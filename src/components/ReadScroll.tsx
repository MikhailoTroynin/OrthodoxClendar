import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { Mark, MarkTarget, markKey, useStore } from '../store';
import { FONT, RADIUS } from '../theme';
import { Icon, Press } from './ui';

const TRACK = 2;
const THUMB = 3;
const MIN_THUMB = 28;
const INSET = 6;
/** Ширина області дотику навколо повзунка. */
const GRIP = 26;
/** Скільки тримати повзунок, щоб поставити закладку. */
const HOLD_MS = 450;

/** Абзац, зареєстрований у ReadScroll: до нього прив'язуються закладки. */
interface Reg {
  ref: React.RefObject<View | null>;
  text: string;
  h?: boolean;
}
/** Виміряний абзац: положення в тексті, висота, текст; h — заголовок. */
interface Para {
  y: number;
  hh: number;
  text: string;
  h?: boolean;
}

const AnchorCtx = createContext<Set<Reg> | null>(null);

/** Абзац (або заголовок, якщо h), на який можна поставити закладку. Поза ReadScroll нічого не додає. */
export function Anchor({ text, h, children }: { text: string; h?: boolean; children: React.ReactNode }) {
  const regs = useContext(AnchorCtx);
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!regs) return;
    const r: Reg = { ref, text, h };
    regs.add(r);
    return () => void regs.delete(r);
  }, [regs, text, h]);
  if (!regs) return <>{children}</>;
  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  );
}

const measure = (el: any, rel: any) =>
  new Promise<{ y: number; h: number } | null>((res) => {
    const timer = setTimeout(() => res(null), 600);
    const done = (v: { y: number; h: number } | null) => {
      clearTimeout(timer);
      res(v);
    };
    try {
      el.measureLayout(rel, (_x: number, y: number, _w: number, h: number) => done({ y, h }), () => done(null));
    } catch {
      done(null);
    }
  });

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Уривок тексту з місця f (0…1): від початку слова, до ~90 знаків. */
function snippet(text: string, f: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  let start = Math.floor(f * s.length);
  start = start < 40 ? 0 : s.lastIndexOf(' ', start) + 1;
  let q = s.slice(start, start + 90);
  if (start + 90 < s.length) q = q.slice(0, Math.max(q.lastIndexOf(' '), 40)) + '…';
  return (start > 0 ? '…' : '') + q;
}

/** Абзац закладки: спершу той, що з тим самим початком тексту і найближчий до збереженого номера, інакше — за номером. */
function paraOf(m: Mark, ps: Para[]): Para | undefined {
  let best = -1;
  ps.forEach((x, k) => {
    if (x.text.slice(0, 40) === m.a && (best < 0 || Math.abs(k - m.i) < Math.abs(best - m.i))) best = k;
  });
  return ps[best >= 0 ? best : m.i];
}

