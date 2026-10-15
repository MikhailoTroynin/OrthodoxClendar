import {
  CalendarType,
  Entry,
  FE,
  Feast,
  Lang,
  LIVES,
  MG,
  NJ,
  POK,
  RD,
  SEP,
  WD,
} from '../data/calendar';
import { DayRec, Item, Reading, Y2027 } from '../data/calendar2027';
import { Y2026 } from '../data/calendar2026';

const DAY_MS = 86400000;

/** Дата без часу (локальна). */
export const ymd = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
export const addDays = (dt: Date, n: number) => new Date(dt.getTime() + n * DAY_MS);
export const toKey = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return ymd(y, m, d);
};
export const sameDay = (a: Date, b: Date) => toKey(a) === toKey(b);

/** Пн=0 … Нд=6 */
export const weekdayIdx = (dt: Date) => (dt.getDay() + 6) % 7;

/** Різниця між юліанським і григоріанським календарями у 1900–2099 роках. */
const JULIAN_SHIFT = 13;

/** Дата за юліанським календарем для цивільної дати. */
export const julianOf = (dt: Date) => addDays(dt, -JULIAN_SHIFT);

/** Повні дані за рік (за цивільною датою). Зараз є 2026 і 2027. */
const YEARS: Record<number, Record<string, DayRec>> = { 2026: Y2026, 2027: Y2027 };

/** Роки, для яких є повний календар. */
export const FULL_YEARS = Object.keys(YEARS).map(Number);

/** Індекс «дата за юліанським календарем → запис», щоб брати неперехідну пам'ять за новоюліанськими числами. */
const OLD_INDEX: Record<number, Record<string, DayRec>> = {};
const oldIndex = (year: number) => {
  let idx = OLD_INDEX[year];
  if (!idx) {
    idx = {};
    for (const rec of Object.values(YEARS[year])) idx[`${rec.o[0]}-${rec.o[1]}`] = rec;
    OLD_INDEX[year] = idx;
  }
  return idx;
};

/** Мітки читань, що залежать від дня тижня й Пасхалії, а не від числа місяця. */
const isCycleLabel = (l: string) => l === 'Звичайне' || /^(За |Суботи|Неділі)/.test(l);

const FIXED_FAST = ['Різдвяний піст', 'Успенський піст', 'Початок Різдвяного посту', 'Початок Успенського посту'];
const APOSTLES_FAST = ['Апостольський піст', 'Початок Апостольського посту'];
const WED_FRI = 'Пісний день';

export interface YearDay {
  week: string;
  glas: string;
  fast: string;
  items: Item[];
  readings: Reading[];
}

/**
 * Дані дня з повного календаря (2026 і 2027, azbyka.ru, юліанський календар).
 * Юліанський режим бере запис за цивільною датою як є. Новоюліанський бере
 * неперехідну пам'ять і пости за числом місяця (13 днів різниці), а тиждень,
 * Пасхалію й перехідні свята — за цивільною датою.
 */
export const yearDay = (dt: Date, cal: CalendarType): YearDay | null => {
  const year = dt.getFullYear();
  const civil = YEARS[year]?.[toKey(dt)];
  if (!civil) return null;
  if (cal === 'oj') {
    return { week: civil.w, glas: civil.g, fast: civil.f, items: civil.i, readings: civil.r };
  }
  const month = dt.getMonth() + 1;
  const day = dt.getDate();
  const men = oldIndex(year)[`${month}-${day}`];
  if (!men) return { week: civil.w, glas: civil.g, fast: civil.f, items: civil.i, readings: civil.r };

  const items = [...civil.i.filter((it) => it[2]), ...men.i.filter((it) => !it[2])];
  // У велике свято читаються лише святкові читання: Пасхальні — за цивільною датою, Господні й Богородичні — за числом місяця.
  const paschal = civil.i.some((it) => it[0] === 2 && it[2]);
  const feast = men.i.some((it) => it[0] === 2 && !it[2]);
  const readings = paschal
    ? civil.r
    : [
        ...(feast ? [] : civil.r.filter((r) => isCycleLabel(r[0]))),
        ...men.r.filter((r) => !isCycleLabel(r[0])),
      ];

  // Піст: постійні (Різдвяний, Успенський) — за числом місяця, решта — за Пасхалією.
  const wedFri = weekdayIdx(dt) === 2 || weekdayIdx(dt) === 4;
  let fast = civil.f;
  if (FIXED_FAST.includes(men.f)) fast = men.f;
  else if (FIXED_FAST.includes(civil.f)) {
    const sviatky = month === 12 ? day >= 25 : month === 1 && day <= 4;
    fast = wedFri && !sviatky ? WED_FRI : '';
  } else if (APOSTLES_FAST.includes(civil.f) && (month > 6 || (month === 6 && day > 28))) {
    fast = wedFri ? WED_FRI : '';
  }
  return { week: civil.w, glas: civil.g, fast, items, readings: readings.length ? readings : civil.r };
};

