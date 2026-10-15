// Локальні нагадування: увечері — про завтрашній день, вранці — про сьогоднішній,
// за 5 днів — про велике свято, дні ангела близьких, а також час молитов. У веб-версії нічого не надсилається.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { CalendarType, Lang } from '../data/calendar';
import { addDays, dayInfo, fastKind, fmtDate, toKey, weekdayName } from './calendar';

export interface Reminders {
  /** Вечірнє нагадування про завтрашній день. */
  eve: boolean;
  eveT: string;
  /** Ранкове нагадування про сьогоднішній день. */
  morn: boolean;
  mornT: string;
  /** За 5 днів до великого свята. */
  pre: boolean;
  /** Дні ангела близьких: увечері напередодні й у сам день. */
  ang: boolean;
  /** Що показувати: піст, читання, іменини, час молитов. */
  show: { f: boolean; r: boolean; n: boolean; p: boolean };
}

export const REMINDER_DEFAULTS: Reminders = {
  eve: true,
  eveT: '20:00',
  morn: true,
  mornT: '07:00',
  pre: false,
  ang: true,
  show: { f: true, r: true, n: true, p: false },
};

/** День ангела близької людини: ім'я і дата «ММ-ДД» за цивільним календарем. */
export interface Angel {
  n: string;
  d: string;
}

/** Дата дня ангела в році y; 29 лютого в невисокосний рік — 28-го. */
export const angelDate = (a: Angel, y: number) => {
  const [m, d] = a.d.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(d, last), 12);
};

/** Імена тих, чий день ангела припадає на цей день. */
export const angelsOn = (list: Angel[], day: Date) =>
  list.filter((a) => {
    const x = angelDate(a, day.getFullYear());
    return x.getMonth() === day.getMonth() && x.getDate() === day.getDate();
  }).map((a) => a.n);

/** Дія з розгорнутого ранкового сповіщення. */
export type NotifAction = 'prayers' | 'reading' | 'life' | 'open';

export const NATIVE = Platform.OS !== 'web';
const CATEGORY = 'day';
const CHANNEL = 'reminders';
/** Скільки днів наперед плануємо (iOS тримає не більше 64 запланованих сповіщень). */
const DAYS = 12;
const PRE_DAYS = 5;

if (NATIVE) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

const at = (day: Date, hhmm: string, plusMin = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m + plusMin, 0, 0);
};

/** Чи можна надсилати сповіщення; ask — попросити дозвіл, якщо ще не питали. */
export async function notifPermission(ask: boolean): Promise<'granted' | 'denied' | 'web'> {
  if (!NATIVE) return 'web';
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return 'granted';
  if (!ask || !cur.canAskAgain) return 'denied';
  const res = await Notifications.requestPermissionsAsync();
  return res.granted ? 'granted' : 'denied';
}

