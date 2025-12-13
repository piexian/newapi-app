import { asArray, getNumber, getString, unwrapApiData } from '@/lib/unwrap';
import type { Channel, CreemProduct, LogItem, PayMethod, QuotaData, Redemption, Token, TopupInfo, User } from '@/lib/models';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function getBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (!s) return undefined;
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return undefined;
}

function safeParseJson(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  if (!input.trim()) return null;
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

function getFirstArrayCandidate(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];
  const candidates = ['items', 'list', 'data', 'logs', 'tokens', 'records', 'result'];
  for (const key of candidates) {
    const v = (data as AnyRecord)[key];
    if (Array.isArray(v)) return v;
  }
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) return v;
  }
  for (const v of Object.values(data)) {
    if (!isRecord(v)) continue;
    for (const vv of Object.values(v)) {
      if (Array.isArray(vv)) return vv;
    }
  }
  return [];
}

export function parseUser(body: unknown): User | null {
  const data = unwrapApiData(body);
  if (!isRecord(data)) return null;
  const id = getNumber(data, ['id']);
  const username = getString(data, ['username']) ?? '';
  if (!id || !username) return null;
  return {
    id,
    username,
    displayName: getString(data, ['display_name']) ?? undefined,
    email: getString(data, ['email']) ?? undefined,
    role: getNumber(data, ['role']) ?? undefined,
    status: getNumber(data, ['status']) ?? undefined,
    group: getString(data, ['group']) ?? undefined,
    quota: getNumber(data, ['quota']) ?? undefined,
    usedQuota: getNumber(data, ['used_quota']) ?? undefined,
    requestCount: getNumber(data, ['request_count']) ?? undefined,
  };
}

export function parseTokens(body: unknown): Token[] {
  const data = unwrapApiData(body);
  const arr = getFirstArrayCandidate(data);
  const mapped: Array<Token | null> = arr.map((it) => {
    if (!isRecord(it)) return null;
    const id = getNumber(it, ['id']);
    if (!id) return null;
    return {
      id,
      name: getString(it, ['name']) ?? undefined,
      key: getString(it, ['key']) ?? undefined,
      status: getNumber(it, ['status']) ?? undefined,
      group: getString(it, ['group']) ?? undefined,
      createdTime: getNumber(it, ['created_time']) ?? undefined,
      accessedTime: getNumber(it, ['accessed_time']) ?? undefined,
      expiredTime: getNumber(it, ['expired_time']) ?? undefined,
      remainQuota: getNumber(it, ['remain_quota']) ?? undefined,
      usedQuota: getNumber(it, ['used_quota']) ?? undefined,
      unlimitedQuota:
        typeof (it as AnyRecord).unlimited_quota === 'boolean'
          ? ((it as AnyRecord).unlimited_quota as boolean)
          : undefined,
      modelLimitsEnabled:
        typeof (it as AnyRecord).model_limits_enabled === 'boolean'
          ? ((it as AnyRecord).model_limits_enabled as boolean)
          : undefined,
      modelLimits: getString(it, ['model_limits']) ?? undefined,
      allowIps:
        (it as AnyRecord).allow_ips === null
          ? null
          : typeof (it as AnyRecord).allow_ips === 'string'
            ? ((it as AnyRecord).allow_ips as string)
            : undefined,
      crossGroupRetry:
        typeof (it as AnyRecord).cross_group_retry === 'boolean'
          ? ((it as AnyRecord).cross_group_retry as boolean)
          : undefined,
    };
  });
  return mapped.filter(notNull);
}

