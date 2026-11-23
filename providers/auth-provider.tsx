import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { storageKeys } from '@/lib/keys';
import { getAccessToken, removeAccessToken, setAccessToken } from '@/lib/secure-storage';
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

  // 单调序号用于让并发的保存/恢复在退出登录后失效，队列用于串行化磁盘读写顺序。
  const authOpSeqRef = useRef(0);
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueStorageOp = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = storageQueueRef.current.then(task, task);
    storageQueueRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, []);

  useEffect(() => {
    let canceled = false;
    const bootSeq = authOpSeqRef.current;

    (async () => {
      try {
        const [userId, accessToken] = await Promise.all([
          getItem(storageKeys.userId),
          getAccessToken(),
        ]);
        if (canceled || bootSeq !== authOpSeqRef.current) return;
        setState({
          userId: (userId ?? '').trim(),
          accessToken: (accessToken ?? '').trim(),
        });
      } catch (error) {
        console.warn('恢复访问凭据失败:', error);
        if (!canceled && bootSeq === authOpSeqRef.current) {
          setState({ userId: '', accessToken: '' });
        }
      } finally {
        if (!canceled) {
          setIsLoaded(true);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  const setCredentials = useCallback(
    async (next: Partial<AuthState>) => {
      const trimmedUserId = typeof next.userId === 'string' ? next.userId.trim() : undefined;
      const trimmedAccessToken = typeof next.accessToken === 'string' ? next.accessToken.trim() : undefined;
      const opSeq = ++authOpSeqRef.current;

      await enqueueStorageOp(async () => {
        if (opSeq !== authOpSeqRef.current) return;

        // 先写易失败的原生安全存储，再写 userId，避免安全存储失败时磁盘残留新 ID 与旧令牌的混用组合。
        let previousToken: string | null = null;
        if (trimmedAccessToken !== undefined) {
          try {
            previousToken = await getAccessToken();
          } catch {
            previousToken = null;
          }
          await setAccessToken(trimmedAccessToken);
        }

        if (trimmedUserId !== undefined) {
          try {
            await setItem(storageKeys.userId, trimmedUserId);
          } catch (error) {
            if (trimmedAccessToken !== undefined) {
              try {
                if (previousToken) {
                  await setAccessToken(previousToken);
                } else {
                  await removeAccessToken();
                }
              } catch {
                // 回滚尽力执行，保留原始写入错误向上抛出
              }
            }
            throw error;
          }
        }

        if (opSeq !== authOpSeqRef.current) return;

        setState((prev) => ({
          userId: trimmedUserId ?? prev.userId,
          accessToken: trimmedAccessToken ?? prev.accessToken,
        }));
      });
    },
    [enqueueStorageOp]
  );

  const logout = useCallback(
    async (args?: { baseUrl?: string }) => {
      ++authOpSeqRef.current;
      setState({ userId: '', accessToken: '' });

      // 立即把本地清理排入串行队列，避免等待远端登出响应期间重新登录后被旧退出操作误删。
      const clearLocalPromise = enqueueStorageOp(async () => {
        await Promise.all([removeItem(storageKeys.userId), removeAccessToken()]);
      });

      const remoteLogoutPromise = (async () => {
        if (!args?.baseUrl) return;
        try {
          const url = joinUrl(args.baseUrl, '/api/user/logout');
          await fetch(url, { method: 'POST', credentials: 'include' });
        } catch {
          // ignore
        }
      })();

      await Promise.all([clearLocalPromise, remoteLogoutPromise]);
    },
    [enqueueStorageOp]
  );

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
