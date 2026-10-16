import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { CalendarType, Lang } from './data/calendar';
import type { Book } from './data/prayers';
import { BM_VERSION, migrateMarks } from './data/markMigrate';
import { S } from './data/strings';
import { dayInfo, fromKey, loadYears, toKey } from './lib/calendar';
import { useDataVersion } from './lib/lazy';
import { loadJSON, saveJSON } from './lib/storage';
import { Angel, NATIVE, onNotifResponse, REMINDER_DEFAULTS, Reminders, reschedule } from './lib/notify';
import { palette, Palette, ThemeName } from './theme';

export type Tab = 'today' | 'cal' | 'book' | 'bible' | 'more';

export type Overlay =
  | { t: 'life' }
  | { t: 'sec'; s: number }
  /** m — закладка, до якої прокрутити (id у Persisted.bm). */
  | { t: 'read'; s: number; j: number; m?: string }
  | { t: 'book'; b: Book }
  /** Глава c книги b (індекс у BOOKS); v…v2 — виділені вірші, до v прокручується. */
  | { t: 'chap'; b: number; c: number; v?: number; v2?: number }
  /** Читання за посиланням s («Гал. 5:22–6:2; Лк. 8:16–21»). */
  | { t: 'pass'; s: string; title: string }
  | { t: 'kath'; k: number; m?: string }
  | { t: 'ps'; i: number; m?: string }
  | { t: 'psalter' }
  | { t: 'pom' }
  | { t: 'jesus' }
  | { t: 'search' }
  | { t: 'settings' }
  | { t: 'remind' }
  | { t: 'angels' }
  | { t: 'donate' }
  | { t: 'ver' }
  | { t: 'marks' };

/** Текст, у якому можна поставити закладку: молитва, кафизма чи сторінка Псалтиря. */
export type MarkTarget = { t: 'read'; s: number; j: number } | { t: 'kath'; k: number } | { t: 'ps'; i: number };

/** Закладка в конкретному місці тексту. */
export interface Mark {
  id: string;
  o: MarkTarget;
  /** Назва тексту і розділу на момент створення (для переліку закладок). */
  title: string;
  kicker: string;
  /** Абзац (порядковий номер серед абзаців тексту), початок його тексту і місце всередині (0…1). */
  i: number;
  a: string;
  f: number;
  /** Глибина в тексті (0…1) — запасний варіант і відсоток у переліку. */
  pos: number;
  /** Уривок тексту біля закладки і найближчий заголовок над нею. */
  q: string;
  h?: string;
  at: number;
}

/** Ключ тексту: закладки з однаковим ключем належать одній молитві. */
export const markKey = (o: MarkTarget) => (o.t === 'read' ? `r${o.s}.${o.j}` : o.t === 'kath' ? `k${o.k}` : `p${o.i}`);

export interface Persisted {
  lang: Lang;
  cal: CalendarType;
  theme: ThemeName;
  fs: number;
  /** Налаштування нагадувань. */
  rm: Reminders;
  /** Дні ангела близьких. */
  ang: Angel[];
  kd: number[];
  /** Прочитані глави Біблії: ключі «книга.глава» (індекс у BOOKS). */
  bd: string[];
  pom: { h: string[]; r: string[] };
  jc: number;
  jt: number;
  amt: number;
  /** Закладки в текстах молитов і Псалтиря. */
  bm: Mark[];
  /** Версія номерів у закладках (див. data/markMigrate). */
  bmv: number;
}

const DEFAULTS: Persisted = {
  lang: 'uk',
  cal: 'nj',
  theme: 'day',
  fs: 17,
  rm: REMINDER_DEFAULTS,
  ang: [],
  kd: [],
  bd: [],
  pom: { h: [], r: [] },
  jc: 0,
  jt: 100,
  amt: 100,
  bm: [],
  bmv: BM_VERSION,
};

/** Посилання на банку monobank; замініть на справжнє перед випуском. */
export const JAR_URL = 'https://send.monobank.ua/jar/XXXXXXXXXX';

interface Ctx extends Persisted {
  t: Record<string, any>;
  p: Palette;
  set: (patch: Partial<Persisted>) => void;
  tab: Tab;
  goTab: (t: Tab) => void;
  ov: Overlay[];
  push: (o: Overlay) => void;
  pop: () => void;
  /** Замінює верхній екран (перехід між главами без накопичення стека). */
  replace: (o: Overlay) => void;
  /** Обрана дата ("YYYY-MM-DD"). */
  date: Date;
  setDate: (d: Date) => void;
  today: Date;
  /** Місяць, показаний у вкладці «Календар». */
  calView: CalView;
  setCalView: (v: CalView) => void;
  openFeasts: () => void;
  q: string;
  setQ: (q: string) => void;
  openDay: (d: Date) => void;
}

export type CalView = 'month' | 'feasts' | 'fasts' | 'mem';

const StoreCtx = createContext<Ctx | null>(null);

