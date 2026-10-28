// Нечіткий пошук молитов за назвою: прощає помилки, російське чи українське написання й інші закінчення
// («Николаю» знаходить «Миколаю», «акафист» — «акафіст»).

/** Літери, які в назвах пишуть по-різному (укр., рос., церковнослов'янською), зводимо до однієї. */
const FOLD: Record<string, string> = {
  і: 'и', ї: 'и', й: 'и', ы: 'и', ѣ: 'е', є: 'е', э: 'е', ё: 'е', ґ: 'г', ъ: '', ь: '', ѳ: 'ф', ѵ: 'и', ѡ: 'о',
};

/** Слова рядка без наголосів, апострофів і розділових знаків. */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[̀-ͯ҃-҉’ʼ'`]/g, '')
    .replace(/[іїйыѣєэёґъьѳѵѡ]/g, (c) => FOLD[c])
    .split(/[^0-9a-zа-я]+/)
    .filter(Boolean);
}

/** Скільки помилок прощаємо слову запиту такої довжини. */
const allow = (n: number) => (n <= 2 ? 0 : n <= 4 ? 1 : n <= 7 ? 2 : 3);

/** Найменша кількість правок (з переставлянням сусідніх літер), щоб слово запиту q стало початком слова w. */
function prefixDist(q: string, w: string, max: number): number {
  const m = q.length;
  const n = w.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const c = q[i - 1] === w[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (i > 1 && j > 1 && q[i - 1] === w[j - 2] && q[i - 2] === w[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return Infinity;
    prev2 = prev;
    prev = cur;
  }
  // Запит цілком використано; слово може тривати далі (інше закінчення).
  const best = Math.min(...prev);
  return best <= max ? best : Infinity;
}

/** Підготовлений до пошуку запис: слова і вся назва одним рядком. */
export interface Entry { ws: string[]; line: string }
export const entry = (...titles: string[]): Entry => {
  const ws = titles.flatMap(words);
  return { ws, line: ' ' + titles.map((t) => words(t).join(' ')).join(' | ') + ' ' };
};

/** Російські й розмовні слова, яких у назвах немає: початок слова запиту → початки слів, якими його шукати. */
const ALIAS: [string, string[]][] = (
  [
    ['болящ', ['недуж', 'хвор']], ['больн', ['хвор', 'недуж']], ['учен', ['навчан']], ['учеб', ['навчан']],
    ['путешеств', ['подорож', 'дороз']], ['усопш', ['спочил', 'помер']], ['умерш', ['помер', 'спочил']],
    ['здрав', ['здоров']], ['родител', ['батьк']], ['супруг', ['подруж']], ['брак', ['шлюб', 'вінчан']],
    ['благодар', ['подяк', 'дяк']], ['пищ', ['їж', 'трапез']], ['еда', ['їж', 'трапез']], ['дет', ['дит', 'діт']],
    ['юри', ['георгі']], ['георги', ['юрі']], ['божия', ['богородиц']], ['матер', ['богородиц']],
  ] as [string, string[]][]
).map(([k, v]) => [words(k)[0], v.map((x) => words(x)[0])]);

/** Як далеко (у правках) слово запиту q від найближчого слова запису; Infinity — не схоже ні на що. */
function wordCost(q: string, ws: string[]): number {
  const max = allow(q.length);
  let best = Infinity;
  for (const w of ws) {
    if (w.startsWith(q)) return 0;
    best = Math.min(best, prefixDist(q, w, Math.min(max, best - 1)));
  }
  for (const [k, alts] of ALIAS) if (q.startsWith(k)) for (const a of alts) if (ws.some((w) => w.startsWith(a))) return 0;
  return best;
}

/**
 * Номери записів, що відповідають запиту, від найкращого збігу.
 * Кожне слово запиту шукаємо як початок слова назви з допуском помилок; рідкісні слова («Миколаю») важать більше
 * за часті («молитва»), а слова, яких немає ніде, не заважають знайти решту.
 */
export function fuzzySearch(entries: Entry[], query: string, limit = 60): number[] {
  const all = words(query);
  if (!all.length) return [];
  const qs = [...new Set(all.some((w) => w.length >= 2) ? all.filter((w) => w.length >= 2) : all)];
  const phrase = ' ' + all.join(' ');
  const cost = entries.map((e) => qs.map((q) => wordCost(q, e.ws)));
  const df = qs.map((_, k) => cost.reduce((n, c) => n + (c[k] < Infinity ? 1 : 0), 0));
  const wt = df.map((d) => (d ? Math.log(1 + entries.length / d) : 0));
  const total = wt.reduce((a, b) => a + b, 0);
  if (!total) return [];
  // Якщо знайшлося хоч одне змістовне слово запиту, самих прийменників («за», «на») для збігу замало.
  const long = qs.map((q, k) => q.length >= 3 && df[k] > 0);
  const needLong = long.some(Boolean);
  const scored: { i: number; sc: number }[] = [];
  cost.forEach((c, i) => {
    let sc = 0;
    c.forEach((x, k) => {
      if (x < Infinity) sc += wt[k] * (1 - (0.5 * x) / (allow(qs[k].length) + 1));
    });
    sc /= total;
    if (entries[i].line.includes(phrase)) sc += 1;
    if (sc >= 0.5 && (!needLong || c.some((x, k) => long[k] && x < Infinity))) scored.push({ i, sc });
  });
  scored.sort((a, b) => b.sc - a.sc || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.i);
}
