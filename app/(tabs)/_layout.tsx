import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMe } from '@/providers/me-provider';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAdmin } = useMe();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recharge"
        options={{
          title: '充值',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tokens"
        options={{
          title: '令牌',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="key.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: '日志',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin/index"
        options={
          isAdmin
            ? {
                title: '管理',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="shield.fill" color={color} />,
              }
            : { href: null }
        }
      />

      {/* Keep admin sub-pages inside Admin, but hide them from the tab bar */}
      <Tabs.Screen name="admin/redemptions" options={{ href: null }} />
      <Tabs.Screen name="admin/channels" options={{ href: null }} />
    </Tabs>
  );
}
