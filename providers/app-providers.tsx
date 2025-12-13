import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/providers/auth-provider';
import { MeProvider } from '@/providers/me-provider';
import { SettingsProvider } from '@/providers/settings-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <MeProvider>{children}</MeProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
