// Підсвічування прокоментованих фрагментів усередині iframe із застосунком.
// Застосунок не змінюється: шукаємо цитати в текстових вузлах його документа
// і підсвічуємо через CSS Custom Highlight API (без зміни DOM React Native).
import type { TextAnchor } from './comments';

const CTX = 32;
const MAX_QUOTE = 1000;

interface Index {
  text: string;
  nodes: Text[];
  starts: number[];
  pos: Map<Text, number>;
}

export interface Target {
  id: string;
  quote: string;
  prefix: string;
  suffix: string;
  resolved: boolean;
}

/** Довжина спільного кінця рядків a і b. */
function tailMatch(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function headMatch(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

export class Highlighter {
  private doc: Document;
  private win: Window & typeof globalThis;
  private idx: Index | null = null;
  private targets: Target[] = [];
  private ranges = new Map<string, Range>();
  private active: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private supported: boolean;
  onFound: (ids: Set<string>) => void = () => {};
  onPick: (id: string) => void = () => {};

  constructor(private frame: HTMLIFrameElement) {
    this.doc = frame.contentDocument!;
    this.win = frame.contentWindow as Window & typeof globalThis;
    this.supported = !!(this.win.CSS && (this.win.CSS as any).highlights && (this.win as any).Highlight);
    const st = this.doc.createElement('style');
    st.textContent = `
      ::highlight(rv) { background-color: rgba(255, 200, 40, .42); }
      ::highlight(rv-active) { background-color: rgba(255, 130, 0, .62); }
      html.rv-on, html.rv-on * { -webkit-user-select: text !important; user-select: text !important; }
    `;
    this.doc.head.appendChild(st);
    new MutationObserver(() => this.schedule()).observe(this.doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    this.doc.addEventListener('click', (e) => this.click(e), true);
  }

  /** Дозволити виділення тексту (лише для авторизованих). */
  setSelectable(on: boolean) {
    this.doc.documentElement.classList.toggle('rv-on', on);
  }

  setTargets(t: Target[]) {
    this.targets = t;
    this.refresh();
  }

  setActive(id: string | null) {
    this.active = id;
    this.paint();
  }

  private schedule() {
    this.idx = null;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.refresh();
    }, 250);
  }

  private index(): Index {
    if (this.idx) return this.idx;
    const nodes: Text[] = [];
    const starts: number[] = [];
    const pos = new Map<Text, number>();
    let text = '';
    const body = this.doc.body;
    if (body) {
      const w = this.doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const tag = n.parentElement?.tagName;
          return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        },
      });
      for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
        pos.set(n, nodes.length);
        nodes.push(n);
        starts.push(text.length);
        // Роздільник між текстовими вузлами: не дає цитаті «склеїтися» з сусіднім блоком.
        text += n.data + '\n';
      }
    }
    return (this.idx = { text, nodes, starts, pos });
  }

  /** Діапазон за глобальними зміщеннями в тексті документа. */
  private rangeAt(ix: Index, s: number, e: number): Range {
    const find = (off: number, end: boolean) => {
      let lo = 0;
      let hi = ix.starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ix.starts[mid] < off || (!end && ix.starts[mid] === off)) lo = mid;
        else hi = mid - 1;
      }
      return { node: ix.nodes[lo], off: off - ix.starts[lo] };
    };
    const a = find(s, false);
    const b = find(e, true);
    const r = this.doc.createRange();
    r.setStart(a.node, Math.min(a.off, a.node.length));
    r.setEnd(b.node, Math.min(b.off, b.node.length));
    return r;
  }

  private visible(r: Range): boolean {
    const el = r.startContainer.parentElement;
    return !!el && el.getClientRects().length > 0;
  }

  /** Найкраще входження цитати: з найдовшим збігом контексту, видиме — у пріоритеті. */
  private locate(t: { quote: string; prefix: string; suffix: string }): Range | null {
    const ix = this.index();
    if (!t.quote) return null;
    let best: { s: number; score: number } | null = null;
    let from = 0;
    for (let k = 0; k < 300; k++) {
      const s = ix.text.indexOf(t.quote, from);
      if (s < 0) break;
      from = s + 1;
      const e = s + t.quote.length;
      let score = tailMatch(ix.text.slice(Math.max(0, s - CTX), s), t.prefix) + headMatch(ix.text.slice(e, e + CTX), t.suffix);
      if (this.visible(this.rangeAt(ix, s, e))) score += 1000;
      if (!best || score > best.score) best = { s, score };
    }
    return best ? this.rangeAt(ix, best.s, best.s + t.quote.length) : null;
  }

  refresh() {
    this.ranges.clear();
    for (const t of this.targets) {
      const r = this.locate(t);
      if (r) this.ranges.set(t.id, r);
    }
    this.paint();
    this.onFound(new Set(this.ranges.keys()));
  }

  private paint() {
    if (!this.supported) return;
    const H = (this.win as any).Highlight;
    const reg = (this.win.CSS as any).highlights as Map<string, unknown>;
    const open: Range[] = [];
    const act: Range[] = [];
    for (const t of this.targets) {
      const r = this.ranges.get(t.id);
      if (!r) continue;
      if (t.id === this.active) act.push(r);
      else if (!t.resolved) open.push(r);
    }
    reg.set('rv', new H(...open));
    reg.set('rv-active', new H(...act));
  }

  /** Прокрутити до фрагмента коментаря. false — його немає на поточному екрані. */
  reveal(id: string): boolean {
    const r = this.ranges.get(id);
    if (!r || !this.visible(r)) return false;
    r.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }

  private click(e: MouseEvent) {
    const sel = this.doc.getSelection();
    if (sel && !sel.isCollapsed) return;
    const d = this.doc as any;
    let node: Node | null = null;
    let off = 0;
    if (d.caretPositionFromPoint) {
      const p = d.caretPositionFromPoint(e.clientX, e.clientY);
      if (p) ({ offsetNode: node, offset: off } = p);
    } else if (d.caretRangeFromPoint) {
      const r = d.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) ({ startContainer: node, startOffset: off } = r);
    }
    if (!node) return;
    for (const t of this.targets) {
      const r = this.ranges.get(t.id);
      if (r && (!t.resolved || t.id === this.active) && r.isPointInRange(node, off)) return this.onPick(t.id);
    }
  }

  /** Глобальне зміщення межі діапазону (вузол + зміщення) у тексті документа. */
  private offsetOf(ix: Index, node: Node, off: number): number {
    if (node.nodeType === Node.TEXT_NODE) {
      const i = ix.pos.get(node as Text);
      if (i !== undefined) return ix.starts[i] + off;
    }
    const b = this.doc.createRange();
    b.setStart(node, off);
    for (let i = 0; i < ix.nodes.length; i++) if (b.comparePoint(ix.nodes[i], 0) >= 0) return ix.starts[i];
    return ix.text.length;
  }

  /** Поточне виділення в застосунку: прив'язка і прямокутник (у координатах iframe). */
  selection(): { anchor: TextAnchor; rect: DOMRect } | null {
    const sel = this.doc.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    this.idx = null;
    const ix = this.index();
    let s = this.offsetOf(ix, r.startContainer, r.startOffset);
    let e = this.offsetOf(ix, r.endContainer, r.endOffset);
    while (s < e && /\s/.test(ix.text[s])) s++;
    while (e > s && /\s/.test(ix.text[e - 1])) e--;
    if (e <= s || e - s > MAX_QUOTE) return null;
    return {
      anchor: {
        quote: ix.text.slice(s, e),
        prefix: ix.text.slice(Math.max(0, s - CTX), s),
        suffix: ix.text.slice(e, e + CTX),
        where: this.screenTitle(),
      },
      rect: r.getBoundingClientRect(),
    };
  }

  /** Назва екрана: найбільший текст у верхній частині вікна застосунку. */
  private screenTitle(): string {
    const ix = this.index();
    let best = '';
    let size = 0;
    for (const n of ix.nodes) {
      const el = n.parentElement;
      const s = n.data.trim();
      if (!el || s.length < 2) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 || rect.top < 0 || rect.top > 110) continue;
      const fs = parseFloat(this.win.getComputedStyle(el).fontSize) || 0;
      if (fs > size) {
        size = fs;
        best = s;
      }
    }
    return best.slice(0, 80);
  }

  get document() {
    return this.doc;
  }
  get iframe() {
    return this.frame;
  }
}