const rankOf = (items: Item[]): 0 | 1 | 2 => items.reduce<0 | 1 | 2>((m, it) => (it[0] > m ? it[0] : m), 0);

/** Запис із ручних даних (вересень і жовтень): збігається за місяцем і числом, а не за роком. */
const legacyEntry = (dt: Date, cal: CalendarType): Entry | null => {
  const k = cal === 'nj' ? dt : julianOf(dt);
  const m = k.getMonth() + 1;
  const d = k.getDate();
  if (m === 10) return NJ[d] ?? null;
  if (m === 9) return SEP[d] ?? null;
  return null;
};

/**
 * Запис про пам'ять дня. Для років із повним календарем (2026, 2027) пам'ять беруть з нього;
 * іменини додають із ручних даних (вересень, жовтень), а англійську назву — лише якщо назва збігається.
 */
export const entryFor = (dt: Date, cal: CalendarType): Entry | null => {
  const yd = yearDay(dt, cal);
  if (yd) {
    if (!yd.items.length) return null;
    const title = yd.items[0][1];
    const old = legacyEntry(dt, cal);
    if (old) return [title, old[0] === title ? old[1] : title, old[2], old[3], rankOf(yd.items)];
    return [title, title, '', '', rankOf(yd.items)];
  }
  return legacyEntry(dt, cal);
};

