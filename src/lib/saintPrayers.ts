// Молитви з молитвослова, пов'язані з пам'яттю дня: акафісти, канони, молитви й тропарі святим, святам та іконам.
// Зв'язок шукаємо за іменами: значущі слова з назви молитви мають стояти поруч у записі календаря
// (з точністю до відмінкового закінчення), а сан святого (свт., мч., прп. …), якщо його названо в молитві, має збігатися.
import { MB } from '../data/prayers';

export interface DayPrayer {
  /** Розділ і молитва в MB (як у маршруті { t: 'read', s, j }). */
  s: number;
  j: number;
  u: string;
  e: string;
}

/** Літери, які в джерелах пишуть по-різному (и/і/ї, є/е, апостроф). */
const fold = (w: string) =>
  w.toLowerCase().replace(/[ʼ’'`]/g, '').replace(/[иїы]/g, 'і').replace(/[єэё]/g, 'е').replace(/ґ/g, 'г');
/** Регулярний вираз, записаний звичайним правописом, для слів після fold. */
const re = (src: string) => new RegExp(fold(src));

/** Закінчення, якими можуть відрізнятися форми одного слова (після fold). */
const ENDINGS = new Set(
  ['', 'а', 'я', 'у', 'ю', 'і', 'е', 'о', 'й', 'ій', 'ей', 'ой', 'ою', 'ею', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ів',
    'оі', 'еі', 'ого', 'ому', 'ім', 'іх', 'імі', 'ові', 'еві', 'ами', 'ями', 'ія', 'ію', 'іі'],
);
/** Різнописи імен у календарі й молитвослові. */
const SYN: [RegExp, string][] = (
  [['^димитр', 'дмитр'], ['^іу', 'ю'], ['^татіан', 'тетян'], ['^фом', 'хом'], ['^тройц', 'трійц'], ['^пʼятидесят', 'пʼятдесят'],
    ['^козьм', 'косьм'], ['^федор', 'феодор'], ['^юрі', 'георгі'], ['^йосиф', 'іосиф'], ['^олександрійськ', 'александрійськ'],
    ['^животвор', 'животворящ'], ['^матфе', 'матвей'], ['^христов', 'христ']] as [string, string][]
).map(([a, b]) => [re(a), fold(b)]);
const normWord = (w: string): string => {
  let x = fold(w);
  for (const [r, to] of SYN) if (r.test(x)) x = x.replace(r, to);
  // Чергування в давальному відмінку: Ользі — Ольги, Луці — Луки.
  return x.replace(/зі$/, 'гі').replace(/ці$/, 'кі');
};
/** Два слова — форми одного: спільна основа (≥ 3 літер) і обидва закінчення допустимі. */
const sameWord = (a: string, b: string): boolean => {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  let c = 0;
  while (c < n && a[c] === b[c]) c++;
  for (let k = c; k >= 3; k--) if (ENDINGS.has(a.slice(k)) && ENDINGS.has(b.slice(k))) return true;
  return false;
};

/** Слово ключа є в записі; складене через дефіс («Києво-Печерському») — досить однієї частини («Печерського»). */
const hasWord = (kw: string, w: string): boolean =>
  sameWord(kw, w) || (kw.includes('-') && kw.split('-').some((part) => part.length >= 4 && sameWord(normWord(part), w)));

/** Сан святого за словом (повним або скороченням); короткі скорочення — лише цілим словом. */
const RANKS: [RegExp, string][] = (
  [['^(вмч|вмц|вмчч|вмцц)$|^великомуч', 'вмч'],
    ['^(сщмч|сщмц|сщмчч)$|^священномуч', 'сщмч'],
    ['^(прмч|прмц|прмчч|прмцц)$|^преподобномуч', 'прмч'],
    ['^(мч|мц|мчч|мцц)$|^муч', 'мч'],
    ['^(свт|свтт)$|^святител', 'свт'],
    ['^(прп|прпп)$|^преподоб', 'прп'],
    ['^рівноап', 'рап'],
    ['^(ап|апп)$|^апостол|^євангеліст', 'ап'],
    ['^(прор)$|^пророк', 'прор'],
    ['^(прав|правв)$|^праведн', 'прав'],
    ['^(блж|блжж)$|^блаженн', 'блж'],
    ['^(блгв|блгвв)$|^благовірн', 'блгв']] as [string, string][]
).map(([a, b]) => [re(a), b]);
const rankOf = (w: string): string | null => RANKS.find(([r]) => r.test(w))?.[1] ?? null;
/** Рід святого за скороченням сану в календарі (мц. — мч.); для решти скорочень невідомий. */
const genderOfAbbr = (w: string): 'f' | 'm' | null =>
  /^(мц|мцц|вмц|вмцц|прмц|прмцц|сщмц)$/.test(w) ? 'f' : /^(мч|мчч|вмч|вмчч|прмч|прмчч|сщмч|сщмчч|свт|свтт)$/.test(w) ? 'm' : null;
/** Рід святого за словом сану в назві молитви («мучениці», «преподобній» — «мученику», «святителю»). */
const genderOfWord = (w: string): 'f' | 'm' => (/(ці|ця|цям|ній|на)$/.test(fold(w)) ? 'f' : 'm');

/** Слова з назв молитов, що не розрізняють святих і свята. */
const STOP = re(
  '^(акафіст|канон|молитв|тропар|кондак|величанн|пресвят|богородиц|божо|божі|матер|її|господ|ісус|спас|собор|чудотвор|ікон|день|неділ|отц|отеч|старц)' +
    '|^(свят|святий|свята|святе|святі|святого|святому|святої|святій|святих|святим|бог|богу|христа|христу|христе|у|в|на|і|й|та|з|до|про|що|перед|від|при)$',
);
const WORD = /[A-Za-zА-Яа-яІіЇїЄєҐґʼ’'-]+/g;
const isCap = (raw: string) => raw[0] !== raw[0].toLowerCase();

/** Слово з тексту календаря: нормалізоване, з великої літери чи ні, сан, що до нього стосується, і що стоїть перед ним. */
interface Tok { w: string; cap: boolean; stop: boolean; rank: string | null; sex: 'f' | 'm' | null; open: boolean; sep: boolean }
const toks = (text: string): Tok[] => {
  // Пояснення в дужках з малої літери («в чернецтві Давида», «перехідне святкування…») — не про імена дня.
  const t = text.replace(/\((?=[^)]*[а-яіїєґa-z])[^)]*\)/g, (m) => (/^\(\s*[а-яіїєґ]/.test(m) ? ' ' : m));
  const out: Tok[] = [];
  let rank: string | null = null;
  let sex: 'f' | 'm' | null = null;
  let last = 0;
  for (const m of t.matchAll(WORD)) {
    const gap = t.slice(last, m.index);
    last = m.index! + m[0].length;
    const w = normWord(m[0]);
    const r = rankOf(w);
    if (r) {
      rank = r;
      sex = genderOfAbbr(w);
      continue;
    }
    out.push({ w, cap: isCap(m[0]), stop: STOP.test(fold(m[0])), rank, sex, open: gap.includes('('), sep: /[,;:.)–—]/.test(gap) });
  }
  return out;
};

interface Key { words: string[]; ranks: Set<string>; sex: 'f' | 'm' | null; theotokos: boolean; icon: boolean; council: boolean }
const theotokosOf = (t: string) => /Богородиц|Божої Матері|Богоматер/i.test(t);

/** Ключ молитви: значущі слова назви (з великої літери; для свят — усі) і сан. */
const keyOf = (title: string, feast: boolean): Key | null => {
  const th = theotokosOf(title);
  // Ікони Богородиці розрізняємо за назвою в лапках.
  const q = th ? title.match(/«([^»]+)»/) : null;
  const words: string[] = [];
  const ranks = new Set<string>();
  let sex: 'f' | 'm' | null = null;
  for (const m of (q ? q[1] : title).matchAll(WORD)) {
    const w = normWord(m[0]);
    const r = rankOf(w);
    if (r) {
      ranks.add(r);
      sex ??= genderOfWord(m[0]);
    }
    else if ((feast || isCap(m[0])) && w.length >= 3 && !STOP.test(fold(m[0]))) words.push(w);
  }
  if (!words.length) return null;
  // Молитви соборам святих («отцям Києво-Печерським», «Оптинським старцям») — лише до днів цих соборів.
  return { words, ranks: q ? new Set() : ranks, sex: q ? null : sex, theotokos: th, icon: !!q || /ікон/i.test(title), council: /отцям|отців|старцям|старців|Собор/i.test(title) };
};

/** Групи, що не стосуються окремих святих чи свят (загальні тропарі, тропарі днів седмиці). */
const SKIP_G = new Set(['Дні седмиці', 'Святим (загальні)']);
/** Групи молитов на свята: їхні назви звичайними словами («Великий четвер»), тож у ключ ідуть усі слова. */
const FEAST_G = new Set(['Празники', 'Інші свята й дні', 'Празникам і Господнім подіям']);
/** Розділи MB, з яких беремо молитви: акафісти, канони, перед іконами, святим, тропарі. */
const SECS = new Set([3, 4, 8, 9, 10]);
/** Розділи «На різні потреби» і «Молитви Господу, Богородиці й Небесним Силам»: лише молитви на свята й до святих
 *  («Молитва на Стрітення Господнє», «Молитва до святителя Миколая», «Молитва Архангелу Рафаїлу»), а не молитви, складені святими. */
const SECS_TO = new Set([6, 7]);
const TO = /^Молитва (на |до |[А-ЯІЇЄ][а-яіїєʼ’']*(у|ю|ам|ому|им|ій|і) )/;

let INDEX: { p: DayPrayer; k: Key }[] | null = null;
const index = () => {
  if (!INDEX) {
    INDEX = [];
    MB.forEach((sec, s) => {
      if (!SECS.has(s) && !SECS_TO.has(s)) return;
      sec.items.forEach((it, j) => {
        if ((it.g && SKIP_G.has(it.g[0])) || (SECS_TO.has(s) && !TO.test(it.u))) return;
        const k = keyOf(it.u, !!it.g && FEAST_G.has(it.g[0]));
        if (k) INDEX!.push({ p: { s, j, u: it.u, e: it.e }, k });
      });
    });
  }
  return INDEX;
};

/**
 * Чи запис календаря про того самого святого чи свято: головне (перше) слово ключа має той самий сан
 * і не уточнене іншим прізвищем чи ім'ям у дужках («Миколая (Велимировича)»), а решта слів ключа стоїть неподалік.
 */
const matches = (k: Key, ts: Tok[]): boolean => {
  const span = k.words.length * 3 + 2;
  const known = (t: Tok) => k.words.some((kw) => hasWord(kw, t.w));
  return ts.some((t, i) => {
    if (!sameWord(k.words[0], t.w)) return false;
    if (k.ranks.size && !(t.rank && k.ranks.has(t.rank))) return false;
    if (k.sex && t.sex && k.sex !== t.sex) return false;
    const n = ts[i + 1];
    if (k.words.length === 1 && n && n.cap && !n.stop && (n.open || !n.sep) && !known(n)) return false;
    const near = ts.slice(Math.max(0, i - span), i + span + 1);
    return k.words.every((kw) => near.some((x) => hasWord(kw, x.w)));
  });
};

const cache = new Map<string, DayPrayer[]>();
/** Молитви, пов'язані з одним записом пам'яті дня (порожньо, якщо таких немає). */
export const prayersFor = (text: string): DayPrayer[] => {
  const hit = cache.get(text);
  if (hit) return hit;
  const ts = toks(text);
  const th = theotokosOf(text);
  const council = /Собор/.test(text);
  // Дні ікон Богородиці — лише молитви перед цими іконами, а не на Богородичні свята.
  const icon = th && /ікон/i.test(text);
  const out = index()
    .filter(({ k }) => k.theotokos === th && (!icon || k.icon) && (!k.council || council) && matches(k, ts))
    .map(({ p }) => p);
  cache.set(text, out);
  return out;
};
