// Рецензування на GitHub Pages: кнопка «Увійти» поряд із телефоном, вікно входу,
// коментарі до виділеного тексту (як у Google Docs) і керування логінами для адміністратора.
// Усе будується звичайним DOM у батьківській сторінці; застосунок в iframe не змінюється.
import { isConfigured } from './config';
import { errText, LOGIN_RE, normLogin } from './util';
import type { Profile } from './auth';
import type { Comment, TextAnchor } from './comments';
import type { UserRow } from './admin';
import { Highlighter } from './highlight';

type Filter = 'open' | 'resolved' | 'all';
type Kids = (Node | string | null | undefined | false)[];

/** Маленький помічник для DOM: h('div.cls', {onclick}, ...діти). Текст вставляється як текст (без HTML). */
function h(tag: string, props: Record<string, any> = {}, ...kids: Kids): HTMLElement {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) (el as any)[k] = v;
    else if (k === 'value') (el as any).value = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const CSS = `
  .rv-side { width: 340px; flex: none; display: flex; flex-direction: column; gap: 12px;
    font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #f1e7d6; }
  .rv-side * { box-sizing: border-box; }
  .rv-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .rv-who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #d9c9ad; }
  .rv-who b { color: #f6efe2; font-weight: 600; }
  .rv-btn { font: inherit; border: 1px solid #6b5636; background: #2a231b; color: #f1e7d6; border-radius: 10px;
    padding: 7px 12px; cursor: pointer; }
  .rv-btn:hover { background: #3a3024; }
  .rv-btn:disabled { opacity: .5; cursor: default; }
  .rv-btn.gold { background: linear-gradient(180deg, #d6b06a, #a8772e); color: #1c1712; border-color: #c9a45c; font-weight: 600; }
  .rv-btn.gold:hover { filter: brightness(1.07); }
  .rv-btn.big { padding: 11px 22px; font-size: 15px; border-radius: 12px; }
  .rv-btn.sm { padding: 4px 9px; font-size: 12.5px; border-radius: 8px; }
  .rv-btn.link { border: 0; background: none; color: #d6b06a; padding: 2px 4px; }
  .rv-btn.link:hover { text-decoration: underline; background: none; }
  .rv-hint { color: #b5a387; font-size: 13px; }
  .rv-tabs { display: flex; gap: 4px; background: #241d16; padding: 3px; border-radius: 10px; }
  .rv-tabs button { flex: 1; font: inherit; font-size: 13px; border: 0; border-radius: 8px; padding: 6px; cursor: pointer;
    background: none; color: #b5a387; }
  .rv-tabs button.on { background: #3a3024; color: #f6efe2; }
  .rv-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
  .rv-list::-webkit-scrollbar { width: 6px; } .rv-list::-webkit-scrollbar-thumb { background: #4a3d2c; border-radius: 3px; }
  .rv-card { background: #2a231b; border: 1px solid #3d3226; border-radius: 12px; padding: 10px 12px; cursor: pointer; }
  .rv-card.on { border-color: #d6b06a; box-shadow: 0 0 0 1px #d6b06a inset; }
  .rv-card.done { opacity: .65; }
  .rv-quote { font-size: 13px; color: #b5a387; border-left: 3px solid #e0a83a; padding-left: 8px; margin-bottom: 6px;
    word-break: break-word; }
  .rv-quote mark { background: rgba(255, 200, 40, .3); color: #fff3d6; border-radius: 2px; }
  .rv-where { font-size: 11.5px; color: #8f7f66; margin-bottom: 4px; }
  .rv-meta { font-size: 12px; color: #8f7f66; display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .rv-meta b { color: #e6d6ba; font-weight: 600; }
  .rv-text { margin: 4px 0; white-space: pre-wrap; word-break: break-word; }
  .rv-sugg { margin: 6px 0; padding: 6px 8px; background: #1f2a1d; border-radius: 8px; font-size: 13px; word-break: break-word; }
  .rv-sugg del { color: #e48b7c; } .rv-sugg ins { color: #9ad48a; text-decoration: none; font-weight: 600; }
  .rv-reply { border-top: 1px solid #3d3226; margin-top: 8px; padding-top: 6px; }
  .rv-acts { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
  .rv-miss { font-size: 11.5px; color: #8f7f66; font-style: italic; }
  .rv-side textarea, .rv-side input, .rv-modal input, .rv-modal select {
    width: 100%; font: inherit; color: #f1e7d6; background: #1c1712; border: 1px solid #4a3d2c; border-radius: 8px; padding: 7px 9px; }
  .rv-side textarea { resize: vertical; min-height: 56px; }
  .rv-side textarea:focus, .rv-side input:focus, .rv-modal input:focus, .rv-modal select:focus { outline: none; border-color: #d6b06a; }
  .rv-compose { background: #30271d; border: 1px solid #d6b06a; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; }
  .rv-label { font-size: 12px; color: #b5a387; }
  .rv-err { color: #f09a8a; font-size: 13px; min-height: 1em; }
  .rv-empty { color: #8f7f66; text-align: center; padding: 24px 8px; }
  .rv-fab { position: fixed; z-index: 50; display: none; font: 600 13px system-ui, sans-serif; border: 0; border-radius: 18px;
    padding: 7px 13px; cursor: pointer; background: #d6b06a; color: #1c1712; box-shadow: 0 4px 16px rgba(0,0,0,.45); }
  .rv-back { position: fixed; inset: 0; z-index: 100; background: rgba(10, 8, 6, .62); display: flex; align-items: center; justify-content: center; }
  .rv-modal { width: 320px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow-y: auto; background: #2a231b;
    border: 1px solid #6b5636; border-radius: 16px; padding: 20px; color: #f1e7d6; box-shadow: 0 20px 60px rgba(0,0,0,.6);
    font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 10px; }
  .rv-modal.wide { width: 520px; }
  .rv-modal h2 { margin: 0 0 4px; font: 600 20px 'Cormorant Garamond', Georgia, serif; color: #f6efe2; }
  .rv-modal * { box-sizing: border-box; }
  .rv-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
  .rv-users { display: flex; flex-direction: column; gap: 6px; }
  .rv-user { display: flex; align-items: center; gap: 8px; background: #1f1913; border-radius: 10px; padding: 7px 10px; }
  .rv-user .n { flex: 1; min-width: 0; } .rv-user .n small { color: #8f7f66; display: block; }
  .rv-user.off .n { opacity: .5; }
  .rv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rv-sep { border: 0; border-top: 1px solid #3d3226; margin: 6px 0; width: 100%; }
`;