/** Пошук по пам'яті всіх днів року, для якого є повні дані (2026, 2027). */
export const searchYear = (year: number, cal: CalendarType, q: string, limit = 60) => {
  const out: { text: string; date: Date }[] = [];
  const recs = YEARS[year];
  if (!recs) return out;
  for (const key of Object.keys(recs).sort()) {
    const dt = fromKey(key);
    const yd = yearDay(dt, cal);
    if (!yd) continue;
    for (const it of yd.items) {
      if (it[1].toLowerCase().includes(q)) {
        out.push({ text: it[1], date: dt });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
};

export const fmtDate = (dt: Date, L: Lang) => {
  const d = dt.getDate();
  const m = dt.getMonth() + 1;
  return L === 'uk' ? `${d} ${MG.uk[m - 1]}` : `${MG.en[m - 1]} ${d}`;
};
export const fmtMD = (m: number, d: number, L: Lang) =>
  L === 'uk' ? `${d} ${MG.uk[m - 1]}` : `${MG.en[m - 1]} ${d}`;

export const MN: Record<Lang, string[]> = {
  uk: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
  en: MG.en,
};

export interface DayInfo {
  date: Date;
  entry: Entry | null;
  rank: 0 | 1 | 2;
  weekday: number;
  isFast: boolean;
  title: string;
  names: string;
  lifeKey: string | null;
  r1: string;
  r2: string;
  /** Решта пам'яті дня (повний календар). */
  more: string[];
  /** Тиждень по Пʼятидесятниці, суботи й недільні назви. */
  week: string;
  glas: string;
  /** Назва посту з календаря (порожньо, якщо посту немає). */
  fastLabel: string;
  /** Усі богослужбові читання дня, по рядку на кожне. */
  readingLines: string[];
}

/**
 * Інформація про день. Читання за днем тижня — приклад із макета,
 * а не повний лекціонарій (див. README).
 */
export const dayInfo = (dt: Date, cal: CalendarType, L: Lang): DayInfo => {
  const entry = entryFor(dt, cal);
  const li = L === 'uk' ? 0 : 1;
  const wi = weekdayIdx(dt);
  const j = julianOf(dt);
  const jm = j.getMonth() + 1;
  const jd = j.getDate();
  const k = cal === 'nj' ? dt : j;
  const km = k.getMonth() + 1;
  const kd = k.getDate();
  const pok = km === 10 && kd === 1;
  const rank = entry ? entry[4] : 0;
  const lifeKey =
    km === 10 && kd === 13 ? (cal === 'nj' ? 'nj13' : 'oj13') : pok ? 'pok' : null;
  const rd = pok ? POK[L] : RD[L][wi];
  void jm;
  void jd;
  const yd = yearDay(dt, cal);
  if (yd) {
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].join('; ');
    return {
      date: dt,
      entry,
      rank,
      weekday: wi,
      isFast: yd.fast !== '' && !yd.fast.startsWith('Заговини'),
      title: entry ? (entry[li] as string) : '',
      names: entry ? (entry[li + 2] as string) : '',
      lifeKey: lifeKey && LIVES[lifeKey] ? lifeKey : null,
      r1: uniq(yd.readings.map((r) => r[1])),
      r2: uniq(yd.readings.map((r) => r[2])),
      more: yd.items.slice(1).map((it) => it[1]),
      week: yd.week,
      glas: yd.glas,
      fastLabel: yd.fast,
      readingLines: yd.readings.map(readingLine),
    };
  }
  return {
    date: dt,
    entry,
    rank,
    weekday: wi,
    isFast: wi === 2 || wi === 4,
    title: entry ? (entry[li] as string) : '',
    names: entry ? (entry[li + 2] as string) : '',
    lifeKey: lifeKey && LIVES[lifeKey] ? lifeKey : null,
    r1: rd[0],
    r2: rd[1],
    more: [],
    week: '',
    glas: '',
    fastLabel: '',
    readingLines: [],
  };
};

const readingLine = ([label, ap, ev, extra]: Reading) => {
  const lit = [ap && `Ап. ${ap}`, ev && `Єв. ${ev}`].filter(Boolean).join('; ');
  return `${label}: ${[extra, lit && `Літ. – ${lit}`].filter(Boolean).join('; ')}`;
};

export const weekdayName = (dt: Date, L: Lang) => WD[L][weekdayIdx(dt)];

export interface FeastRow {
  date: string;
  name: string;
  mv: boolean;
  next: boolean;
}

/** Найближче свято (Двонадесяте або велике) від указаної дати. */
export const nextFeast = (from: Date, cal: CalendarType): Feast | null => {
  let best: Feast | null = null;
  let bestDays = Infinity;
  const t0 = ymd(from.getFullYear(), from.getMonth() + 1, from.getDate()).getTime();
  for (const f of FE) {
    if (f.s === 0) continue;
    const [m, d] = f[cal];
    let when = ymd(from.getFullYear(), m, d).getTime();
    if (when < t0) when = ymd(from.getFullYear() + 1, m, d).getTime();
    const days = Math.round((when - t0) / DAY_MS);
    if (days < bestDays) {
      bestDays = days;
      best = f;
    }
  }
  return best;
};

export const feastSections = (cal: CalendarType, L: Lang, from: Date) => {
  const nx = nextFeast(from, cal);
  return [0, 1, 2].map((s) => ({
    s,
    rows: FE.filter((f) => f.s === s).map<FeastRow>((f) => ({
      date: fmtMD(f[cal][0], f[cal][1], L),
      name: f[L],
      mv: !!f.mv,
      next: f === nx,
    })),
  }));
};

export interface MonthCell {
  date: Date | null;
  inMonth: boolean;
}

/** Сітка місяця з тижнями від понеділка. */
export const monthGrid = (year: number, month: number): MonthCell[] => {
  const first = ymd(year, month, 1);
  const lead = weekdayIdx(first);
  const count = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ date: null, inMonth: false });
  for (let d = 1; d <= count; d++) cells.push({ date: ymd(year, month, d), inMonth: true });
  while (cells.length % 7) cells.push({ date: null, inMonth: false });
  return cells;
};

/** Тиждень навколо дати (Пн–Нд). */
export const weekOf = (dt: Date) => {
  const mon = addDays(dt, -weekdayIdx(dt));
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
};
