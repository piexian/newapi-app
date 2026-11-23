import { createApiClient } from '@/lib/api-client';

describe('lib/api-client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends auth headers, query params, and defaults credentials to omit', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({ success: true, data: { id: 1 } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = createApiClient({
      baseUrl: 'http://192.168.1.10:3000/',
      userId: '1001',
      accessToken: 'tok-abc',
    });

    const res = await client.request({
      path: '/api/user/self',
      query: { p: 2, keyword: undefined, active: true },
    });

    expect(res).toEqual({ ok: true, status: 200, body: { success: true, data: { id: 1 } } });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://192.168.1.10:3000/api/user/self?p=2&active=true',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        headers: {
          'New-Api-User': '1001',
          Authorization: 'Bearer tok-abc',
        },
      })
    );
  });

  it('omits auth headers when explicitly disabled', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      userId: '1001',
      accessToken: 'tok-abc',
    });

    await client.request({
      path: '/api/status',
      auth: { sendUserId: false, sendAccessToken: false },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/api/status',
      expect.objectContaining({
        headers: {},
      })
    );
  });

  it('throws when baseUrl is missing', async () => {
    const client = createApiClient({ baseUrl: '' });
    await expect(client.request({ path: '/api/status' })).rejects.toThrow('Base URL 未设置');
  });
});
