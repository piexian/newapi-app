import { readResponseBody } from '@/lib/json';
import { joinUrl } from '@/lib/url';

export type ApiClientConfig = {
  baseUrl: string;
  userId?: string;
  accessToken?: string;
};

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  body: T;
};

export function createApiClient(config: ApiClientConfig) {
  async function request<T = unknown>(args: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    headers?: Record<string, string | undefined>;
    auth?: {
      sendUserId?: boolean;
      sendAccessToken?: boolean;
    };
  }): Promise<ApiResult<T>> {
    if (!config.baseUrl) {
      throw new Error('Base URL 未设置');
    }
    const url = new URL(joinUrl(config.baseUrl, args.path));
    if (args.query) {
      for (const [k, v] of Object.entries(args.query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {};
    if (args.headers) {
      for (const [k, v] of Object.entries(args.headers)) {
        if (v === undefined) continue;
        headers[k] = v;
      }
    }

    const sendUserId = args.auth?.sendUserId ?? true;
    const sendAccessToken = args.auth?.sendAccessToken ?? true;

    if (sendUserId && config.userId) headers['New-Api-User'] = config.userId;
    if (sendAccessToken && config.accessToken) headers['Authorization'] = `Bearer ${config.accessToken}`;

    if (args.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(url.toString(), {
      method: args.method ?? 'GET',
      headers,
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
      credentials: 'include',
    });

    const body = (await readResponseBody(response)) as T;
    return { ok: response.ok, status: response.status, body };
  }

  return { request };
}
