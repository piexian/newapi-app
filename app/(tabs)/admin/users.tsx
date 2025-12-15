import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Badge } from '@/components/ui/badge';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { Surface } from '@/components/ui/surface';
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

function roleColor(role?: number) {
  switch (role) {
    case 1:
      return '#DBEAFE';
    case 10:
      return '#FEF9C3';
    case 100:
      return '#FFEDD5';
    default:
      return '#E5E7EB';
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

function statusColor(status?: number, deleted?: boolean) {
  if (deleted) return '#E5E7EB';
  switch (status) {
    case 1:
      return '#DCFCE7';
    case 2:
      return '#FEE2E2';
    default:
      return '#E5E7EB';
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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [items, setItems] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [groupOptions, setGroupOptions] = useState<string[]>([]);

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
    async (nextPage = 1) => {
      setError('');
      setBusy(true);
      try {
        const kw = keyword.trim();
        const g = group.trim();
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
        setError(e instanceof Error ? e.message : '请求失败');
      } finally {
        setBusy(false);
      }
    },
    [api, group, keyword, pageSize]
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
        Alert.alert('已完成', 'Passkey 已重置');
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失败');
      } finally {
        setBusy(false);
      }
    },
    [api]
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
        Alert.alert('已完成', '2FA 已重置');
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失败');
      } finally {
        setBusy(false);
      }
    },
    [api]
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
      <View style={styles.screen}>
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.title}>用户</Text>
          <Surface>
            <Text style={styles.hint}>无权限</Text>
          </Surface>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>返回</Text>
          </Pressable>
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
              <Text style={styles.title}>用户</Text>
              <View style={styles.actions}>
                <Pressable style={[styles.actionBtn, styles.primaryBtn]} onPress={openCreate} disabled={busy}>
                  <Text style={[styles.actionText, styles.primaryText]}>新增</Text>
                </Pressable>
              </View>
            </View>

            {!!error && (
              <Surface>
                <Text style={styles.errorText}>{error}</Text>
              </Surface>
            )}

            <Surface style={styles.searchCard}>
              <Text style={styles.cardTitle}>搜索</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="支持 ID/用户名/显示名称/邮箱"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
                <TextInput
                  value={group}
                  onChangeText={setGroup}
                  placeholder="分组（可选）"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
                <Pressable style={styles.actionBtn} onPress={() => load(1)} disabled={busy}>
                  <Text style={styles.actionText}>搜索</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    setKeyword('');
                    setGroup('');
                    setTimeout(() => {
                      void load(1);
                    }, 50);
                  }}
                  disabled={busy}
                >
                  <Text style={styles.actionText}>重置</Text>
                </Pressable>
              </View>
              {!!groupOptions.length && (
                <View style={styles.quickRow}>
                  {groupOptions.slice(0, 10).map((g) => (
                    <Pressable
                      key={g}
                      style={styles.quickBtn}
                      onPress={() => {
                        setGroup(g);
                        setTimeout(() => void load(1), 50);
                      }}
                      disabled={busy}
                    >
                      <Text style={styles.quickText}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={styles.pagerInfo}>{pagerInfo}</Text>
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
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.username} <Text style={styles.dim}>#{item.id}</Text>
                  </Text>
                  {!!item.remark && (
                    <Text style={styles.remark} numberOfLines={1}>
                      {item.remark}
                    </Text>
                  )}
                </View>
                <Badge text={statusLabel(item.status, deleted)} color={statusColor(item.status, deleted)} />
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.k}>角色</Text>
                <Badge text={roleLabel(item.role)} color={roleColor(item.role)} />
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>分组</Text>
                <Text style={styles.v}>{item.group || 'default'}</Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.k}>调用次数</Text>
                <Text style={styles.v}>{formatCount(item.requestCount)}</Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.k}>额度</Text>
                <Text style={styles.v}>
                  {formatOmega(remain)} / {formatOmega(totalQuota)}
                </Text>
              </View>
              <View style={styles.progressWrap}>
                <View style={[styles.progressBar, { width: `${Math.round(percent * 100)}%` }]} />
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.k}>邀请</Text>
                <Text style={styles.v}>
                  {formatCount(item.affCount)} · 收益 {formatOmega(item.affHistoryQuota)} · 邀请人 {item.inviterId ?? '—'}
                </Text>
              </View>

              <View style={styles.opsRow}>
                <Pressable style={[styles.smallBtn, styles.primaryBtn]} onPress={() => openEdit(item.id)} disabled={busy}>
                  <Text style={[styles.smallBtnText, styles.primaryText]}>编辑</Text>
                </Pressable>
                {!deleted && (
                  <Pressable
                    style={[styles.smallBtn, item.status === 1 ? styles.dangerBtn : styles.primaryBtn]}
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
                  >
                    <Text style={[styles.smallBtnText, item.status === 1 ? styles.dangerText : styles.primaryText]}>
                      {item.status === 1 ? '禁用' : '启用'}
                    </Text>
                  </Pressable>
                )}
                {!deleted && (
                  <Pressable
                    style={[styles.smallBtn, styles.ghostBtn]}
                    onPress={() => {
                      Alert.alert('重置 Passkey', '将解绑该用户当前的 Passkey。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '重置', style: 'destructive', onPress: () => void resetPasskey(item.id) },
                      ]);
                    }}
                    disabled={busy}
                  >
                    <Text style={[styles.smallBtnText, styles.primaryText]}>重置 Passkey</Text>
                  </Pressable>
                )}
                {!deleted && (
                  <Pressable
                    style={[styles.smallBtn, styles.ghostBtn]}
                    onPress={() => {
                      Alert.alert('重置 2FA', '将强制禁用该用户两步验证。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '重置', style: 'destructive', onPress: () => void resetTwoFA(item.id) },
                      ]);
                    }}
                    disabled={busy}
                  >
                    <Text style={[styles.smallBtnText, styles.primaryText]}>重置 2FA</Text>
                  </Pressable>
                )}
                {isRoot && !deleted && (
                  <Pressable
                    style={[styles.smallBtn, styles.secondaryBtn]}
                    onPress={() => {
                      Alert.alert('提升用户', '将提升该用户为管理员。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '提升', style: 'destructive', onPress: () => void manageUser(item.id, 'promote') },
                      ]);
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.smallBtnText}>提升</Text>
                  </Pressable>
                )}
                {isRoot && !deleted && (
                  <Pressable
                    style={[styles.smallBtn, styles.secondaryBtn]}
                    onPress={() => {
                      Alert.alert('降级用户', '将降级该用户为普通用户。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '降级', style: 'destructive', onPress: () => void manageUser(item.id, 'demote') },
                      ]);
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.smallBtnText}>降级</Text>
                  </Pressable>
                )}
                {!deleted && (
                  <Pressable
                    style={[styles.smallBtn, styles.dangerBtn]}
                    onPress={() => {
                      Alert.alert('注销用户', '相当于删除用户，此操作不可逆。确定继续？', [
                        { text: '取消', style: 'cancel' },
                        { text: '注销', style: 'destructive', onPress: () => void manageUser(item.id, 'delete') },
                      ]);
                    }}
                    disabled={busy}
                  >
                    <Text style={[styles.smallBtnText, styles.dangerText]}>注销</Text>
                  </Pressable>
                )}
              </View>
            </Surface>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>暂无用户</Text>}
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
        <View style={[styles.modalOverlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Surface style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? `编辑用户 #${editingId}` : '添加用户'}</Text>
              <View style={styles.modalHeaderActions}>
                <Pressable style={styles.modalBtn} onPress={() => setFormOpen(false)} disabled={busy}>
                  <Text style={styles.modalBtnText}>关闭</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.primaryBtn]} onPress={save} disabled={busy}>
                  <Text style={[styles.modalBtnText, styles.primaryText]}>{busy ? '保存中…' : '保存'}</Text>
                </Pressable>
              </View>
            </View>

            {!!error && (
              <Surface>
                <Text style={styles.errorText}>{error}</Text>
              </Surface>
            )}

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>基本信息</Text>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>用户名*</Text>
                <TextInput
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>显示名称</Text>
                <TextInput
                  value={displayNameInput}
                  onChangeText={setDisplayNameInput}
                  placeholder="display name"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>{editingId ? '密码(留空不改)' : '密码*'}</Text>
                <TextInput
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder={editingId ? '留空不修改' : '最短 8 位'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>备注</Text>
                <TextInput
                  value={remarkInput}
                  onChangeText={setRemarkInput}
                  placeholder="仅管理员可见"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>

              {editingId !== null && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>权限设置</Text>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>分组</Text>
                    <TextInput
                      value={groupInput}
                      onChangeText={setGroupInput}
                      placeholder="default"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[styles.input, styles.flex1]}
                    />
                  </View>
                  {!!groupOptions.length && (
                    <View style={styles.quickRow}>
                      {groupOptions.slice(0, 10).map((g) => (
                        <Pressable key={g} style={styles.quickBtn} onPress={() => setGroupInput(g)} disabled={busy}>
                          <Text style={styles.quickText}>{g}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>剩余额度</Text>
                    <TextInput
                      value={quotaInput}
                      onChangeText={setQuotaInput}
                      placeholder="整数"
                      keyboardType="numeric"
                      style={[styles.input, styles.flex1]}
                    />
                  </View>
                  <View style={styles.quickRow}>
                    {[500000, 1000000, 5000000].map((n) => (
                      <Pressable key={n} style={styles.quickBtn} onPress={() => applyQuotaDelta(n)} disabled={busy}>
                        <Text style={styles.quickText}>{`+${formatOmega(n)}`}</Text>
                      </Pressable>
                    ))}
                    {[-500000].map((n) => (
                      <Pressable key={n} style={styles.quickBtn} onPress={() => applyQuotaDelta(n)} disabled={busy}>
                        <Text style={styles.quickText}>{`${formatOmega(n)}`}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.hint}>预览：{formatOmega(quotaInput.trim() ? Number(quotaInput.trim()) : undefined)}</Text>

                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>绑定信息（只读）</Text>
                  {(['email', 'github_id', 'discord_id', 'oidc_id', 'wechat_id', 'telegram_id'] as const).map((k) => (
                    <View key={k} style={styles.formRow}>
                      <Text style={styles.formLabel}>{k}</Text>
                      <View style={[styles.formInput, styles.readOnlyBox]}>
                        <Text selectable style={styles.readOnlyText}>
                          {safeString(editingDetail?.[k]) || '—'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  list: { flex: 1 },
  container: { padding: 16, gap: 12 },
  header: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#11181C' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  errorText: { color: '#991B1B', fontWeight: '700' },
  hint: { color: '#667085', fontSize: 12, fontWeight: '600' },
  searchCard: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#11181C' },
  inlineRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  flex1: { flex: 1 },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
    color: '#11181C',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    alignSelf: 'flex-start',
  },
  actionText: { fontWeight: '800', color: '#11181C' },
  primaryBtn: { backgroundColor: '#11181C', borderColor: 'transparent' },
  primaryText: { color: '#fff' },
  dangerBtn: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  dangerText: { color: '#991B1B' },
  ghostBtn: { backgroundColor: '#667085', borderColor: 'transparent' },
  secondaryBtn: { backgroundColor: '#EEF2FF', borderColor: 'rgba(0,0,0,0.08)' },
  pagerInfo: { flex: 1, textAlign: 'center', color: '#667085', fontSize: 12, fontWeight: '700' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  quickText: { color: '#11181C', fontWeight: '800', fontSize: 12 },
  item: { gap: 10 },
  itemDisabled: { opacity: 0.75 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  itemTitleWrap: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: '900', color: '#11181C' },
  dim: { color: '#98A2B3', fontWeight: '800' },
  remark: { color: '#667085', fontSize: 12, fontWeight: '700' },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  k: { color: '#667085', fontSize: 12, fontWeight: '700' },
  v: { color: '#11181C', fontSize: 12, fontWeight: '900' },
  progressWrap: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,28,0.06)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#11181C',
    borderRadius: 999,
  },
  opsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
  },
  smallBtnText: { fontWeight: '900', color: '#11181C' },
  empty: { paddingTop: 16, color: '#667085', textAlign: 'center' },
  backBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#11181C',
  },
  backText: { color: '#fff', fontWeight: '900' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 12,
    justifyContent: 'flex-end',
  },
  modalCard: { maxHeight: '92%', padding: 12, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: '#11181C' },
  modalHeaderActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
  },
  modalBtnText: { fontWeight: '900', color: '#11181C' },
  modalBody: { paddingBottom: 12, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#11181C' },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  formLabel: { width: 110, color: '#667085', fontSize: 12, fontWeight: '800' },
  formInput: { flex: 1 },
  readOnlyBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#F3F4F6',
  },
  readOnlyText: { color: '#11181C', fontWeight: '900', fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
});
