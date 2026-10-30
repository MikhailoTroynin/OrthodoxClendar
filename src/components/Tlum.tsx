// Тлумачення псалмів Євфимія Зигабена та Євангелія блж. Феофілакта: значок біля псалма й вірша і сторінка з тлумаченням,
// що розгортається від середини в боки, як розкрита книга.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, BackHandler, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { KATH_RANGE, TL, TL_LOAD, TlumPsalms, TlumSeg } from '../data/tlum';
import { EV_BOOK, TE, TE_LOAD } from '../data/tlumEv';
import { BOOKS, bookName } from '../lib/bible';
import { lazy, Lazy, useLazy } from '../lib/lazy';
import { useStore } from '../store';
import { FONT, NUM, RADIUS } from '../theme';
import { Icon, Kicker, OutlineButton, Press } from './ui';

const kathOf = (n: number) => KATH_RANGE.findIndex(([a, b]) => a <= n && n <= b) + 1;
const LOADERS: Record<number, Lazy<{ Z: TlumPsalms }>> = Object.fromEntries(
  Object.entries(TL_LOAD).map(([k, l]) => [k, lazy(l)]),
);

const LOADERS_EV: Record<string, Lazy<{ Z: TlumSeg[] }>> = Object.fromEntries(
  Object.entries(TE_LOAD).map(([k, l]) => [k, lazy(l)]),
);

/** Чи є тлумачення псалма n (або його вірша v); з e — глави n Євангелія e (mt, mk, lk, jn). */
export const hasTlum = (n: number, v?: number, e?: string) => {
  const vs = e ? TE[`${e}:${n}`] : TL[n];
  return !!vs && (v === undefined || vs.includes(v));
};

/** Код Євангелія (mt, mk, lk, jn) для книги Біблії b — або undefined, якщо це не Євангеліє. */
export const evCode = (b: number) => EV_BOOK[BOOKS[b][0]];

// Відкрите тлумачення: один на весь застосунок, показується над усіма екранами (TlumHost).
type Open = { n: number; v?: number; e?: string } | null;
let open: Open = null;
const subs = new Set<() => void>();
const setOpen = (o: Open) => {
  open = o;
  subs.forEach((f) => f());
};
const useOpen = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => open,
  );

/** Відкриває тлумачення псалма n (або глави n Євангелія e), прокручене до вірша v. */
export const openTlum = (n: number, v?: number, e?: string) => hasTlum(n, undefined, e) && setOpen({ n, v, e });

/** Мнемонічний значок тлумачення: розгорнута книга з променем над нею. */
export function TlumGlyph({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 8.2C10 6.6 6.8 6 3 6.4v11.4c3.8-.4 7 .2 9 1.8 2-1.6 5.2-2.2 9-1.8V6.4c-3.8-.4-7 .2-9 1.8zM12 8.2v11.4" stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
      <Path d="M12 1.6v2.6M8.6 2.6l1 1.9M15.4 2.6l-1 1.9" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={12} cy={13.6} r={1.1} fill={color} />
    </Svg>
  );
}

/** Кнопка «Тлумачення» біля назви псалма чи глави Євангелія. */
export function TlumBtn({ n, e }: { n: number; e?: string }) {
  const { p, t } = useStore();
  if (!hasTlum(n, undefined, e)) return null;
  return (
    <Press label={`${t.tlum} · ${e ? n : `${t.psalm} ${n}`}`} onPress={() => openTlum(n, undefined, e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, borderColor: p.a300 }}>
      <TlumGlyph size={15} color={p.a700} />
      <Text style={{ fontFamily: FONT.body, fontSize: 12, color: p.a700 }}>{t.tlum}</Text>
    </Press>
  );
}

/** Маленький значок після номера вірша (усередині Text): дотик відкриває тлумачення вірша. */
export function TlumMark({ n, v, size, e }: { n: number; v: number; size: number; e?: string }) {
  const { p } = useStore();
  if (!hasTlum(n, v, e)) return null;
  return (
    <Text onPress={() => openTlum(n, v, e)} accessibilityRole="button" suppressHighlighting>
      {' '}
      <View style={{ width: size, height: size * 0.8, justifyContent: 'flex-end' }}>
        <TlumGlyph size={size} color={p.accent} />
      </View>
    </Text>
  );
}

const vLabel = (s: TlumSeg, t: Record<string, string>) =>
  /[-,]/.test(s.v) ? `${t.verses} ${s.v.replace('-', '–').replace(',', ', ')}` : `${t.verse} ${s.v}`;
const covers = (s: TlumSeg, v: number) => {
  const a = s.v.split(/[-,]/).map(Number);
  return s.v.includes('-') ? a[0] <= v && v <= a[a.length - 1] : a.includes(v);
};

/** Сторінка тлумачення над усіма екранами; розкривається від середини в боки. */
export function TlumHost() {
  const o = useOpen();
  const [shown, setShown] = useState<Open>(null);
  const spine = useRef(new Animated.Value(0)).current;
  const page = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const native = true;

  useEffect(() => {
    if (o) {
      setShown(o);
      if (shown) return; // інший псалом на вже розкритій сторінці
      [spine, page, text, fade].forEach((a) => a.setValue(0));
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: native }),
          Animated.timing(spine, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        ]),
        Animated.timing(page, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        Animated.timing(text, { toValue: 1, duration: 240, useNativeDriver: native }),
      ]).start();
    } else if (shown) {
      Animated.parallel([
        Animated.timing(text, { toValue: 0, duration: 120, useNativeDriver: native }),
        Animated.timing(page, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
        Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: native }),
      ]).start(() => setShown(null));
    }
  }, [o]);

  useEffect(() => {
    if (!o) return;
    const h = BackHandler.addEventListener('hardwareBackPress', () => (setOpen(null), true));
    return () => h.remove();
  }, [!!o]);

  if (!shown) return null;
  const close = () => setOpen(null);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents={o ? 'auto' : 'none'}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,14,6,0.55)', opacity: fade }}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="×" />
      </Animated.View>
      <View style={{ flex: 1, marginHorizontal: 12, marginVertical: 26 }} pointerEvents="box-none">
        <Page o={shown} close={close} page={page} text={text} spine={spine} />
      </View>
    </View>
  );
}

