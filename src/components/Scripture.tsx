import React, { useState } from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import { BOOK, chapTitle, chapter, Ref, tokenize, Verse } from '../lib/bible';
import { useLazy } from '../lib/lazy';
import { useStore } from '../store';
import { FONT } from '../theme';
import { NUM, Press } from './ui';
import { TlumMark } from './Tlum';

/** Відкриває місце Писання: главу з виділеними віршами. */
export const refOverlay = (r: Ref) => ({ t: 'chap' as const, b: r.b, c: r.c, v: r.v, v2: r.c2 === r.c ? r.v2 : undefined });

/** Текст, у якому посилання на Писання («Лк. 1:39–49, 56») — активні. */
export function RefText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const { p, push, t } = useStore();
  const toks = tokenize(children);
  return (
    <Text style={style}>
      {toks.map((x, i) =>
        typeof x === 'string' ? (
          x
        ) : (
          <Text
            key={i}
            accessibilityRole="link"
            onPress={() => push({ t: 'pass', s: x.text, title: t.scripture })}
            style={{ color: p.a700, textDecorationLine: 'underline', textDecorationColor: p.a300 }}
          >
            {x.text}
          </Text>
        ),
      )}
    </Text>
  );
}

/** Перший рядок вірша — для попереднього перегляду паралельного місця. */
const snippet = (r: Ref) => {
  const v = chapter(r.b, r.c).vs.find((x) => x.n === r.v);
  if (!v) return '';
  const s = v.t.replace(/\n/g, ' ');
  return s.length > 110 ? s.slice(0, 108).replace(/\s+\S*$/, '') + '…' : s;
};

/** Паралельні місця вірша з початком тексту (книги, на які вони посилаються, довантажуються). */
function XRefs({ xs }: { xs: Ref[] }) {
  const { p, fs, push } = useStore();
  useLazy(...new Set(xs.map((r) => BOOK[r.b])));
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: p.a300, paddingLeft: 10, marginVertical: 6, gap: 6 }}>
      {xs.map((r, j) => (
        <Press key={j} onPress={() => push(refOverlay(r))} style={{ paddingVertical: 2 }}>
          <Text style={{ fontFamily: FONT.body, fontSize: fs * 0.78, lineHeight: fs * 1.15, color: p.mute(70) }}>
            <Text style={{ color: p.a700, textDecorationLine: 'underline', textDecorationColor: p.a300 }}>{r.label}</Text>
            {'  '}
            {snippet(r)}
          </Text>
        </Press>
      ))}
    </View>
  );
}

/**
 * Вірші з номерами. Номер вірша з паралельними місцями підкреслено: дотик розгортає їх список,
 * кожне місце відкривається окремою главою. hl — виділені вірші, onY — позиція вірша (для прокрутки),
 * tl — номер псалма, біля віршів якого показати значок тлумачення.
 */
export function Verses({ vs, b, c, hl, onY, tl }: { vs: Verse[]; b: number; c?: number; hl?: [number, number]; onY?: (n: number, y: number) => void; tl?: number }) {
  const { p, fs, lang } = useStore();
  const ul = lang === 'uk';
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const body = { fontFamily: FONT.body, fontSize: fs, lineHeight: fs * 1.6, color: p.text } as const;
  let prevC = c;
  return (
    <View>
      {vs.map((v, i) => {
        const vc = v.c ?? c;
        const head = vc !== prevC && vc !== undefined;
        prevC = vc;
        const key = `${vc}:${v.n}`;
        const on = open[key];
        const lit = hl && v.n >= hl[0] && v.n <= hl[1];
        return (
          <View key={key + i} onLayout={onY ? (e) => onY(v.n, e.nativeEvent.layout.y) : undefined}>
            {head && (
              <Text style={{ fontFamily: FONT.headingBold, fontSize: fs * 0.85, color: p.a700, marginTop: 10, marginBottom: 4 }}>
                {chapTitle(b, vc!, ul)}
              </Text>
            )}
            <View style={{ paddingVertical: 3, paddingHorizontal: lit ? 8 : 0, marginHorizontal: lit ? -8 : 0, backgroundColor: lit ? p.a100 : 'transparent', borderRadius: 4 }}>
              <Text style={body}>
                <Text
                  onPress={v.x.length ? () => setOpen((s) => ({ ...s, [key]: !s[key] })) : undefined}
                  accessibilityRole={v.x.length ? 'button' : undefined}
                  style={[
                    { fontFamily: FONT.headingBold, fontSize: fs * 0.72, color: p.a700 },
                    v.x.length ? { textDecorationLine: 'underline', textDecorationColor: p.a300 } : null,
                    NUM,
                  ]}
                >
                  {v.n}
                </Text>
                {!!tl && <TlumMark n={tl} v={v.n} size={fs * 0.7} />}
                {'  '}
                {v.t}
              </Text>
              {v.notes.map((n, j) => (
                <Text key={j} style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: fs * 0.75, lineHeight: fs * 1.1, color: p.mute(60), marginTop: 2 }}>
                  {`* ${n}`}
                </Text>
              ))}
            </View>
            {on && <XRefs xs={v.x} />}
          </View>
        );
      })}
    </View>
  );
}
