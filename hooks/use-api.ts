import { useMemo } from 'react';

import { createApiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

export function useApi() {
  const { baseUrl } = useSettings();
  const { userId, accessToken } = useAuth();

  // 显式 memo：避免每次渲染返回新的 client，使依赖 [api] 的 useCallback/useEffect 保持稳定。
  // 不依赖 React Compiler 的自动 memo，保证关闭编译器时也不会触发请求循环。
  return useMemo(
    () => createApiClient({ baseUrl, userId, accessToken }),
    [baseUrl, userId, accessToken]
  );
}

