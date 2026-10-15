// Читання молитов уголос: безкоштовний синтез мовлення самого пристрою (expo-speech;
// у браузері — Web Speech API). Обираємо український чоловічий голос, якщо він є в системі.
import { useEffect, useState } from 'react';
import * as Speech from 'expo-speech';
import type { MvBook } from '../data/molytvoslov';
import type { Lang } from '../data/calendar';

// Імена чоловічих голосів: Microsoft Ostap (Edge, Windows), RHVoice Anatol / Volodymyr (Android, Windows).
const MALE = /ostap|остап|anatol|анатол|volodymyr|володимир|mykola|микола|taras|тарас|\bmale\b|чолов/i;
const FEMALE = /female|polina|поліна|lesya|леся|natalia|наталія|marianna|мар.яна|жіно/i;

let voices: Promise<Speech.Voice[]> | undefined;
const allVoices = () =>
  (voices ??= Promise.race([
    Speech.getAvailableVoicesAsync(),
    // Браузер без голосів ніколи не повідомляє про список — не чекаємо довше секунди.
    new Promise<Speech.Voice[]>((r) => setTimeout(() => r([]), 1000)),
  ]).then(
    (v) => {
      if (!v.length) voices = undefined; // у браузері список голосів з'являється не одразу
      return v;
    },
    () => ((voices = undefined), []),
  ));

/** Найкращий голос для мови: чоловічий, потім якісніший / мережевий, потім будь-який цієї мови. */
async function pickVoice(lang: Lang): Promise<{ voice?: string; male: boolean }> {
  const code = lang === 'uk' ? 'uk' : 'en';
  const own = (await allVoices()).filter((v) => v.language.toLowerCase().replace('_', '-').startsWith(code));
  const name = (v: Speech.Voice) => `${v.name} ${v.identifier}`;
  const score = (v: Speech.Voice) =>
    (MALE.test(name(v)) ? 100 : 0) - (FEMALE.test(name(v)) ? 50 : 0) +
    (/natural|neural|online|enhanced|premium/i.test(name(v)) || v.quality === Speech.VoiceQuality.Enhanced ? 10 : 0);
  const best = own.sort((a, b) => score(b) - score(a))[0];
  return { voice: best?.identifier, male: !!best && MALE.test(name(best)) };
}

/** Текст для читання: без наголосів, номерів віршів, посилань на примітки й HTML. */
const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/⁽\d+⁾/g, '')
    .replace(/́/g, '')
    .replace(/[\[\]{}\\/=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Абзаци сторінки молитвослова / Псалтиря для читання вголос; рубрики (§) і примітки не читаються. */
export function bookText(b: MvBook, only?: number[]): string[] {
  const secs = only ? only.map((i) => b.secs[i]) : b.secs;
  return secs.flatMap((s) => [
    s.h ?? '',
    ...s.ps.filter((t) => t[0] !== '§').map((t) => (t[0] === '#' ? t.slice(1) : t[0] === '@' ? t.slice(t.indexOf(' ') + 1) : t)),
  ]);
}

/** Ділить текст на шматки до ~240 знаків по реченнях і комах: довгі фрази браузери й Android обривають. */
function chunks(paras: string[]): string[] {
  const out: string[] = [];
  for (const para of paras.map(clean).filter(Boolean)) {
    let cur = '';
    for (const sent of para.match(/[^.!?;:,]+[.!?;:,…»”]*\s*/g) ?? [para]) {
      if (cur && (cur + sent).length > 240) {
        out.push(cur.trim());
        cur = '';
      }
      cur += sent;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

let run = 0;
const listeners = new Set<(on: boolean) => void>();
const emit = (on: boolean) => listeners.forEach((f) => f(on));

export function stopSpeaking() {
  run++;
  Speech.stop();
  emit(false);
}

export async function speak(paras: string[], lang: Lang) {
  stopSpeaking();
  const my = run;
  emit(true);
  const { voice, male } = await pickVoice(lang);
  if (my !== run) return;
  const parts = chunks(paras);
  if (!parts.length) return emit(false);
  parts.forEach((text, i) =>
    Speech.speak(text, {
      language: lang === 'uk' ? 'uk-UA' : 'en-US',
      voice,
      rate: 0.9,
      // Якщо чоловічого голосу немає, трохи знижуємо тон, щоб звучало нижче.
      pitch: male ? 1 : 0.8,
      onDone: i === parts.length - 1 ? () => void (my === run && emit(false)) : undefined,
      onError: () => void (my === run && stopSpeaking()),
    }),
  );
}

/** Стан читання; читання зупиняється, коли сторінку закривають. */
export function useSpeaking(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    listeners.add(setOn);
    return () => {
      listeners.delete(setOn);
      stopSpeaking();
    };
  }, []);
  return on;
}
