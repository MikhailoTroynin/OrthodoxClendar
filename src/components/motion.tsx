import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleProp, View, ViewStyle } from 'react-native';
import { Icon } from './ui';

/** Крива руху з макета: швидкий старт, м'яка зупинка. */
export const EASE = Easing.bezier(0.2, 0.7, 0.2, 1);

/** Чи просив користувач менше руху: тоді зсуви замінюємо появою або вимикаємо. */
export function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setR(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setR);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return r;
}

/** Свайп убік: від 56 пікселів і помітно горизонтальний (|dx| > 1,6·|dy|). Вертикальну прокрутку не чіпає. */
export function useSwipe(onNext?: () => void, onPrev?: () => void) {
  const cb = useRef({ onNext, onPrev });
  cb.current = { onNext, onPrev };
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) < 56 || Math.abs(g.dx) < Math.abs(g.dy) * 1.6) return;
          if (g.dx < 0) cb.current.onNext?.();
          else cb.current.onPrev?.();
        },
      }).panHandlers,
    [],
  );
}

/** Поява зсувом на 28 пікселів з боку свайпу й проявою за 260 мс (dir: 1 — з правого боку, −1 — з лівого). */
export function SlideIn({ dir, children, style }: { dir: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(dir ? 0 : 1)).current;
  useEffect(() => {
    if (!dir) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [dir, v]);
  const x = reduce ? 0 : dir * 28;
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [x, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Розгортання блоку: висота й прозорість за 320 мс. */
export function Collapse({ open, children, ms = 320 }: { open: boolean; children: React.ReactNode; ms?: number }) {
  const reduce = useReduceMotion();
  const [h, setH] = useState(0);
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    Animated.timing(v, { toValue: open ? 1 : 0, duration: reduce ? 0 : ms, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [open, reduce, ms, v]);
  return (
    <Animated.View style={{ overflow: 'hidden', opacity: v, height: h ? v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }) : open ? undefined : 0 }}>
      <View style={h ? { position: 'absolute', top: 0, left: 0, right: 0 } : undefined} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

/** Шеврон, що повертається на 90° за 250 мс, коли блок відкрито. */
export function Chevron({ open, color, size = 18 }: { open: boolean; color: string; size?: number }) {
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: open ? 1 : 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [open, v]);
  return (
    <Animated.View style={{ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}>
      <Icon name="right" size={size} color={color} />
    </Animated.View>
  );
}
