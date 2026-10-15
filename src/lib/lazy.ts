// Ледаче завантаження великих модулів із даними (Біблія, календарі, молитвослов, Псалтир):
// у веб-версії кожен такий модуль — окремий файл, що завантажується лише тоді, коли він потрібен.
import { useEffect, useSyncExternalStore } from 'react';

const subs = new Set<() => void>();
let ver = 0;
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

/** Номер версії даних: зростає щоразу, коли завантажується черговий модуль. */
export const useDataVersion = () => useSyncExternalStore(subscribe, () => ver);

/** Модуль, що завантажується за потреби: виклик повертає дані (або undefined, поки їх немає). */
export interface Lazy<T> {
  (): T | undefined;
  load(): Promise<T>;
}

export function lazy<T>(loader: () => Promise<T>): Lazy<T> {
  let value: T | undefined;
  let pending: Promise<T> | undefined;
  const get = (() => value) as Lazy<T>;
  get.load = () =>
    (pending ??= loader().then(
      (v) => {
        value = v;
        ver++;
        subs.forEach((f) => f());
        return v;
      },
      (e) => {
        pending = undefined; // наступна спроба завантажить знову (наприклад, коли з'явиться мережа)
        throw e;
      },
    ));
  return get;
}

/** Починає завантаження модулів і перемальовує компонент, коли вони готові. true — усі вже завантажено. */
export function useLazy(...ls: Lazy<unknown>[]): boolean {
  useDataVersion();
  const ready = ls.every((l) => l() !== undefined);
  useEffect(() => {
    if (!ready) ls.forEach((l) => l.load().catch((e) => console.warn('Не вдалося завантажити дані', e)));
  });
  return ready;
}

/** Слідуваний Псалтир. */
export const psaltyrL = lazy(() => import('../data/psaltyr'));
/** Молитвослов: розділи, повні тексти Київського ізводу і молитви з каналу. */
export const prayersL = lazy(() => import('../data/prayers'));
