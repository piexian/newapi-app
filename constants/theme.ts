import { Platform } from 'react-native';

export const Palette = {
  ink: '#15211F',
  inkSoft: '#33423F',
  muted: '#63716E',
  subtle: '#8A9894',
  canvas: '#F3F6F5',
  surface: '#FFFFFF',
  surfaceMuted: '#EAF0EE',
  border: '#D8E1DE',
  borderStrong: '#B8C6C2',
  accent: '#0B6B5C',
  accentStrong: '#075247',
  accentSoft: '#DDF1EC',
  danger: '#B42318',
  dangerSoft: '#FDE7E5',
  warning: '#9A6700',
  warningSoft: '#FFF3D6',
  info: '#255D8A',
  infoSoft: '#E2EFF8',
} as const;

export const Layout = {
  contentMaxWidth: 1180,
  formMaxWidth: 560,
  pagePadding: 16,
  sectionGap: 16,
  controlHeight: 46,
} as const;

export const Radius = {
  small: 6,
  medium: 8,
} as const;

export const Shadows = Platform.select({
  web: {
    boxShadow: '0 8px 24px rgba(28, 52, 46, 0.08)',
  },
  default: {
    shadowColor: '#1C342E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
});

export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.canvas,
    tint: Palette.accent,
    icon: Palette.muted,
    tabIconDefault: Palette.subtle,
    tabIconSelected: Palette.accent,
  },
  dark: {
    text: '#F2F7F5',
    background: '#101916',
    tint: '#71C7B5',
    icon: '#A3B4AF',
    tabIconDefault: '#82938E',
    tabIconSelected: '#71C7B5',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Avenir Next',
    serif: 'ui-serif',
    rounded: 'Avenir Next',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  web: {
    sans: "'Avenir Next', 'Segoe UI', system-ui, -apple-system, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Avenir Next', 'Segoe UI', system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
