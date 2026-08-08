import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Surface } from '@/components/ui/surface';
import { Sparkline } from '@/components/ui/sparkline';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export function StatTile({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  sparkline,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  sparkline?: number[];
}) {
  const { colors } = useAppTheme();
  const tone = iconColor ?? colors.accent;
  const len = value.length;
  const valueSize =
    len > 20 ? 12 : len > 18 ? 13 : len > 16 ? 14 : len > 14 ? 15 : len > 12 ? 16 : len > 10 ? 18 : 20;
  return (
    <Surface style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${tone}22` }]}>
          <Ionicons name={icon} size={18} color={tone} />
        </View>
        <Text style={[styles.title, { color: colors.muted }]}>{title}</Text>
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.left}>
          <Text
            style={[styles.value, { fontSize: valueSize, color: colors.ink }]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {value}
          </Text>
          {!!subtitle && <Text style={[styles.subtitle, { color: colors.subtle }]}>{subtitle}</Text>}
        </View>
        {!!sparkline?.length && (
          <View style={styles.sparklineWrap}>
            <Sparkline values={sparkline} color={tone} width={96} height={26} />
          </View>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    padding: 16,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomRow: {
    marginTop: 18,
    gap: 8,
  },
  left: {
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  sparklineWrap: {
    alignSelf: 'flex-end',
  },
});
