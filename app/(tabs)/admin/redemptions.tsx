import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { Badge } from '@/components/ui/badge';
import { AppButton } from '@/components/ui/app-button';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Surface } from '@/components/ui/surface';
import { useApi } from '@/hooks/use-api';
import { formatDateTimeEpochSeconds, formatOmega } from '@/lib/format';
import { parseRedemptions } from '@/lib/parsers';
import { useMe } from '@/providers/me-provider';

type AnyRecord = Record<string, unknown>;
function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

type ApiEnvelope = { success?: boolean; message?: unknown; data?: unknown };
function getApiError(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const env = body as ApiEnvelope;
  if (typeof env.success === 'boolean' && env.success === false) {
    const msg = env.message;
    return typeof msg === 'string' && msg.trim() ? msg : '请求失败';
  }
  return null;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function statusLabel(status?: number, expiredTime?: number) {
  const expired = status === 1 && expiredTime && expiredTime !== 0 && expiredTime < nowSeconds();
  if (expired) return '已过期';
  switch (status) {
    case 1:
      return '未使用';
    case 2:
      return '已禁用';
    case 3:
      return '已使用';
    default:
      return `状态 ${status ?? '—'}`;
  }
}

function statusColor(status?: number, expiredTime?: number) {
  const expired = status === 1 && expiredTime && expiredTime !== 0 && expiredTime < nowSeconds();
  if (expired) return '#FEF9C3';
  switch (status) {
    case 1:
      return '#DCFCE7';
    case 2:
      return '#FEE2E2';
    case 3:
      return '#E5E7EB';
    default:
      return '#E5E7EB';
  }
}

function maskKey(key?: string) {
  if (!key) return '—';
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export default function RedemptionsScreen() {
  const api = useApi();
  const { isAdmin } = useMe();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [items, setItems] = useState<ReturnType<typeof parseRedemptions>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [quotaInput, setQuotaInput] = useState('1000000');
  const [countInput, setCountInput] = useState('1');
  const [expiredInput, setExpiredInput] = useState('0'); // 0 永不过期

  const [keysOpen, setKeysOpen] = useState(false);
  const [createdKeys, setCreatedKeys] = useState<string>('');

  const load = useCallback(
    async (nextPage = 1) => {
      setError('');
      setBusy(true);
      try {
        const kw = keyword.trim();
        const res = await api.request({
          path: kw ? '/api/redemption/search' : '/api/redemption/',
          query: {
            p: nextPage,
            page_size: pageSize,
            keyword: kw ? kw : undefined,
          },
        });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        setItems(parseRedemptions(res.body));
        const env = res.body as unknown;
        const data = (isRecord(env) && isRecord(env.data) ? env.data : null) as AnyRecord | null;
        setPage(typeof data?.page === 'number' ? data.page : nextPage);
        setPageSize(typeof data?.page_size === 'number' ? data.page_size : pageSize);
        setTotal(typeof data?.total === 'number' ? data.total : (Array.isArray(data?.items) ? data.items.length : 0));
        if (!res.ok) setError(`请求失败：HTTP ${res.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '请求失败');
      } finally {
        setBusy(false);
      }
    },
    [api, keyword, pageSize]
  );

  useEffect(() => {
    if (!isAdmin) return;
    void load(1);
  }, [isAdmin, load]);

  const pagerInfo = useMemo(() => {
    if (!total) return `第 ${page} 页`;
    const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
    return `第 ${page} / ${pages} 页，共 ${total} 条`;
  }, [page, pageSize, total]);

  const canPrev = page > 1;
  const canNext = total <= 0 ? items.length >= pageSize : page * pageSize < total;

  const copy = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('已复制', '已复制到剪贴板');
  }, []);

  const clearInvalid = useCallback(() => {
    Alert.alert('清理失效兑换码', '将删除已使用、已禁用及过期的兑换码，此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清理',
        style: 'destructive',
        onPress: async () => {
          setError('');
          setBusy(true);
          try {
            const res = await api.request({ path: '/api/redemption/invalid', method: 'DELETE' });
            const err = getApiError(res.body);
            if (err) {
              setError(err);
              return;
            }
            if (!res.ok) {
              setError(`清理失败：HTTP ${res.status}`);
              return;
            }
            await load(1);
          } catch (e) {
            setError(e instanceof Error ? e.message : '清理失败');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [api, load]);

  const toggleStatus = useCallback(
    async (id: number, nextEnabled: boolean) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({
          path: '/api/redemption/',
          method: 'PUT',
          query: { status_only: true },
          body: { id, status: nextEnabled ? 1 : 2 },
        });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        if (!res.ok) {
          setError(`更新失败：HTTP ${res.status}`);
          return;
        }
        await load(page);
      } catch (e) {
        setError(e instanceof Error ? e.message : '更新失败');
      } finally {
        setBusy(false);
      }
    },
    [api, load, page]
  );

  const remove = useCallback(
    (id: number) => {
      Alert.alert('删除兑换码', '确定删除该兑换码？删除后不可恢复。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              const res = await api.request({ path: `/api/redemption/${id}`, method: 'DELETE' });
              const err = getApiError(res.body);
              if (err) {
                setError(err);
                return;
              }
              if (!res.ok) {
                setError(`删除失败：HTTP ${res.status}`);
                return;
              }
              await load(page);
            } catch (e) {
              setError(e instanceof Error ? e.message : '删除失败');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [api, load, page]
  );

  const openCreate = useCallback(() => {
    setNameInput('');
    setQuotaInput('1000000');
    setCountInput('1');
    setExpiredInput('0');
    setCreateOpen(true);
  }, []);

  const create = useCallback(async () => {
    const name = nameInput.trim();
    const quota = Number(quotaInput.trim());
    const count = Number(countInput.trim());
    const expiredTime = Number(expiredInput.trim());
    if (!name) {
      setError('名称不能为空');
      return;
    }
    if (!Number.isFinite(quota) || quota <= 0) {
      setError('额度必须是正数');
      return;
    }
    if (!Number.isInteger(count) || count <= 0 || count > 100) {
      setError('数量必须是 1-100 的整数');
      return;
    }
    if (!Number.isFinite(expiredTime) || expiredTime < 0) {
      setError('过期时间必须是 0（不过期）或未来时间戳');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await api.request({
        path: '/api/redemption/',
        method: 'POST',
        body: { name, quota, count, expired_time: expiredTime },
      });
      const err = getApiError(res.body);
      if (err) {
        setError(err);
        return;
      }
      if (!res.ok) {
        setError(`新增失败：HTTP ${res.status}`);
        return;
      }
      const env = res.body as unknown;
      const keys = (isRecord(env) && Array.isArray(env.data) ? env.data : []) as unknown[];
      const text = keys.filter((k) => typeof k === 'string').join('\n');
      setCreatedKeys(text);
      setKeysOpen(true);
      setCreateOpen(false);
      await load(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失败');
    } finally {
      setBusy(false);
    }
  }, [api, countInput, expiredInput, load, nameInput, quotaInput]);

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.title}>兑换码</Text>
          <Surface>
            <Text style={styles.hint}>无权限</Text>
          </Surface>
          <AppButton label="返回管理" icon="arrow-back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
        data={items}
        keyExtractor={(it) => String(it.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.pageTitleGroup}>
                <AppButton label="返回" icon="arrow-back" variant="quiet" compact onPress={() => router.back()} />
                <Text style={styles.title}>兑换码</Text>
              </View>
              <View style={styles.actions}>
                <AppButton label="新增兑换码" icon="add" compact onPress={openCreate} disabled={busy} />
                <AppButton
                  label="清理失效"
                  icon="delete-sweep"
                  variant="danger"
                  compact
                  onPress={clearInvalid}
                  disabled={busy}
                />
              </View>
            </View>

            {!!error && <InlineNotice message={error} />}

            <Surface style={styles.searchCard}>
              <Text style={styles.cardTitle}>搜索</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="按名称/ID 前缀"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
                <Pressable style={styles.actionBtn} onPress={() => load(1)} disabled={busy}>
                  <Text style={styles.actionText}>搜索</Text>
                </Pressable>
              </View>
              <Text style={styles.pagerInfo}>{pagerInfo}</Text>
            </Surface>

            {createOpen && (
              <Surface style={styles.formCard}>
                <Text style={styles.cardTitle}>新增兑换码</Text>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>名称</Text>
                  <TextInput value={nameInput} onChangeText={setNameInput} placeholder="例如：活动礼包" style={[styles.input, styles.flex1]} />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>额度</Text>
                  <TextInput value={quotaInput} onChangeText={setQuotaInput} keyboardType="numeric" style={[styles.input, styles.flex1]} />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>数量</Text>
                  <TextInput value={countInput} onChangeText={setCountInput} keyboardType="numeric" style={[styles.input, styles.flex1]} />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>过期</Text>
                  <TextInput value={expiredInput} onChangeText={setExpiredInput} keyboardType="numeric" style={[styles.input, styles.flex1]} />
                </View>
                <View style={styles.quickRow}>
                  <Pressable style={styles.quickBtn} onPress={() => setExpiredInput('0')} disabled={busy}>
                    <Text style={styles.quickText}>永不过期</Text>
                  </Pressable>
                  <Pressable style={styles.quickBtn} onPress={() => setExpiredInput(String(nowSeconds() + 3600))} disabled={busy}>
                    <Text style={styles.quickText}>1 小时</Text>
                  </Pressable>
                  <Pressable style={styles.quickBtn} onPress={() => setExpiredInput(String(nowSeconds() + 86400))} disabled={busy}>
                    <Text style={styles.quickText}>1 天</Text>
                  </Pressable>
                  <Pressable style={styles.quickBtn} onPress={() => setExpiredInput(String(nowSeconds() + 30 * 86400))} disabled={busy}>
                    <Text style={styles.quickText}>30 天</Text>
                  </Pressable>
                </View>
                <View style={styles.formActions}>
                  <Pressable style={[styles.actionBtn, styles.primaryBtn]} onPress={create} disabled={busy}>
                    <Text style={[styles.actionText, styles.primaryText]}>{busy ? '提交中…' : '提交'}</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => setCreateOpen(false)} disabled={busy}>
                    <Text style={styles.actionText}>取消</Text>
                  </Pressable>
                </View>
                <Text style={styles.hint}>过期时间为 epoch seconds，0 表示不过期。</Text>
              </Surface>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Surface style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.name || `兑换码 #${item.id}`}
              </Text>
              <Badge text={statusLabel(item.status, item.expiredTime)} color={statusColor(item.status, item.expiredTime)} />
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>额度</Text>
              <Text style={styles.v}>{formatOmega(item.quota)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Key</Text>
              <Pressable onPress={() => item.key && copy(item.key)}>
                <Text style={styles.v}>{maskKey(item.key)}</Text>
              </Pressable>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>过期</Text>
              <Text style={styles.v}>{formatDateTimeEpochSeconds(item.expiredTime)}</Text>
            </View>
            <View style={styles.opsRow}>
              <Pressable
                style={[styles.smallBtn, item.status === 1 ? styles.dangerBtn : styles.primaryBtn]}
                onPress={() => toggleStatus(item.id, item.status !== 1)}
                disabled={busy || item.status === 3}
              >
                <Text style={[styles.smallBtnText, item.status === 1 ? styles.dangerText : styles.primaryText]}>
                  {item.status === 1 ? '禁用' : '启用'}
                </Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.ghostBtn]} onPress={() => remove(item.id)} disabled={busy}>
                <Text style={styles.smallBtnText}>删除</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, styles.secondaryBtn]}
                onPress={() => item.key && copy(item.key)}
                disabled={busy || !item.key}
              >
                <Text style={styles.smallBtnText}>复制 Key</Text>
              </Pressable>
            </View>
          </Surface>
        )}
        ListEmptyComponent={
          <EmptyState title="暂无兑换码" description="生成兑换码后会显示在这里。" icon="confirmation-number" />
        }
      />

      <FloatingPageControls
        onPrev={() => load(Math.max(1, page - 1))}
        onRefresh={() => load(page)}
        onNext={() => load(page + 1)}
        disabledPrev={busy || !canPrev}
        disabledRefresh={busy}
        disabledNext={busy || !canNext}
        refreshLabel={busy ? '刷新中…' : '刷新'}
      />

      <Modal visible={keysOpen} transparent animationType="fade" onRequestClose={() => setKeysOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>已生成兑换码</Text>
              <View style={styles.modalActions}>
                <Pressable style={[styles.actionBtn, styles.primaryBtn]} onPress={() => copy(createdKeys)} disabled={!createdKeys}>
                  <Text style={[styles.actionText, styles.primaryText]}>复制</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => setKeysOpen(false)}>
                  <Text style={styles.actionText}>关闭</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.modalBody}>
              <Text selectable style={styles.mono}>
                {createdKeys || '—'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  list: { flex: 1 },
  container: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 16, gap: 16 },
  header: { gap: 12 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitleGroup: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#15211F' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8E1DE',
  },
  actionText: { fontWeight: '800', color: '#15211F' },
  primaryBtn: { backgroundColor: '#0B6B5C', borderColor: 'transparent' },
  primaryText: { color: '#fff' },
  dangerBtn: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  dangerText: { color: '#991B1B' },
  ghostBtn: { backgroundColor: '#63716E', borderColor: 'transparent' },
  secondaryBtn: { backgroundColor: '#fff' },
  errorText: { color: '#B42318', fontWeight: '700' },
  searchCard: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#15211F' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderColor: '#D8E1DE',
    backgroundColor: '#fff',
    color: '#15211F',
  },
  flex1: { flex: 1 },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  pagerInfo: { flex: 1, textAlign: 'center', color: '#63716E', fontSize: 12, fontWeight: '700' },
  formCard: { gap: 10 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formLabel: { width: 56, color: '#63716E', fontSize: 12, fontWeight: '800' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginLeft: 56 },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8E1DE',
    backgroundColor: '#fff',
  },
  quickText: { fontWeight: '900', color: '#15211F', fontSize: 12 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hint: { color: '#63716E', fontSize: 12, fontWeight: '600' },
  item: { gap: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: '#15211F' },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  k: { color: '#63716E', fontSize: 12, fontWeight: '700' },
  v: { color: '#15211F', fontSize: 12, fontWeight: '900' },
  opsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8E1DE',
    backgroundColor: '#fff',
  },
  smallBtnText: { fontWeight: '900', color: '#15211F' },
  empty: { paddingTop: 16, color: '#63716E', textAlign: 'center' },
  backBtn: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0B6B5C' },
  backText: { color: '#fff', fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { maxHeight: '85%', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8E1DE',
    gap: 10,
  },
  modalTitle: { fontSize: 14, fontWeight: '900', color: '#15211F' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBody: { padding: 14 },
  mono: { fontFamily: 'ui-monospace', fontSize: 12, color: '#15211F' },
});
