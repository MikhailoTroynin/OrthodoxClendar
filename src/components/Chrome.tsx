import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FONT } from '../theme';
import { Overlay, Tab, useStore } from '../store';
import { MB } from '../data/prayers';
import { PSALTYR } from '../data/psaltyr';
import { bookName, chapTitle } from '../lib/bible';
import { Icon, Kicker, Press } from './ui';

/** Верхня панель вкладки: підпис, перемикач теми, пошук. */
export function TopBar({ kicker }: { kicker: string }) {
  const { p, theme, set, push, t } = useStore();
  const night = theme === 'night';
  return (
    <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 14 }}>
      <Kicker>{kicker}</Kicker>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <Press
          label={night ? t.toDay : t.toNight}
          onPress={() => set({ theme: night ? 'day' : 'night' })}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={night ? 'sun' : 'moon'} color={p.text} />
        </Press>
        <Press
          label={t.search}
          onPress={() => push({ t: 'search' })}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="search" color={p.text} />
        </Press>
      </View>
    </View>
  );
}

/** Назва екрана для кнопки «Назад»: куди вона повертає. */
function screenName(o: Overlay | undefined, tab: Tab, t: Record<string, any>, ul: boolean): string {
  const nm = (x: { u: string; e: string }) => (ul ? x.u : x.e);
  if (!o) return { today: t.tab0, cal: t.tab1, book: t.prayerBook, bible: t.scripture, more: t.menu }[tab];
  switch (o.t) {
    case 'sec': return nm(MB[o.s]);
    case 'read': return nm(MB[o.s].items[o.j]);
    case 'book': return nm(o.b);
    case 'chap': return chapTitle(o.b, o.c, ul);
    case 'pass': return o.title;
    case 'kath': return `${t.kathisma} ${o.k}`;
    case 'ps': return nm(PSALTYR[o.i]);
    case 'life': return t.life2;
    case 'search': return t.search;
    case 'settings': return t.settings;
    case 'remind': return t.rTitle;
    case 'pom': return t.pom;
    case 'jesus': return t.jesus;
    case 'donate': return t.supportRow;
    case 'ver': return t.versions;
  }
}

/** Верхня панель вторинного екрана: «Назад» із назвою попереднього екрана і підпис. */
export function BackBar({ kicker, right }: { kicker?: string; right?: React.ReactNode }) {
  const { p, pop, t, ov, tab, lang } = useStore();
  const label = screenName(ov[ov.length - 2], tab, t, lang === 'uk');
  return (
    <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 8, paddingRight: 14 }}>
      <Press onPress={pop} label={`${t.back}: ${label}`} style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingRight: 10, flexShrink: 1, maxWidth: 220 }}>
        <Icon name="left" color={p.a700} size={22} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONT.headingBold, fontSize: 16, color: p.a700 }}>{label}</Text>
      </Press>
      {right ?? (kicker ? <Kicker style={{ flexShrink: 1, textAlign: 'right' }}>{kicker}</Kicker> : null)}
    </View>
  );
}

const TABS: { k: Tab; icon: string; label: string }[] = [
  { k: 'today', icon: 'today', label: 'tab0' },
  { k: 'cal', icon: 'calendar', label: 'tab1' },
  { k: 'book', icon: 'book', label: 'tab2' },
  { k: 'bible', icon: 'cross', label: 'tab3' },
  { k: 'more', icon: 'menu', label: 'tab4' },
];

export function TabBar() {
  const { p, tab, goTab, t } = useStore();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: p.divider, backgroundColor: p.bg, paddingTop: 6, paddingBottom: 6, paddingHorizontal: 4 }}>
      {TABS.map((x) => {
        const on = tab === x.k;
        const color = on ? p.a700 : p.n600;
        return (
          <Pressable
            key={x.k}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => goTab(x.k)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 52,
              paddingVertical: 4,
              borderRadius: 4,
              backgroundColor: pressed ? p.mute(5) : 'transparent',
            })}
          >
            {/* Золота риска над активною вкладкою. */}
            <View style={{ position: 'absolute', top: -7, width: 28, height: 2, borderRadius: 1, backgroundColor: p.accent, opacity: on ? 1 : 0 }} />
            <Icon name={x.icon} color={color} size={24} />
            <Text numberOfLines={2} style={{ fontFamily: FONT.body, fontSize: 11, lineHeight: 12.5, textAlign: 'center', color }}>
              {t[x.label]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
