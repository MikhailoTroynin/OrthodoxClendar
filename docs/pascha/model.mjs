// Julian Pascha (Meeus), and its civil date for 1900–2099 (Julian + 13 days).
// t counts days after 21 March (Julian): the full moon is at t = d, Pascha at t = d + e + 1.
export const MONTHS = { 3: "березня", 4: "квітня", 5: "травня" };
export function pascha(year) {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const t = d + e + 1;
  const dateOf = (shift) => (21 + shift <= 31 ? { month: 3, day: 21 + shift } : 21 + shift <= 61 ? { month: 4, day: 21 + shift - 31 } : { month: 5, day: 21 + shift - 61 });
  return { year, c, s: year % 28, d, e, t, o: t % 7, julian: dateOf(t), civil: dateOf(t + 13) };
}