const fmt = (t: number) =>
  new Date(t).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export interface ReviewHost {
  frame: HTMLIFrameElement;
  stage: HTMLElement;
  refit: () => void;
}

export function mountReview(host: ReviewHost) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ---------- стан ----------
  let me: Profile | null = null;
  let comments: Comment[] = [];
  let users: UserRow[] = [];
  let filter: Filter = 'open';
  let activeId: string | null = null;
  let found = new Set<string>();
  let pending: TextAnchor | null = null;
  let hl: Highlighter | null = null;
  let svc: typeof import('./service') | null = null;
  let stopComments: (() => void) | null = null;
  let stopUsers: (() => void) | null = null;
  let usersModal: HTMLElement | null = null;
  const drafts = new Map<string, string>();
  let listErr = '';

  const side = h('div.rv-side');
  const bar = h('div.rv-bar');
  const body = h('div', { style: 'display:flex;flex-direction:column;gap:10px;flex:1;min-height:0' });
  side.append(bar, body);
  host.stage.append(side);
  host.refit();

  const fab = h('button.rv-fab', { type: 'button' }, '💬 Коментувати') as HTMLButtonElement;
  fab.onmousedown = (e) => e.preventDefault();
  fab.onclick = () => {
    const s = hl?.selection();
    if (!s) return;
    pending = s.anchor;
    fab.style.display = 'none';
    hl?.document.getSelection()?.removeAllRanges();
    renderBody();
    (body.querySelector('.rv-compose textarea') as HTMLTextAreaElement | null)?.focus();
  };
  document.body.append(fab);

  const loadSvc = async () => (svc ??= await import('./service'));

  // ---------- iframe ----------
  const attach = () => {
    if (hl || !host.frame.contentDocument?.body) return;
    hl = new Highlighter(host.frame);
    hl.onFound = (ids) => {
      const changed = ids.size !== found.size || [...ids].some((x) => !found.has(x));
      found = ids;
      if (changed) renderList();
    };
    hl.onPick = (id) => select(id, false);
    hl.setSelectable(!!me);
    syncTargets();
    const d = hl.document;
    const upd = () => placeFab();
    d.addEventListener('selectionchange', upd);
    d.addEventListener('scroll', upd, true);
    window.addEventListener('resize', upd);
  };
  if (host.frame.contentDocument?.readyState === 'complete') attach();
  host.frame.addEventListener('load', attach);

  function placeFab() {
    const s = me && hl ? hl.selection() : null;
    if (!s || (s.rect.width === 0 && s.rect.height === 0)) {
      fab.style.display = 'none';
      return;
    }
    const fr = host.frame.getBoundingClientRect();
    const k = fr.width / (host.frame.clientWidth || fr.width);
    let top = fr.top + s.rect.top * k - 40;
    if (top < fr.top + 4) top = fr.top + s.rect.bottom * k + 8;
    top = Math.min(Math.max(top, fr.top + 4), fr.bottom - 40);
    fab.style.display = 'block';
    const left = Math.min(Math.max(fr.left + (s.rect.left + s.rect.width / 2) * k - fab.offsetWidth / 2, fr.left + 4), fr.right - fab.offsetWidth - 4);
    fab.style.left = left + 'px';
    fab.style.top = top + 'px';
  }

  function syncTargets() {
    hl?.setTargets(comments.map((c) => ({ id: c.id, quote: c.quote, prefix: c.prefix, suffix: c.suffix, resolved: c.resolved })));
    hl?.setActive(activeId);
  }

  function select(id: string | null, reveal: boolean) {
    activeId = id;
    hl?.setActive(id);
    const c = comments.find((x) => x.id === id);
    if (c && c.resolved && filter === 'open') filter = 'all';
    renderList();
    if (id && reveal) hl?.reveal(id);
    if (id && !reveal) body.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---------- верхня панель ----------
  function renderBar() {
    bar.replaceChildren();
    if (!me) {
      bar.append(h('button.rv-btn.gold.big', { type: 'button', onclick: openLogin }, 'Увійти'));
      return;
    }
    const admin = me.role === 'admin';
    bar.append(
      h('div.rv-who', { title: me.login }, h('b', {}, me.name), me.role === 'admin' ? ' · адміністратор' : ' · рецензент'),
      ...(admin
        ? [
            h('button.rv-btn.sm', { type: 'button', onclick: openUsers }, 'Користувачі'),
            h('button.rv-btn.sm', { type: 'button', onclick: exportJson, title: 'Завантажити всі коментарі файлом' }, 'Експорт'),
          ]
        : []),
      h('button.rv-btn.sm', { type: 'button', onclick: () => svc?.signOutUser() }, 'Вийти'),
    );
  }

  // ---------- коментарі ----------
  function renderBody() {
    body.replaceChildren();
    if (!me) return;
    if (pending) body.append(composer(pending));
    else body.append(h('div.rv-hint', {}, 'Виділіть слово чи фрагмент тексту в застосунку і натисніть «💬 Коментувати».'));
    const tabs = h('div.rv-tabs');
    const n = (f: Filter) => comments.filter((c) => (f === 'all' ? true : f === 'open' ? !c.resolved : c.resolved)).length;
    for (const [f, label] of [
      ['open', 'Відкриті'],
      ['resolved', 'Виправлені'],
      ['all', 'Усі'],
    ] as [Filter, string][]) {
      tabs.append(
        h('button', { type: 'button', class: filter === f ? 'on' : '', onclick: () => ((filter = f), renderBody()) }, `${label} (${n(f)})`),
      );
    }
    body.append(tabs, h('div.rv-list'));
    renderList();
  }

  function composer(a: TextAnchor): HTMLElement {
    const text = h('textarea', { placeholder: 'Коментар: що не так?', rows: 3 }) as HTMLTextAreaElement;
    const sugg = h('input', { placeholder: 'Замінити на… (необов’язково)' }) as HTMLInputElement;
    const err = h('div.rv-err');
    const save = h('button.rv-btn.gold.sm', { type: 'button' }, 'Зберегти') as HTMLButtonElement;
    save.onclick = async () => {
      if (!text.value.trim() && !sugg.value.trim()) return void (err.textContent = 'Напишіть коментар або пропозицію заміни');
      save.disabled = true;
      try {
        await (await loadSvc()).addComment(me!, a, text.value, sugg.value);
        pending = null;
        filter = filter === 'resolved' ? 'open' : filter;
        renderBody();
      } catch (e) {
        err.textContent = errText(e);
        save.disabled = false;
      }
    };
    text.onkeydown = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save.click();
      if (e.key === 'Escape') ((pending = null), renderBody());
    };
    return h(
      'div.rv-compose',
      {},
      a.where && h('div.rv-where', {}, a.where),
      quoteEl(a),
      text,
      h('div.rv-label', {}, 'Пропозиція заміни виділеного:'),
      sugg,
      err,
      h('div.rv-row', {}, h('button.rv-btn.sm', { type: 'button', onclick: () => ((pending = null), renderBody()) }, 'Скасувати'), save),
    );
  }

  function quoteEl(a: { quote: string; prefix: string; suffix: string }) {
    const cut = (s: string, n: number, left: boolean) => (s.length > n ? (left ? '…' + s.slice(-n) : s.slice(0, n) + '…') : s);
    // Контекст показуємо лише в межах того самого абзацу (абзаци в індексі розділені «\n»).
    const pre = a.prefix.slice(a.prefix.lastIndexOf('\n') + 1);
    const nl = a.suffix.indexOf('\n');
    const suf = nl < 0 ? a.suffix : a.suffix.slice(0, nl);
    const flat = a.quote.replace(/\s*\n\s*/g, ' ');
    const q = flat.length > 220 ? flat.slice(0, 200) + '…' : flat;
    return h('div.rv-quote', {}, cut(pre, 24, true), h('mark', {}, q), cut(suf, 24, false));
  }

  function card(c: Comment): HTMLElement {
    const on = c.id === activeId;
    const canDel = me && (me.uid === c.authorUid || me.role === 'admin');
    const el = h('div.rv-card' + (on ? '.on' : '') + (c.resolved ? '.done' : ''), { 'data-id': c.id });
    el.onclick = (e) => {
      if ((e.target as HTMLElement).closest('button, textarea, input')) return;
      select(on ? null : c.id, !on);
    };
    el.append(
      c.where ? h('div.rv-where', {}, c.where) : '',
      quoteEl(c),
      h('div.rv-meta', {}, h('b', {}, c.author || c.authorLogin), fmt(c.createdAt), c.resolved && `· ✓ виправлено${c.resolvedBy ? ' (' + c.resolvedBy + ')' : ''}`),
      c.text ? h('div.rv-text', {}, c.text) : '',
      c.suggestion ? h('div.rv-sugg', {}, h('del', {}, c.quote.length > 80 ? c.quote.slice(0, 80) + '…' : c.quote.replace(/\s*\n\s*/g, ' ')), ' → ', h('ins', {}, c.suggestion)) : '',
    );
    for (const r of c.replies)
      el.append(h('div.rv-reply', {}, h('div.rv-meta', {}, h('b', {}, r.author), fmt(r.at)), h('div.rv-text', {}, r.text)));
    if (!found.has(c.id)) el.append(h('div.rv-miss', {}, 'Цей фрагмент не на поточному екрані застосунку'));
    if (on) {
      const ta = h('textarea', { placeholder: 'Відповісти…', rows: 2, value: drafts.get(c.id) ?? '' }) as HTMLTextAreaElement;
      ta.oninput = () => drafts.set(c.id, ta.value);
      const send = h('button.rv-btn.gold.sm', { type: 'button' }, 'Відповісти') as HTMLButtonElement;
      send.onclick = async () => {
        if (!ta.value.trim()) return;
        send.disabled = true;
        try {
          await (await loadSvc()).addReply(me!, c.id, ta.value);
          drafts.delete(c.id);
        } catch (e) {
          alert(errText(e));
          send.disabled = false;
        }
      };
      ta.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send.click();
      };
      el.append(
        h('div', { style: 'margin-top:8px' }, ta),
        h(
          'div.rv-acts',
          {},
          send,
          h(
            'button.rv-btn.sm',
            { type: 'button', onclick: async () => svc?.setResolved(me!, c.id, !c.resolved).catch((e) => alert(errText(e))) },
            c.resolved ? 'Відкрити знову' : '✓ Виправлено',
          ),
          canDel &&
            h(
              'button.rv-btn.link.sm',
              {
                type: 'button',
                onclick: async () => {
                  if (!confirm('Видалити коментар?')) return;
                  await svc?.removeComment(c.id).catch((e) => alert(errText(e)));
                  if (activeId === c.id) select(null, false);
                },
              },
              'Видалити',
            ),
        ),
      );
    }
    return el;
  }

  function renderList() {
    const list = body.querySelector('.rv-list');
    if (!list) return;
    const focused = document.activeElement as HTMLTextAreaElement | null;
    const keepFocus = focused?.tagName === 'TEXTAREA' && !!focused.closest('.rv-card');
    const shown = comments.filter((c) => (filter === 'all' ? true : filter === 'open' ? !c.resolved : c.resolved));
    // Спершу ті, що є на поточному екрані.
    shown.sort((a, b) => Number(found.has(b.id)) - Number(found.has(a.id)));
    list.replaceChildren(
      ...(listErr ? [h('div.rv-err', {}, listErr)] : []),
      ...(shown.length ? shown.map(card) : [h('div.rv-empty', {}, filter === 'resolved' ? 'Виправлених немає' : 'Коментарів поки немає')]),
    );
    if (keepFocus) {
      const ta = list.querySelector('.rv-card.on textarea') as HTMLTextAreaElement | null;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }
    // Лічильники на вкладках.
    const tabs = body.querySelectorAll('.rv-tabs button');
    const counts = [comments.filter((c) => !c.resolved).length, comments.filter((c) => c.resolved).length, comments.length];
    const labels = ['Відкриті', 'Виправлені', 'Усі'];
    tabs.forEach((b, i) => (b.textContent = `${labels[i]} (${counts[i]})`));
  }

  // ---------- модальні вікна ----------
  function modal(content: HTMLElement, onClose?: () => void): () => void {
    const back = h('div.rv-back', {}, content);
    const close = () => {
      back.remove();
      document.removeEventListener('keydown', esc);
      onClose?.();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    // Лише блок: стрілка з `false` у onmousedown скасовує фокусування полів у вікні.
    back.onmousedown = (e) => {
      if (e.target === back) close();
    };
    document.addEventListener('keydown', esc);
    document.body.append(back);
    return close;
  }

  function openLogin() {
    if (!isConfigured()) {
      const close = modal(
        h(
          'div.rv-modal',
          {},
          h('h2', {}, 'Вхід'),
          h('div', {}, 'Рецензування ще не налаштоване: не вказано конфігурацію Firebase (src/review/config.ts).'),
          h('div.rv-row', {}, h('button.rv-btn.gold', { type: 'button', onclick: () => close() }, 'Зрозуміло')),
        ),
      );
      return;
    }
    const login = h('input', { placeholder: 'Логін', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false' }) as HTMLInputElement;
    const pass = h('input', { type: 'password', placeholder: 'Пароль', autocomplete: 'current-password' }) as HTMLInputElement;
    const err = h('div.rv-err');
    const go = h('button.rv-btn.gold', { type: 'submit' }, 'Увійти') as HTMLButtonElement;
    const form = h('form.rv-modal', {}, h('h2', {}, 'Вхід для рецензентів'), login, pass, err,
      h('div.rv-row', {}, h('button.rv-btn', { type: 'button', onclick: () => close() }, 'Скасувати'), go)) as HTMLFormElement;
    form.onsubmit = async (e) => {
      e.preventDefault();
      err.textContent = '';
      const l = normLogin(login.value);
      if (!l || !pass.value) return void (err.textContent = 'Введіть логін і пароль');
      go.disabled = true;
      go.textContent = 'Вхід…';
      try {
        const s = await loadSvc();
        loginWaiter = (ok, e2) => {
          loginWaiter = null;
          if (ok) close();
          else {
            err.textContent = errText(e2);
            go.disabled = false;
            go.textContent = 'Увійти';
          }
        };
        await s.signIn(l, pass.value);
      } catch (e2) {
        loginWaiter = null;
        err.textContent = errText(e2);
        go.disabled = false;
        go.textContent = 'Увійти';
      }
    };
    const close = modal(form, () => (loginWaiter = null));
    setTimeout(() => login.focus(), 0);
  }
  let loginWaiter: ((ok: boolean, e?: unknown) => void) | null = null;

  function openUsers() {
    if (!me || me.role !== 'admin' || !svc) return;
    const s = svc;
    const list = h('div.rv-users');
    const login = h('input', { placeholder: 'Логін (латиницею)', autocapitalize: 'off', spellcheck: 'false' }) as HTMLInputElement;
    const name = h('input', { placeholder: 'Ім’я (як показувати)' }) as HTMLInputElement;
    const pass = h('input', { type: 'text', placeholder: 'Пароль (від 6 символів)', autocomplete: 'off' }) as HTMLInputElement;
    const role = h('select', {}, h('option', { value: 'reviewer' }, 'Рецензент'), h('option', { value: 'admin' }, 'Адміністратор')) as HTMLSelectElement;
    const err = h('div.rv-err');
    const add = h('button.rv-btn.gold', { type: 'button' }, 'Додати') as HTMLButtonElement;
    add.onclick = async () => {
      err.textContent = '';
      const l = normLogin(login.value);
      if (!LOGIN_RE.test(l)) return void (err.textContent = 'Логін: 3–32 символи — латиниця, цифри, «.», «-», «_»');
      add.disabled = true;
      try {
        await s.createUser(l, pass.value, name.value, role.value as 'admin' | 'reviewer', me!.login);
        login.value = name.value = pass.value = '';
        err.style.color = '#9ad48a';
        err.textContent = `Логін «${l}» створено`;
        setTimeout(() => (err.style.color = ''), 3000);
      } catch (e) {
        err.style.color = '';
        err.textContent = e instanceof Error && !(e as any).code ? e.message : errText(e);
      } finally {
        add.disabled = false;
      }
    };
    const content = h(
      'div.rv-modal.wide',
      {},
      h('h2', {}, 'Користувачі'),
      h('div.rv-hint', {}, 'Хто може входити кнопкою «Увійти» і залишати коментарі.'),
      list,
      h('hr.rv-sep'),
      h('div.rv-label', {}, 'Новий логін'),
      h('div.rv-grid', {}, login, name, pass, role),
      err,
      h('div.rv-hint', {}, 'Пароль потім змінити не можна: щоб замінити, вимкніть старий логін і створіть новий.'),
      h('div.rv-row', {}, h('button.rv-btn', { type: 'button', onclick: () => close() }, 'Закрити'), add),
    );
    usersModal = list;
    renderUsers();
    stopUsers?.();
    stopUsers = s.watchUsers(
      (rows) => ((users = rows), renderUsers()),
      (e) => (list.replaceChildren(h('div.rv-err', {}, errText(e)))),
    );
    const close = modal(content, () => {
      stopUsers?.();
      stopUsers = null;
      usersModal = null;
    });
  }

  function renderUsers() {
    if (!usersModal || !svc) return;
    const s = svc;
    usersModal.replaceChildren(
      ...users.map((u) => {
        const self = u.uid === me?.uid;
        return h(
          'div.rv-user' + (u.active ? '' : '.off'),
          {},
          h('div.n', {}, u.name || u.login, h('small', {}, `${u.login} · ${u.role === 'admin' ? 'адміністратор' : 'рецензент'}${u.active ? '' : ' · вимкнено'}`)),
          !self &&
            h(
              'button.rv-btn.sm',
              { type: 'button', onclick: () => s.setRole(u.uid, u.role === 'admin' ? 'reviewer' : 'admin').catch((e) => alert(errText(e))) },
              u.role === 'admin' ? 'Зробити рецензентом' : 'Зробити адміном',
            ),
          !self &&
            h(
              'button.rv-btn.sm',
              { type: 'button', onclick: () => s.setActive(u.uid, !u.active).catch((e) => alert(errText(e))) },
              u.active ? 'Вимкнути' : 'Увімкнути',
            ),
          self && h('span.rv-hint', {}, 'це ви'),
        );
      }),
    );
  }

  function exportJson() {
    const data = comments.map(({ id, where, quote, prefix, suffix, text, suggestion, author, createdAt, resolved, resolvedBy, replies }) => ({
      id, where, quote, prefix, suffix, text, suggestion, author, createdAt: new Date(createdAt).toISOString(), resolved, resolvedBy,
      replies: replies.map((r) => ({ author: r.author, text: r.text, at: new Date(r.at).toISOString() })),
    }));
    const a = h('a', {
      href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })),
      download: `comments-${new Date().toISOString().slice(0, 10)}.json`,
    }) as HTMLAnchorElement;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- вхід / вихід ----------
  function setUser(p: Profile | null) {
    me = p;
    hl?.setSelectable(!!p);
    stopComments?.();
    stopComments = null;
    comments = [];
    pending = null;
    activeId = null;
    listErr = '';
    if (p && svc) {
      stopComments = svc.watchComments(
        (list) => {
          comments = list;
          listErr = '';
          syncTargets();
          renderList();
        },
        (e) => ((listErr = errText(e)), renderList()),
      );
    }
    syncTargets();
    placeFab();
    renderBar();
    renderBody();
    host.refit();
  }

  renderBar();
  if (isConfigured()) {
    // Відновити сесію, якщо користувач уже входив у цьому браузері.
    loadSvc().then((s) =>
      s.watchUser((p, e) => {
        setUser(p);
        if (p || e) loginWaiter?.(!!p, e);
      }),
    );
  }
}
