import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAppTheme } from '@/hooks/use-app-theme';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function Sparkline({
  values,
  width = 88,
  height = 28,
  color,
  style,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const stroke = color ?? colors.accent;
  const d = useMemo(() => {
    if (!values.length) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = values.length <= 1 ? 0 : width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * step;
        const y = height - (height * (v - min)) / span;
        const yy = clamp(y, 1, height - 1);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yy.toFixed(1)}`;
      })
      .join(' ');
  }, [values, width, height]);

  if (!d) return null;
  return (
    <Svg width={width} height={height} style={style} accessibilityLabel="趋势图">
      <Path d={d} stroke={stroke} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
