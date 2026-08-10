import { DarkColors, LightColors, Shadows, Tones } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// 应用级主题：语义色 + 状态色 + 阴影（深色下阴影置空）
export function useAppTheme() {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  return {
    scheme,
    isDark,
    colors: isDark ? DarkColors : LightColors,
    tones: Tones[scheme],
    shadow: isDark ? null : Shadows,
  };
}
