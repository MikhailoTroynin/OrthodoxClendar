import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { FONT } from '../theme';
import { Overlay, Tab, useStore } from '../store';
import { prayersL, psaltyrL } from '../lib/lazy';
import { bookName, chapTitle } from '../lib/bible';
import { Icon, Kicker, Press } from './ui';

/** Кнопка переліку закладок; зафарбована, коли закладки є. */
function MarksBtn() {
  const { p, push, t, bm } = useStore();
  return (
    <Press
      label={t.marks}
      onPress={() => push({ t: 'marks' })}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="bookmark" color={bm.length ? p.accent : p.text} fill={bm.length ? p.accent : undefined} />
    </Press>
  );
}

/** Верхня панель вкладки: підпис, закладки, пошук. Перемикач теми — в Меню та Налаштуваннях. */
export function TopBar({ kicker }: { kicker: string }) {
  const { p, push, t } = useStore();
  return (
    <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 14 }}>
      <Kicker>{kicker}</Kicker>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <MarksBtn />
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
  const mb = prayersL()?.MB;
  const ps = psaltyrL()?.PSALTYR;
  if (!o) return { today: t.tab0, cal: t.tab1, book: t.prayerBook, bible: t.scripture, more: t.menu }[tab];
  switch (o.t) {
    case 'sec': return mb ? nm(mb[o.s]) : '';
    case 'read': return mb ? nm(mb[o.s].items[o.j]) : '';
    case 'book': return nm(o.b);
    case 'chap': return chapTitle(o.b, o.c, ul);
    case 'pass': return o.title;
    case 'kath': return `${t.kathisma} ${o.k}`;
    case 'ps': return ps ? nm(ps[o.i]) : '';
    case 'life': return t.life2;
    case 'search': return t.search;
    case 'settings': return t.settings;
    case 'remind': return t.rTitle;
    case 'angels': return t.angTitle;
    case 'pom': return t.pom;
    case 'jesus': return t.jesus;
    case 'donate': return t.supportRow;
    case 'ver': return t.versions;
    case 'psalter': return t.psalter;
    case 'marks': return t.marks;
  }
}

/** Верхня панель вторинного екрана: «Назад» із назвою попереднього екрана, підпис і кнопка закладок (крім самого переліку закладок). */
export function BackBar({ kicker, right }: { kicker?: string; right?: React.ReactNode }) {
  const { p, pop, t, ov, tab, lang } = useStore();
  const label = screenName(ov[ov.length - 2], tab, t, lang === 'uk');
  const marks = ov[ov.length - 1]?.t !== 'marks';
  return (
    <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 8, paddingRight: 14 }}>
      <Press onPress={pop} label={`${t.back}: ${label}`} style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingRight: 10, flexShrink: 1, maxWidth: 220 }}>
        <Icon name="left" color={p.a700} size={22} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONT.headingBold, fontSize: 16, color: p.a700 }}>{label}</Text>
      </Press>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 1 }}>
        {right ?? (kicker ? <Kicker style={{ flexShrink: 1, textAlign: 'right' }}>{kicker}</Kicker> : null)}
        {marks && <MarksBtn />}
      </View>
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

const SLIDE = Easing.bezier(0.2, 0.7, 0.2, 1);

export function TabBar() {
  const { p, tab, goTab, t } = useStore();
  const [w, setW] = useState(0);
  const idx = TABS.findIndex((x) => x.k === tab);
  const x = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  // Ширина вкладки: панель мінус бічні поля 4 + 4, ділена на п'ять.
  const cell = (w - 8) / TABS.length;
  useEffect(() => {
    if (!w) return;
    const to = 4 + cell * idx + (cell - 28) / 2;
    if (first.current) {
      first.current = false;
      x.setValue(to);
      return;
    }
    // Золота риска їде до активної вкладки одним рухом, а не гасне й спалахує на місці.
    Animated.timing(x, { toValue: to, duration: 300, easing: SLIDE, useNativeDriver: true }).start();
  }, [idx, w, cell, x]);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: p.divider, backgroundColor: p.bg, paddingTop: 6, paddingBottom: 6, paddingHorizontal: 4 }}
    >
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: -1, left: 0, width: 28, height: 2, borderRadius: 1, backgroundColor: p.accent, transform: [{ translateX: x }] }}
      />
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
