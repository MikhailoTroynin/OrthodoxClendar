import React from 'react';
import { ScrollView, View } from 'react-native';
import { PL } from '../data/strings';
import { H1, Kicker, NavRow, Seg, Body, card } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { useStore } from '../store';
import { groupItem } from '../lib/bible';
import { GOSPELS, gospelRead } from './BibleTab';

export default function MenuTab() {
  const { p, t, lang, cal, theme, set, push, pom, jc, kd, bd } = useStore();
  const ul = lang === 'uk';
  const pomN = pom.h.length + pom.r.length;
  const pomWord = ul ? PL(pomN, t.nmW) : pomN === 1 ? t.nmW[0] : t.nmW[1];
  const gos = gospelRead(bd);
  const left = GOSPELS - gos;
  const leftSub = `${t.left} ${left} ${ul ? PL(left, t.chW) : left === 1 ? t.chW[0] : t.chW[1]}`;

  return (
    <View style={{ flex: 1 }}>
      <TopBar kicker="" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 }}>
        <View style={{ marginBottom: 20 }}>
          <H1>{t.menu}</H1>
        </View>

        <Kicker style={{ marginBottom: 8 }}>{t.personal}</Kicker>
        <View style={[card(p), { marginBottom: 24 }]}>
          <NavRow title={t.pom} value={`${pomN} ${pomWord}`} onPress={() => push({ t: 'pom' })} />
          <NavRow title={t.jesus} value={`${t.todayW}: ${jc}`} onPress={() => push({ t: 'jesus' })} />
          <NavRow title={t.psRead} value={`${kd.length} / 20`} onPress={() => push({ t: 'psalter' })} />
          <NavRow title={t.gosRead} sub={leftSub} value={`${gos} / ${GOSPELS}`} onPress={() => push({ t: 'book', b: groupItem(5) })} last />
        </View>

        <Kicker style={{ marginBottom: 8 }}>{t.support}</Kicker>
        <View style={[card(p), { marginBottom: 24 }]}>
          <NavRow title={t.supportRow} sub={t.supportSub} onPress={() => push({ t: 'donate' })} last />
        </View>

        <Kicker style={{ marginBottom: 8 }}>{t.app}</Kicker>
        <View style={{ marginBottom: 12 }}>
          <Body size={12.5} mute={60} style={{ marginBottom: 8 }}>{t.theme}</Body>
          <Seg
            opts={[
              { label: t.day, on: theme === 'day', onPress: () => set({ theme: 'day' }) },
              { label: t.night, on: theme === 'night', onPress: () => set({ theme: 'night' }) },
            ]}
          />
        </View>
        <View style={[card(p), { marginBottom: 24 }]}>
          <NavRow
            title={t.settings}
            sub={`${ul ? 'Українська' : 'English'} · ${cal === 'nj' ? t.nj : t.oj}`}
            onPress={() => push({ t: 'settings' })}
          />
          <NavRow title={t.versions} sub={t.verHelp} onPress={() => push({ t: 'ver' })} last />
        </View>
      </ScrollView>
    </View>
  );
}