export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider відсутній');
  return c;
};

export function StoreProvider({ children, onReady }: { children: React.ReactNode; onReady?: () => void }) {
  const [saved, setSaved] = useState<Persisted>(DEFAULTS);
  const loaded = useRef(false);
  const [tab, setTab] = useState<Tab>('today');
  const [ov, setOv] = useState<Overlay[]>([]);
  const today = useMemo(() => new Date(), []);
  const [date, setDateState] = useState<Date>(today);
  const [calView, setCalView] = useState<CalView>('month');
  const [q, setQ] = useState('');

  useEffect(() => {
    // Перший екран чекає лише на налаштування й календар поточного року; решта даних — за потреби.
    const year = loadYears([today.getFullYear()]).catch((e) => console.warn('Не вдалося завантажити календар', e));
    Promise.all([loadJSON<Persisted & { date?: string }>(), year])
      .then(([v]) => {
        // Англійських текстів поки немає, тож мова завжди українська (навіть якщо раніше збережено «en»).
        if (v) setSaved((s) => ({ ...s, ...v, lang: 'uk', rm: { ...s.rm, ...v.rm, show: { ...s.rm.show, ...v.rm?.show } }, pom: { ...s.pom, ...v.pom }, bm: Array.isArray(v.bm) ? migrateMarks(v.bm, v.bmv) : [], bmv: BM_VERSION }));
      })
      .catch((e) => console.warn('Не вдалося відновити налаштування', e))
      // Застосунок відкривається за будь-якого результату: інакше лишається порожній екран.
      .finally(() => {
        loaded.current = true;
        setReady(true);
        onReady?.();
        loadYears().catch(() => {});
      });
  }, [onReady, today]);

  useEffect(() => {
    if (loaded.current) saveJSON(saved);
  }, [saved]);

  // Нагадування плануються наперед на кілька днів: оновлюємо їх під час запуску і після змін налаштувань.
  const pomN = saved.pom.h.length + saved.pom.r.length;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready || !NATIVE) return;
    const h = setTimeout(
      () => loadYears().then(() => reschedule(saved.rm, saved.cal, saved.lang, S[saved.lang], pomN, saved.ang, true)),
      400,
    );
    return () => clearTimeout(h);
  }, [ready, saved.rm, saved.cal, saved.lang, pomN, saved.ang]);

  const set = useCallback((patch: Partial<Persisted>) => setSaved((s) => ({ ...s, ...patch })), []);
  const push = useCallback((o: Overlay) => setOv((s) => [...s, o]), []);
  const pop = useCallback(() => setOv((s) => s.slice(0, -1)), []);
  const replace = useCallback((o: Overlay) => setOv((s) => [...s.slice(0, -1), o]), []);
  const goTab = useCallback((t: Tab) => {
    setTab(t);
    setOv([]);
  }, []);
  const setDate = useCallback((d: Date) => setDateState(fromKey(toKey(d))), []);
  const openDay = useCallback(
    (d: Date) => {
      setDate(d);
      setTab('today');
      setOv([]);
      setQ('');
    },
    [setDate],
  );
  const openFeasts = useCallback(() => {
    setCalView('feasts');
    setTab('cal');
    setOv([]);
    setQ('');
  }, []);

  // Натискання на сповіщення відкриває його день, а кнопки — молитви, читання чи житіє.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    if (!ready) return;
    return onNotifResponse((key, action, kind) => {
      const d = fromKey(key);
      openDay(d);
      const { cal, lang } = savedRef.current;
      const t = S[lang];
      if (action === 'prayers' || kind === 'prayM' || kind === 'prayE') {
        setTab('book');
        setOv([{ t: 'read', s: 0, j: action === 'prayers' ? 0 : kind === 'prayE' ? 1 : 0 }]);
      } else if (action === 'reading') {
        const day = dayInfo(d, cal, lang);
        const s = [day.r1, day.r2].filter(Boolean).join('; ');
        if (s) setOv([{ t: 'pass', s, title: t.readings }]);
      } else if (action === 'life') {
        if (dayInfo(d, cal, lang).lifeKey) setOv([{ t: 'life' }]);
      }
    });
  }, [ready, openDay]);

  // Кнопка «Назад» в Android закриває верхній екран.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ov.length) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [ov.length, pop]);

  // Коли довантажуються дані (календар іншого року тощо), екрани перемальовуються.
  const dv = useDataVersion();
  const value = useMemo<Ctx>(
    () => ({
      ...saved,
      t: S[saved.lang],
      p: palette(saved.theme),
      set,
      tab,
      goTab,
      ov,
      push,
      pop,
      replace,
      date,
      setDate,
      today,
      calView,
      setCalView,
      openFeasts,
      q,
      setQ,
      openDay,
    }),
    [saved, set, tab, goTab, ov, push, pop, replace, date, setDate, today, calView, openFeasts, q, openDay, dv],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
