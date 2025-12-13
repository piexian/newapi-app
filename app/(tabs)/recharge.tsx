import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';

import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { useApi } from '@/hooks/use-api';
import { formatDateTimeEpochSeconds, formatOmega } from '@/lib/format';
import { parseTopupInfo, parseTopupRecords, parseUser } from '@/lib/parsers';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function parsePositiveInt(text: string): number | null {
  const n = Number(text.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

export default function RechargeScreen() {
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [topUpLink, setTopUpLink] = useState('');

  const [user, setUser] = useState<ReturnType<typeof parseUser>>(null);
  const [topupInfo, setTopupInfo] = useState<ReturnType<typeof parseTopupInfo>>(null);

  const [records, setRecords] = useState<ReturnType<typeof parseTopupRecords>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');

  const [redemptionCode, setRedemptionCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const [payWay, setPayWay] = useState('');
  const [topupAmountText, setTopupAmountText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [amountLoading, setAmountLoading] = useState(false);
  const [payableAmount, setPayableAmount] = useState<string>('');
  const [paying, setPaying] = useState(false);

  const [webPayOpen, setWebPayOpen] = useState(false);
  const [webPayHtml, setWebPayHtml] = useState('');

  const payMethods = useMemo(() => {
    const methods = topupInfo?.payMethods ?? [];
    return methods.filter((m) => {
      if (m.type === 'stripe') return !!topupInfo?.enableStripeTopup;
      return !!topupInfo?.enableOnlineTopup;
    });
  }, [topupInfo]);

  const minTopup = useMemo(() => {
    if (!topupInfo) return 1;
    if (payWay === 'stripe') {
      const methodMin = payMethods.find((m) => m.type === 'stripe')?.minTopup;
      return methodMin ?? topupInfo.stripeMinTopup ?? topupInfo.minTopup ?? 1;
    }
    return topupInfo.minTopup ?? 1;
  }, [payMethods, payWay, topupInfo]);

  const presetAmounts = useMemo(() => {
    const base = Math.max(1, minTopup);
    const options = topupInfo?.amountOptions?.length
      ? topupInfo.amountOptions
      : [1, 5, 10, 30, 50, 100, 300, 500].map((m) => m * base);
    const uniq = Array.from(new Set(options)).filter((n) => Number.isFinite(n) && n > 0);
    uniq.sort((a, b) => a - b);
    return uniq.slice(0, 12);
  }, [minTopup, topupInfo?.amountOptions]);

  const load = useCallback(
    async (nextPage = 1) => {
      setError('');
      setBusy(true);
      try {
        const [userRes, infoRes, recordsRes, statusRes] = await Promise.all([
          api.request({ path: '/api/user/self' }),
          api.request({ path: '/api/user/topup/info' }),
          api.request({
            path: '/api/user/topup/self',
            query: {
              p: nextPage,
              page_size: pageSize,
              keyword: keyword.trim() ? keyword.trim() : undefined,
            },
          }),
          api.request({
            path: '/api/status',
            auth: { sendAccessToken: false, sendUserId: false },
          }),
        ]);

        const userEnv = userRes.body as unknown;
        const infoEnv = infoRes.body as unknown;
        const recordsEnv = recordsRes.body as unknown;
        const statusEnv = statusRes.body as unknown;

        if (isRecord(userEnv) && typeof userEnv.success === 'boolean' && userEnv.success === false) {
          setError(typeof userEnv.message === 'string' ? userEnv.message : '用户信息失败');
          return;
        }
        if (isRecord(infoEnv) && typeof infoEnv.success === 'boolean' && infoEnv.success === false) {
          setError(typeof infoEnv.message === 'string' ? infoEnv.message : '充值配置失败');
          return;
        }
        if (isRecord(recordsEnv) && typeof recordsEnv.success === 'boolean' && recordsEnv.success === false) {
          setError(typeof recordsEnv.message === 'string' ? recordsEnv.message : '充值记录失败');
          return;
        }
        if (isRecord(statusEnv) && typeof statusEnv.success === 'boolean' && statusEnv.success === false) {
          setError(typeof statusEnv.message === 'string' ? statusEnv.message : '系统状态失败');
          return;
        }

        setUser(parseUser(userRes.body));
        const parsedInfo = parseTopupInfo(infoRes.body);
        setTopupInfo(parsedInfo);
        setPayWay((prev) => {
          if (prev) return prev;
          const methods = (parsedInfo?.payMethods ?? []).filter((m) => {
            if (m.type === 'stripe') return !!parsedInfo?.enableStripeTopup;
            return !!parsedInfo?.enableOnlineTopup;
          });
          const preferred = methods.find((m) => m.type === 'alipay') ?? methods[0];
          return preferred?.type ?? '';
        });

        setRecords(parseTopupRecords(recordsRes.body));

        const data = (isRecord(recordsEnv) && isRecord(recordsEnv.data) ? recordsEnv.data : null) as AnyRecord | null;
        setPage(typeof data?.page === 'number' ? data.page : nextPage);
        setPageSize(typeof data?.page_size === 'number' ? data.page_size : pageSize);
        setTotal(typeof data?.total === 'number' ? data.total : 0);

        const statusData = (isRecord(statusEnv) && isRecord(statusEnv.data) ? statusEnv.data : null) as AnyRecord | null;
        setTopUpLink(typeof statusData?.top_up_link === 'string' ? (statusData.top_up_link as string) : '');

        if (!userRes.ok) setError(`用户信息失败：HTTP ${userRes.status}`);
        if (!infoRes.ok) setError((prev) => prev || `充值配置失败：HTTP ${infoRes.status}`);
        if (!recordsRes.ok) setError((prev) => prev || `充值记录失败：HTTP ${recordsRes.status}`);
        if (!statusRes.ok) setError((prev) => prev || `系统状态失败：HTTP ${statusRes.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '请求失败');
      } finally {
        setBusy(false);
      }
    },
    [api, keyword, pageSize]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const redeem = useCallback(async () => {
    const key = redemptionCode.trim();
    if (!key) {
      Alert.alert('兑换码充值', '请输入兑换码');
      return;
    }
    setError('');
    setRedeeming(true);
    try {
      const res = await api.request({ path: '/api/user/topup', method: 'POST', body: { key } });
      const env = res.body as unknown;
      if (isRecord(env) && typeof env.success === 'boolean' && env.success === false) {
        setError(typeof env.message === 'string' ? env.message : '兑换失败');
        return;
      }
      if (!res.ok) {
        setError(`兑换失败：HTTP ${res.status}`);
        return;
      }
      const data = isRecord(env) ? env.data : undefined;
      const quotaNum = typeof data === 'number' ? data : Number(data);
      Alert.alert('兑换成功', Number.isFinite(quotaNum) ? `成功兑换额度：${formatOmega(quotaNum)}` : '兑换成功');
      setRedemptionCode('');
      await load(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '兑换失败');
    } finally {
      setRedeeming(false);
    }
  }, [api, load, redemptionCode]);

  const pasteRedemptionCode = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const next = (text ?? '').trim();
      if (!next) return;
      setRedemptionCode(next);
    } catch {
      // ignore
    }
  }, []);

  const openBuyLink = useCallback(async () => {
    const link = topUpLink.trim();
    if (!link) {
      Alert.alert('购买兑换码', '管理员未配置购买链接');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : '打开链接失败');
    }
  }, [topUpLink]);

  const escapeHtml = useCallback((s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), []);

  const buildAutoPostHtml = useCallback(
    (url: string, params: Record<string, unknown>) => {
      const inputs = Object.entries(params)
        .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(String(v ?? ''))}" />`)
        .join('');
      return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>支付中…</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial;margin:0;padding:18px;color:#111}</style>
</head>
<body>
  <p>正在跳转到支付页面…</p>
  <form id="f" action="${escapeHtml(url)}" method="post">${inputs}</form>
  <script>document.getElementById('f').submit();</script>
</body>
</html>`;
    },
    [escapeHtml]
  );

  const getAmount = useCallback(async () => {
    if (!payWay) {
      Alert.alert('在线充值', '请选择支付方式');
      return;
    }
    const n = parsePositiveInt(topupAmountText);
    if (n === null) {
      Alert.alert('在线充值', '请输入正确的整数充值数量');
      return;
    }
    if (n < minTopup) {
      Alert.alert('在线充值', `充值数量不能小于 ${minTopup}`);
      return;
    }
    setError('');
    setAmountLoading(true);
    try {
      const res = await api.request({
        path: payWay === 'stripe' ? '/api/user/stripe/amount' : '/api/user/amount',
        method: 'POST',
        body: { amount: n },
      });
      const env = res.body as unknown;
      if (isRecord(env) && typeof env.message === 'string' && env.message !== 'success') {
        setError(typeof env.data === 'string' ? env.data : env.message);
        return;
      }
      if (isRecord(env) && env.message === 'success') {
        const data = env.data;
        if (typeof data === 'string') setPayableAmount(data);
        else if (typeof data === 'number' && Number.isFinite(data)) setPayableAmount(data.toFixed(2));
        else setPayableAmount('');
      }
      if (!res.ok) setError(`计算失败：HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败');
    } finally {
      setAmountLoading(false);
    }
  }, [api, minTopup, payWay, topupAmountText]);

  const startPay = useCallback(async () => {
    if (!payWay) {
      Alert.alert('在线充值', '请选择支付方式');
      return;
    }
    const n = parsePositiveInt(topupAmountText);
    if (n === null) {
      Alert.alert('在线充值', '请输入正确的整数充值数量');
      return;
    }
    if (n < minTopup) {
      Alert.alert('在线充值', `充值数量不能小于 ${minTopup}`);
      return;
    }

    const discountRate = topupInfo?.discount?.[String(n)] ?? 1;
    const payable = payableAmount ? `，预计支付 ${payableAmount}` : '';
    Alert.alert('确认充值', `充值数量 ${n}${payable}${discountRate !== 1 ? `（折扣 ${discountRate}）` : ''}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '去支付',
        onPress: async () => {
          setError('');
          setPaying(true);
          try {
            if (payWay === 'stripe') {
              const payRes = await api.request({
                path: '/api/user/stripe/pay',
                method: 'POST',
                body: { amount: n, payment_method: 'stripe' },
              });
              const env = payRes.body as unknown;
              if (isRecord(env) && typeof env.message === 'string' && env.message !== 'success') {
                setError(typeof env.data === 'string' ? env.data : env.message);
                return;
              }
              const link =
                isRecord(env) && isRecord(env.data) && typeof env.data.pay_link === 'string' ? (env.data.pay_link as string) : '';
              if (!link) {
                setError('拉起支付失败：未返回 pay_link');
                return;
              }
              await WebBrowser.openBrowserAsync(link);
              await load(1);
              return;
            }

            const payRes = await api.request({
              path: '/api/user/pay',
              method: 'POST',
              body: { amount: n, payment_method: payWay },
            });
            const env = payRes.body as unknown;
            if (isRecord(env) && typeof env.message === 'string' && env.message !== 'success') {
              setError(typeof env.data === 'string' ? env.data : env.message);
              return;
            }
            const url = isRecord(env) && typeof env.url === 'string' ? env.url : '';
            const params = isRecord(env) && isRecord(env.data) ? (env.data as Record<string, unknown>) : null;
            if (!url || !params) {
              setError('拉起支付失败：未返回 url/data');
              return;
            }
            setWebPayHtml(buildAutoPostHtml(url, params));
            setWebPayOpen(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : '支付失败');
          } finally {
            setPaying(false);
          }
        },
      },
    ]);
  }, [api, buildAutoPostHtml, load, minTopup, payWay, payableAmount, topupAmountText, topupInfo?.discount]);

  const startCreemPay = useCallback(
    async (productId: string) => {
      if (!productId) return;
      setError('');
      setPaying(true);
      try {
        const res = await api.request({
          path: '/api/user/creem/pay',
          method: 'POST',
          body: { product_id: productId, payment_method: 'creem' },
        });
        const env = res.body as unknown;
        if (isRecord(env) && typeof env.message === 'string' && env.message !== 'success') {
          setError(typeof env.data === 'string' ? env.data : env.message);
          return;
        }
        const link =
          isRecord(env) && isRecord(env.data) && typeof env.data.checkout_url === 'string' ? (env.data.checkout_url as string) : '';
        if (!link) {
          setError('拉起支付失败：未返回 checkout_url');
          return;
        }
        await WebBrowser.openBrowserAsync(link);
        await load(1);
      } catch (e) {
        setError(e instanceof Error ? e.message : '支付失败');
      } finally {
        setPaying(false);
      }
    },
    [api, load]
  );

  const currentBalance = user?.quota;
  const historyCost = user?.usedQuota;

  const canOnlineTopup = !!payMethods.length;
  const canCreemTopup = !!topupInfo?.enableCreemTopup && !!topupInfo?.creemProducts?.length;
  const canPrev = page > 1;
  const canNext = total <= 0 ? records.length >= pageSize : page * pageSize < total;

  const pagerInfo = useMemo(() => {
    if (!total) return `第 ${page} 页`;
    const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
    return `第 ${page} / ${pages} 页，共 ${total} 条`;
  }, [page, pageSize, total]);

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
        data={records}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>充值</Text>
            </View>

            {!!error && (
              <Surface>
                <Text style={styles.errorText}>{error}</Text>
              </Surface>
            )}

            <View style={styles.summaryRow}>
              <Surface style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>当前余额</Text>
                <Text style={styles.summaryValue}>{formatOmega(currentBalance)}</Text>
              </Surface>
              <Surface style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>历史消耗</Text>
                <Text style={styles.summaryValue}>{formatOmega(historyCost)}</Text>
              </Surface>
            </View>

            <Surface style={styles.redeemCard}>
              <Text style={styles.cardTitle}>兑换码充值</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  value={redemptionCode}
                  onChangeText={setRedemptionCode}
                  placeholder="请输入兑换码"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
                <Pressable style={styles.ghostBtn} onPress={pasteRedemptionCode} disabled={redeeming || busy}>
                  <Text style={styles.ghostText}>粘贴</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={redeem} disabled={redeeming || busy}>
                  <Text style={styles.primaryText}>{redeeming ? '兑换中…' : '兑换'}</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>兑换成功后会自动刷新余额与记录</Text>
              {!!topUpLink.trim() && (
                <Pressable style={styles.buyBtn} onPress={openBuyLink} disabled={busy || redeeming}>
                  <Text style={styles.buyText}>购买兑换码</Text>
                </Pressable>
              )}
            </Surface>

            <Surface style={styles.onlineCard}>
              <View style={styles.onlineHeader}>
                <Text style={styles.cardTitle}>在线充值</Text>
                <Badge text={canOnlineTopup ? '可用' : '未配置'} color={canOnlineTopup ? '#DCFCE7' : '#FEF3C7'} />
              </View>

              {!canOnlineTopup ? (
                <Text style={styles.hint}>管理员未配置在线充值，仍可使用兑换码充值。</Text>
              ) : (
                <View style={styles.onlineBody}>
                  <Text style={styles.label}>支付方式</Text>
                  <View style={styles.chipRow}>
                    {payMethods.map((m) => (
                      <Pressable
                        key={m.type}
                        style={[styles.chip, payWay === m.type ? styles.chipActive : styles.chipIdle]}
                        onPress={() => {
                          setPayWay(m.type);
                          setPayableAmount('');
                        }}
                      >
                        <Text style={[styles.chipText, payWay === m.type ? styles.chipTextActive : styles.chipTextIdle]}>
                          {m.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>充值数量</Text>
                  <View style={styles.chipRow}>
                    {presetAmounts.map((v) => (
                      <Pressable
                        key={String(v)}
                        style={[styles.chip, selectedPreset === v ? styles.chipActive : styles.chipIdle]}
                        onPress={() => {
                          setSelectedPreset(v);
                          setTopupAmountText(String(v));
                          setPayableAmount('');
                        }}
                      >
                        <Text style={[styles.chipText, selectedPreset === v ? styles.chipTextActive : styles.chipTextIdle]}>
                          {v}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.inlineRow}>
                    <TextInput
                      value={topupAmountText}
                      onChangeText={(t) => {
                        setTopupAmountText(t);
                        const n = Number(t.trim());
                        setSelectedPreset(Number.isFinite(n) ? n : null);
                        setPayableAmount('');
                      }}
                      keyboardType="numeric"
                      placeholder={`最小 ${minTopup}`}
                      style={[styles.input, styles.flex1]}
                    />
                    <Pressable style={styles.ghostBtn} onPress={getAmount} disabled={amountLoading || busy || paying}>
                      <Text style={styles.ghostText}>{amountLoading ? '计算中…' : '计算'}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.k}>预计支付</Text>
                    <Text style={styles.v}>{payableAmount || '—'}</Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.k}>折扣</Text>
                    <Text style={styles.v}>
                      {(() => {
                        const n = Number(topupAmountText.trim());
                        const d = topupInfo?.discount?.[String(n)] ?? 1;
                        return d === 1 ? '—' : String(d);
                      })()}
                    </Text>
                  </View>

                  <Pressable style={[styles.primaryBtn, styles.payBtn]} onPress={startPay} disabled={busy || paying}>
                    <Text style={styles.primaryText}>{paying ? '支付中…' : '去支付'}</Text>
                  </Pressable>
                </View>
              )}
            </Surface>

            {canCreemTopup && (
              <Surface style={styles.creemCard}>
                <Text style={styles.cardTitle}>Creem 充值</Text>
                <Text style={styles.hint}>请选择产品后跳转支付</Text>
                <View style={styles.creemList}>
                  {(topupInfo?.creemProducts ?? []).slice(0, 8).map((p) => (
                    <Pressable
                      key={p.productId}
                      style={styles.creemItem}
                      onPress={() => startCreemPay(p.productId)}
                      disabled={busy || paying}
                    >
                      <View style={styles.creemLeft}>
                        <Text style={styles.creemName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.hint} numberOfLines={1}>
                          额度：{p.quota ?? '—'}
                        </Text>
                      </View>
                      <Text style={styles.creemPrice}>
                        {p.currency === 'EUR' ? '€' : '$'}
                        {p.price}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Surface>
            )}

            <Surface style={styles.pagerCard}>
              <Text style={styles.cardTitle}>充值记录</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="关键字（订单号/渠道）"
                  style={[styles.input, styles.flex1]}
                />
                <Pressable style={styles.ghostBtn} onPress={() => load(1)} disabled={busy}>
                  <Text style={styles.ghostText}>搜索</Text>
                </Pressable>
              </View>
              <Text style={styles.pagerInfo}>{pagerInfo}</Text>
            </Surface>
          </View>
        }
        renderItem={({ item }) => (
          <Surface style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={styles.name}>{item.name || `记录 #${item.id}`}</Text>
              <Badge
                text={item.status === 1 ? '已完成' : item.status === 0 ? '未完成' : `状态 ${item.status ?? '—'}`}
                color={item.status === 1 ? '#DCFCE7' : '#FEF3C7'}
              />
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>额度</Text>
              <Text style={styles.v}>{formatOmega(item.quota)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>创建</Text>
              <Text style={styles.v}>{formatDateTimeEpochSeconds(item.created)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>兑换</Text>
              <Text style={styles.v}>{formatDateTimeEpochSeconds(item.redeemed)}</Text>
            </View>
          </Surface>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无充值记录</Text>}
      />

      <FloatingPageControls
        onPrev={() => load(Math.max(1, page - 1))}
        onRefresh={() => load(page)}
        onNext={() => load(page + 1)}
        disabledPrev={busy || redeeming || paying || !canPrev}
        disabledRefresh={busy || redeeming || paying}
        disabledNext={busy || redeeming || paying || !canNext}
        refreshLabel={busy ? '刷新中…' : '刷新'}
      />

      <Modal visible={webPayOpen} transparent animationType="fade" onRequestClose={() => setWebPayOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>支付</Text>
              <Pressable
                style={styles.modalClose}
                onPress={() => {
                  setWebPayOpen(false);
                  setWebPayHtml('');
                  void load(1);
                }}
              >
                <Text style={styles.modalCloseText}>关闭</Text>
              </Pressable>
            </View>
            <WebView originWhitelist={['*']} source={{ html: webPayHtml }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  list: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#11181C',
  },
  errorText: {
    color: '#d11',
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#11181C',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11181C',
  },
  hint: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    color: '#11181C',
    fontSize: 12,
    fontWeight: '900',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
    color: '#11181C',
  },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#11181C',
    alignSelf: 'flex-start',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '900',
  },
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#667085',
    alignSelf: 'flex-start',
  },
  ghostText: {
    color: '#fff',
    fontWeight: '900',
  },
  buyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignSelf: 'flex-start',
  },
  buyText: {
    color: '#fff',
    fontWeight: '900',
  },
  payBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  redeemCard: {
    gap: 10,
  },
  onlineCard: {
    gap: 10,
  },
  onlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  onlineBody: {
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipIdle: {
    backgroundColor: '#fff',
    borderColor: 'rgba(0,0,0,0.12)',
  },
  chipActive: {
    backgroundColor: '#11181C',
    borderColor: '#11181C',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  chipTextIdle: {
    color: '#11181C',
  },
  chipTextActive: {
    color: '#fff',
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  k: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  v: {
    color: '#11181C',
    fontSize: 12,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
  },
  creemCard: {
    gap: 10,
  },
  creemList: {
    gap: 10,
  },
  creemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
  },
  creemLeft: {
    flex: 1,
    gap: 4,
  },
  creemName: {
    color: '#11181C',
    fontSize: 13,
    fontWeight: '900',
  },
  creemPrice: {
    color: '#11181C',
    fontSize: 13,
    fontWeight: '900',
  },
  pagerCard: {
    gap: 10,
  },
  pagerInfo: {
    flex: 1,
    textAlign: 'center',
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  item: {
    gap: 10,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#11181C',
  },
  empty: {
    paddingTop: 16,
    color: '#667085',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    maxHeight: '85%',
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#11181C',
  },
  modalClose: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#11181C',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '900',
  },
});
