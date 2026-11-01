// Нижня панель переходу «‹ Попередня · Позначити · Наступна ›» — спільна для глав Біблії, кафизм Псалтиря,
// молитов молитвослова й сторінок тлумачення.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useStore } from '../store';
import { FONT, RADIUS } from '../theme';
import { Icon, Press } from './ui';

/** Кнопка «Позначити»/«Прочитано»: фон з'являється за 300 мс, галочка вискакує зі збільшенням .4→1. */
export function ReadBtn({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  const { p } = useStore();
  const bg = useRef(new Animated.Value(done ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(bg, { toValue: done ? 1 : 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    if (done) {
      pop.setValue(0.4);
      Animated.timing(pop, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    }
  }, [done, bg, pop]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: done }}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, borderRadius: RADIUS, backgroundColor: pressed ? p.accentA(8) : 'transparent' })}
    >
      <Animated.View
        style={{
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderWidth: 1,
          borderColor: p.accent,
          borderRadius: RADIUS,
          backgroundColor: bg.interpolate({ inputRange: [0, 1], outputRange: [p.accentA(0), p.a100] }),
        }}
      >
        {done && (
          <Animated.View style={{ opacity: pop.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1] }), transform: [{ scale: pop }] }}>
            <Icon name="check" size={18} color={p.a700} sw={2} />
          </Animated.View>
        )}
        <Text numberOfLines={1} style={{ fontFamily: FONT.headingBold, fontSize: 16, color: p.a700 }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Панель: ліворуч «‹ Попередня», праворуч «Наступна ›» (тьмяніють, коли переходити нікуди), посередині — mark. */
export function NavBar({ prev, next, mark }: { prev?: () => void; next?: () => void; mark?: { done: boolean; label: string; onPress: () => void } }) {
  const { p, t } = useStore();
  const side = (label: string, text: string, go?: () => void) => (
    <Press label={label} onPress={() => go?.()} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 8, opacity: go ? 1 : 0.35 }}>
      <Text style={{ fontFamily: FONT.headingBold, fontSize: 16, color: p.a700 }}>{text}</Text>
    </Press>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: p.divider, backgroundColor: p.bg }}>
      {side(t.prevCh, `‹ ${t.prevCh}`, prev)}
      {mark ? <ReadBtn done={mark.done} label={mark.label} onPress={mark.onPress} /> : <View style={{ flex: 1 }} />}
      {side(t.nextCh, `${t.nextCh} ›`, next)}
    </View>
  );
}
