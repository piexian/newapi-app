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
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Badge } from '@/components/ui/badge';
import { AppButton } from '@/components/ui/app-button';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Surface } from '@/components/ui/surface';
import { Layout, Radius, type ToneName } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useApi } from '@/hooks/use-api';
import { formatCount, formatOmega } from '@/lib/format';
import type { User } from '@/lib/models';
import { parseUsers } from '@/lib/parsers';
import { unwrapApiData } from '@/lib/unwrap';
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

function isDeleted(user: User) {
  return user.deletedAt !== null && user.deletedAt !== undefined;
}

function roleLabel(role?: number) {
  switch (role) {
    case 1:
      return '普通用户';
    case 10:
      return '管理员';
    case 100:
      return '超级管理员';
    default:
      return `角色 ${role ?? '—'}`;
  }
}

function roleTone(role?: number): ToneName {
  switch (role) {
    case 1:
      return 'info';
    case 10:
      return 'warning';
    case 100:
      return 'accent';
    default:
      return 'neutral';
  }
}

function statusLabel(status?: number, deleted?: boolean) {
  if (deleted) return '已注销';
  switch (status) {
    case 1:
      return '已启用';
    case 2:
      return '已禁用';
    default:
      return `状态 ${status ?? '—'}`;
  }
}

function statusTone(status?: number, deleted?: boolean): ToneName {
  if (deleted) return 'neutral';
  switch (status) {
    case 1:
      return 'success';
    case 2:
      return 'danger';
    default:
      return 'neutral';
  }
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export default function AdminUsersScreen() {
  const api = useApi();
  const { isAdmin, isRoot } = useMe();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useAppTheme();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = useCallback((message: string) => {
    setSuccess(message);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(''), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const [items, setItems] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [groupOptions, setGroupOptions] = useState<string[]>([]);

  // applied*：已提交的搜索条件。输入/下拉直接改 draft，
  // 只有点"搜索/重置"时提交到 applied，load 依赖 applied，
  // 避免每次键入或切换分组都触发网络请求。
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [appliedGroup, setAppliedGroup] = useState('');

  // 请求序号守卫：仅最新一次请求的响应才会写入 state，丢弃过期响应。
  const requestSeq = useRef(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<AnyRecord | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [remarkInput, setRemarkInput] = useState('');
  const [groupInput, setGroupInput] = useState('default');
  const [quotaInput, setQuotaInput] = useState('');

  const pagerInfo = useMemo(() => {
    if (!total) return `第 ${page} 页`;
    const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
    return `第 ${page} / ${pages} 页，共 ${total} 条`;
  }, [page, pageSize, total]);

  const canPrev = page > 1;
  const canNext = total <= 0 ? items.length >= pageSize : page * pageSize < total;

  const load = useCallback(
    async (nextPage = 1, filters?: { keyword?: string; group?: string }) => {
      const seq = ++requestSeq.current;
      setError('');
      setBusy(true);
      try {
        // 当显式传 filters 时（重置按钮），优先用 filters 的值；否则用 applied*
        const kw = (filters?.keyword ?? appliedKeyword).trim();
        const g = (filters?.group ?? appliedGroup).trim();
        const searching = !!kw || !!g;
        const res = await api.request({
          path: searching ? '/api/user/search' : '/api/user/',
          query: {
            p: nextPage,
            page_size: pageSize,
            keyword: kw || undefined,
            group: g || undefined,
          },
        });
        if (seq !== requestSeq.current) return;
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        setItems(parseUsers(res.body));

        const env = res.body as unknown;
        const data = (isRecord(env) && isRecord(env.data) ? env.data : null) as AnyRecord | null;
        const inferredTotal =
          typeof data?.total === 'number'
            ? data.total
            : Array.isArray(data?.items)
              ? data.items.length
              : Array.isArray(data)
                ? data.length
                : 0;
        setTotal(inferredTotal);
        setPage(typeof data?.page === 'number' ? data.page : nextPage);
        setPageSize(typeof data?.page_size === 'number' ? data.page_size : pageSize);

        if (!res.ok) setError(`请求失败：HTTP ${res.status}`);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        setError(e instanceof Error ? e.message : '请求失败');
      } finally {
        if (seq === requestSeq.current) setBusy(false);
      }
    },
    [api, appliedGroup, appliedKeyword, pageSize]
  );

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.request({ path: '/api/group/' });
      const err = getApiError(res.body);
      if (err) return;
      const data = unwrapApiData(res.body) as unknown;
      if (Array.isArray(data)) {
        setGroupOptions(data.filter((g): g is string => typeof g === 'string' && g.trim().length > 0));
      }
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    if (!isAdmin) return;
    void load(1);
    void fetchGroups();
  }, [fetchGroups, isAdmin, load]);

  const resetFilters = useCallback(() => {
    setKeyword('');
    setGroup('');
    setAppliedKeyword('');
    setAppliedGroup('');
    // 传入清空后的值直接加载，避免依赖 state 更新时序
    void load(1, { keyword: '', group: '' });
  }, [load]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setEditingDetail(null);
    setUsernameInput('');
    setDisplayNameInput('');
    setPasswordInput('');
    setRemarkInput('');
    setGroupInput('default');
    setQuotaInput('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({ path: `/api/user/${id}` });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        const data = unwrapApiData(res.body) as unknown;
        const detail = isRecord(data) ? data : {};
        setEditingId(id);
        setEditingDetail(detail);
        setUsernameInput(safeString(detail.username));
        setDisplayNameInput(safeString(detail.display_name));
        setPasswordInput('');
        setRemarkInput(safeString(detail.remark));
        setGroupInput(safeString(detail.group) || 'default');
        const quota = safeNumber(detail.quota);
        setQuotaInput(typeof quota === 'number' ? String(quota) : '');
        setFormOpen(true);

        if (!res.ok) setError(`获取用户失败：HTTP ${res.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取用户失败');
      } finally {
        setBusy(false);
      }
    },
    [api]
  );

  const manageUser = useCallback(
    async (id: number, action: 'enable' | 'disable' | 'delete' | 'promote' | 'demote') => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({ path: '/api/user/manage', method: 'POST', body: { id, action } });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        if (!res.ok) {
          setError(`操作失败：HTTP ${res.status}`);
          return;
        }
        await load(page);
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失败');
      } finally {
        setBusy(false);
      }
    },
    [api, load, page]
  );

  const resetPasskey = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({ path: `/api/user/${id}/reset_passkey`, method: 'DELETE' });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        if (!res.ok) {
          setError(`操作失败：HTTP ${res.status}`);
          return;
        }
        showSuccess('Passkey 已重置');
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失败');
      } finally {
        setBusy(false);
      }
    },
    [api, showSuccess]
  );

  const resetTwoFA = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({ path: `/api/user/${id}/2fa`, method: 'DELETE' });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        if (!res.ok) {
          setError(`操作失败：HTTP ${res.status}`);
          return;
        }
        showSuccess('2FA 已重置');
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失败');
      } finally {
        setBusy(false);
      }
    },
    [api, showSuccess]
  );

  const save = useCallback(async () => {
    const username = usernameInput.trim();
    const displayName = displayNameInput.trim();
    const password = passwordInput;
    const remark = remarkInput.trim();

    if (!username) {
      setError('用户名不能为空');
      return;
    }

    if (editingId === null) {
      if (!password.trim()) {
        setError('密码不能为空');
        return;
      }
      if (password.trim().length < 8 || password.trim().length > 20) {
        setError('密码长度需为 8-20 位');
        return;
      }
    } else if (password.trim()) {
      if (password.trim().length < 8 || password.trim().length > 20) {
        setError('密码长度需为 8-20 位');
        return;
      }
    }

    const quotaText = quotaInput.trim();
    const quota = quotaText ? Number.parseInt(quotaText, 10) : undefined;
    if (editingId !== null && quotaText && (!Number.isFinite(quota) || Number.isNaN(quota))) {
      setError('额度必须是整数');
      return;
    }

    setError('');
    setBusy(true);
    try {
      if (editingId === null) {
        const res = await api.request({
          path: '/api/user/',
          method: 'POST',
          body: {
            username,
            display_name: displayName,
            password: password.trim(),
            remark,
          },
        });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        if (!res.ok) {
          setError(`创建失败：HTTP ${res.status}`);
          return;
        }
        setFormOpen(false);
        await load(1);
        return;
      }

      const res = await api.request({
        path: '/api/user/',
        method: 'PUT',
        body: {
          id: editingId,
          username,
          display_name: displayName,
          password: password.trim(), // empty means no change
          remark,
          group: groupInput.trim(),
          quota,
        },
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
      setFormOpen(false);
      await load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }, [api, displayNameInput, editingId, groupInput, load, page, passwordInput, quotaInput, remarkInput, usernameInput]);

  const applyQuotaDelta = useCallback(
    (delta: number) => {
      const current = quotaInput.trim() ? Number.parseInt(quotaInput.trim(), 10) : 0;
      const next = (Number.isFinite(current) ? current : 0) + delta;
      setQuotaInput(String(next));
    },
    [quotaInput]
  );

  if (!isAdmin) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: colors.ink }]}>用户</Text>
          <EmptyState icon="lock-outline" title="无权限" description="当前账号无管理员权限，无法访问此页面。" />
          <AppButton label="返回管理" icon="arrow-back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 }, // 底部预留浮动分页栏空间
        ]}
        data={items}
        keyExtractor={(it) => String(it.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.pageTitleGroup}>
                <AppButton label="返回" icon="arrow-back" variant="quiet" compact onPress={() => router.back()} />
                <Text style={[styles.title, { color: colors.ink }]}>用户</Text>
              </View>
              <View style={styles.actions}>
                <AppButton label="新增用户" icon="person-add" compact onPress={openCreate} disabled={busy} />
              </View>
            </View>

            {!!error && <InlineNotice message={error} />}
            {!!success && <InlineNotice message={success} title="已完成" tone="success" />}

            <Surface style={styles.searchCard}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>搜索</Text>
              <View style={styles.searchRow}>
                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="支持 ID/用户名/显示名称/邮箱"
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
                    styles.flex1,
                  ]}
                />
                <DropdownSelect
                  title="选择分组"
                  value={group}
                  onChange={setGroup}
                  options={groupOptions}
                  placeholder="分组（可选）"
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.searchActions}>
                <AppButton
                  label="搜索"
                  icon="search"
                  variant="secondary"
                  style={styles.flexBtn}
                  onPress={() => {
                    setAppliedKeyword(keyword);
                    setAppliedGroup(group);
                  }}
                  disabled={busy}
                />
                <AppButton
                  label="重置"
                  icon="refresh"
                  variant="secondary"
                  style={styles.flexBtn}
                  onPress={resetFilters}
                  disabled={busy}
                />
              </View>
              <Text style={[styles.pagerInfo, { color: colors.muted }]}>{pagerInfo}</Text>
            </Surface>
          </View>
        }
        renderItem={({ item }) => {
          const deleted = isDeleted(item);
          const remain = item.quota ?? 0;
          const used = item.usedQuota ?? 0;
          const totalQuota = remain + used;
          const percent = totalQuota > 0 ? Math.max(0, Math.min(1, remain / totalQuota)) : 0;
          return (
            <Surface style={[styles.item, deleted ? styles.itemDisabled : null]}>
              <View style={styles.itemTop}>
                <View style={styles.itemTitleWrap}>
                  <Text style={[styles.itemTitle, { color: colors.ink }]} numberOfLines={1}>
                    {item.username} <Text style={[styles.dim, { color: colors.subtle }]}>#{item.id}</Text>
                  </Text>
                  {!!item.remark && (
                    <Text style={[styles.remark, { color: colors.muted }]} numberOfLines={1}>
                      {item.remark}
                    </Text>
                  )}
                </View>
                <Badge text={statusLabel(item.status, deleted)} tone={statusTone(item.status, deleted)} />
              </View>

              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>角色</Text>
                <Badge text={roleLabel(item.role)} tone={roleTone(item.role)} />
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>分组</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{item.group || 'default'}</Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>调用次数</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{formatCount(item.requestCount)}</Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>额度</Text>
                <Text style={[styles.v, { color: colors.ink }]}>
                  {formatOmega(remain)} / {formatOmega(totalQuota)}
                </Text>
              </View>
              <View style={[styles.progressWrap, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: colors.accent, width: `${Math.round(percent * 100)}%` },
                  ]}
                />
              </View>

              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>邀请</Text>
                <Text style={[styles.v, { color: colors.ink }]}>
                  {formatCount(item.affCount)} · 收益 {formatOmega(item.affHistoryQuota)} · 邀请人 {item.inviterId ?? '—'}
                </Text>
              </View>

              <View style={styles.opsRow}>
                <AppButton label="编辑" icon="edit" variant="primary" compact onPress={() => openEdit(item.id)} disabled={busy} />
                {!deleted && (
                  <AppButton
                    label={item.status === 1 ? '禁用' : '启用'}
                    variant={item.status === 1 ? 'danger' : 'primary'}
                    compact
                    onPress={() => {
                      const action = item.status === 1 ? 'disable' : 'enable';
                      Alert.alert(
                        action === 'disable' ? '禁用用户' : '启用用户',
                        action === 'disable' ? '确定要禁用该用户？' : '确定要启用该用户？',
                        [
                          { text: '取消', style: 'cancel' },
                          { text: '确定', style: 'destructive', onPress: () => void manageUser(item.id, action) },
                        ]
                      );
                    }}
                    disabled={busy}
                  />
                )}
                {!deleted && (
                  <AppButton
                    label="重置 Passkey"
                    variant="secondary"
                    compact
                    onPress={() => {
                      Alert.alert('重置 Passkey', '将解绑该用户当前的 Passkey。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '重置', style: 'destructive', onPress: () => void resetPasskey(item.id) },
                      ]);
                    }}
                    disabled={busy}
                  />
                )}
                {!deleted && (
                  <AppButton
                    label="重置 2FA"
                    variant="secondary"
                    compact
                    onPress={() => {
                      Alert.alert('重置 2FA', '将强制禁用该用户两步验证。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '重置', style: 'destructive', onPress: () => void resetTwoFA(item.id) },
                      ]);
                    }}
                    disabled={busy}
                  />
                )}
                {isRoot && !deleted && (
                  <AppButton
                    label="提升"
                    variant="secondary"
                    compact
                    onPress={() => {
                      Alert.alert('提升用户', '将提升该用户为管理员。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '提升', style: 'destructive', onPress: () => void manageUser(item.id, 'promote') },
                      ]);
                    }}
                    disabled={busy}
                  />
                )}
                {isRoot && !deleted && (
                  <AppButton
                    label="降级"
                    variant="secondary"
                    compact
                    onPress={() => {
                      Alert.alert('降级用户', '将降级该用户为普通用户。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '降级', style: 'destructive', onPress: () => void manageUser(item.id, 'demote') },
                      ]);
                    }}
                    disabled={busy}
                  />
                )}
                {!deleted && (
                  <AppButton
                    label="注销"
                    variant="danger"
                    compact
                    onPress={() => {
                      Alert.alert('注销用户', '相当于删除用户，此操作不可逆。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '注销', style: 'destructive', onPress: () => void manageUser(item.id, 'delete') },
                      ]);
                    }}
                    disabled={busy}
                  />
                )}
              </View>
            </Surface>
          );
        }}
        ListEmptyComponent={
          <EmptyState title="暂无用户" description="调整搜索条件，或刷新后重试。" icon="group" />
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

      <Modal
        transparent
        visible={formOpen}
        animationType="slide"
        onRequestClose={() => {
          setFormOpen(false);
        }}
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
                {editingId ? `编辑用户 #${editingId}` : '添加用户'}
              </Text>
              <View style={styles.modalHeaderActions}>
                <AppButton label="关闭" variant="secondary" compact onPress={() => setFormOpen(false)} disabled={busy} />
                <AppButton label={busy ? '保存中…' : '保存'} variant="primary" compact onPress={save} disabled={busy} />
              </View>
            </View>

            {!!error && <InlineNotice message={error} />}

            {/* 键盘弹出时抬起表单，避免遮挡备注/分组/额度字段 */}
            <KeyboardAvoidingView
              style={styles.modalKav}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>基本信息</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>用户名*</Text>
                  <TextInput
                    value={usernameInput}
                    onChangeText={setUsernameInput}
                    placeholder="username"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.input,
                      { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
                      styles.flex1,
                    ]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>显示名称</Text>
                  <TextInput
                    value={displayNameInput}
                    onChangeText={setDisplayNameInput}
                    placeholder="display name"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.input,
                      { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
                      styles.flex1,
                    ]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>
                    {editingId ? '密码(留空不改)' : '密码*'}
                  </Text>
                  <TextInput
                    value={passwordInput}
                    onChangeText={setPasswordInput}
                    placeholder={editingId ? '留空不修改' : '最短 8 位'}
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    style={[
                      styles.input,
                      { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
                      styles.flex1,
                    ]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>备注</Text>
                  <TextInput
                    value={remarkInput}
                    onChangeText={setRemarkInput}
                    placeholder="仅管理员可见"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.input,
                      { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
                      styles.flex1,
                    ]}
                  />
                </View>

                {editingId !== null && (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <Text style={[styles.sectionTitle, { color: colors.ink }]}>权限设置</Text>
                    <View style={styles.formRow}>
                      <Text style={[styles.formLabel, { color: colors.muted }]}>分组</Text>
                      <DropdownSelect
                        title="选择分组"
                        value={groupInput}
                        onChange={setGroupInput}
                        options={groupOptions}
                        placeholder="default"
                        style={[styles.input, styles.flex1]}
                      />
                    </View>
                    <View style={styles.formRow}>
                      <Text style={[styles.formLabel, { color: colors.muted }]}>剩余额度</Text>
                      <TextInput
                        value={quotaInput}
                        onChangeText={setQuotaInput}
                        placeholder="整数"
                        placeholderTextColor={colors.subtle}
                        keyboardType="numeric"
                        style={[
                          styles.input,
                          { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
                          styles.flex1,
                        ]}
                      />
                    </View>
                    <View style={styles.quickRow}>
                      {[500000, 1000000, 5000000].map((n) => (
                        <Pressable
                          key={n}
                          accessibilityRole="button"
                          accessibilityLabel={`增加额度 ${formatOmega(n)}`}
                          style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          onPress={() => applyQuotaDelta(n)}
                          disabled={busy}
                        >
                          <Text style={[styles.quickText, { color: colors.ink }]}>{`+${formatOmega(n)}`}</Text>
                        </Pressable>
                      ))}
                      {[-500000].map((n) => (
                        <Pressable
                          key={n}
                          accessibilityRole="button"
                          accessibilityLabel={`减少额度 ${formatOmega(Math.abs(n))}`}
                          style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          onPress={() => applyQuotaDelta(n)}
                          disabled={busy}
                        >
                          <Text style={[styles.quickText, { color: colors.ink }]}>{`${formatOmega(n)}`}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={[styles.hint, { color: colors.muted }]}>
                      预览：{formatOmega(quotaInput.trim() ? Number(quotaInput.trim()) : undefined)}
                    </Text>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <Text style={[styles.sectionTitle, { color: colors.ink }]}>绑定信息（只读）</Text>
                    {(['email', 'github_id', 'discord_id', 'oidc_id', 'wechat_id', 'telegram_id'] as const).map((k) => (
                      <View key={k} style={styles.formRow}>
                        <Text style={[styles.formLabel, { color: colors.muted }]}>{k}</Text>
                        <View
                          style={[
                            styles.formInput,
                            styles.readOnlyBox,
                            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                          ]}
                        >
                          <Text selectable style={[styles.readOnlyText, { color: colors.ink }]}>
                            {safeString(editingDetail?.[k]) || '—'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
  container: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: Layout.pagePadding,
    gap: Layout.sectionGap,
  },
  header: { gap: 12 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitleGroup: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 20, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  hint: { fontSize: 12, fontWeight: '600' },
  searchCard: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  searchActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  flex1: { flex: 1 },
  flexBtn: { flex: 1 },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pagerInfo: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickText: { fontWeight: '800', fontSize: 12 },
  item: { gap: 10 },
  itemDisabled: { opacity: 0.75 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  itemTitleWrap: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  dim: { fontWeight: '800' },
  remark: { fontSize: 12, fontWeight: '700' },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  k: { fontSize: 12, fontWeight: '700' },
  v: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  progressWrap: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  opsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
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
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  formLabel: { width: 110, fontSize: 12, fontWeight: '800' },
  formInput: { flex: 1 },
  readOnlyBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  readOnlyText: { fontWeight: '600', fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth },
});