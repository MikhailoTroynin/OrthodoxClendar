// Біблія (переклад Патріарха Філарета): доступ до глав, перехресні посилання й розбір посилань на кшталт «Лк. 1:39–49, 56».
import { BOOKS, LOAD } from '../data/bible/books';
import type { BChap } from '../data/bible/types';
import type { Book } from '../data/prayers';

export { BOOKS };

/** Групи книг: назви укр./англ. */
export const GROUPS: [string, string][] = [
  ['П’ятикнижжя', 'Pentateuch'],
  ['Історичні книги', 'Historical books'],
  ['Повчальні книги', 'Wisdom books'],
  ['Великі пророки', 'Major prophets'],
  ['Малі пророки', 'Minor prophets'],
  ['Євангеліє', 'Gospels'],
  ['Діяння', 'Acts'],
  ['Соборні послання', 'Catholic Epistles'],
  ['Послання апостола Павла', 'Epistles of St Paul'],
  ['Одкровення', 'Revelation'],
];

const cache: BChap[][] = [];
/** Глави книги b (модуль із текстом завантажується при першому зверненні). */
export const bookData = (b: number): BChap[] => (cache[b] ??= LOAD[b]());

export interface Verse {
  n: number;
  t: string;
  /** Перехресні посилання. */
  x: Ref[];
  notes: string[];
  /** Глава — у фрагментах, що охоплюють кілька глав. */
  c?: number;
}

/** Посилання на місце Писання: книга b, від глави c вірша v до глави c2 вірша v2 (включно). */
export interface Ref {
  b: number;
  c: number;
  v: number;
  c2: number;
  v2: number;
  label: string;
}

const verseCache = new Map<string, { h?: string; vs: Verse[] }>();

/** Вірші глави c (від 1) книги b. */
export const chapter = (b: number, c: number): { h?: string; vs: Verse[] } => {
  const key = `${b}.${c}`;
  const hit = verseCache.get(key);
  if (hit) return hit;
  const ch = bookData(b)[c - 1];
  if (!ch) return { vs: [] };
  let e = 1;
  const vs = ch.v.map((it) => {
    const [n, t] = typeof it === 'string' ? [e, it] : it;
    e = n + 1;
    return { n, t, x: (ch.x?.[n] ?? '').split('|').filter(Boolean).map(xref), notes: ch.n?.[n] ?? [] };
  });
  const res = { h: ch.h, vs };
  verseCache.set(key, res);
  return res;
};

/** "книга.глава.вірш[-кінець|:вірш]" → Ref. */
const xref = (s: string): Ref => {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:([-:])(\d+))?$/.exec(s)!;
  const b = +m[1], c = +m[2], v = +m[3];
  const v2 = m[4] === '-' ? +m[5] : v;
  const tail = m[4] === '-' ? `–${m[5]}` : m[4] === ':' ? `, ${m[5]}` : '';
  return { b, c, v, c2: c, v2, label: `${BOOKS[b][2]} ${c}:${v}${tail}` };
};

/** Назва книги мовою інтерфейсу («Євангеліє від Луки» для Євангелій). */
export const bookName = (b: number, ul: boolean) =>
  BOOKS[b][4] === 5 ? (ul ? 'Євангеліє в' + BOOKS[b][1].slice(1) : 'Gospel of ' + BOOKS[b][3]) : ul ? BOOKS[b][1] : BOOKS[b][3];

/** Заголовок глави: «Псалом 50» або «Глава 3». */
export const chapTitle = (b: number, c: number, ul: boolean) =>
  BOOKS[b][0] === 'ps' ? `${ul ? 'Псалом' : 'Psalm'} ${c}` : `${ul ? 'Глава' : 'Chapter'} ${c}`;

/** Книга для списків екрана «Письмо». */
export const bookItem = (b: number): Book => ({ u: BOOKS[b][1], e: BOOKS[b][3], ch: BOOKS[b][5], i: b });

/** Група книг для списків (або сама книга, якщо вона в групі одна). */
export const groupItem = (g: number): Book => {
  const ix = BOOKS.map((x, i) => (x[4] === g ? i : -1)).filter((i) => i >= 0);
  return ix.length === 1 ? bookItem(ix[0]) : { u: GROUPS[g][0], e: GROUPS[g][1], books: ix.map(bookItem) };
};

/** Вірші між двома місцями (включно), можливо через кілька глав. */
export const passage = (r: Ref): Verse[] => {
  const out: Verse[] = [];
  const last = bookData(r.b).length;
  for (let c = r.c; c <= Math.min(r.c2, last); c++) {
    for (const v of chapter(r.b, c).vs) {
      if ((c > r.c || v.n >= r.v) && (c < r.c2 || v.n <= r.v2)) out.push({ ...v, c });
    }
  }
  return out;
};

// ——— Розбір посилань у тексті ———

