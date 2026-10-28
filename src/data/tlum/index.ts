// Тлумачення Псалтиря Євфимія Зигабена (переклад українською з російського видання) — http://mediaglagol.com.ua/book/tolkovaya_psaltir
// Файл згенеровано scripts/build_tlumach.py з scripts/zigaben/uk/, не правте вручну.
/** Тлумачення одного місця: v — вірш(і) («0» — вступ до псалма, «3-5», «1,2»), h — цитата вірша, t — абзаци. */
export interface TlumSeg {
  v: string;
  h?: string;
  t: string[];
}
export type TlumPsalms = Record<string, TlumSeg[]>;

export const KATH_RANGE: [number, number][] = [[1, 8], [9, 16], [17, 23], [24, 31], [32, 36], [37, 45], [46, 54], [55, 63], [64, 69], [70, 76], [77, 84], [85, 90], [91, 100], [101, 104], [105, 108], [109, 117], [118, 118], [119, 133], [134, 142], [143, 151]];
/** Псалми з тлумаченням і вірші, до яких воно є (0 — вступ). */
export const TL: Record<string, number[]> = {"1":[1,2,3,4,5,6]};
/** Модулі з текстами тлумачень за кафизмами. */
export const TL_LOAD: Record<number, () => Promise<{ Z: TlumPsalms }>> = {
  1: () => import('./k1'),
};
