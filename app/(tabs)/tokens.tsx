import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApi } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { AppButton } from '@/components/ui/app-button';
import { Surface } from '@/components/ui/surface';
import { formatDateTimeEpochSeconds, formatQuota } from '@/lib/format';
import { parseTokens } from '@/lib/parsers';
import { useAppTheme } from '@/hooks/use-app-theme';
import { unwrapApiData } from '@/lib/unwrap';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { ScrollTopButton } from '@/components/ui/scroll-top-button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice } from '@/components/ui/inline-notice';
import { useStatus } from '@/providers/status-provider';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { Layout, Radius } from '@/constants/theme';

// 表单标签列固定宽度，使右列（输入/快捷按钮/说明）对齐；宽度足以容纳最长标签不换行
const FORM_LABEL_WIDTH = 96;

function maskKey(key?: string) {
  if (!key) return '—';
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

type ApiEnvelope = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

function getApiEnvelope(body: unknown): ApiEnvelope | null {
  if (!isRecord(body)) return null;
  if (typeof body.success !== 'boolean') return null;
  return {
    success: body.success,
    message: typeof body.message === 'string' ? body.message : undefined,
    data: body.data,
  };
}

function safeParseJsonObject(input: string): AnyRecord | null {
  const trimmed = input.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return null;
  }
}

function pickString(obj: AnyRecord, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string') return v;
  }
  return '';
}