const norm = (s: string) => s.toLowerCase().replace(/[.\s’ʼ']/g, '');
const ABBR = new Map<string, number>();
BOOKS.forEach(([slug, u, ab, e], i) => {
  ABBR.set(norm(ab), i);
  ABBR.set(norm(slug), i);
  ABBR.set(norm(u.replace(/\*$/, '')), i);
  ABBR.set(norm(e.replace(/\*$/, '').replace(/ \(.*\)$/, '')), i);
});
const idx = (slug: string) => BOOKS.findIndex((b) => b[0] === slug);
// Скорочення календаря й інших джерел, що відрізняються від сайту.
for (const [a, slug] of [
  ['Мт', 'matt'], ['Мтф', 'matt'], ['Мф', 'matt'], ['Ін', 'john'], ['Йн', 'john'], ['Прип', 'prov'], ['Йоїл', 'joel'], ['Іоїл', 'joel'],
  ['Юд', 'jude'], ['Іуд', 'jude'], ['Фил', 'philem'], ['Флм', 'philem'], ['Флп', 'phil'], ['Дії', 'acts'], ['Діян', 'acts'],
  ['Об', 'rev'], ['Одкр', 'rev'], ['Як', 'jas'], ['Єр', 'jer'], ['Пс', 'ps'], ['Іс', 'isa'], ['Ісая', 'isa'],
  ['Mt', 'matt'], ['Mk', 'mark'], ['Lk', 'luke'], ['Jn', 'john'], ['Gen', 'gen'], ['Ex', 'exod'], ['Is', 'isa'], ['Isa', 'isa'],
  ['Prov', 'prov'], ['Wis', 'wisd'], ['Ezek', 'ezek'], ['Zech', 'zech'], ['Mal', 'mal'], ['Rom', 'rom'], ['Gal', 'gal'],
  ['Eph', 'eph'], ['Phil', 'phil'], ['Col', 'col'], ['Heb', 'heb'], ['Jas', 'jas'], ['Tit', 'titus'], ['Phlm', 'philem'],
  ['Rev', 'rev'], ['Acts', 'acts'], ['Ps', 'ps'], ['Jude', 'jude'],
  ['1Cor', '1-cor'], ['2Cor', '2-cor'], ['1Thess', '1-thess'], ['2Thess', '2-thess'], ['1Tim', '1-tim'], ['2Tim', '2-tim'],
  ['1Pet', '1-pet'], ['2Pet', '2-pet'], ['1Jn', '1-john'], ['2Jn', '2-john'], ['3Jn', '3-john'],
] as const) ABBR.set(norm(a), idx(slug));

const D = '[–—-]';
const ITEM = `\\d+(?::\\d+)?(?:\\s*${D}\\s*\\d+(?::\\d+)?)?`;
const LIST = `\\d+:\\d+(?:\\s*${D}\\s*\\d+(?::\\d+)?)?(?:\\s*,\\s*${ITEM})*`;
// [книга] список; книга — «1 Кор.», «Лк.», «Посл. Єр.», «Gal».
const RX = new RegExp(`((?:[1-4]\\s?)?(?:Посл\\.\\s?)?[A-Za-zА-ЯІЇЄҐа-яіїєґ’ʼ']+\\.?\\s*)?(${LIST})`, 'g');

/** Розбирає список «1:39–49, 56» / «5:22–6:2» книги b. */
const parseList = (b: number, s: string): Ref[] => {
  const out: Ref[] = [];
  let c = 0;
  for (const it of s.split(/\s*,\s*/)) {
    const m = new RegExp(`^(\\d+)(?::(\\d+))?(?:\\s*${D}\\s*(\\d+)(?::(\\d+))?)?$`).exec(it.trim());
    if (!m) continue;
    let c1: number, v1: number;
    if (m[2] !== undefined) [c1, v1] = [+m[1], +m[2]];
    else if (c) [c1, v1] = [c, +m[1]];
    else continue;
    let c2 = c1, v2 = v1;
    if (m[3] !== undefined) [c2, v2] = m[4] !== undefined ? [+m[3], +m[4]] : [c1, +m[3]];
    c = c2;
    out.push({ b, c: c1, v: v1, c2, v2, label: '' });
  }
  return out;
};

/** Частини тексту: звичайний рядок або посилання з розібраними місцями. */
export type Tok = string | { text: string; refs: Ref[] };

/** Знаходить у тексті посилання на Писання. Список без назви книги після «;» належить попередній книзі. */
export const tokenize = (s: string): Tok[] => {
  const out: Tok[] = [];
  let pos = 0;
  let prev = -1;
  for (const m of s.matchAll(RX)) {
    const start = m.index!;
    let b = -1;
    let bookPart = m[1] ?? '';
    if (bookPart) {
      b = ABBR.get(norm(bookPart)) ?? -1;
      if (b < 0) bookPart = ''; // не книга (напр. «Утр.») — лишаємо як текст
    }
    if (b < 0) {
      // продовження попередньої книги: «Лк. 10:38–42; 11:27–28»
      if (prev < 0 || !/[;,]\s*$/.test(s.slice(pos, start + (m[1]?.length ?? 0)))) continue;
      b = prev;
    }
    const refStart = start + (m[1]?.length ?? 0) - bookPart.length;
    const refs = parseList(b, m[2]);
    if (!refs.length || refs.some((r) => r.c < 1 || r.c > BOOKS[r.b][5])) continue;
    if (refStart > pos) out.push(s.slice(pos, refStart));
    const text = s.slice(refStart, start + m[0].length);
    for (const r of refs) r.label = `${BOOKS[b][2]} ${r.c}:${r.v}${r.c2 !== r.c ? `–${r.c2}:${r.v2}` : r.v2 !== r.v ? `–${r.v2}` : ''}`;
    out.push({ text, refs });
    pos = start + m[0].length;
    prev = b;
  }
  if (pos < s.length) out.push(s.slice(pos));
  return out;
};

/** Усі місця Писання, згадані в рядку. */
export const parseRefs = (s: string): Ref[] => tokenize(s).flatMap((t) => (typeof t === 'string' ? [] : t.refs));
