import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { storageKeys } from '@/lib/keys';
import { getItem, setItem } from '@/lib/storage';
import { normalizeBaseUrl } from '@/lib/url';

type SettingsContextValue = {
  baseUrl: string;
  isLoaded: boolean;
  setBaseUrl: (value: string) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const stored = await getItem(storageKeys.baseUrl);
      if (canceled) return;
      setBaseUrlState(normalizeBaseUrl(stored ?? ''));
      setIsLoaded(true);
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const setBaseUrl = useCallback(async (value: string) => {
    const normalized = normalizeBaseUrl(value);
    setBaseUrlState(normalized);
    await setItem(storageKeys.baseUrl, normalized);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ baseUrl, isLoaded, setBaseUrl }),
    [baseUrl, isLoaded, setBaseUrl]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

