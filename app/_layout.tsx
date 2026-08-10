import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProviders } from '@/providers/app-providers';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkColors, LightColors } from '@/constants/theme';

const AppLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: LightColors.accent,
    background: LightColors.canvas,
    card: LightColors.surface,
    text: LightColors.ink,
    border: LightColors.border,
  },
};

const AppDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: DarkColors.accent,
    background: DarkColors.canvas,
    card: DarkColors.surface,
    text: DarkColors.ink,
    border: DarkColors.border,
  },
};

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: settingsLoaded } = useSettings();
  const loading = !authLoaded || !settingsLoaded;

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [loading, isSignedIn, router, segments]);

  if (!loading) return null;
  // 凭证恢复期间显示加载占位，避免白屏
  const colors = colorScheme === 'dark' ? DarkColors : LightColors;
  return (
    <View style={[styles.boot, { backgroundColor: colors.canvas }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AppProviders>
      <ThemeProvider value={colorScheme === 'dark' ? AppDarkTheme : AppLightTheme}>
        <AuthGate />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppProviders>
  );
}
