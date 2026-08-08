import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { Layout, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
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

function AdminMenuRow({ item }: { item: Destination }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`进入${item.title}管理`}
      onPress={() => router.push(item.route)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => (pressed ? styles.menuItemPressed : null)}>
      <Surface
        style={[
          styles.menuRowInner,
          hovered ? { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong } : null,
        ]}>
        <View style={[styles.menuIcon, { backgroundColor: colors.accentSoft }]}>
          <MaterialIcons name={item.icon} size={22} color={colors.accent} />
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuTitle, { color: colors.ink }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.menuDescription, { color: colors.muted }]} numberOfLines={1}>
            {item.description}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.subtle} />
      </Surface>
    </Pressable>
  );
}

export default function AdminHomeScreen() {
  const insets = useSafeAreaInsets();
  const { me, isAdmin, isRoot, isLoaded } = useMe();
  const { colors } = useAppTheme();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
      ]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>管理</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
          {isAdmin ? `${me?.username ?? '管理员'} · ${isRoot ? 'Root' : 'Admin'}` : '管理权限'}
        </Text>
      </View>

      {!isLoaded ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>加载中</Text>
        </View>
      ) : !isAdmin ? (
        <EmptyState
          icon="lock-outline"
          title="当前账号无管理员权限"
          description="请切换到管理员账号后再访问此区域。"
        />
      ) : (
        <View style={styles.menu}>
          {destinations.map((item) => (
            <AdminMenuRow key={item.route} item={item} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: Layout.pagePadding,
    gap: Layout.sectionGap,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  menu: {
    gap: 10,
  },
  menuRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
  },
  menuCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  menuTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  menuDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  loading: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 19,
  },
});