/** Тост унизу екрана з необов'язковою дією («Скасувати», «Повернути»). */
export function useToast(): [React.ReactNode, (msg: string, act?: { label: string; fn: () => void }) => void] {
  const { p } = useStore();
  const [toast, setToast] = useState<{ msg: string; act?: { label: string; fn: () => void } } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((msg: string, act?: { label: string; fn: () => void }) => {
    clearTimeout(timer.current);
    setToast({ msg, act });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  const node = toast && (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center' }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 420, minHeight: 44, paddingLeft: 16, paddingRight: toast.act ? 4 : 16, borderRadius: RADIUS, backgroundColor: p.text }}
      >
        <Text style={{ flexShrink: 1, paddingVertical: 10, fontFamily: FONT.body, fontSize: 14, color: p.bg }}>{toast.msg}</Text>
        {toast.act && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.act!.fn();
              setToast(null);
            }}
            style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FONT.bodyBold, fontSize: 14, color: p.a300 }}>{toast.act.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
  return [node, show];
}

/** Звідки береться закладка: текст і його назва для переліку закладок. */
export interface MarkSrc {
  o: MarkTarget;
  title: string;
  kicker: string;
}

export interface ReadScrollHandle {
  /** Ставить закладку на рядок навпроти повзунка. */
  addMark: () => void;
}

/** Кнопка «Поставити закладку» для верхньої панелі екрана читання. */
export function MarkBtn({ onPress }: { onPress: () => void }) {
  const { p, t } = useStore();
  return (
    <Press label={t.markAdd} onPress={onPress} style={{ minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="bookmarkAdd" color={p.a700} />
    </Press>
  );
}

/** Прокрутка для довгого читання з тоненьким золотим повзунком праворуч: показує, на якій глибині тексту читач.
 *  З mark у тексті можна ставити закладки: на рядок навпроти повзунка (кнопкою вгорі або утримавши повзунок);
 *  goto — закладка, до якої прокрутити після відкриття. */
export const ReadScroll = forwardRef<ReadScrollHandle, { children: React.ReactNode; mark?: MarkSrc; goto?: string }>(function ReadScroll(
  { children, mark, goto },
  ref,
) {
  const { p, t, bm, set, fs } = useStore();
  const y = useRef(new Animated.Value(0)).current;
  const yNow = useRef(0);
  const sv = useRef<any>(null);
  const body = useRef<View>(null);
  const regs = useMemo(() => new Set<Reg>(), []);
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  const track = Math.max(0, view - INSET * 2);
  const max = content - view;
  const show = max > 8 && track > 0;
  const thumb = show ? Math.max(MIN_THUMB, Math.min(track, (track * view) / content)) : 0;
  const travel = track - thumb;

  const key = mark ? markKey(mark.o) : '';
  const mine = useMemo(() => (mark ? bm.filter((m) => markKey(m.o) === key) : []), [bm, key, !!mark]);
  const bmRef = useRef(bm);
  bmRef.current = bm;
  const [toast, showToast] = useToast();

  /** Абзаци тексту в порядку читання з положеннями відносно початку тексту. */
  const layout = useCallback(async (): Promise<Para[]> => {
    const root = body.current;
    if (!root) return [];
    const ms = await Promise.all(
      [...regs].map(async (r) => {
        const m = r.ref.current ? await measure(r.ref.current, root) : null;
        return m && m.h > 0 ? { y: m.y, hh: m.h, text: r.text, h: r.h } : null;
      }),
    );
    return (ms.filter(Boolean) as Para[]).sort((a, b) => a.y - b.y);
  }, [regs]);

  /** Де в тексті кожна закладка цього тексту: для позначок ліворуч і рисок на повзунку. */
  const [ys, setYs] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!mine.length || !content) return setYs({});
    let live = true;
    const h = setTimeout(async () => {
      const ps = await layout();
      if (!live) return;
      const out: Record<string, number> = {};
      mine.forEach((m) => {
        const a = paraOf(m, ps);
        out[m.id] = a ? a.y + m.f * a.hh : m.pos * content;
      });
      setYs(out);
    }, 150);
    return () => {
      live = false;
      clearTimeout(h);
    };
  }, [mine, content, fs, layout]);

  // Коротке золоте підсвічування рядка, куди поставлено закладку або куди перейшли за нею.
  const glow = useRef(new Animated.Value(0)).current;
  const [glowY, setGlowY] = useState<number | null>(null);
  const flash = useCallback(
    (at: number) => {
      setGlowY(at);
      glow.setValue(1);
      Animated.timing(glow, { toValue: 0, duration: 1600, delay: 700, useNativeDriver: true }).start(() => setGlowY(null));
    },
    [glow],
  );

  const remove = useCallback(
    (m: Mark) => {
      set({ bm: bmRef.current.filter((x) => x.id !== m.id) });
      showToast(t.markRemoved, { label: t.restore, fn: () => set({ bm: [...bmRef.current.filter((x) => x.id !== m.id), m] }) });
    },
    [set, showToast, t],
  );

  const geo = useRef({ show, travel, thumb, max, content });
  geo.current = { show, travel, thumb, max, content };
  const addMark = useCallback(async () => {
    if (!mark) return;
    const g = geo.current;
    // Рядок навпроти середини повзунка; якщо текст вміщається на екрані — верх тексту.
    const pt = yNow.current + (g.show ? INSET + (g.travel * clamp(yNow.current / g.max, 0, 1)) + g.thumb / 2 : 0);
    const ps = await layout();
    let i = ps.findIndex((a) => a.y + a.hh > pt);
    if (i < 0) i = ps.length - 1;
    const a = ps[i];
    // На заголовку закладка стає на сам заголовок, а не на відступ над ним.
    const f = !a ? 0 : a.h ? 0.6 : clamp((pt - a.y) / a.hh, 0, 1);
    const near = bmRef.current.find((m) => markKey(m.o) === markKey(mark.o) && m.i === i && Math.abs(m.f - f) < 0.12);
    if (near) {
      flash(pt);
      return showToast(t.markExists);
    }
    let h: string | undefined;
    for (let k = i - 1; k >= 0 && !a?.h; k--) if (ps[k].h) {
      h = ps[k].text;
      break;
    }
    const m: Mark = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      o: mark.o,
      title: mark.title,
      kicker: mark.kicker,
      i: Math.max(0, i),
      a: a ? a.text.slice(0, 40) : '',
      f,
      pos: g.content ? clamp(pt / g.content, 0, 1) : 0,
      q: a ? (a.h ? a.text : snippet(a.text, f)) : mark.title,
      h,
      at: Date.now(),
    };
    set({ bm: [...bmRef.current, m] });
    flash(pt);
    showToast(t.markAdded, { label: t.undo, fn: () => set({ bm: bmRef.current.filter((x) => x.id !== m.id) }) });
  }, [mark, layout, set, flash, showToast, t]);

  useImperativeHandle(ref, () => ({ addMark }), [addMark]);

  // Перехід за закладкою: коли текст розмічено, прокручуємо так, щоб рядок закладки був у верхній третині екрана.
  const went = useRef(false);
  useEffect(() => {
    if (!goto || went.current || !content || !view) return;
    const m = bmRef.current.find((x) => x.id === goto);
    if (!m) return;
    const h = setTimeout(async () => {
      const a = paraOf(m, await layout());
      const at = a ? a.y + m.f * a.hh : m.pos * content;
      went.current = true;
      sv.current?.scrollTo({ y: clamp(at - view * 0.3, 0, Math.max(0, content - view)), animated: false });
      flash(at);
    }, 250);
    return () => clearTimeout(h);
  }, [goto, content, view, layout, flash]);

  // Повзунок можна тягнути (прокручує текст), а якщо втримати — ставить закладку.
  const addRef = useRef(addMark);
  addRef.current = addMark;
  const pan = useMemo(() => {
    let start = 0;
    let moved = false;
    let hold: ReturnType<typeof setTimeout> | undefined;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start = yNow.current;
        moved = false;
        hold = setTimeout(() => {
          hold = undefined;
          if (!moved) addRef.current();
        }, HOLD_MS);
      },
      onPanResponderMove: (_e, s) => {
        if (!moved && Math.abs(s.dy) < 6) return;
        moved = true;
        clearTimeout(hold);
        const g = geo.current;
        if (g.travel > 0) sv.current?.scrollTo({ y: clamp(start + (s.dy * g.max) / g.travel, 0, g.max), animated: false });
      },
      onPanResponderRelease: () => clearTimeout(hold),
      onPanResponderTerminate: () => clearTimeout(hold),
    });
  }, []);

  const lineH = fs * 1.65;
  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={sv}
        onLayout={(e) => setView(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContent(h)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
          useNativeDriver: true,
          listener: (e: any) => {
            yNow.current = e.nativeEvent.contentOffset.y;
          },
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <AnchorCtx.Provider value={mark ? regs : null}>
          <View ref={body} collapsable={false} style={{ paddingHorizontal: 24 }}>
            {glowY !== null && (
              <Animated.View
                pointerEvents="none"
                style={{ position: 'absolute', left: 14, right: 14, top: glowY - lineH * 0.75, height: lineH * 1.5, borderRadius: RADIUS, backgroundColor: p.accentA(18), opacity: glow }}
              />
            )}
            {children}
            {/* Позначки закладок ліворуч від тексту; дотик видаляє закладку (її можна повернути з тосту). */}
            {mine.map((m) =>
              ys[m.id] === undefined ? null : (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.markDel}: ${m.q}`}
                  onPress={() => remove(m)}
                  hitSlop={10}
                  style={{ position: 'absolute', left: 4, top: ys[m.id] - 9, width: 16, height: 18, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="bookmark" size={15} sw={1.5} color={p.accent} fill={p.accent} />
                </Pressable>
              ),
            )}
          </View>
        </AnchorCtx.Provider>
      </Animated.ScrollView>
      {show && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: INSET, bottom: INSET, right: 0, width: GRIP }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right: 4 + (THUMB - TRACK) / 2, width: TRACK, borderRadius: 1, backgroundColor: p.divider }} />
          {/* Риски закладок на доріжці повзунка. */}
          {mine.map((m) =>
            ys[m.id] === undefined ? null : (
              <View
                key={m.id}
                pointerEvents="none"
                style={{ position: 'absolute', right: 2, width: 7, height: 2, borderRadius: 1, backgroundColor: p.a700, top: clamp((ys[m.id] / content) * track, 0, track - 2) }}
              />
            ),
          )}
          <Animated.View
            {...(mark ? pan.panHandlers : {})}
            pointerEvents={mark ? 'auto' : 'none'}
            accessible={!!mark}
            accessibilityLabel={mark ? t.markAdd : undefined}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: GRIP,
              height: thumb,
              alignItems: 'flex-end',
              paddingRight: 4,
              transform: [{ translateY: y.interpolate({ inputRange: [0, max], outputRange: [0, travel], extrapolate: 'clamp' }) }],
            }}
          >
            <View style={{ width: THUMB, height: '100%', borderRadius: THUMB / 2, backgroundColor: p.accent }} />
          </Animated.View>
        </View>
      )}
      {toast}
    </View>
  );
});