export function parseLogs(body: unknown): LogItem[] {
  const data = unwrapApiData(body);
  const arr = getFirstArrayCandidate(data);
  const mapped: Array<LogItem | null> = arr.map((it) => {
    if (!isRecord(it)) return null;
    const id = getNumber(it, ['id']);
    if (!id) return null;
    return {
      id,
      type: getNumber(it, ['type']) ?? undefined,
      content: getString(it, ['content']) ?? undefined,
      createdAt: getNumber(it, ['created_at']) ?? undefined,
      username: getString(it, ['username']) ?? undefined,
      tokenName: getString(it, ['token_name']) ?? undefined,
      modelName: getString(it, ['model_name']) ?? undefined,
      quota: getNumber(it, ['quota']) ?? undefined,
      promptTokens: getNumber(it, ['prompt_tokens']) ?? undefined,
      completionTokens: getNumber(it, ['completion_tokens']) ?? undefined,
      useTime: getNumber(it, ['use_time']) ?? undefined,
      isStream: typeof (it as AnyRecord).is_stream === 'boolean' ? ((it as AnyRecord).is_stream as boolean) : undefined,
      channel: getNumber(it, ['channel']) ?? undefined,
      tokenId: getNumber(it, ['token_id']) ?? undefined,
      group: getString(it, ['group']) ?? undefined,
      ip: getString(it, ['ip']) ?? undefined,
      other: getString(it, ['other']) ?? undefined,
    };
  });
  return mapped.filter(notNull);
}

export function parseQuotaData(body: unknown): QuotaData[] {
  const data = unwrapApiData(body);
  const arr = getFirstArrayCandidate(data);
  const mapped: Array<QuotaData | null> = arr.map((it) => {
    if (!isRecord(it)) return null;
    return {
      id: getNumber(it, ['id']) ?? undefined,
      userId: getNumber(it, ['user_id']) ?? undefined,
      username: getString(it, ['username']) ?? undefined,
      modelName: getString(it, ['model_name']) ?? undefined,
      createdAt: getNumber(it, ['created_at']) ?? undefined,
      tokenUsed: getNumber(it, ['token_used']) ?? undefined,
      count: getNumber(it, ['count']) ?? undefined,
      quota: getNumber(it, ['quota']) ?? undefined,
    };
  });
  return mapped.filter(notNull);
}