function parseNumberOrNull(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function TokensScreen() {
  const api = useApi();
  const { quota } = useStatus();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState<ReturnType<typeof parseTokens>>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const listRef = useRef<FlatList<ReturnType<typeof parseTokens>[number]>>(null);
  const [showTop, setShowTop] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingKey, setEditingKey] = useState<string>('');
  const [nameInput, setNameInput] = useState('');
  const [statusEnabled, setStatusEnabled] = useState(true);
  const [expiredTimeInput, setExpiredTimeInput] = useState('');
  const [remainQuotaInput, setRemainQuotaInput] = useState('');
  const [unlimitedQuota, setUnlimitedQuota] = useState(false);
  const [tokenGroupInput, setTokenGroupInput] = useState('');
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [modelLimitInput, setModelLimitInput] = useState('');
  const [ipWhitelistInput, setIpWhitelistInput] = useState('');
  const [extraJson, setExtraJson] = useState('');
  const [crossGroupRetry, setCrossGroupRetry] = useState(false);
  // 其它未知高级字段的 JSON 编辑区默认折叠，仅在已有未知字段或用户主动展开时显示
  const [extraOpen, setExtraOpen] = useState(false);

  const load = useCallback(
    async (nextPage = 1) => {
    setError('');
    setBusy(true);
    try {
      const res = await api.request({ path: '/api/token/', query: { p: nextPage, page_size: pageSize } });
      const env = getApiEnvelope(res.body);
      if (env && env.success === false) {
        setError(env.message || '请求失败');
        return;
      }
      setTokens(parseTokens(res.body));
      const data = (isRecord(env?.data) ? (env?.data as AnyRecord) : null) as AnyRecord | null;
      setPage(typeof data?.page === 'number' ? data.page : nextPage);
      setPageSize(typeof data?.page_size === 'number' ? data.page_size : pageSize);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
      if (!res.ok) setError(`请求失败：HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(false);
    }
    },
    [api, pageSize]
  );

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.request({ path: '/api/user/self/groups' });
      const env = getApiEnvelope(res.body);
      if (env && env.success === false) return;
      const data = unwrapApiData(res.body) as unknown;
      if (isRecord(data)) {
        setGroupOptions(Object.keys(data).filter((g) => typeof g === 'string' && g.trim().length > 0));
      }
    } catch {
      // ignore
    }
  }, [api]);

  const maxPage = useMemo(() => {
    if (!total) return page;
    return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  }, [page, pageSize, total]);
  const canPrev = page > 1;
  const canNext = total <= 0 ? tokens.length >= pageSize : page < maxPage;

  const openCreate = useCallback(() => {
    setEditingId(null);
    setNameInput('');
    setStatusEnabled(true);
    setExpiredTimeInput('');
    setRemainQuotaInput('');
    setUnlimitedQuota(false);
    setEditingKey('');
    setTokenGroupInput('');
    setModelLimitInput('');
    setIpWhitelistInput('');
    setExtraJson('');
    setCrossGroupRetry(false);
    setExtraOpen(false);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const tok = tokens.find((t) => t.id === id);
        setEditingId(id);
        setNameInput(tok?.name ?? '');
        setStatusEnabled(tok?.status === 1);
        setExpiredTimeInput(tok?.expiredTime ? String(tok.expiredTime) : '');
        setRemainQuotaInput(tok?.remainQuota !== undefined ? String(tok.remainQuota) : '');
        setUnlimitedQuota(!!tok?.unlimitedQuota);
        setEditingKey(tok?.key ?? '');
        setTokenGroupInput('');
        setModelLimitInput('');
        setIpWhitelistInput('');
        setExtraJson('');
        setCrossGroupRetry(false);
        setExtraOpen(false);

        const detailRes = await api.request({ path: `/api/token/${id}` });
        const detailEnv = getApiEnvelope(detailRes.body);
        if (detailEnv && detailEnv.success === false) {
          setError(detailEnv.message || '获取令牌详情失败');
          return;
        }
        const data = unwrapApiData(detailRes.body) as unknown;
        const detail = isRecord(data) ? data : {};

        const knownKeys = new Set([
          'id',
          'user_id',
          'name',
          'key',
          'status',
          'expired_time',
          'remain_quota',
          'unlimited_quota',
          'group',
          'token_group',
          'models',
          'model_limit',
          'model_limits',
          'model_limits_enabled',
          'allow_ips',
          'ip_whitelist',
          'cross_group_retry',
        ]);
        const extra: AnyRecord = {};
        for (const [k, v] of Object.entries(detail)) {
          if (knownKeys.has(k)) continue;
          extra[k] = v;
        }

        setEditingKey((typeof detail.key === 'string' ? detail.key : '') || (tok?.key ?? ''));
        setNameInput((typeof detail.name === 'string' ? detail.name : '') || (tok?.name ?? ''));
        setStatusEnabled((typeof detail.status === 'number' ? detail.status : tok?.status) === 1);
        setExpiredTimeInput(
          typeof detail.expired_time === 'number'
            ? String(detail.expired_time)
            : tok?.expiredTime
              ? String(tok.expiredTime)
              : ''
        );
        setRemainQuotaInput(
          typeof detail.remain_quota === 'number'
            ? String(detail.remain_quota)
            : tok?.remainQuota !== undefined
              ? String(tok.remainQuota)
              : ''
        );
        setUnlimitedQuota(
          typeof detail.unlimited_quota === 'boolean' ? detail.unlimited_quota : !!tok?.unlimitedQuota
        );

        setTokenGroupInput(pickString(detail, ['group', 'token_group']));

        const models =
          (detail as AnyRecord).model_limits ??
          (detail as AnyRecord).models ??
          (detail as AnyRecord).model_limit;
        if (Array.isArray(models)) setModelLimitInput(models.filter((m) => typeof m === 'string').join(', '));
        else if (typeof models === 'string') setModelLimitInput(models.split(',').map((s) => s.trim()).filter(Boolean).join(', '));

        const ips = (detail as AnyRecord).allow_ips ?? (detail as AnyRecord).ip_whitelist;
        if (Array.isArray(ips)) setIpWhitelistInput(ips.filter((m) => typeof m === 'string').join('\n'));
        else if (typeof ips === 'string') setIpWhitelistInput(ips);

        const crossGroupRetryValue =
          typeof (detail as AnyRecord).cross_group_retry === 'boolean'
            ? ((detail as AnyRecord).cross_group_retry as boolean)
            : false;
        setCrossGroupRetry(crossGroupRetryValue);
        const extraKeys = Object.keys(extra);
        setExtraJson(extraKeys.length ? `${JSON.stringify(extra, null, 2)}\n` : '');
        setExtraOpen(extraKeys.length > 0);
        setFormOpen(true);

        if (!detailRes.ok) setError(`获取令牌详情失败：HTTP ${detailRes.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取令牌详情失败');
      } finally {
        setBusy(false);
      }
    },
    [api, tokens]
  );

  const applyExpiryOffset = useCallback((seconds: number) => {
    const now = Math.floor(Date.now() / 1000);
    setExpiredTimeInput(String(now + seconds));
  }, []);

  const applyNeverExpire = useCallback(() => {
    setExpiredTimeInput('-1');
  }, []);

  const saveToken = useCallback(async () => {
    setFormError('');
    setBusy(true);
    try {
      const expired_time_raw = parseNumberOrNull(expiredTimeInput);
      const remain_quota_raw = parseNumberOrNull(remainQuotaInput);
      if (expiredTimeInput.trim() && expired_time_raw === null) {
        setFormError('到期时间必须是数字（epoch seconds）');
        return;
      }
      if (remainQuotaInput.trim() && remain_quota_raw === null) {
        setFormError('剩余额度必须是数字');
        return;
      }
      if (!nameInput.trim()) {
        setFormError('名称不能为空');
        return;
      }

      const extra = safeParseJsonObject(extraJson);
      if (extra === null) {
        setFormError('其它高级字段 JSON 格式不正确');
        return;
      }

      const modelRaw = modelLimitInput.trim();
      let modelList: string[] = [];
      if (modelRaw) {
        if (modelRaw.startsWith('[')) {
          try {
            const arr = JSON.parse(modelRaw) as unknown;
            if (Array.isArray(arr)) modelList = arr.filter((m) => typeof m === 'string') as string[];
          } catch {
            modelList = [];
          }
        }
        if (!modelList.length) {
          modelList = modelRaw
            .split(/[,\n]/g)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      let base: AnyRecord = {};
      if (editingId) {
        const detailRes = await api.request({ path: `/api/token/${editingId}` });
        const detailEnv = getApiEnvelope(detailRes.body);
        if (detailEnv && detailEnv.success === false) {
          setFormError(detailEnv.message || '获取令牌详情失败');
          return;
        }
        if (!detailRes.ok) {
          setFormError(`获取令牌详情失败：HTTP ${detailRes.status}`);
          return;
        }
        const detailData = unwrapApiData(detailRes.body) as unknown;
        if (isRecord(detailData)) base = detailData;
      }

      const expired_time =
        expired_time_raw !== null
          ? expired_time_raw === 0
            ? -1
            : expired_time_raw
          : typeof base.expired_time === 'number'
            ? (base.expired_time as number)
            : -1;

      const remain_quota =
        remain_quota_raw !== null
          ? remain_quota_raw
          : typeof base.remain_quota === 'number'
            ? (base.remain_quota as number)
            : 0;

      // 合并策略：base（服务端现有字段，编辑时保留）→ extra（其它高级 JSON 字段）→ 表单字段（最高优先级，覆盖前两者）。
      // 删除 extra 里被表单字段接管的键，避免被 base 的旧值覆盖表单意图。
      const {
        group: _extraGroup,
        model_limits: _extraModelLimits,
        allow_ips: _extraAllowIps,
        ...extraRest
      } = extra;

      const payload: Record<string, unknown> = {
        ...(editingId ? base : {}),
        ...extraRest,
        ...(editingId ? { id: editingId } : {}),
        name: nameInput.trim(),
        status: statusEnabled ? 1 : 2,
        expired_time,
        remain_quota,
        unlimited_quota: unlimitedQuota,
        group: tokenGroupInput.trim(),
        model_limits: modelList.join(','),
        model_limits_enabled: modelList.length > 0,
        allow_ips: ipWhitelistInput.trim(),
        cross_group_retry: crossGroupRetry,
      };

      const res = await api.request({
        path: '/api/token/',
        method: editingId ? 'PUT' : 'POST',
        body: payload,
      });

      const env = getApiEnvelope(res.body);
      if (env && env.success === false) {
        setFormError(env.message || '保存失败');
        return;
      }
      if (!res.ok) {
        setFormError(`保存失败：HTTP ${res.status}`);
        return;
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }, [
    api,
    crossGroupRetry,
    editingId,
    expiredTimeInput,
    extraJson,
    ipWhitelistInput,
    load,
    modelLimitInput,
    nameInput,
    remainQuotaInput,
    statusEnabled,
    tokenGroupInput,
    unlimitedQuota,
  ]);

  const toggleStatus = useCallback(
    async (id: number, nextEnabled: boolean) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({
          path: '/api/token/',
          method: 'PUT',
          query: { status_only: true },
          body: { id, status: nextEnabled ? 1 : 2 },
        });
        const env = getApiEnvelope(res.body);
        if (env && env.success === false) {
          setError(env.message || '更新状态失败');
          return;
        }
        if (!res.ok) {
          setError(`更新状态失败：HTTP ${res.status}`);
          return;
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : '更新状态失败');
      } finally {
        setBusy(false);
      }
    },
    [api, load]
  );

  const deleteToken = useCallback(
    (id: number) => {
      Alert.alert('删除令牌', '确定删除该令牌？删除后不可恢复。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              const res = await api.request({ path: `/api/token/${id}`, method: 'DELETE' });
              if (!res.ok) {
                setError(`删除失败：HTTP ${res.status}`);
                return;
              }
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : '删除失败');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [api, load]
  );

  const totalRemain = useMemo(() => {
    const nums = tokens.map((t) => t.remainQuota).filter((n): n is number => typeof n === 'number');
    if (!nums.length) return undefined;
    return nums.reduce((a, b) => a + b, 0);
  }, [tokens]);

  useEffect(() => {
    void load(1);
    void fetchGroups();
  }, [fetchGroups, load]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <FlatList
        style={styles.list}
        ref={listRef}
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 480)}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Layout.pagePadding, paddingBottom: insets.bottom + 96 }, // 96：为浮动操作栏留出空间（其自身已处理底部安全区）
        ]}
        data={tokens}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.ink }]}>令牌</Text>
              <View style={styles.headerActions}>
                <AppButton label="新增令牌" icon="add" compact onPress={openCreate} disabled={busy} />
              </View>
            </View>
            {!!error && <InlineNotice message={error} />}
            <View style={styles.summaryRow}>
              <Surface style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>令牌数量</Text>
                <Text style={[styles.summaryValue, { color: colors.ink }]}>{total || tokens.length}</Text>
              </Surface>
              <Surface style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>剩余额度</Text>
                <Text style={[styles.summaryValue, { color: colors.ink }]}>
                  {formatQuota(totalRemain, quota ?? undefined)}
                </Text>
              </Surface>
            </View>
            <Text style={[styles.listTitle, { color: colors.ink }]}>列表</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Surface style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1} ellipsizeMode="tail">
                {item.name || `Token #${item.id}`}
              </Text>
              <Badge
                text={
                  item.status === 1
                    ? '启用'
                    : item.status === 2
                      ? '禁用'
                      : item.status === 3
                        ? '已过期'
                        : item.status === 4
                          ? '已耗尽'
                          : `状态 ${item.status ?? '—'}`
                }
                tone={
                  item.status === 1
                    ? 'success'
                    : item.status === 2
                      ? 'neutral'
                      : item.status === 3
                        ? 'warning'
                        : 'danger'
                }
              />
            </View>
            <View style={styles.opsRow}>
              <AppButton
                label={item.status === 1 ? '禁用' : '启用'}
                icon={item.status === 1 ? 'block' : 'check-circle'}
                variant={item.status === 1 ? 'danger' : 'primary'}
                compact
                onPress={() => toggleStatus(item.id, item.status !== 1)}
                disabled={busy}
              />
              <AppButton
                label="编辑"
                icon="edit"
                variant="secondary"
                compact
                onPress={() => openEdit(item.id)}
                disabled={busy}
              />
              <AppButton
                label="删除"
                icon="delete-outline"
                variant="danger"
                compact
                onPress={() => deleteToken(item.id)}
                disabled={busy}
              />
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: colors.muted }]}>Key</Text>
              <Text style={[styles.metaVal, { color: colors.ink }]}>{maskKey(item.key)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: colors.muted }]}>剩余额度</Text>
              <Text style={[styles.metaVal, { color: colors.ink }]}>
                {item.unlimitedQuota ? '无限制' : formatQuota(item.remainQuota, quota ?? undefined)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: colors.muted }]}>到期</Text>
              <Text style={[styles.metaVal, { color: colors.ink }]}>
                {formatDateTimeEpochSeconds(item.expiredTime)}
              </Text>
            </View>
          </Surface>
        )}
        ListEmptyComponent={
          <EmptyState title="暂无令牌" description="创建一个访问令牌，或刷新列表后重试。" icon="vpn-key" />
        }
      />

      <Modal
        transparent
        visible={formOpen}
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: colors.overlay },
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Surface style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>
                {editingId ? `编辑 Token #${editingId}` : '新增令牌'}
              </Text>
              <View style={styles.modalHeaderActions}>
                <AppButton label="关闭" variant="secondary" compact onPress={() => setFormOpen(false)} disabled={busy} />
                <AppButton
                  label={busy ? '保存中…' : '保存'}
                  variant="primary"
                  compact
                  onPress={saveToken}
                  disabled={busy}
                />
              </View>
            </View>

            {!!formError && <InlineNotice message={formError} />}

            {/* Android 已设 adjustPan（窗口整体上移），iOS 用 padding 避让键盘 */}
            <KeyboardAvoidingView
              style={styles.modalKav}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                {!!editingKey && (
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>Key</Text>
                    <View
                      style={[
                        styles.formInput,
                        styles.readOnlyBox,
                        { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                      ]}>
                      <Text selectable style={[styles.readOnlyText, { color: colors.ink }]}>
                        {editingKey}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>名称</Text>
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="例如：我的令牌"
                    placeholderTextColor={colors.subtle}
                    selectionColor={colors.accent}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.input,
                      styles.formInput,
                      { borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.ink },
                    ]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>令牌分组</Text>
                  <DropdownSelect
                    title="选择分组"
                    value={tokenGroupInput}
                    onChange={setTokenGroupInput}
                    options={groupOptions}
                    placeholder="例如：default"
                    style={[styles.input, styles.formInput]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>启用</Text>
                  <Switch
                    value={statusEnabled}
                    onValueChange={setStatusEnabled}
                    trackColor={{ true: colors.accent, false: colors.borderStrong }}
                    thumbColor={statusEnabled ? colors.onAccent : colors.surface}
                    accessibilityLabel="启用"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>到期时间</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>到期时间</Text>
                  <TextInput
                    value={expiredTimeInput}
                    onChangeText={setExpiredTimeInput}
                    placeholder="epoch seconds（可选）"
                    placeholderTextColor={colors.subtle}
                    selectionColor={colors.accent}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      styles.formInput,
                      { borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.ink },
                    ]}
                  />
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formLabelSpacer} />
                  <View style={styles.quickBtns}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.quickBtn,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        pressed && !busy ? { backgroundColor: colors.surfaceMuted } : null,
                        busy ? styles.quickDisabled : null,
                      ]}
                      onPress={applyNeverExpire}
                      disabled={busy}>
                      <Text style={[styles.quickText, { color: colors.ink }]}>永不过期</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.quickBtn,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        pressed && !busy ? { backgroundColor: colors.surfaceMuted } : null,
                        busy ? styles.quickDisabled : null,
                      ]}
                      onPress={() => applyExpiryOffset(30 * 24 * 3600)}
                      disabled={busy}>
                      <Text style={[styles.quickText, { color: colors.ink }]}>一个月</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.quickBtn,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        pressed && !busy ? { backgroundColor: colors.surfaceMuted } : null,
                        busy ? styles.quickDisabled : null,
                      ]}
                      onPress={() => applyExpiryOffset(24 * 3600)}
                      disabled={busy}>
                      <Text style={[styles.quickText, { color: colors.ink }]}>一天</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.quickBtn,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        pressed && !busy ? { backgroundColor: colors.surfaceMuted } : null,
                        busy ? styles.quickDisabled : null,
                      ]}
                      onPress={() => applyExpiryOffset(3600)}
                      disabled={busy}>
                      <Text style={[styles.quickText, { color: colors.ink }]}>一小时</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formLabelSpacer} />
                  <Text style={[styles.helpText, { color: colors.muted }]}>
                    预览：{formatDateTimeEpochSeconds(expiredTimeInput.trim() ? Number(expiredTimeInput.trim()) : undefined)}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>额度设置</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>无限额</Text>
                  <Switch
                    value={unlimitedQuota}
                    onValueChange={setUnlimitedQuota}
                    trackColor={{ true: colors.accent, false: colors.borderStrong }}
                    thumbColor={unlimitedQuota ? colors.onAccent : colors.surface}
                    accessibilityLabel="无限额"
                  />
                </View>
                {!unlimitedQuota && (
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>剩余额度</Text>
                    <TextInput
                      value={remainQuotaInput}
                      onChangeText={setRemainQuotaInput}
                      placeholder="整数"
                      placeholderTextColor={colors.subtle}
                      selectionColor={colors.accent}
                      keyboardType="numeric"
                      style={[
                        styles.input,
                        styles.formInput,
                        { borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.ink },
                      ]}
                    />
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>访问限制</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>模型限制</Text>
                  <TextInput
                    value={modelLimitInput}
                    onChangeText={setModelLimitInput}
                    placeholder="逗号/换行分隔，或 JSON 数组"
                    placeholderTextColor={colors.subtle}
                    selectionColor={colors.accent}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[
                      styles.input,
                      styles.formInput,
                      styles.textArea,
                      { borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.ink },
                    ]}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>IP 白名单</Text>
                  <TextInput
                    value={ipWhitelistInput}
                    onChangeText={setIpWhitelistInput}
                    placeholder="允许的 IP，一行一个；留空不限制"
                    placeholderTextColor={colors.subtle}
                    selectionColor={colors.accent}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[
                      styles.input,
                      styles.formInput,
                      styles.textArea,
                      { borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.ink },
                    ]}
                    textAlignVertical="top"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>高级</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>跨分组重试</Text>
                  <Switch
                    value={crossGroupRetry}
                    onValueChange={setCrossGroupRetry}
                    trackColor={{ true: colors.accent, false: colors.borderStrong }}
                    thumbColor={crossGroupRetry ? colors.onAccent : colors.surface}
                    accessibilityLabel="跨分组重试"
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>其它字段</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.quickBtn,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      pressed ? { backgroundColor: colors.surfaceMuted } : null,
                    ]}
                    onPress={() => setExtraOpen((v) => !v)}>
                    <Text style={[styles.quickText, { color: colors.ink }]}>
                      {extraOpen ? '收起 JSON 编辑' : '展开 JSON 编辑'}
                    </Text>
                  </Pressable>
                </View>
                {extraOpen && (
                  <TextInput
                    value={extraJson}
                    onChangeText={setExtraJson}
                    placeholder={'{\n  "note": "..."\n}'}
                    placeholderTextColor={colors.subtle}
                    selectionColor={colors.accent}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[
                      styles.input,
                      styles.textArea,
                      { borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.ink },
                    ]}
                    textAlignVertical="top"
                  />
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </Surface>
        </View>
      </Modal>

      <ScrollTopButton
        visible={showTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
      />

      <FloatingPageControls
        onPrev={() => load(Math.max(1, page - 1))}
        onRefresh={() => load(page)}
        onNext={() => load(Math.min(maxPage, page + 1))}
        disabledPrev={busy || !canPrev}
        disabledRefresh={busy}
        disabledNext={busy || !canNext}
        refreshLabel={busy ? '刷新中…' : '刷新'}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  container: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: Layout.pagePadding,
    gap: Layout.sectionGap,
  },
  header: {
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'flex-end',
  },
  modalCard: { maxHeight: '92%', padding: 12, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  modalHeaderActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  modalKav: { flex: 1 },
  modalBody: { paddingBottom: 12, gap: 10 },
  sectionTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  formLabel: {
    width: FORM_LABEL_WIDTH,
    fontSize: 13,
    fontWeight: '700',
  },
  formLabelSpacer: {
    width: FORM_LABEL_WIDTH,
  },
  formInput: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 10,
    marginBottom: 2,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 92,
    paddingVertical: 10,
  },
  quickBtns: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickDisabled: {
    opacity: 0.5,
  },
  quickText: {
    fontWeight: '800',
    fontSize: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  readOnlyText: {
    fontWeight: '700',
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
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  listTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
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
  opsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaKey: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});