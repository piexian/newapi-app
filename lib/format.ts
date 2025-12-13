export function formatOmega(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Ω${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}Ω${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}Ω${(abs / 10_000).toFixed(2)}W`;
  if (abs >= 1_000) return `${sign}Ω${(abs / 1_000).toFixed(2)}K`;
  if (Number.isInteger(amount)) return `${sign}Ω${abs}`;
  return `${sign}Ω${abs.toFixed(2)}`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(2)}W`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${abs}`;
}

export function formatDateTimeEpochSeconds(epochSeconds: number | null | undefined): string {
  if (epochSeconds === null || epochSeconds === undefined || Number.isNaN(epochSeconds)) return '—';
  if (epochSeconds === 0 || epochSeconds === -1) return '永不过期';
  const d = new Date(epochSeconds * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
