import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useApi } from '@/hooks/use-api';
import { unwrapApiData } from '@/lib/unwrap';
import { useSettings } from '@/providers/settings-provider';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function safeString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export type QuotaDisplayType = 'USD' | 'CNY' | 'CUSTOM' | 'TOKENS';

export type StatusQuotaConfig = {
  quotaPerUnit: number;
  quotaDisplayType: QuotaDisplayType;
  usdExchangeRate: number;
  customCurrencySymbol: string;
  customCurrencyExchangeRate: number;
};

type StatusContextValue = {
  quota: StatusQuotaConfig | null;
  isLoaded: boolean;
  refresh: () => Promise<void>;
};

const StatusContext = createContext<StatusContextValue | null>(null);

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const { baseUrl } = useSettings();

  const [quota, setQuota] = useState<StatusQuotaConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!baseUrl) {
      setQuota(null);
      setIsLoaded(true);
      return;
    }

    const res = await api.request({ path: '/api/status' });
    const body = res.body as unknown;
    if (isRecord(body) && body.success === false) {
      setQuota(null);
      setIsLoaded(true);
      return;
    }

    const data = unwrapApiData(body) as unknown;
    if (!isRecord(data)) {
      setQuota(null);
      setIsLoaded(true);
      return;
    }

    const quotaPerUnit = safeNumber(data.quota_per_unit) ?? 500000;
    const quotaDisplayTypeRaw = (safeString(data.quota_display_type) ?? 'USD').toUpperCase();
    const quotaDisplayType: QuotaDisplayType =
      quotaDisplayTypeRaw === 'TOKENS' || quotaDisplayTypeRaw === 'CNY' || quotaDisplayTypeRaw === 'CUSTOM'
        ? (quotaDisplayTypeRaw as QuotaDisplayType)
        : 'USD';

    setQuota({
      quotaPerUnit: quotaPerUnit > 0 ? quotaPerUnit : 500000,
      quotaDisplayType,
      usdExchangeRate: safeNumber(data.usd_exchange_rate) ?? 1,
      customCurrencySymbol: safeString(data.custom_currency_symbol) ?? '¤',
      customCurrencyExchangeRate: safeNumber(data.custom_currency_exchange_rate) ?? 1,
    });
    setIsLoaded(true);
  }, [api, baseUrl]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!canceled) setIsLoaded(true);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [refresh]);

  const value = useMemo<StatusContextValue>(() => ({ quota, isLoaded, refresh }), [quota, isLoaded, refresh]);

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatus(): StatusContextValue {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error('useStatus must be used within StatusProvider');
  return ctx;
}
