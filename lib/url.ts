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

export function isValidServerUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const validScheme = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    return validScheme && parsed.hostname.length > 0 && parsed.search === '' && parsed.hash === '';
  } catch {
    return false;
  }
}

export function isHttpsUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export function shouldAllowPaymentWebViewUrl(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed === 'about:blank') return true;
  return isHttpsUrl(trimmed);
}

export function isCleartextHttpUrl(input: string): boolean {
  if (!isValidServerUrl(input)) return false;
  return new URL(input.trim()).protocol === 'http:';
}
