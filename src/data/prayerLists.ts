// Короткі переліки для екранів «Молитвослов» і «Письмо»; вони потрібні одразу, тож винесені з великого модуля prayers.ts.
/** Римські номери розділів молитвослова. */
export const ROM: string[] = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
/** Групи розділів молитвослова на екрані: індекси розділів у MB у порядку показу. */
export const SEC_GROUPS: { u: string; e: string; ix: number[] }[] = [
  { u: 'Щоденне', e: 'Daily', ix: [0, 1, 2] },
  { u: 'Служби', e: 'Services', ix: [3, 4, 5] },
  { u: 'Святі й потреби', e: 'Saints and needs', ix: [9, 8, 10, 6] },
  { u: 'Інше', e: 'More', ix: [7, 11, 12] },
];
/** Римський номер розділу s за порядком показу (нумерація наскрізна, у межах груп іде підряд). */
export const secNum = (s: number) => {
  const order = SEC_GROUPS.flatMap((g) => g.ix);
  const i = order.indexOf(s);
  return ROM[i < 0 ? s : i];
};
/** Посилання на молитву з повним текстом (як MvRef у prayers.ts): книга b молитвослова, акафістів (a) чи канонника (k), за потреби — розділ s. */
export interface DayRef { b: number; a?: 1; k?: 1; s?: number }
/** Що читати за днем тижня (Пн–Нд): молитви з повним текстом і кому присвячено день. */
export const WK: [DayRef[], string, string][] = [
  [[{ b: 9 }], 'безплотним силам', 'the Bodiless Powers'],
  [[{ b: 7 }], 'святому Іоанну Предтечі', 'St John the Forerunner'],
  [[{ b: 1, a: 1 }, { b: 8 }], 'Хресту і Богородиці', 'the Cross and the Theotokos'],
  [[{ b: 10, s: 19 }], 'апостолам і святителю Миколаю', 'the Apostles and St Nicholas'],
  [[{ b: 0, a: 1 }, { b: 7 }], 'Хресту Господньому', 'the Cross'],
  [[{ b: 13 }, { b: 10, s: 23 }], 'усім святим і спочилим', 'all saints and the departed'],
  [[{ b: 0, a: 1 }], 'Воскресінню Христовому', 'the Resurrection'],
];
/** Молитва, яку пропонують зараз (номер у розділі «Щоденне правило»), за годиною доби. */
export const nowPrayer = (h: number): { j: number; part: 'morning' | 'day' | 'evening' } =>
  h >= 4 && h < 12 ? { j: 0, part: 'morning' } : h >= 12 && h < 18 ? { j: 3, part: 'day' } : { j: 1, part: 'evening' };
/** Псалми кожної з 20 кафизм. */
export const KATH: string[] = ['1–8','9–16','17–23','24–31','32–36','37–45','46–54','55–63','64–69','70–76','77–84','85–90','91–100','101–104','105–108','109–117','118','119–133','134–142','143–151'];
