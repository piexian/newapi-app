import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AuthProvider, useAuth } from '@/providers/auth-provider';

const mockPlainMap = new Map<string, string>();
let mockSecureToken: string | null = null;
let mockSetAccessTokenImpl: ((value: string) => Promise<void>) | null = null;
let mockGetAccessTokenImpl: (() => Promise<string>) | null = null;

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(async (key: string) => mockPlainMap.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockPlainMap.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockPlainMap.delete(key);
  }),
}));

jest.mock('@/lib/secure-storage', () => ({
  getAccessToken: jest.fn(async () => {
    if (mockGetAccessTokenImpl) return mockGetAccessTokenImpl();
    return mockSecureToken ?? '';
  }),
  setAccessToken: jest.fn(async (value: string) => {
    if (mockSetAccessTokenImpl) return mockSetAccessTokenImpl(value);
    mockSecureToken = value;
  }),
  removeAccessToken: jest.fn(async () => {
    mockSecureToken = null;
  }),
}));

type AuthSnapshot = ReturnType<typeof useAuth>;

function mountAuth() {
  let latest: AuthSnapshot | null = null;

  function Consumer() {
    latest = useAuth();
    return null;
  }

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
  });

  return {
    get current(): AuthSnapshot {
      if (!latest) throw new Error('AuthContext not captured');
      return latest;
    },
    unmount() {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('providers/auth-provider', () => {
  beforeEach(() => {
    mockPlainMap.clear();
    mockSecureToken = null;
    mockSetAccessTokenImpl = null;
    mockGetAccessTokenImpl = null;
    jest.clearAllMocks();
  });

  it('keeps old userId and token consistent across restart when SecureStore write fails', async () => {
    mockPlainMap.set('auth.userId', '1001');
    mockSecureToken = 'token-A';

    const firstMount = mountAuth();
    await flushPromises();
    expect(firstMount.current.userId).toBe('1001');
    expect(firstMount.current.accessToken).toBe('token-A');
    expect(firstMount.current.isSignedIn).toBe(true);

    mockSetAccessTokenImpl = async () => {
      throw new Error('安全存储写入失败');
    };

    await act(async () => {
      await expect(
        firstMount.current.setCredentials({ userId: '2002', accessToken: 'token-B' })
      ).rejects.toThrow('安全存储写入失败');
    });

    expect(firstMount.current.userId).toBe('1001');
    expect(firstMount.current.accessToken).toBe('token-A');
    expect(mockPlainMap.get('auth.userId')).toBe('1001');
    expect(mockSecureToken).toBe('token-A');
    firstMount.unmount();

    mockSetAccessTokenImpl = null;
    const secondMount = mountAuth();
    await flushPromises();
    expect(secondMount.current.userId).toBe('1001');
    expect(secondMount.current.accessToken).toBe('token-A');
    secondMount.unmount();
  });

  it('does not let an in-flight credential save undo a subsequent logout', async () => {
    mockPlainMap.set('auth.userId', '1001');
    mockSecureToken = 'token-A';

    const mounted = mountAuth();
    await flushPromises();

    let releaseWrite!: () => void;
    mockSetAccessTokenImpl = (value: string) =>
      new Promise<void>((resolve) => {
        releaseWrite = () => {
          mockSecureToken = value;
          resolve();
        };
      });

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = mounted.current.setCredentials({ userId: '2002', accessToken: 'token-B' });
    });

    await flushPromises();

    let logoutPromise!: Promise<void>;
    act(() => {
      logoutPromise = mounted.current.logout();
    });

    expect(mounted.current.isSignedIn).toBe(false);

    await act(async () => {
      releaseWrite();
      await Promise.all([savePromise, logoutPromise]);
    });

    expect(mounted.current.isSignedIn).toBe(false);
    expect(mounted.current.userId).toBe('');
    expect(mounted.current.accessToken).toBe('');
    expect(mockPlainMap.get('auth.userId')).toBeUndefined();
    expect(mockSecureToken).toBeNull();
    mounted.unmount();
  });

  it('finishes boot loading cleanly even if SecureStore throws during initial restore', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGetAccessTokenImpl = async () => {
      throw new Error('Keystore unreadable');
    };

    const mounted = mountAuth();
    await flushPromises();

    expect(mounted.current.isLoaded).toBe(true);
    expect(mounted.current.isSignedIn).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    mounted.unmount();
  });
});
