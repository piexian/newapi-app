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
          <Text style={styles.value}>{value}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {!!sparkline?.length && <Sparkline values={sparkline} color={iconColor} />}
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  left: {
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: '#11181C',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#98A2B3',
  },
});

