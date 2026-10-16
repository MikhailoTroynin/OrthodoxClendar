import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, View, useWindowDimensions } from 'react-native';
import { toKey } from '../lib/calendar';

const DAY = 86400000;
/** Номер дня без годинних поясів і переходу на літній час. */
const dayNum = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
const fromNum = (n: number) => {
  const u = new Date(n * DAY);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};

/** Гортання днів пальцем: сторінки лежать поруч і їдуть разом за пальцем, сусідній день «затягується» на екран.
 *  Кожна сторінка стоїть на своєму місці (номер дня × ширина), тож після переходу нічого не перемальовується з нуля. */
export function DayPager({ date, setDate, render }: { date: Date; setDate: (d: Date) => void; render: (d: Date) => React.ReactNode }) {
  const win = useWindowDimensions();
  const [w, setW] = useState(win.width);
  const x = useRef(new Animated.Value(0)).current;
  // Початок відліку: сторінки рахуються від дня, з яким відкрилась вкладка, щоб зсуви лишались невеликими.
  const anchor = useRef(dayNum(date)).current;
  const idx = dayNum(date) - anchor;

  const live = useRef({ idx, w, start: 0, setDate });
  live.current.idx = idx;
  live.current.w = w;
  live.current.setDate = setDate;
  // Яка сторінка зараз на екрані: лишаємо її намальованою, поки зсув не дожене новий день (щоб не блимало порожнім).
  const shown = useRef(idx);

  useLayoutEffect(() => {
    const to = -idx * w;
    const from = shown.current;
    shown.current = idx;
    if (Math.abs(from - idx) === 1) {
      // Сусідній день (із тижневої смужки чи після свайпу): доїжджаємо плавно; після свайпу зсув уже на місці.
      Animated.timing(x, { toValue: to, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    } else {
      x.stopAnimation();
      x.setValue(to);
    }
  }, [idx, w, x]);

  const pan = useMemo(() => {
    const settle = (dx: number, vx: number) => {
      const { idx: i, w: W } = live.current;
      let dir = 0;
      if (dx < -W * 0.22 || (vx < -0.35 && dx < -16)) dir = 1;
      else if (dx > W * 0.22 || (vx > 0.35 && dx > 16)) dir = -1;
      const target = i + dir;
      const dist = Math.abs(-target * W - live.current.start - dx);
      const duration = Math.max(160, Math.min(320, (dist / W) * 360));
      Animated.timing(x, { toValue: -target * W, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
        if (finished && dir !== 0) {
          shown.current = target;
          live.current.setDate(fromNum(anchor + target));
        }
      });
    };
    return PanResponder.create({
      // Перехоплюємо лише явно горизонтальний рух; вертикальна прокрутка сторінки лишається за ScrollView.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderGrant: () => {
        x.stopAnimation((v) => (live.current.start = v));
      },
      onPanResponderMove: (_, g) => {
        const { idx: i, w: W, start } = live.current;
        // Не далі за сусідній день.
        x.setValue(Math.max(-(i + 1) * W, Math.min(-(i - 1) * W, start + g.dx)));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => settle(g.dx, g.vx),
      onPanResponderTerminate: () => settle(0, 0),
    });
  }, [x, anchor]);

  const pages = [...new Set([idx - 1, idx, idx + 1, shown.current])];
  // Стрічка сторінок має охоплювати всі намальовані дні: на Android дотики не доходять до дочірніх View
  // поза межами батька, і після свайпу сторінку не можна було прокрутити вертикально.
  const lo = Math.min(...pages);
  const hi = Math.max(...pages);
  return (
    <View style={{ flex: 1, overflow: 'hidden' }} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: lo * w, width: (hi - lo + 1) * w, transform: [{ translateX: x }] }}>
        {pages.map((k) => {
          const d = fromNum(anchor + k);
          return (
            <View key={toKey(d)} style={{ position: 'absolute', top: 0, bottom: 0, left: (k - lo) * w, width: w }}>
              {render(d)}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}
