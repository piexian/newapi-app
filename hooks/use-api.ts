import { createApiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

export function useApi() {
  const { baseUrl } = useSettings();
  const { userId, accessToken } = useAuth();

  return createApiClient({ baseUrl, userId, accessToken });
}

