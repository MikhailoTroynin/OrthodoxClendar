import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FONT } from '../theme';
import { Tab, useStore } from '../store';
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

/** Верхня панель вторинного екрана: «Назад» і підпис. */
export function BackBar({ kicker, right }: { kicker?: string; right?: React.ReactNode }) {
  const { p, pop, t } = useStore();
  return (
    <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, paddingRight: 14 }}>
      <Press onPress={pop} label={t.back} style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingRight: 10 }}>
        <Icon name="left" color={p.a700} size={22} />
        <Text style={{ fontFamily: FONT.headingBold, fontSize: 16, color: p.a700 }}>{t.back}</Text>
      </Press>
      {right ?? (kicker ? <Kicker>{kicker}</Kicker> : null)}
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
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: p.divider, backgroundColor: p.bg, paddingTop: 8, paddingBottom: 6 }}>
      {TABS.map((x) => {
        const on = tab === x.k;
        const color = on ? p.a700 : p.n600;
        return (
          <Pressable
            key={x.k}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => goTab(x.k)}
            style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 }}
          >
            <Icon name={x.icon} color={color} size={22} sw={on ? 1.8 : 1.5} />
            <Text numberOfLines={1} style={{ fontFamily: FONT.body, fontSize: 10.5, color }}>
              {t[x.label]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
