import { Platform } from 'react-native';

// 语义调色板：light 为基准，dark 与其键一一对应
export type ThemeColors = {
  ink: string;
  inkSoft: string;
  muted: string;
  subtle: string;
  canvas: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  success: string;
  successSoft: string;
  overlay: string;
};

export const LightColors: ThemeColors = {
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
  onAccent: '#FFFFFF',
  danger: '#B42318',
  dangerSoft: '#FDE7E5',
  warning: '#9A6700',
  warningSoft: '#FFF3D6',
  info: '#255D8A',
  infoSoft: '#E2EFF8',
  success: '#0F7B4C',
  successSoft: '#DDF3E7',
  overlay: 'rgba(15, 27, 24, 0.25)',
};

export const DarkColors: ThemeColors = {
  ink: '#F2F7F5',
  inkSoft: '#D5E0DC',
  muted: '#A3B4AF',
  subtle: '#82938E',
  canvas: '#101916',
  surface: '#17231F',
  surfaceMuted: '#1F2C27',
  border: '#2E403A',
  borderStrong: '#3E544D',
  accent: '#71C7B5',
  accentStrong: '#8FD6C6',
  accentSoft: '#1E3530',
  onAccent: '#0E1B17',
  danger: '#E5695E',
  dangerSoft: '#3A1D1A',
  warning: '#E0A63C',
  warningSoft: '#3A2E12',
  info: '#7FB3E0',
  infoSoft: '#1C2C3A',
  success: '#4CC38A',
  successSoft: '#17342A',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// 兼容别名：仅浅色，存量代码迁移完成后移除
export const Palette = LightColors;

// 状态徽标语义色（bg/fg 成对），替代各处散落的 pastel 硬编码
export type ToneName = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type Tone = { bg: string; fg: string };

export const Tones: Record<'light' | 'dark', Record<ToneName, Tone>> = {
  light: {
    accent: { bg: LightColors.accentSoft, fg: LightColors.accentStrong },
    success: { bg: LightColors.successSoft, fg: LightColors.success },
    warning: { bg: LightColors.warningSoft, fg: LightColors.warning },
    danger: { bg: LightColors.dangerSoft, fg: LightColors.danger },
    info: { bg: LightColors.infoSoft, fg: LightColors.info },
    neutral: { bg: LightColors.surfaceMuted, fg: LightColors.muted },
  },
  dark: {
    accent: { bg: DarkColors.accentSoft, fg: DarkColors.accentStrong },
    success: { bg: DarkColors.successSoft, fg: DarkColors.success },
    warning: { bg: DarkColors.warningSoft, fg: DarkColors.warning },
    danger: { bg: DarkColors.dangerSoft, fg: DarkColors.danger },
    info: { bg: DarkColors.infoSoft, fg: DarkColors.info },
    neutral: { bg: DarkColors.surfaceMuted, fg: DarkColors.muted },
  },
};

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
  pill: 999,
} as const;

// 浅色阴影；深色模式下不使用阴影（靠 border 分层），见 useAppTheme().shadow
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
    text: LightColors.ink,
    background: LightColors.canvas,
    tint: LightColors.accent,
    icon: LightColors.muted,
    tabIconDefault: LightColors.subtle,
    tabIconSelected: LightColors.accent,
  },
  dark: {
    text: DarkColors.ink,
    background: DarkColors.canvas,
    tint: DarkColors.accent,
    icon: DarkColors.muted,
    tabIconDefault: DarkColors.subtle,
    tabIconSelected: DarkColors.accent,
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
