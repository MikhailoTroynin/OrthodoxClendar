// Тлумачення Євангелія блж. Феофілакта Болгарського (переклад українською з російського видання) — https://azbyka.ru/otechnik/Feofilakt_Bolgarskij/
// Файл згенеровано scripts/build_tlumach_ev.py з scripts/feofilakt/uk/, не правте вручну.
import type { TlumSeg } from '../tlum';
/** Книга Євангелія (slug з src/data/bible/books.ts) → код книги в TE. */
export const EV_BOOK: Record<string, string> = {"matt":"mt","mark":"mk","luke":"lk","john":"jn"};
/** Глави з тлумаченням і вірші, до яких воно є (0 — вступ). */
export const TE: Record<string, number[]> = {"mt:17":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27],"mt:28":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]};
/** Модулі з текстами тлумачень за главами. */
export const TE_LOAD: Record<string, () => Promise<{ Z: TlumSeg[] }>> = {
  'mt:17': () => import('./mt/17'),
  'mt:28': () => import('./mt/28'),
};
