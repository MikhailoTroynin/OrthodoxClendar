import React, { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DayRef, nowPrayer, ROM, WK } from '../data/prayerLists';
import type { Section } from '../data/prayers';
import { prayersL } from '../lib/lazy';
import { Body, H1, Heading, Icon, Kicker, NavRow, OutlineButton, Press, card } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { weekdayIdx, weekdayName } from '../lib/calendar';
import { useStore } from '../store';
import { FONT, RADIUS } from '../theme';

/** Розділ і номер молитви з повним текстом за посиланням DayRef (спершу шукаємо в «Акафістах» і «Канонах»). */
function findRef(MB: Section[], r: DayRef): { s: number; j: number } | undefined {
  const order = [3, 4, ...MB.map((_, i) => i).filter((i) => i !== 3 && i !== 4)];
  for (const s of order) {
    const j = MB[s].items.findIndex((it) =>
      it.mv?.some((m) => m.b === r.b && !m.a === !r.a && !m.k === !r.k && (r.s === undefined ? !m.s : m.s?.length === 1 && m.s[0] === r.s)),
    );
    if (j >= 0) return { s, j };
  }
}

/** Поточний час, що оновлюється щохвилини й після повернення в застосунок. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return now;
}

export default function BookTab() {
  const { p, t, lang, push, jc, jt } = useStore();
  const ul = lang === 'uk';
  const nm = (x: { u: string; e: string }) => (ul ? x.u : x.e);
  const mt = (x: { mu: string; me: string }) => (ul ? x.mu : x.me);
  const now = useNow();
  const wk = WK[weekdayIdx(now)];
  const MB = prayersL()!.MB; // вкладка відкривається, коли молитвослов уже завантажено (див. App)
  const np = nowPrayer(now.getHours());
  const cur = MB[0].items[np.j];
  const curK = np.part === 'morning' ? t.nowMorning : np.part === 'day' ? t.nowDay : t.nowEvening;
  const dayItems = wk[0].flatMap((r) => {
    const f = findRef(MB, r);
    return f ? [{ ...f, it: MB[f.s].items[f.j] }] : [];
  });

  return (
    <View style={{ flex: 1 }}>
      <TopBar kicker={`${t.byDay} · ${weekdayName(now, lang)}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 }}>
        <View style={{ marginBottom: 20 }}>
          <H1>{t.prayerBook}</H1>
        </View>

        <View style={card(p)}>
          <View style={{ padding: 16, gap: 6 }}>
            <Kicker>{curK}</Kicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Heading size={21}>{nm(cur)}</Heading>
                {!!mt(cur) && <Body size={12.5} mute={60}>{mt(cur)}</Body>}
              </View>
              <OutlineButton label={t.start} onPress={() => push({ t: 'read', s: 0, j: np.j })} />
            </View>
          </View>
          <View style={{ padding: 16, paddingBottom: 6, gap: 4, borderTopWidth: 1, borderTopColor: p.divider }}>
            <Kicker>{`${t.byDay} · ${weekdayName(now, lang)}`}</Kicker>
            <Body size={12} mute={60}>{`${t.dayDedic}${ul ? wk[1] : wk[2]}.`}</Body>
          </View>
          {dayItems.map((d, i) => (
            <Press
              key={i}
              onPress={() => push({ t: 'read', s: d.s, j: d.j })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 0 }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Heading size={17}>{nm(d.it)}</Heading>
                <Body size={12} mute={60}>{nm(MB[d.s])}</Body>
              </View>
              <Icon name="right" size={18} color={p.mute(50)} />
            </Press>
          ))}
          <View style={{ height: 6 }} />
        </View>

        <Press
          onPress={() => push({ t: 'jesus' })}
          style={[card(p), { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }]}
        >
          <Rope progress={Math.min(jc, jt) / jt} size={44} />
          <View style={{ flex: 1 }}>
            <Heading size={18}>{t.jesus}</Heading>
            <Body size={12.5} mute={60}>{t.jesusSub}</Body>
          </View>
          <Icon name="right" size={18} color={p.mute(50)} />
        </Press>

        <Kicker style={{ marginTop: 26, marginBottom: 4 }}>{t.sections}</Kicker>
        <View style={{ borderTopWidth: 1, borderTopColor: p.divider }}>
          {MB.map((s, i) => (
            <Press
              key={i}
              onPress={() => push({ t: 'sec', s: i })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderRadius: 0, borderBottomWidth: 1, borderBottomColor: p.divider }}
            >
              <Text numberOfLines={1} style={{ width: 36, fontFamily: FONT.heading, fontSize: 18, color: p.a700 }}>{ROM[i]}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Heading size={19}>{nm(s)}</Heading>
                <Text numberOfLines={1} style={{ fontFamily: FONT.body, fontSize: 12, color: p.mute(60) }}>
                  {s.items.slice(0, 3).map(nm).join(' · ')}
                </Text>
              </View>
              <Text style={{ fontFamily: FONT.body, fontSize: 13, color: p.mute(55) }}>{s.items.length}</Text>
              <Icon name="right" size={18} color={p.mute(50)} />
            </Press>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Кільце-прогрес для чоток. */
export function Rope({ progress, size }: { progress: number; size: number }) {
  const { p } = useStore();
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.divider} strokeWidth={2} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={p.accent}
        strokeWidth={2}
        fill="none"
        strokeDasharray={`${c}`}
        strokeDashoffset={c * (1 - progress)}
        strokeLinecap="round"
        rotation={-90}
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

export { NavRow, Pressable, RADIUS };
