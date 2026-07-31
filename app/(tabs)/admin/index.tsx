import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout, Palette, Radius, Shadows } from '@/constants/theme';
import { useMe } from '@/providers/me-provider';

type Destination = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  route:
    | '/(tabs)/admin/redemptions'
    | '/(tabs)/admin/channels'
    | '/(tabs)/admin/users';
};

const destinations: Destination[] = [
  {
    title: '兑换码',
    description: '生成、停用和清理兑换码',
    icon: 'confirmation-number',
    route: '/(tabs)/admin/redemptions',
  },
  {
    title: '渠道',
    description: '维护模型渠道和运行状态',
    icon: 'hub',
    route: '/(tabs)/admin/channels',
  },
  {
    title: '用户',
    description: '搜索用户并管理账号状态',
    icon: 'group',
    route: '/(tabs)/admin/users',
  },
];

export default function AdminHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me, isAdmin, isRoot } = useMe();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
      ]}>
      <View style={styles.header}>
        <Text style={styles.title}>管理</Text>
        <Text style={styles.subtitle}>
          {isAdmin ? `${me?.username ?? '管理员'} · ${isRoot ? 'Root' : 'Admin'}` : '管理权限'}
        </Text>
      </View>

      {!isAdmin ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="lock-outline" size={24} color={Palette.muted} />
          </View>
          <Text style={styles.emptyTitle}>当前账号无管理员权限</Text>
          <Text style={styles.emptyText}>请切换到管理员账号后再访问此区域。</Text>
        </View>
      ) : (
        <View style={styles.menu}>
          {destinations.map((item) => (
            <Pressable
              key={item.route}
              accessibilityRole="button"
              accessibilityLabel={`进入${item.title}管理`}
              onPress={() => router.push(item.route)}
              style={({ pressed, hovered }) => [
                styles.menuItem,
                hovered ? styles.menuItemHovered : null,
                pressed ? styles.menuItemPressed : null,
              ]}>
              <View style={styles.menuIcon}>
                <MaterialIcons name={item.icon} size={22} color={Palette.accent} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Palette.subtle} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  container: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: Layout.pagePadding,
    gap: 20,
  },
  header: {
    gap: 4,
  },
  title: {
    color: Palette.ink,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  menu: {
    gap: 10,
  },
  menuItem: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    ...(Shadows ?? {}),
  },
  menuItemHovered: {
    borderColor: Palette.borderStrong,
    backgroundColor: '#FBFDFC',
  },
  menuItemPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.995 }],
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.accentSoft,
  },
  menuCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  menuTitle: {
    color: Palette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  menuDescription: {
    color: Palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    marginBottom: 4,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceMuted,
  },
  emptyTitle: {
    color: Palette.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    maxWidth: 360,
    color: Palette.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
