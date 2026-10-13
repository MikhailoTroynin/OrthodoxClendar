import { THEMES } from './data/strings';

export type ThemeName = 'day' | 'night';

export interface Palette {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  text: string;
  divider: string;
  accent: string;
  a100: string;
  a300: string;
  a700: string;
  a800: string;
  n100: string;
  n400: string;
  n600: string;
  n800: string;
  /** Текст з прозорістю, як color-mix(text N%) у макеті. */
  mute: (pct: number) => string;
  /** Акцентний колір з прозорістю (стан натискання). */
  accentA: (pct: number) => string;
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const ACCENT = '#b68235';

export const palette = (name: ThemeName): Palette => {
  const t = THEMES[name];
  return {
    scheme: t.scheme as 'light' | 'dark',
    bg: t.bg,
    surface: t.surface,
    text: t.text,
    divider: rgba(t.text, 0.16),
    accent: ACCENT,
    a100: t.a100,
    a300: t.a300,
    a700: t.a700,
    a800: t.a800,
    n100: t.n100,
    n400: t.n400,
    n600: t.n600,
    n800: t.n800,
    mute: (pct) => rgba(t.text, pct / 100),
    accentA: (pct) => rgba(ACCENT, pct / 100),
  };
};

export const FONT = {
  heading: 'CormorantGaramond_400Regular',
  headingBold: 'CormorantGaramond_600SemiBold',
  body: 'Lora_400Regular',
  bodyBold: 'Lora_600SemiBold',
} as const;

export const RADIUS = 4;
export const NUM = { fontVariant: ['tabular-nums', 'lining-nums'] as ('tabular-nums' | 'lining-nums')[] };
