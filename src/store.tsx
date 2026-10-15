import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { CalendarType, Lang } from './data/calendar';
import { Book } from './data/prayers';
import { S } from './data/strings';
import { fromKey, toKey } from './lib/calendar';
import { loadJSON, saveJSON } from './lib/storage';
import { palette, Palette, ThemeName } from './theme';

export type Tab = 'today' | 'cal' | 'book' | 'bible' | 'more';

export type Overlay =
  | { t: 'life' }
  | { t: 'sec'; s: number }
  | { t: 'read'; s: number; j: number }
  | { t: 'book'; b: Book }
  /** Глава c книги b (індекс у BOOKS); v…v2 — виділені вірші, до v прокручується. */
  | { t: 'chap'; b: number; c: number; v?: number; v2?: number }
  /** Читання за посиланням s («Гал. 5:22–6:2; Лк. 8:16–21»). */
  | { t: 'pass'; s: string; title: string }
  | { t: 'kath'; k: number }
  | { t: 'ps'; i: number }
  | { t: 'pom' }
  | { t: 'jesus' }
  | { t: 'search' }
  | { t: 'settings' }
  | { t: 'donate' }
  | { t: 'ver' };

export interface Persisted {
  lang: Lang;
  cal: CalendarType;
  theme: ThemeName;
  fs: number;
  nt: { f: boolean; s: boolean; n: boolean };
  kd: number[];
  pom: { h: string[]; r: string[] };
  jc: number;
  jt: number;
  amt: number;
}

const DEFAULTS: Persisted = {
  lang: 'uk',
  cal: 'nj',
  theme: 'day',
  fs: 17,
  nt: { f: true, s: true, n: false },
  kd: [],
  pom: { h: [], r: [] },
  jc: 0,
  jt: 100,
  amt: 100,
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
  calView: 'month' | 'feasts';
  setCalView: (v: 'month' | 'feasts') => void;
  openFeasts: () => void;
  q: string;
  setQ: (q: string) => void;
  openDay: (d: Date) => void;
}

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
  const [calView, setCalView] = useState<'month' | 'feasts'>('month');
  const [q, setQ] = useState('');

  useEffect(() => {
    loadJSON<Persisted & { date?: string }>().then((v) => {
      if (v) setSaved((s) => ({ ...s, ...v, nt: { ...s.nt, ...v.nt }, pom: { ...s.pom, ...v.pom } }));
      loaded.current = true;
      onReady?.();
    });
  }, [onReady]);

  useEffect(() => {
    if (loaded.current) saveJSON(saved);
  }, [saved]);

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
    [saved, set, tab, goTab, ov, push, pop, replace, date, setDate, today, calView, openFeasts, q, openDay],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
