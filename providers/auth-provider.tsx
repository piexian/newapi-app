import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { storageKeys } from '@/lib/keys';
import { getItem, removeItem, setItem } from '@/lib/storage';
import { joinUrl } from '@/lib/url';

type AuthState = {
  userId: string;
  accessToken: string;
};

type AuthContextValue = AuthState & {
  isLoaded: boolean;
  isSignedIn: boolean;
  setCredentials: (next: Partial<AuthState>) => Promise<void>;
  logout: (args?: { baseUrl?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ userId: '', accessToken: '' });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const [userId, accessToken] = await Promise.all([
        getItem(storageKeys.userId),
        getItem(storageKeys.accessToken),
      ]);
      if (canceled) return;
      setState({
        userId: (userId ?? '').trim(),
        accessToken: (accessToken ?? '').trim(),
      });
      setIsLoaded(true);
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const setCredentials = useCallback(async (next: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...next }));
    if (typeof next.userId === 'string') await setItem(storageKeys.userId, next.userId.trim());
    if (typeof next.accessToken === 'string') {
      await setItem(storageKeys.accessToken, next.accessToken.trim());
    }
  }, []);

  const logout = useCallback(async (args?: { baseUrl?: string }) => {
    try {
      if (args?.baseUrl) {
        const url = joinUrl(args.baseUrl, '/api/user/logout');
        await fetch(url, { method: 'POST', credentials: 'include' });
      }
    } catch {
      // ignore
    }
    setState({ userId: '', accessToken: '' });
    await Promise.all([removeItem(storageKeys.userId), removeItem(storageKeys.accessToken)]);
  }, []);

  const isSignedIn = !!state.userId && !!state.accessToken;

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isLoaded,
      isSignedIn,
      setCredentials,
      logout,
    }),
    [state, isLoaded, isSignedIn, setCredentials, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
