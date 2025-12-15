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

export type QuotaFormatConfig = {
  quotaPerUnit?: number;
  quotaDisplayType?: string;
  usdExchangeRate?: number;
  customCurrencySymbol?: string;
  customCurrencyExchangeRate?: number;
};

export function formatQuota(value: number | null | undefined, config?: QuotaFormatConfig, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';

  const quotaPerUnit = config?.quotaPerUnit;
  const unit = typeof quotaPerUnit === 'number' && Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : 1;

  const displayType = (config?.quotaDisplayType ?? 'USD').toUpperCase();
  if (displayType === 'TOKENS') return formatCount(value);

  const resultUSD = value / unit;
  let symbol = '$';
  let displayValue = resultUSD;

  if (displayType === 'CNY') {
    symbol = '￥';
    displayValue = resultUSD * (config?.usdExchangeRate ?? 1);
  } else if (displayType === 'CUSTOM') {
    symbol = config?.customCurrencySymbol ?? '¤';
    displayValue = resultUSD * (config?.customCurrencyExchangeRate ?? 1);
  }

  const fixedResult = displayValue.toFixed(digits);
  if (parseFloat(fixedResult) === 0 && value > 0 && displayValue > 0) {
    const minValue = Math.pow(10, -digits);
    return symbol + minValue.toFixed(digits);
  }
  return symbol + fixedResult;
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
