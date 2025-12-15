import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/providers/auth-provider';
import { MeProvider } from '@/providers/me-provider';
import { SettingsProvider } from '@/providers/settings-provider';
import { StatusProvider } from '@/providers/status-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <StatusProvider>
            <MeProvider>{children}</MeProvider>
          </StatusProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
