import React from 'react';
import { Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { FONT, NUM, RADIUS } from '../theme';
import { useStore } from '../store';

export { NUM };

const PATHS: Record<string, string> = {
  right: 'm9 18 6-6-6-6',
  left: 'm15 18-6-6 6-6',
  x: 'M18 6 6 18M6 6l12 12',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  sunRays: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
  searchTail: 'm21 21-4.3-4.3',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  book: 'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z',
  cross: 'M12 2v20M6 8h12',
  menu: 'M4 6h16M4 12h16M4 18h16',
  heart: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z',
  plus: 'M12 5v14M5 12h14',
};

export function Icon({ name, size = 21, color, sw = 1.5 }: { name: string; size?: number; color: string; sw?: number }) {
  const common = { stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'sun' && (
        <>
          <Circle cx={12} cy={12} r={4} {...common} />
          <Path d={PATHS.sunRays} {...common} />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={8} {...common} />
          <Path d={PATHS.searchTail} {...common} />
        </>
      )}
      {name === 'today' && (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Circle cx={12} cy={12} r={3} {...common} />
        </>
      )}
      {PATHS[name] && !['sun', 'search', 'today'].includes(name) && <Path d={PATHS[name]} {...common} />}
    </Svg>
  );
}

/** Натискна область з підсвіткою, як :hover у макеті. */
export function Press({
  onPress,
  style,
  children,
  label,
  disabled,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  label?: string;
  disabled?: boolean;
}) {
  const { p } = useStore();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [{ borderRadius: RADIUS }, style, pressed && { backgroundColor: p.mute(6) }]}
    >
      {children}
    </Pressable>
  );
}

export function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { p } = useStore();
  return (
    <Text
      style={[
        { fontFamily: FONT.body, fontSize: 10.5, letterSpacing: 1.05, textTransform: 'uppercase', color: p.a700 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  const { p } = useStore();
  return (
    <Text style={{ fontFamily: FONT.heading, fontSize: 38, lineHeight: 40, letterSpacing: -0.76, color: p.text }}>
      {children}
    </Text>
  );
}

export function Heading({
  children,
  size,
  style,
}: {
  children: React.ReactNode;
  size: number;
  style?: StyleProp<TextStyle>;
}) {
  const { p } = useStore();
  return (
    <Text style={[{ fontFamily: FONT.headingBold, fontSize: size, lineHeight: size * 1.2, color: p.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  size = 14,
  mute,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  mute?: number;
  style?: StyleProp<TextStyle>;
}) {
  const { p } = useStore();
  return (
    <Text
      style={[
        { fontFamily: FONT.body, fontSize: size, lineHeight: size * 1.5, color: mute ? p.mute(mute) : p.text },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Divider({ gap = 22 }: { gap?: number }) {
  const { p } = useStore();
  return <View style={{ height: 1, backgroundColor: p.divider, marginVertical: gap }} />;
}

export function OutlineButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const { p } = useStore();
  return (
    <Press
      onPress={onPress}
      style={[{ paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: p.accent }, style]}
    >
      <Text style={{ fontFamily: FONT.headingBold, fontSize: 15, color: p.a700 }}>{label}</Text>
    </Press>
  );
}

export function GhostButton({ label, onPress, chevron = true }: { label: string; onPress: () => void; chevron?: boolean }) {
  const { p } = useStore();
  return (
    <Press onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 6 }}>
      <Text style={{ fontFamily: FONT.headingBold, fontSize: 15, color: p.a700 }}>{label}</Text>
      {chevron && <Icon name="right" size={16} color={p.a700} />}
    </Press>
  );
}

export interface SegOpt {
  label: string;
  on: boolean;
  onPress: () => void;
}

export function Seg({ opts, height = 40 }: { opts: SegOpt[]; height?: number }) {
  const { p } = useStore();
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: p.divider, borderRadius: RADIUS, overflow: 'hidden' }}>
      {opts.map((o, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityState={{ selected: o.on }}
          onPress={o.onPress}
          style={{
            flex: 1,
            height,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: o.on ? p.accent : 'transparent',
          }}
        >
          <Text style={{ fontFamily: FONT.body, fontSize: 14, color: o.on ? p.a700 : p.text }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Tag({ label, outline }: { label: string; outline?: boolean }) {
  const { p } = useStore();
  return (
    <View
      style={[
        { borderRadius: 3, paddingHorizontal: outline ? 8 : 9, paddingVertical: 2, alignSelf: 'flex-start' },
        outline ? { borderWidth: 1, borderColor: p.accent } : { backgroundColor: p.a100 },
      ]}
    >
      <Text style={{ fontFamily: FONT.body, fontSize: 11, color: outline ? p.a700 : p.a800 }}>{label}</Text>
    </View>
  );
}

export function NeutralTag({ label }: { label: string }) {
  const { p } = useStore();
  return (
    <View style={{ borderRadius: 3, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: p.n100, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: FONT.body, fontSize: 10.5, color: p.n800 }}>{label}</Text>
    </View>
  );
}

/** Позначка дня: крапка — свято, кільце — піст. */
export function Marks({ feast, fast }: { feast?: boolean; fast?: boolean }) {
  const { p } = useStore();
  return (
    <View style={{ height: 6, justifyContent: 'center' }}>
      {feast && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.accent }} />}
      {fast && !feast && <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: p.n600 }} />}
    </View>
  );
}

export function Switch({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const { p } = useStore();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: on ? p.accent : p.divider,
        backgroundColor: on ? p.accentA(12) : 'transparent',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: on ? p.accent : p.n400,
        }}
      />
    </Pressable>
  );
}

/** Рядок списку з шевроном. */
export function NavRow({
  title,
  sub,
  value,
  onPress,
  last,
}: {
  title: string;
  sub?: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { p } = useStore();
  return (
    <Press
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 0,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: p.divider,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: FONT.headingBold, fontSize: 18, lineHeight: 22, color: p.text }}>{title}</Text>
        {!!sub && (
          <Text numberOfLines={2} style={{ fontFamily: FONT.body, fontSize: 12, color: p.mute(60) }}>
            {sub}
          </Text>
        )}
      </View>
      {!!value && <Text style={{ fontFamily: FONT.body, fontSize: 13, color: p.mute(60) }}>{value}</Text>}
      <Icon name="right" size={18} color={p.mute(50)} />
    </Press>
  );
}

export const card = (p: { divider: string }): ViewStyle => ({
  borderWidth: 1,
  borderColor: p.divider,
  borderRadius: RADIUS,
});
