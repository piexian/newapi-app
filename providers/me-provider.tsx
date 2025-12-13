import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useApi } from '@/hooks/use-api';
import { parseUser } from '@/lib/parsers';
import type { User } from '@/lib/models';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

type MeContextValue = {
  me: User | null;
  isLoaded: boolean;
  isAdmin: boolean;
  isRoot: boolean;
  refresh: () => Promise<void>;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const { baseUrl } = useSettings();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  const [me, setMe] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!baseUrl || !authLoaded || !isSignedIn) {
      setMe(null);
      setIsLoaded(authLoaded);
      return;
    }
    const res = await api.request({ path: '/api/user/self' });
    const body = res.body as unknown;
    if (body && typeof body === 'object' && !Array.isArray(body) && 'success' in (body as any)) {
      const success = (body as { success?: boolean }).success;
      if (success === false) {
        setMe(null);
        setIsLoaded(true);
        return;
      }
    }
    setMe(parseUser(body));
    setIsLoaded(true);
  }, [api, authLoaded, baseUrl, isSignedIn]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!canceled) setIsLoaded(true);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [refresh]);

  const role = me?.role ?? 0;
  const isAdmin = role >= 10;
  const isRoot = role >= 100;

  const value = useMemo<MeContextValue>(
    () => ({ me, isLoaded, isAdmin, isRoot, refresh }),
    [me, isLoaded, isAdmin, isRoot, refresh]
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used within MeProvider');
  return ctx;
}

