import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Surface } from '@/components/ui/surface';
import { useMe } from '@/providers/me-provider';

export default function AdminHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me, isAdmin, isRoot } = useMe();

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.title}>管理</Text>
          <Surface>
            <Text style={styles.hint}>当前账号无管理员权限</Text>
          </Surface>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>管理</Text>
        <Text style={styles.sub}>当前用户：{me?.username ?? '—'} · {isRoot ? 'Root' : 'Admin'}</Text>

        <Surface style={styles.card}>
          <Text style={styles.cardTitle}>兑换码</Text>
          <Text style={styles.hint}>批量生成、启用/禁用、删除、清理失效</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/(tabs)/admin/redemptions')}>
            <Text style={styles.primaryText}>进入兑换码管理</Text>
          </Pressable>
        </Surface>

        <Surface style={styles.card}>
          <Text style={styles.cardTitle}>渠道</Text>
          <Text style={styles.hint}>查看列表、启用/禁用、编辑基础字段</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/(tabs)/admin/channels')}>
            <Text style={styles.primaryText}>进入渠道管理</Text>
          </Pressable>
        </Surface>

        <Surface style={styles.card}>
          <Text style={styles.cardTitle}>用户</Text>
          <Text style={styles.hint}>搜索、编辑、启用/禁用、重置 2FA/Passkey、注销</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/(tabs)/admin/users')}>
            <Text style={styles.primaryText}>进入用户管理</Text>
          </Pressable>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#11181C' },
  sub: { marginTop: -6, fontSize: 12, fontWeight: '700', color: '#667085' },
  card: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#11181C' },
  hint: { color: '#667085', fontSize: 12, fontWeight: '600' },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#11181C',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  primaryText: { color: '#fff', fontWeight: '900' },
});
