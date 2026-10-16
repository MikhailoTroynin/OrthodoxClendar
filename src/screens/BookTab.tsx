import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ROM, WK } from '../data/prayerLists';
import { prayersL } from '../lib/lazy';
import { Body, H1, Heading, Icon, Kicker, NavRow, OutlineButton, Press, card } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { weekdayIdx, weekdayName } from '../lib/calendar';
import { useStore } from '../store';
import { FONT, RADIUS } from '../theme';

export default function BookTab() {
  const { p, t, lang, today, push, jc, jt } = useStore();
  const ul = lang === 'uk';
  const nm = (x: { u: string; e: string }) => (ul ? x.u : x.e);
  const mt = (x: { mu: string; me: string }) => (ul ? x.mu : x.me);
  const wi = weekdayIdx(today);
  const wk = WK[wi];
  const MB = prayersL()!.MB; // вкладка відкривається, коли молитвослов уже завантажено (див. App)
  const ak = MB[3].items[wk[0]];
  const morning = MB[0].items[0];

  return (
    <View style={{ flex: 1 }}>
      <TopBar kicker={`${t.byDay} · ${weekdayName(today, lang)}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 }}>
        <View style={{ marginBottom: 20 }}>
          <H1>{t.prayerBook}</H1>
        </View>

        <View style={card(p)}>
          <View style={{ padding: 16, gap: 6 }}>
            <Kicker>{t.nowMorning}</Kicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Heading size={21}>{nm(morning)}</Heading>
                <Body size={12.5} mute={60}>{mt(morning)}</Body>
              </View>
              <OutlineButton label={t.start} onPress={() => push({ t: 'read', s: 0, j: 0 })} />
            </View>
          </View>
          <Press
            onPress={() => push({ t: 'read', s: 3, j: wk[0] })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: p.divider, borderRadius: 0 }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Kicker>{`${t.byDay} · ${weekdayName(today, lang)}`}</Kicker>
              <Heading size={17}>{nm(ak)}</Heading>
              <Body size={12} mute={60}>{`${t.dayDedic}${ul ? wk[1] : wk[2]}.`}</Body>
            </View>
            <Icon name="right" size={18} color={p.mute(50)} />
          </Press>
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