function Page({ o, close, page, text, spine }: { o: NonNullable<Open>; close: () => void; page: Animated.Value; text: Animated.Value; spine: Animated.Value }) {
  const { p, t, fs, lang } = useStore();
  const L: Lazy<{ Z: any }> = o.e ? LOADERS_EV[`${o.e}:${o.n}`] : LOADERS[kathOf(o.n)];
  const ready = useLazy(L);
  const segs: TlumSeg[] = ready ? (o.e ? L()!.Z : L()!.Z[o.n]) ?? [] : [];
  const scroll = useRef<ScrollView>(null);
  const ys = useRef<Record<number, number>>({});
  const target = o.v === undefined ? -1 : segs.findIndex((s) => covers(s, o.v!));
  useEffect(() => {
    ys.current = {};
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [o.n, o.e]);
  const onY = (i: number, y: number) => {
    ys.current[i] = y;
    if (i === target) setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 10), animated: false }), 30);
  };
  const body = { fontFamily: FONT.body, fontSize: fs - 1, lineHeight: (fs - 1) * 1.62, color: p.text } as const;
  // Сусідні псалми (або глави цього Євангелія) з тлумаченням.
  const ids = o.e ? Object.keys(TE).filter((k) => k.startsWith(`${o.e}:`)).map((k) => +k.slice(3)) : Object.keys(TL).map(Number);
  const prev = ids.filter((x) => x < o.n).pop();
  const next = ids.find((x) => x > o.n);
  const book = o.e ? BOOKS.findIndex((b) => EV_BOOK[b[0]] === o.e) : -1;
  const title = o.e ? `${bookName(book, lang === 'uk')} ${o.n}` : `${t.psalm} ${o.n}`;
  const lab = (x: number) => (o.e ? `${t.chapter} ${x}` : `${t.psalm} ${x}`);
  // Корінець книги: тонка золота риска, з якої розгортається сторінка.
  const spineOp = Animated.multiply(spine, page.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.6, 0] }));
  return (
    <View style={{ flex: 1 }}>
      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, backgroundColor: p.accent,
          opacity: spineOp, transform: [{ scaleY: spine }],
        }}
      />
      <Animated.View
        style={{
          flex: 1, backgroundColor: p.bg, borderRadius: RADIUS * 2, borderWidth: 1, borderColor: p.a300, overflow: 'hidden',
          opacity: page.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] }),
          transform: [{ scaleX: page.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] }) }],
          shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 12,
        }}
      >
        {/* Згин посередині, що зникає, коли сторінка розгорнулась. */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 28, marginLeft: -14, backgroundColor: p.a100, opacity: page.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.5, 0] }) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 4, paddingTop: 6, borderBottomWidth: 1, borderBottomColor: p.divider }}>
          <TlumGlyph size={18} color={p.a700} />
          <Kicker style={{ flex: 1, marginLeft: 8 }}>{o.e ? t.tlumByEv : t.tlumBy}</Kicker>
          <Press label="×" onPress={close} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={20} color={p.mute(65)} />
          </Press>
        </View>
        <Animated.View style={{ flex: 1, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30 }}>
            <Text style={{ fontFamily: FONT.heading, fontSize: 30, lineHeight: 34, color: p.text, marginBottom: 4 }}>{title}</Text>
            <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: 13, color: p.mute(60), marginBottom: 14 }}>{o.e ? t.tlumSubEv : t.tlumSub}</Text>
            {!ready && <Text style={{ ...body, color: p.mute(50) }}>…</Text>}
            {segs.map((s, i) => {
              const lit = i === target;
              return (
                <View
                  key={i}
                  onLayout={(e) => onY(i, e.nativeEvent.layout.y)}
                  style={{ marginBottom: 12, paddingVertical: lit ? 8 : 0, paddingHorizontal: lit ? 10 : 0, marginHorizontal: lit ? -10 : 0, backgroundColor: lit ? p.a100 : 'transparent', borderRadius: RADIUS }}
                >
                  {s.v !== '0' && s.v !== segs[i - 1]?.v && (
                    <Text style={[{ fontFamily: FONT.headingBold, fontSize: 15, color: p.a700, letterSpacing: 0.4, marginTop: 4, marginBottom: 2 }, NUM]}>{vLabel(s, t)}</Text>
                  )}
                  {!!s.h && (
                    <Text style={{ ...body, fontFamily: FONT.bodyBold, fontSize: fs - 2, lineHeight: (fs - 2) * 1.5, color: p.a800, marginBottom: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: p.a300 }}>{s.h}</Text>
                  )}
                  {s.t.map((x, j) => (
                    <Text key={j} style={{ ...body, marginBottom: 8 }}>{x}</Text>
                  ))}
                </View>
              );
            })}
            {ready && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                {prev ? <OutlineButton label={`← ${lab(prev)}`} onPress={() => setOpen({ n: prev, e: o.e })} /> : <View />}
                {next ? <OutlineButton label={`${lab(next)} →`} onPress={() => setOpen({ n: next, e: o.e })} /> : <View />}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
