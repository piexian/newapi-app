type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 从 new-api 标准响应信封 `{ success, message, data }` 中取出 `data`。
 *
 * 仅当响应"看起来像信封"时才剥层：必须同时满足
 *   1) 含 `success` 键（new-api 所有接口都带），且
 *   2) 含 `data` 键。
 * 这样可以避免对"非信封、但恰好有个 data 字段"的响应误剥层。
 * 不符合信封特征时原样返回，交由调用方/parsers 自行取数组或字段。
 */
export function unwrapApiData<T = unknown>(body: unknown): T {
  if (!isRecord(body)) return body as T;
  if ('success' in body && 'data' in body) return (body as AnyRecord).data as T;
  return body as T;
}

export function getString(body: unknown, path: string[]): string | undefined {
  let cur: unknown = body;
  for (const seg of path) {
    if (!isRecord(cur)) return undefined;
    cur = (cur as AnyRecord)[seg];
  }
  if (typeof cur === 'string') return cur;
  if (typeof cur === 'number') return String(cur);
  return undefined;
}

export function getNumber(body: unknown, path: string[]): number | undefined {
  const s = getString(body, path);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

