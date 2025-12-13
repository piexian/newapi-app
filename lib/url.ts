export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

export function joinUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return path;
  if (!path) return base;
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/${path}`;
}

