import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useMe } from '@/providers/me-provider';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: string }) {
    return <MaterialIcons size={23} name={name} color={color} />;
  };
}

export default function TabLayout() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useMe();
  const { width } = useWindowDimensions();
  const compact = width < 370;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtle,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: !compact,
        tabBarStyle: [
          styles.tabBar,
          {
            // 底部安全区：手势导航下不与系统手势条重叠
            height: 61 + insets.bottom,
            paddingBottom: insets.bottom + 7,
            backgroundColor: isDark ? colors.surface : 'rgba(255, 255, 255, 0.97)',
            borderTopColor: colors.border,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '我的',
          tabBarAccessibilityLabel: '我的',
          tabBarIcon: tabIcon('person'),
        }}
      />
      <Tabs.Screen
        name="recharge"
        options={{
          title: '充值',
          tabBarAccessibilityLabel: '充值',
          tabBarIcon: tabIcon('credit-card'),
        }}
      />
      <Tabs.Screen
        name="tokens"
        options={{
          title: '令牌',
          tabBarAccessibilityLabel: '令牌',
          tabBarIcon: tabIcon('key'),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: '日志',
          tabBarAccessibilityLabel: '日志',
          tabBarIcon: tabIcon('description'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarAccessibilityLabel: '设置',
          tabBarIcon: tabIcon('settings'),
        }}
      />
      <Tabs.Screen
        name="admin/index"
        options={
          isAdmin
            ? {
                title: '管理',
                tabBarAccessibilityLabel: '管理',
                tabBarIcon: tabIcon('shield'),
              }
            : { href: null }
        }
      />

      {/* Keep admin sub-pages inside Admin, but hide them from the tab bar */}
      <Tabs.Screen name="admin/redemptions" options={{ href: null }} />
      <Tabs.Screen name="admin/channels" options={{ href: null }} />
      <Tabs.Screen name="admin/users" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 7,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    maxWidth: 132,
    minHeight: 52,
    borderRadius: 8,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
});
