import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMe } from '@/providers/me-provider';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAdmin } = useMe();
  const { width } = useWindowDimensions();
  const compact = width < 370;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#82938E' : Palette.subtle,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: !compact,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={23} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recharge"
        options={{
          title: '充值',
          tabBarIcon: ({ color }) => <IconSymbol size={23} name="creditcard.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tokens"
        options={{
          title: '令牌',
          tabBarIcon: ({ color }) => <IconSymbol size={23} name="key.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: '日志',
          tabBarIcon: ({ color }) => <IconSymbol size={23} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => <IconSymbol size={23} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin/index"
        options={
          isAdmin
            ? {
                title: '管理',
                tabBarIcon: ({ color }) => <IconSymbol size={23} name="shield.fill" color={color} />,
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
    height: 68,
    paddingTop: 7,
    paddingBottom: 7,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderTopWidth: 1,
    borderTopColor: Palette.border,
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
