import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Surface } from '@/components/ui/surface';
import { Sparkline } from '@/components/ui/sparkline';

export function StatTile({
  title,
  value,
  subtitle,
  icon,
  iconColor = '#2563EB',
  sparkline,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  sparkline?: number[];
}) {
  const len = value.length;
  const valueSize = len > 20 ? 12 : len > 18 ? 13 : len > 16 ? 14 : len > 14 ? 15 : len > 12 ? 16 : len > 10 ? 18 : 20;
  return (
    <Surface style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.left}>
          <Text style={[styles.value, { fontSize: valueSize }]} numberOfLines={1} ellipsizeMode="tail">
            {value}
          </Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {!!sparkline?.length && (
          <View style={styles.sparklineWrap}>
            <Sparkline values={sparkline} color={iconColor} width={96} height={26} />
          </View>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 13,
    color: '#667085',
    fontWeight: '600',
  },
  bottomRow: {
    marginTop: 10,
    gap: 8,
  },
  left: {
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: '#11181C',
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#98A2B3',
  },
  sparklineWrap: {
    alignSelf: 'flex-end',
  },
});
