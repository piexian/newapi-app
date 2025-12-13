import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { Badge } from '@/components/ui/badge';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { Surface } from '@/components/ui/surface';
import { useApi } from '@/hooks/use-api';
import { formatDateTimeEpochSeconds } from '@/lib/format';
import { parseChannels } from '@/lib/parsers';
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

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  0: 'Unknown',
  1: 'OpenAI',
  3: 'Azure',
  4: 'Ollama',
  14: 'Anthropic',
  20: 'OpenRouter',
  24: 'Gemini',
  25: 'Moonshot',
  33: 'AWS',
  40: 'SiliconFlow',
  41: 'VertexAI',
  42: 'Mistral',
  43: 'DeepSeek',
  45: 'VolcEngine',
  48: 'xAI',
};

function channelTypeLabel(type?: number) {
  if (typeof type !== 'number') return 'Unknown';
  return CHANNEL_TYPE_NAMES[type] ?? `Type ${type}`;
}

function statusLabel(status?: number) {
  switch (status) {
    case 1:
      return '启用';
    case 2:
      return '手动禁用';
    case 3:
      return '自动禁用';
    default:
      return `状态 ${status ?? '-'}`;
  }
}

function statusColor(status?: number) {
  switch (status) {
    case 1:
      return '#DCFCE7';
    case 2:
      return '#FEE2E2';
    case 3:
      return '#FEF9C3';
    default:
      return '#E5E7EB';
  }
}

