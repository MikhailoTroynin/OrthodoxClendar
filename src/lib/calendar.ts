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

/** Запис про пам'ять дня. Дані збігаються за місяцем і числом, а не за роком. */
export const entryFor = (dt: Date, cal: CalendarType): Entry | null => {
  const k = cal === 'nj' ? dt : julianOf(dt);
  const m = k.getMonth() + 1;
  const d = k.getDate();
  if (m === 10) return NJ[d] ?? null;
  if (m === 9) return SEP[d] ?? null;
  return null;
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
  };
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