/** Перепланує всі нагадування на найближчі дні за поточними налаштуваннями. */
export async function reschedule(rm: Reminders, cal: CalendarType, lang: Lang, t: Record<string, any>, pomN: number, angels: Angel[] = [], ask = false) {
  if (!NATIVE) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const angOn = rm.ang && angels.length > 0;
    const any = rm.eve || rm.morn || rm.pre || rm.show.p || angOn;
    if (!any) return;
    if ((await notifPermission(ask)) !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: t.rTitle,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.setNotificationCategoryAsync(CATEGORY, [
      { identifier: 'prayers', buttonTitle: t.nPrayers, options: { opensAppToForeground: true } },
      { identifier: 'reading', buttonTitle: t.nReading, options: { opensAppToForeground: true } },
      { identifier: 'life', buttonTitle: t.nLife, options: { opensAppToForeground: true } },
    ]);

    const now = Date.now();
    const jobs: Promise<string>[] = [];
    const add = (when: Date, title: string, body: string, date: Date, kind: string, category?: string) => {
      if (when.getTime() <= now + 30_000) return;
      jobs.push(
        Notifications.scheduleNotificationAsync({
          content: { title, body, data: { date: toKey(date), kind }, ...(category ? { categoryIdentifier: category } : {}) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
        }),
      );
    };

    const today = new Date();
    for (let i = 0; i < DAYS; i++) {
      const day = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12), i);

      if (rm.morn) {
        const d = dayInfo(day, cal, lang);
        const lines = [
          d.title,
          rm.show.f ? `${t.fast}: ${t.fk[fastKind(d)]}` : '',
          rm.show.r && (d.r1 || d.r2) ? `${t.readings}: ${[d.r1, d.r2].filter(Boolean).join(' · ')}` : '',
          rm.show.n && d.names ? `${t.nNamesP}${d.names}` : '',
        ].filter(Boolean);
        add(at(day, rm.mornT), `${t.nTodayK}${weekdayName(day, lang)}, ${fmtDate(day, lang)}`, lines.join('\n'), day, 'morn', CATEGORY);
      }

      if (rm.eve) {
        const next = addDays(day, 1);
        const d = dayInfo(next, cal, lang);
        const date = fmtDate(next, lang);
        const title =
          d.rank === 2 && d.title
            ? `${t.nFeastTomorrow}${d.title}`
            : `${t.nTomorrow}${date}${rm.show.f && d.isFast ? t.nFastDay : ''}`;
        const fastLine =
          rm.show.f && d.isFast
            ? `${cap(weekdayName(next, lang))}: ${d.rank === 2 ? t.fastFish : d.rank === 1 ? t.fastOil : t.fastStrict}`
            : '';
        const lines = [
          [fastLine, d.title && !(d.rank === 2) ? `${t.nMemory}${d.title}` : ''].filter(Boolean).join(' '),
          rm.show.n && d.names ? `${t.nNamesP}${d.names}` : '',
        ].filter(Boolean);
        add(at(day, rm.eveT), title, lines.join('\n'), next, 'eve');
      }

      if (rm.pre) {
        const f = addDays(day, PRE_DAYS);
        const d = dayInfo(f, cal, lang);
        if (d.rank === 2 && d.title) add(at(day, rm.mornT, 1), t.nApp, `${t.nInDays}${fmtDate(f, lang)}: ${d.title}.`, f, 'pre');
      }

      if (angOn) {
        // Увечері напередодні — у час вечірнього нагадування, у сам день — у час ранкового.
        const next = addDays(day, 1);
        const eveN = angelsOn(angels, next);
        if (eveN.length) add(at(day, rm.eveT, 1), `${t.nAngTomorrow}${eveN.join(', ')}`, eveN.length > 1 ? t.nAngEveM : t.nAngEve, next, 'angE');
        const todayN = angelsOn(angels, day);
        if (todayN.length) add(at(day, rm.mornT, 2), `${t.nAngToday}${todayN.join(', ')}`, todayN.length > 1 ? t.nAngDayM : t.nAngDay, day, 'angM');
      }

      if (rm.show.p) {
        const meta = pomN > 0 ? `${t.nPrayMeta} · ${t.pom}: ${pomN}` : t.nPrayMeta;
        add(at(day, rm.mornT, 30), t.nMornPrayers, meta, day, 'prayM');
        add(at(day, rm.eveT, 90), t.nEvePrayers, meta, day, 'prayE');
      }
    }
    await Promise.all(jobs);
  } catch {
    // нагадування не критичні для роботи застосунку
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Підписка на натискання сповіщень; повертає дату дня і дію. */
export function onNotifResponse(cb: (date: string, action: NotifAction, kind: string) => void): () => void {
  if (!NATIVE) return () => {};
  const handle = (r: Notifications.NotificationResponse | null) => {
    if (!r) return;
    const data = r.notification.request.content.data as { date?: string; kind?: string } | undefined;
    if (!data?.date) return;
    const a = r.actionIdentifier;
    const action: NotifAction = a === 'prayers' || a === 'reading' || a === 'life' ? a : 'open';
    cb(data.date, action, data.kind ?? '');
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