export function parseLogStat(body: unknown): Record<string, number> {
  const data = unwrapApiData(body);
  if (!isRecord(data)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  return out;
}

export function parseDataSelf(body: unknown): Record<string, number> {
  const data = unwrapApiData(body);
  if (!isRecord(data)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  return out;
}

export type TopupRecord = {
  id: number;
  quota?: number;
  status?: number;
  created?: number;
  redeemed?: number;
  name?: string;
};

export function parseTopupRecords(body: unknown): TopupRecord[] {
  const data = unwrapApiData(body);
  const arr = getFirstArrayCandidate(data);
  const mapped: Array<TopupRecord | null> = arr.map((it) => {
    if (!isRecord(it)) return null;
    const id = getNumber(it, ['id']);
    if (!id) return null;
    return {
      id,
      name: getString(it, ['name']) ?? undefined,
      quota: getNumber(it, ['quota']) ?? undefined,
      status: getNumber(it, ['status']) ?? undefined,
      created: getNumber(it, ['created_time']) ?? getNumber(it, ['created_at']) ?? undefined,
      redeemed: getNumber(it, ['redeemed_time']) ?? undefined,
    };
  });
  return mapped.filter(notNull);
}

export function pickMetric(data: Record<string, number>, keys: string[]): number | undefined {
  for (const k of keys) {
    if (k in data) return data[k];
  }
  return undefined;
}

export function safeArray<T>(value: unknown): T[] {
  return asArray(value) as T[];
}

export function parseTopupInfo(body: unknown): TopupInfo | null {
  const data = unwrapApiData(body);
  if (!isRecord(data)) return null;

  const payMethodsRaw = safeParseJson((data as AnyRecord).pay_methods);
  const payMethodsArr = Array.isArray(payMethodsRaw) ? payMethodsRaw : Array.isArray((data as AnyRecord).pay_methods) ? ((data as AnyRecord).pay_methods as unknown[]) : [];
  const payMethods: PayMethod[] = payMethodsArr
    .map((it) => {
      if (!isRecord(it)) return null;
      const type = getString(it, ['type']) ?? '';
      const name = getString(it, ['name']) ?? type;
      if (!type || !name) return null;
      return {
        type,
        name,
        color: getString(it, ['color']) ?? undefined,
        minTopup: getNumber(it, ['min_topup']) ?? undefined,
      };
    })
    .filter(notNull);

  const amountOptionsRaw = safeParseJson((data as AnyRecord).amount_options);
  const amountOptionsArr = Array.isArray(amountOptionsRaw)
    ? amountOptionsRaw
    : Array.isArray((data as AnyRecord).amount_options)
      ? ((data as AnyRecord).amount_options as unknown[])
      : [];
  const amountOptions: number[] = amountOptionsArr
    .map((v) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0) as number[];

  const discountRaw = safeParseJson((data as AnyRecord).discount);
  const discountObj = isRecord(discountRaw) ? discountRaw : isRecord((data as AnyRecord).discount) ? ((data as AnyRecord).discount as AnyRecord) : null;
  const discount: Record<string, number> = {};
  if (discountObj) {
    for (const [k, v] of Object.entries(discountObj)) {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      if (Number.isFinite(n) && n > 0) discount[k] = n;
    }
  }

  const creemRaw = safeParseJson((data as AnyRecord).creem_products);
  const creemArr = Array.isArray(creemRaw)
    ? creemRaw
    : Array.isArray((data as AnyRecord).creem_products)
      ? ((data as AnyRecord).creem_products as unknown[])
      : [];
  const creemProducts: CreemProduct[] = creemArr
    .map((it) => {
      if (!isRecord(it)) return null;
      const productId = getString(it, ['productId']) ?? getString(it, ['product_id']) ?? '';
      const name = getString(it, ['name']) ?? productId;
      const price = getNumber(it, ['price']) ?? 0;
      if (!productId || !price) return null;
      return {
        productId,
        name,
        price,
        currency: getString(it, ['currency']) ?? undefined,
        quota: getNumber(it, ['quota']) ?? undefined,
      };
    })
    .filter(notNull);

  return {
    enableOnlineTopup: getBool((data as AnyRecord).enable_online_topup) ?? false,
    enableStripeTopup: getBool((data as AnyRecord).enable_stripe_topup) ?? false,
    enableCreemTopup: getBool((data as AnyRecord).enable_creem_topup) ?? false,
    minTopup: getNumber(data, ['min_topup']) ?? undefined,
    stripeMinTopup: getNumber(data, ['stripe_min_topup']) ?? undefined,
    payMethods,
    amountOptions,
    discount,
    creemProducts,
  };
}

export function parseRedemptions(body: unknown): Redemption[] {
  const data = unwrapApiData(body);
  const arr = getFirstArrayCandidate(data);
  const mapped: Array<Redemption | null> = arr.map((it) => {
    if (!isRecord(it)) return null;
    const id = getNumber(it, ['id']);
    if (!id) return null;
    return {
      id,
      userId: getNumber(it, ['user_id']) ?? undefined,
      key: getString(it, ['key']) ?? undefined,
      status: getNumber(it, ['status']) ?? undefined,
      name: getString(it, ['name']) ?? undefined,
      quota: getNumber(it, ['quota']) ?? undefined,
      createdTime: getNumber(it, ['created_time']) ?? undefined,
      redeemedTime: getNumber(it, ['redeemed_time']) ?? undefined,
      usedUserId: getNumber(it, ['used_user_id']) ?? undefined,
      expiredTime: getNumber(it, ['expired_time']) ?? undefined,
    };
  });
  return mapped.filter(notNull);
}

export function parseChannels(body: unknown): Channel[] {
  const data = unwrapApiData(body);
  const arr = getFirstArrayCandidate(data);
  const mapped: Array<Channel | null> = arr.map((it) => {
    if (!isRecord(it)) return null;
    const id = getNumber(it, ['id']);
    if (!id) return null;
    const baseUrl = getString(it, ['base_url']) ?? undefined;
    const tag = getString(it, ['tag']) ?? undefined;
    const remark = getString(it, ['remark']) ?? undefined;
    return {
      id,
      type: getNumber(it, ['type']) ?? undefined,
      status: getNumber(it, ['status']) ?? undefined,
      name: getString(it, ['name']) ?? undefined,
      group: getString(it, ['group']) ?? undefined,
      tag,
      baseUrl,
      models: getString(it, ['models']) ?? undefined,
      priority: getNumber(it, ['priority']) ?? undefined,
      weight: getNumber(it, ['weight']) ?? undefined,
      createdTime: getNumber(it, ['created_time']) ?? undefined,
      responseTime: getNumber(it, ['response_time']) ?? undefined,
      balance: getNumber(it, ['balance']) ?? undefined,
      other: getString(it, ['other']) ?? undefined,
      remark,
    };
  });
  return mapped.filter(notNull);
}