function normalizeCommaList(input: string): string {
  const parts = input
    .split(/[,|\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(',');
}

function parseIntegerOrNull(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export default function ChannelsScreen() {
  const api = useApi();
  const { isAdmin } = useMe();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [items, setItems] = useState<ReturnType<typeof parseChannels>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [modelKeyword, setModelKeyword] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<AnyRecord | null>(null);
  const [isMultiKey, setIsMultiKey] = useState(false);
  const [multiKeyMode, setMultiKeyMode] = useState<'random' | 'polling'>('random');
  const [keyMode, setKeyMode] = useState<'replace' | 'append'>('replace');

  const [nameInput, setNameInput] = useState('');
  const [typeInput, setTypeInput] = useState('1');
  const [keyInput, setKeyInput] = useState('');
  const [statusEnabled, setStatusEnabled] = useState(true);
  const [groupInput, setGroupInput] = useState('default');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [modelsInput, setModelsInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [priorityInput, setPriorityInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [remarkInput, setRemarkInput] = useState('');
  const [otherInput, setOtherInput] = useState('');
  const [settingInput, setSettingInput] = useState('');
  const [modelMappingInput, setModelMappingInput] = useState('');
  const [paramOverrideInput, setParamOverrideInput] = useState('');
  const [headerOverrideInput, setHeaderOverrideInput] = useState('');

  const query = useMemo(() => {
    const kw = keyword.trim();
    const g = group.trim();
    const mk = modelKeyword.trim();
    const status = statusFilter === 'all' ? undefined : statusFilter;
    return { kw, g, mk, status };
  }, [group, keyword, modelKeyword, statusFilter]);

  const load = useCallback(
    async (nextPage = 1) => {
      setError('');
      setBusy(true);
      try {
        const isSearching = !!query.kw || !!query.g || !!query.mk || query.status !== undefined;
        const res = await api.request({
          path: isSearching ? '/api/channel/search' : '/api/channel/',
          query: {
            p: nextPage,
            page_size: pageSize,
            keyword: query.kw || undefined,
            group: query.g || undefined,
            model: query.mk || undefined,
            status: query.status || undefined,
            id_sort: true,
          },
        });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        setItems(parseChannels(res.body));
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
        setPage(nextPage);
        if (!res.ok) setError(`请求失败：HTTP ${res.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '请求失败');
      } finally {
        setBusy(false);
      }
    },
    [api, pageSize, query.g, query.kw, query.mk, query.status]
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

  const openCreate = useCallback(() => {
    setEditingId(null);
    setEditingOriginal(null);
    setIsMultiKey(false);
    setMultiKeyMode('random');
    setKeyMode('replace');
    setNameInput('');
    setTypeInput('1');
    setKeyInput('');
    setStatusEnabled(true);
    setGroupInput('default');
    setBaseUrlInput('');
    setModelsInput('');
    setWeightInput('');
    setPriorityInput('');
    setTagInput('');
    setRemarkInput('');
    setOtherInput('');
    setSettingInput('');
    setModelMappingInput('');
    setParamOverrideInput('');
    setHeaderOverrideInput('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const row = items.find((it) => it.id === id);
        setEditingId(id);
        setEditingOriginal(null);
        setIsMultiKey(false);
        setMultiKeyMode('random');
        setKeyMode('replace');

        setNameInput(row?.name ?? '');
        setTypeInput(String(row?.type ?? 1));
        setKeyInput('');
        setStatusEnabled((row?.status ?? 1) === 1);
        setGroupInput(row?.group ?? 'default');
        setBaseUrlInput(row?.baseUrl ?? '');
        setModelsInput(row?.models ?? '');
        setWeightInput(row?.weight !== undefined ? String(row.weight) : '');
        setPriorityInput(row?.priority !== undefined ? String(row.priority) : '');
        setTagInput(row?.tag ?? '');
        setRemarkInput(row?.remark ?? '');
        setOtherInput(row?.other ?? '');
        setSettingInput('');
        setModelMappingInput('');
        setParamOverrideInput('');
        setHeaderOverrideInput('');

        const detailRes = await api.request({ path: `/api/channel/${id}` });
        const detailErr = getApiError(detailRes.body);
        if (detailErr) {
          setError(detailErr);
          return;
        }
        if (!detailRes.ok) {
          setError(`获取渠道详情失败：HTTP ${detailRes.status}`);
          return;
        }
        const data = unwrapApiData(detailRes.body) as unknown;
        const detail = (isRecord(data) ? data : null) as AnyRecord | null;
        if (!detail) {
          setError('获取渠道详情失败：数据格式错误');
          return;
        }
        setEditingOriginal(detail);

        const chInfo = detail.channel_info;
        const multi = isRecord(chInfo) && typeof chInfo.is_multi_key === 'boolean' ? chInfo.is_multi_key : false;
        setIsMultiKey(multi);
        const mkMode = isRecord(chInfo) && typeof chInfo.multi_key_mode === 'string' ? chInfo.multi_key_mode : '';
        if (mkMode === 'polling' || mkMode === 'random') setMultiKeyMode(mkMode);

        setNameInput(typeof detail.name === 'string' ? detail.name : row?.name ?? '');
        setTypeInput(typeof detail.type === 'number' ? String(detail.type) : String(row?.type ?? 1));
        setStatusEnabled((typeof detail.status === 'number' ? detail.status : row?.status ?? 1) === 1);
        setGroupInput(typeof detail.group === 'string' ? detail.group : row?.group ?? 'default');
        setBaseUrlInput(typeof detail.base_url === 'string' ? detail.base_url : row?.baseUrl ?? '');
        setModelsInput(typeof detail.models === 'string' ? detail.models : row?.models ?? '');
        setWeightInput(
          typeof detail.weight === 'number'
            ? String(detail.weight)
            : row?.weight !== undefined
              ? String(row.weight)
              : ''
        );
        setPriorityInput(
          typeof detail.priority === 'number'
            ? String(detail.priority)
            : row?.priority !== undefined
              ? String(row.priority)
              : ''
        );
        setTagInput(typeof detail.tag === 'string' ? detail.tag : row?.tag ?? '');
        setRemarkInput(typeof detail.remark === 'string' ? detail.remark : row?.remark ?? '');
        setOtherInput(typeof detail.other === 'string' ? detail.other : row?.other ?? '');
        setSettingInput(typeof detail.setting === 'string' ? detail.setting : '');
        setModelMappingInput(typeof detail.model_mapping === 'string' ? detail.model_mapping : '');
        setParamOverrideInput(typeof detail.param_override === 'string' ? detail.param_override : '');
        setHeaderOverrideInput(typeof detail.header_override === 'string' ? detail.header_override : '');

        setFormOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取渠道详情失败');
      } finally {
        setBusy(false);
      }
    },
    [api, items]
  );

  const save = useCallback(async () => {
    setError('');
    const name = nameInput.trim();
    const type = parseIntegerOrNull(typeInput) ?? 0;
    const groupValue = groupInput.trim() || 'default';
    const baseUrlValue = baseUrlInput.trim();
    const modelsValue = normalizeCommaList(modelsInput);
    const weightValue = parseIntegerOrNull(weightInput);
    const priorityValue = parseIntegerOrNull(priorityInput);

    if (!name) {
      setError('请输入名称');
      return;
    }
    if (type < 0) {
      setError('类型不正确');
      return;
    }
    if (!editingId && !keyInput.trim()) {
      setError('请输入 Key');
      return;
    }

    setBusy(true);
    try {
      const base: AnyRecord = editingOriginal ? { ...editingOriginal } : {};
      const payload: AnyRecord = {
        ...base,
        id: editingId ?? 0,
        name,
        type,
        status: statusEnabled ? 1 : 2,
        group: groupValue,
        base_url: baseUrlValue,
        models: modelsValue,
        tag: tagInput.trim(),
        remark: remarkInput.trim(),
        other: otherInput,
        setting: settingInput,
        model_mapping: modelMappingInput,
        param_override: paramOverrideInput,
        header_override: headerOverrideInput,
      };

      if (typeof weightValue === 'number') payload.weight = weightValue;
      if (typeof priorityValue === 'number') payload.priority = priorityValue;

      const key = keyInput.trim();
      if (key) {
        payload.key = key;
        if (editingId && isMultiKey) payload.key_mode = keyMode;
      }

      if (!editingId) {
        const addBody: AnyRecord = {
          mode: isMultiKey ? 'multi_to_single' : 'single',
          multi_key_mode: isMultiKey ? multiKeyMode : undefined,
          channel: payload,
        };
        const res = await api.request({ path: '/api/channel/', method: 'POST', body: addBody });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        if (!res.ok) {
          setError(`新增失败：HTTP ${res.status}`);
          return;
        }
      } else {
        const res = await api.request({ path: '/api/channel/', method: 'PUT', body: payload });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        if (!res.ok) {
          setError(`更新失败：HTTP ${res.status}`);
          return;
        }
      }

      setFormOpen(false);
      setEditingId(null);
      setEditingOriginal(null);
      await load(editingId ? page : 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : editingId ? '更新失败' : '新增失败');
    } finally {
      setBusy(false);
    }
  }, [
    api,
    baseUrlInput,
    editingId,
    editingOriginal,
    groupInput,
    headerOverrideInput,
    isMultiKey,
    keyInput,
    keyMode,
    load,
    modelMappingInput,
    modelsInput,
    multiKeyMode,
    nameInput,
    otherInput,
    page,
    paramOverrideInput,
    priorityInput,
    remarkInput,
    settingInput,
    statusEnabled,
    tagInput,
    typeInput,
    weightInput,
  ]);

  const setStatus = useCallback(
    async (id: number, nextStatus: number) => {
      setError('');
      setBusy(true);
      try {
        const detailRes = await api.request({ path: `/api/channel/${id}` });
        const detailErr = getApiError(detailRes.body);
        if (detailErr) {
          setError(detailErr);
          return;
        }
        if (!detailRes.ok) {
          setError(`获取渠道失败：HTTP ${detailRes.status}`);
          return;
        }
        const data = unwrapApiData(detailRes.body) as unknown;
        const channel = (isRecord(data) ? data : null) as AnyRecord | null;
        if (!channel) {
          setError('获取渠道失败：数据格式错误');
          return;
        }
        const payload: AnyRecord = { ...channel, id, status: nextStatus };
        const saveRes = await api.request({ path: '/api/channel/', method: 'PUT', body: payload });
        const saveErr = getApiError(saveRes.body);
        if (saveErr) {
          setError(saveErr);
          return;
        }
        if (!saveRes.ok) {
          setError(`更新失败：HTTP ${saveRes.status}`);
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

  const testChannel = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({ path: `/api/channel/test/${id}` });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        const ok = isRecord(res.body) && typeof res.body.success === 'boolean' ? res.body.success : res.ok;
        const time = isRecord(res.body) && typeof res.body.time === 'number' ? res.body.time : null;
        const msg = isRecord(res.body) && typeof res.body.message === 'string' ? res.body.message : '';
        if (!ok) {
          Alert.alert('测试失败', msg || `HTTP ${res.status}`);
          return;
        }
        Alert.alert('测试成功', time !== null ? `耗时 ${time.toFixed(3)}s` : 'OK');
        await load(page);
      } catch (e) {
        setError(e instanceof Error ? e.message : '测试失败');
      } finally {
        setBusy(false);
      }
    },
    [api, load, page]
  );

  const testAllChannels = useCallback(() => {
    Alert.alert('测试全部渠道', '该操作可能比较耗时，确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '开始',
        onPress: async () => {
          setError('');
          setBusy(true);
          try {
            const res = await api.request({ path: '/api/channel/test' });
            const err = getApiError(res.body);
            if (err) {
              setError(err);
              return;
            }
            if (!res.ok) {
              setError(`测试失败：HTTP ${res.status}`);
              return;
            }
            Alert.alert('已触发', '后台测试中（可能需要一段时间）');
            await load(page);
          } catch (e) {
            setError(e instanceof Error ? e.message : '测试失败');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [api, load, page]);

  const updateBalance = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({ path: `/api/channel/update_balance/${id}` });
        const err = getApiError(res.body);
        if (err) {
          setError(err);
          return;
        }
        const balance = isRecord(res.body) && typeof res.body.balance === 'number' ? res.body.balance : null;
        Alert.alert('余额', balance !== null ? `$${balance.toFixed(4)}` : 'OK');
        await load(page);
      } catch (e) {
        setError(e instanceof Error ? e.message : '更新余额失败');
      } finally {
        setBusy(false);
      }
    },
    [api, load, page]
  );

  const updateAllBalances = useCallback(() => {
    Alert.alert('更新全部余额', '该操作可能比较耗时，确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '开始',
        onPress: async () => {
          setError('');
          setBusy(true);
          try {
            const res = await api.request({ path: '/api/channel/update_balance' });
            const err = getApiError(res.body);
            if (err) {
              setError(err);
              return;
            }
            if (!res.ok) {
              setError(`更新失败：HTTP ${res.status}`);
              return;
            }
            Alert.alert('已触发', '后台更新中（可能需要一段时间）');
            await load(page);
          } catch (e) {
            setError(e instanceof Error ? e.message : '更新失败');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [api, load, page]);

  const copyChannel = useCallback(
    (id: number) => {
      Alert.alert('复制渠道', '将复制该渠道，新的渠道会包含 key', [
        { text: '取消', style: 'cancel' },
        {
          text: '复制',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              const res = await api.request({
                path: `/api/channel/copy/${id}`,
                method: 'POST',
                query: { reset_balance: true },
              });
              const err = getApiError(res.body);
              if (err) {
                setError(err);
                return;
              }
              if (!res.ok) {
                setError(`复制失败：HTTP ${res.status}`);
                return;
              }
              await load(1);
            } catch (e) {
              setError(e instanceof Error ? e.message : '复制失败');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [api, load]
  );

  const deleteDisabled = useCallback(() => {
    Alert.alert('删除禁用渠道', '将删除所有状态为禁用的渠道，此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          setError('');
          setBusy(true);
          try {
            const res = await api.request({ path: '/api/channel/disabled', method: 'DELETE' });
            const err = getApiError(res.body);
            if (err) {
              setError(err);
              return;
            }
            if (!res.ok) {
              setError(`删除失败：HTTP ${res.status}`);
              return;
            }
            await load(1);
          } catch (e) {
            setError(e instanceof Error ? e.message : '删除失败');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [api, load]);

  const remove = useCallback(
    (id: number) => {
      Alert.alert('删除渠道', '确定删除该渠道？删除后不可恢复。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              const res = await api.request({ path: `/api/channel/${id}`, method: 'DELETE' });
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

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.title}>渠道</Text>
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
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        data={items}
        keyExtractor={(it) => String(it.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>渠道</Text>
              <View style={styles.headerActions}>
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
              <Text style={styles.cardTitle}>筛选</Text>
              <View style={styles.chipRow}>
                {(['all', 'enabled', 'disabled'] as const).map((k) => (
                  <Pressable
                    key={k}
                    style={[styles.chip, statusFilter === k ? styles.chipActive : styles.chipIdle]}
                    onPress={() => setStatusFilter(k)}
                  >
                    <Text style={[styles.chipText, statusFilter === k ? styles.chipTextActive : styles.chipTextIdle]}>
                      {k === 'all' ? '全部' : k === 'enabled' ? '启用' : '禁用'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.formRow}>
                <Text style={styles.formLabel}>关键字</Text>
                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="按名称/ID"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>分组</Text>
                <TextInput
                  value={group}
                  onChangeText={setGroup}
                  placeholder="例如 default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>模型</Text>
                <TextInput
                  value={modelKeyword}
                  onChangeText={setModelKeyword}
                  placeholder="例如 gpt-4o"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>页大小</Text>
                <TextInput
                  value={String(pageSize)}
                  onChangeText={(t) => {
                    const n = parseInt(t, 10);
                    if (!Number.isFinite(n) || n <= 0) return;
                    setPageSize(Math.min(100, n));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, styles.flex1]}
                />
              </View>

              <View style={styles.inlineRow}>
                <Pressable style={[styles.actionBtn, styles.primaryBtn]} onPress={() => load(1)} disabled={busy}>
                  <Text style={[styles.actionText, styles.primaryText]}>应用</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    setKeyword('');
                    setGroup('');
                    setModelKeyword('');
                    setStatusFilter('all');
                    void load(1);
                  }}
                  disabled={busy}
                >
                  <Text style={styles.actionText}>清空</Text>
                </Pressable>
              </View>

              <View style={styles.inlineRow}>
                <Pressable style={styles.actionBtn} onPress={testAllChannels} disabled={busy}>
                  <Text style={styles.actionText}>测试全部</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={updateAllBalances} disabled={busy}>
                  <Text style={styles.actionText}>更新余额</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={deleteDisabled} disabled={busy}>
                  <Text style={styles.actionText}>删除禁用</Text>
                </Pressable>
              </View>

              <Text style={styles.pagerInfo}>{pagerInfo}</Text>
            </Surface>
          </View>
        }
        renderItem={({ item }) => (
          <Surface style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.name || `Channel #${item.id}`}
              </Text>
              <Badge text={statusLabel(item.status)} color={statusColor(item.status)} />
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Type</Text>
              <Text style={styles.v}>
                {item.type !== undefined ? `${channelTypeLabel(item.type)} (${item.type})` : '-'}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>ID</Text>
              <Text style={styles.v}>{item.id}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Group</Text>
              <Text style={styles.v}>{item.group || '-'}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>BaseURL</Text>
              <Text style={styles.v} numberOfLines={1}>
                {item.baseUrl || '-'}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Tag</Text>
              <Text style={styles.v}>{item.tag || '-'}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>创建</Text>
              <Text style={styles.v}>{formatDateTimeEpochSeconds(item.createdTime)}</Text>
            </View>
            <View style={styles.opsRow}>
              <Pressable style={[styles.smallBtn, styles.primaryBtn]} onPress={() => openEdit(item.id)} disabled={busy}>
                <Text style={[styles.smallBtnText, styles.primaryText]}>编辑</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, item.status === 1 ? styles.dangerBtn : styles.primaryBtn]}
                onPress={() => setStatus(item.id, item.status === 1 ? 2 : 1)}
                disabled={busy}
              >
                <Text style={[styles.smallBtnText, item.status === 1 ? styles.dangerText : styles.primaryText]}>
                  {item.status === 1 ? '禁用' : '启用'}
                </Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.ghostBtn]} onPress={() => testChannel(item.id)} disabled={busy}>
                <Text style={[styles.smallBtnText, styles.primaryText]}>测试</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.ghostBtn]} onPress={() => updateBalance(item.id)} disabled={busy}>
                <Text style={[styles.smallBtnText, styles.primaryText]}>余额</Text>
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => copy(String(item.id))} disabled={busy}>
                <Text style={styles.smallBtnText}>复制ID</Text>
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => copyChannel(item.id)} disabled={busy}>
                <Text style={styles.smallBtnText}>复制渠道</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.ghostBtn]} onPress={() => remove(item.id)} disabled={busy}>
                <Text style={styles.smallBtnText}>删除</Text>
              </Pressable>
            </View>
          </Surface>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无渠道</Text>}
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
              <Text style={styles.modalTitle}>{editingId ? `编辑 Channel #${editingId}` : '新增渠道'}</Text>
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
                <Text style={styles.formLabel}>名称*</Text>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Channel name"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>

              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Type*</Text>
                <TextInput
                  value={typeInput}
                  onChangeText={setTypeInput}
                  placeholder="1"
                  keyboardType="numeric"
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.quickRow}>
                {[1, 3, 4, 14, 20, 24, 25, 43].map((t) => (
                  <Pressable key={t} style={styles.quickBtn} onPress={() => setTypeInput(String(t))} disabled={busy}>
                    <Text style={styles.quickText}>{channelTypeLabel(t)}</Text>
                  </Pressable>
                ))}
              </View>

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
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>启用</Text>
                <Switch value={statusEnabled} onValueChange={setStatusEnabled} />
              </View>
              {!editingId && (
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>多Key</Text>
                  <Switch value={isMultiKey} onValueChange={setIsMultiKey} />
                </View>
              )}
              {!editingId && isMultiKey && (
                <View style={styles.chipRow}>
                  {(['random', 'polling'] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.chip, multiKeyMode === m ? styles.chipActive : styles.chipIdle]}
                      onPress={() => setMultiKeyMode(m)}
                      disabled={busy}
                    >
                      <Text style={[styles.chipText, multiKeyMode === m ? styles.chipTextActive : styles.chipTextIdle]}>
                        {m === 'random' ? '随机' : '轮询'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.formRow}>
                <Text style={styles.formLabel}>BaseURL</Text>
                <TextInput
                  value={baseUrlInput}
                  onChangeText={setBaseUrlInput}
                  placeholder="https://api.openai.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>

              <View style={styles.formRow}>
                <Text style={styles.formLabel}>{editingId ? 'Key(留空不改)' : 'Key*'}</Text>
                <TextInput
                  value={keyInput}
                  onChangeText={setKeyInput}
                  placeholder={editingId ? '留空不修改' : 'API key'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.input, styles.flex1, styles.textArea]}
                />
              </View>
              {editingId && isMultiKey && keyInput.trim() && (
                <View style={styles.chipRow}>
                  {(['replace', 'append'] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.chip, keyMode === m ? styles.chipActive : styles.chipIdle]}
                      onPress={() => setKeyMode(m)}
                      disabled={busy}
                    >
                      <Text style={[styles.chipText, keyMode === m ? styles.chipTextActive : styles.chipTextIdle]}>
                        {m === 'replace' ? '覆盖' : '追加'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>模型 / 权重</Text>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Models</Text>
                <TextInput
                  value={modelsInput}
                  onChangeText={setModelsInput}
                  placeholder="gpt-4o,gpt-4o-mini"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.input, styles.flex1, styles.textArea]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Weight</Text>
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder="0"
                  keyboardType="numeric"
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Priority</Text>
                <TextInput
                  value={priorityInput}
                  onChangeText={setPriorityInput}
                  placeholder="0"
                  keyboardType="numeric"
                  style={[styles.input, styles.flex1]}
                />
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Tag / 备注</Text>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Tag</Text>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="tag"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Remark</Text>
                <TextInput
                  value={remarkInput}
                  onChangeText={setRemarkInput}
                  placeholder="remark"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.flex1]}
                />
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>高级（可选）</Text>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Other</Text>
                <TextInput
                  value={otherInput}
                  onChangeText={setOtherInput}
                  placeholder="other"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.input, styles.flex1, styles.textArea]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Setting</Text>
                <TextInput
                  value={settingInput}
                  onChangeText={setSettingInput}
                  placeholder="channel setting"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.input, styles.flex1, styles.textArea]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>ModelMap</Text>
                <TextInput
                  value={modelMappingInput}
                  onChangeText={setModelMappingInput}
                  placeholder="model_mapping"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.input, styles.flex1, styles.textArea]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Param</Text>
                <TextInput
                  value={paramOverrideInput}
                  onChangeText={setParamOverrideInput}
                  placeholder="param_override"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.input, styles.flex1, styles.textArea]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Header</Text>
                <TextInput
                  value={headerOverrideInput}
                  onChangeText={setHeaderOverrideInput}
                  placeholder="header_override"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.input, styles.flex1, styles.textArea]}
                />
              </View>
            </ScrollView>
          </Surface>
        </View>
      </Modal>

      <FloatingPageControls
        onPrev={() => load(Math.max(1, page - 1))}
        onRefresh={() => load(page)}
        onNext={() => load(page + 1)}
        disabledPrev={busy || !canPrev}
        disabledRefresh={busy}
        disabledNext={busy || !canNext}
        refreshLabel={busy ? '刷新中…' : '刷新'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  list: { flex: 1 },
  container: { padding: 16, gap: 12 },
  header: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#11181C' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { color: '#d11', fontWeight: '700' },
  searchCard: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#11181C' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipIdle: { backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.12)' },
  chipActive: { backgroundColor: '#11181C', borderColor: '#11181C' },
  chipText: { fontSize: 12, fontWeight: '900' },
  chipTextIdle: { color: '#11181C' },
  chipTextActive: { color: '#fff' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  quickText: { color: '#11181C', fontWeight: '800', fontSize: 12 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formLabel: { width: 56, color: '#667085', fontSize: 12, fontWeight: '800' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
    color: '#11181C',
  },
  textArea: { minHeight: 64, textAlignVertical: 'top' },
  flex1: { flex: 1 },
  inlineRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
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
  pagerInfo: { flex: 1, textAlign: 'center', color: '#667085', fontSize: 12, fontWeight: '700' },
  item: { gap: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: '#11181C' },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  k: { color: '#667085', fontSize: 12, fontWeight: '700' },
  v: { color: '#11181C', fontSize: 12, fontWeight: '900' },
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
  hint: { color: '#667085', fontSize: 12, fontWeight: '600' },
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#11181C' },
});
