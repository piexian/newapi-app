type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function unwrapApiData<T = unknown>(body: unknown): T {
  if (!isRecord(body)) return body as T;
  if ('data' in body) return (body as AnyRecord).data as T;
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

