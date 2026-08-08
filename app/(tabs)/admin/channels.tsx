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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { Layout, Radius, type ToneName } from '@/constants/theme';
import { Badge } from '@/components/ui/badge';
import { AppButton } from '@/components/ui/app-button';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Surface } from '@/components/ui/surface';
import { useAppTheme } from '@/hooks/use-app-theme';
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

// 状态徽标语义：启用→success、手动禁用→neutral、自动禁用→warning
function statusTone(status?: number): ToneName {
  switch (status) {
    case 1:
      return 'success';
    case 2:
      return 'neutral';
    case 3:
      return 'warning';
    default:
      return 'neutral';
  }
}

function normalizeCommaList(input: string): string {
  const parts = input
    .split(/[,|\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(',');
}

function splitCommaList(input: string): string[] {
  return input
    .split(/[,|\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqKeepOrderStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function parseIntegerOrNull(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

// 本地主题化输入框：统一边框/背景/文字/占位符颜色，避免每个输入框重复内联
function ThemedTextInput({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  const { colors } = useAppTheme();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.border }, style]}
    />
  );
}

export default function ChannelsScreen() {
  const { colors } = useAppTheme();
  const api = useApi();
  const { isAdmin } = useMe();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  // 行级操作的进行中 id：仅禁用该行的按钮，不阻塞整页
  const [pendingId, setPendingId] = useState<number | null>(null);
  // 行级/批量操作的临时结果提示，命中后 4s 自动清除
  const [rowResult, setRowResult] = useState<{ id: number; ok: boolean; message: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ ok: boolean; message: string } | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTemporaryResult = useCallback((r: { id?: number; ok: boolean; message: string }) => {
    setRowResult(r.id != null ? { id: r.id, ok: r.ok, message: r.message } : null);
    setBulkResult(r.id == null ? { ok: r.ok, message: r.message } : null);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => {
      setRowResult(null);
      setBulkResult(null);
    }, 4000);
  }, []);
  const [error, setError] = useState('');

  const [items, setItems] = useState<ReturnType<typeof parseChannels>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
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
  const [fetchModelsBusy, setFetchModelsBusy] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState('');
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [modelsPickerOpen, setModelsPickerOpen] = useState(false);
  const [modelsPickerKeyword, setModelsPickerKeyword] = useState('');
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
    setFetchModelsBusy(false);
    setFetchModelsError('');
    setFetchedModels([]);
    setModelsPickerOpen(false);
    setModelsPickerKeyword('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    async (id: number) => {
      setError('');
      setFetchModelsBusy(false);
      setFetchModelsError('');
      setFetchedModels([]);
      setModelsPickerOpen(false);
      setModelsPickerKeyword('');
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

  const selectedModels = useMemo(() => new Set(splitCommaList(modelsInput)), [modelsInput]);

  const filteredFetchedModels = useMemo(() => {
    const q = modelsPickerKeyword.trim().toLowerCase();
    if (!q) return fetchedModels;
    return fetchedModels.filter((m) => m.toLowerCase().includes(q));
  }, [fetchedModels, modelsPickerKeyword]);

  const toggleModelInModelsInput = useCallback(
    (modelName: string) => {
      const current = uniqKeepOrderStrings(splitCommaList(modelsInput));
      const exists = current.includes(modelName);
      const next = exists ? current.filter((m) => m !== modelName) : [...current, modelName];
      setModelsInput(next.join(','));
    },
    [modelsInput]
  );

  const fetchUpstreamModels = useCallback(async () => {
    setFetchModelsError('');
    setFetchModelsBusy(true);
    try {
      let res: { ok: boolean; status: number; body: unknown };
      if (editingId !== null) {
        res = await api.request({ path: `/api/channel/fetch_models/${editingId}` });
      } else {
        const type = parseIntegerOrNull(typeInput) ?? 0;
        const key = keyInput.trim();
        if (!key) {
          setFetchModelsError('请先填写 Key');
          return;
        }
        res = await api.request({
          path: '/api/channel/fetch_models',
          method: 'POST',
          body: { base_url: baseUrlInput.trim(), type, key },
        });
      }

      const err = getApiError(res.body);
      if (err) {
        setFetchModelsError(err);
        return;
      }

      const data = unwrapApiData(res.body) as unknown;
      if (!Array.isArray(data)) {
        setFetchModelsError('获取模型失败：数据格式错误');
        return;
      }

      const models = data
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .map((m) => m.trim());
      setFetchedModels(uniqKeepOrderStrings(models));
      setModelsPickerKeyword('');
      setModelsPickerOpen(true);
    } catch (e) {
      setFetchModelsError(e instanceof Error ? e.message : '获取模型失败');
    } finally {
      setFetchModelsBusy(false);
    }
  }, [api, baseUrlInput, editingId, keyInput, typeInput]);

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
      setPendingId(id);
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
        setPendingId(null);
      }
    },
    [api, load, page]
  );

  const testChannel = useCallback(
    async (id: number) => {
      setError('');
      setPendingId(id);
      try {
        const res = await api.request({ path: `/api/channel/test/${id}` });
        const err = getApiError(res.body);
        if (err) {
          showTemporaryResult({ id, ok: false, message: err });
          return;
        }
        const ok = isRecord(res.body) && typeof res.body.success === 'boolean' ? res.body.success : res.ok;
        const time = isRecord(res.body) && typeof res.body.time === 'number' ? res.body.time : null;
        const msg = isRecord(res.body) && typeof res.body.message === 'string' ? res.body.message : '';
        if (!ok) {
          showTemporaryResult({ id, ok: false, message: msg || `测试失败：HTTP ${res.status}` });
          return;
        }
        showTemporaryResult({ id, ok: true, message: time !== null ? `测试成功，耗时 ${time.toFixed(3)}s` : '测试成功' });
        await load(page);
      } catch (e) {
        showTemporaryResult({ id, ok: false, message: e instanceof Error ? e.message : '测试失败' });
      } finally {
        setPendingId(null);
      }
    },
    [api, load, page, showTemporaryResult]
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
            showTemporaryResult({ ok: true, message: '已触发，后台测试中（可能需要一段时间）' });
            await load(page);
          } catch (e) {
            setError(e instanceof Error ? e.message : '测试失败');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [api, load, page, showTemporaryResult]);

  const updateBalance = useCallback(
    async (id: number) => {
      setError('');
      setPendingId(id);
      try {
        const res = await api.request({ path: `/api/channel/update_balance/${id}` });
        const err = getApiError(res.body);
        if (err) {
          showTemporaryResult({ id, ok: false, message: err });
          return;
        }
        const balance = isRecord(res.body) && typeof res.body.balance === 'number' ? res.body.balance : null;
        showTemporaryResult({ id, ok: true, message: balance !== null ? `余额 $${balance.toFixed(4)}` : '更新完成' });
        await load(page);
      } catch (e) {
        showTemporaryResult({ id, ok: false, message: e instanceof Error ? e.message : '更新余额失败' });
      } finally {
        setPendingId(null);
      }
    },
    [api, load, page, showTemporaryResult]
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
            showTemporaryResult({ ok: true, message: '已触发，后台更新中（可能需要一段时间）' });
            await load(page);
          } catch (e) {
            setError(e instanceof Error ? e.message : '更新失败');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [api, load, page, showTemporaryResult]);

  const copyChannel = useCallback(
    (id: number) => {
      Alert.alert('复制渠道', '将复制该渠道，新的渠道会包含 key', [
        { text: '取消', style: 'cancel' },
        {
          text: '复制',
          onPress: async () => {
            setError('');
            setPendingId(id);
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
              setPendingId(null);
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
            setPendingId(id);
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
              setPendingId(null);
            }
          },
        },
      ]);
    },
    [api, load, page]
  );

  if (!isAdmin) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: colors.ink }]}>渠道</Text>
          <EmptyState title="无权限" icon="lock-outline" />
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
          // 底部留白 96：给浮动分页控件留出空间（比原先 120 更紧凑）
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 },
        ]}
        data={items}
        keyExtractor={(it) => String(it.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.pageTitleGroup}>
                <AppButton label="返回" icon="arrow-back" variant="quiet" compact onPress={() => router.back()} />
                <Text style={[styles.title, { color: colors.ink }]}>渠道</Text>
              </View>
              <View style={styles.headerActions}>
                <AppButton label="新增渠道" icon="add" compact onPress={openCreate} disabled={busy} />
              </View>
            </View>

            {!!error && <InlineNotice message={error} />}
            {!!bulkResult && <InlineNotice message={bulkResult.message} tone={bulkResult.ok ? 'success' : 'danger'} />}

            <Surface style={styles.searchCard}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>筛选</Text>
              <View style={styles.chipRow}>
                {(['all', 'enabled', 'disabled'] as const).map((k) => {
                  const active = statusFilter === k;
                  return (
                    <Pressable
                      key={k}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: active ? colors.accent : colors.surface,
                          borderColor: active ? colors.accent : colors.border,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setStatusFilter(k)}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.ink }]}>
                        {k === 'all' ? '全部' : k === 'enabled' ? '启用' : '禁用'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formRow}>
                <Text style={[styles.formLabel, { color: colors.muted }]}>关键字</Text>
                <ThemedTextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="按名称/ID"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.flex1}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={[styles.formLabel, { color: colors.muted }]}>分组</Text>
                <DropdownSelect
                  title="选择分组"
                  value={group}
                  onChange={setGroup}
                  options={groupOptions}
                  placeholder="例如 default"
                  style={[styles.input, styles.flex1]}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={[styles.formLabel, { color: colors.muted }]}>模型</Text>
                <ThemedTextInput
                  value={modelKeyword}
                  onChangeText={setModelKeyword}
                  placeholder="例如 gpt-4o"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.flex1}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={[styles.formLabel, { color: colors.muted }]}>页大小</Text>
                <ThemedTextInput
                  value={String(pageSize)}
                  onChangeText={(t) => {
                    const n = parseInt(t, 10);
                    if (!Number.isFinite(n) || n <= 0) return;
                    setPageSize(Math.min(100, n));
                  }}
                  keyboardType="numeric"
                  style={styles.flex1}
                />
              </View>

              <View style={styles.inlineRow}>
                <AppButton
                  label="应用"
                  variant="primary"
                  compact
                  onPress={() => load(1)}
                  disabled={busy}
                />
                <AppButton
                  label="清空"
                  variant="secondary"
                  compact
                  onPress={() => {
                    setKeyword('');
                    setGroup('');
                    setModelKeyword('');
                    setStatusFilter('all');
                    void load(1);
                  }}
                  disabled={busy}
                />
              </View>

              <View style={styles.inlineRow}>
                <AppButton label="测试全部" variant="secondary" compact onPress={testAllChannels} disabled={busy} />
                <AppButton label="更新余额" variant="secondary" compact onPress={updateAllBalances} disabled={busy} />
                <AppButton label="删除禁用" variant="danger" compact onPress={deleteDisabled} disabled={busy} />
              </View>

              <Text style={[styles.pagerInfo, { color: colors.muted }]}>{pagerInfo}</Text>
            </Surface>
          </View>
        }
        renderItem={({ item }) => (
          <Surface style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.ink }]} numberOfLines={1}>
                {item.name || `Channel #${item.id}`}
              </Text>
              <Badge text={statusLabel(item.status)} tone={statusTone(item.status)} />
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: colors.muted }]}>Type</Text>
              <Text style={[styles.v, { color: colors.ink }]}>
                {item.type !== undefined ? `${channelTypeLabel(item.type)} (${item.type})` : '-'}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: colors.muted }]}>ID</Text>
              <Text style={[styles.v, { color: colors.ink }]}>{item.id}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: colors.muted }]}>Group</Text>
              <Text style={[styles.v, { color: colors.ink }]}>{item.group || '-'}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: colors.muted }]}>BaseURL</Text>
              <Text style={[styles.v, { color: colors.ink }]} numberOfLines={1}>
                {item.baseUrl || '-'}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: colors.muted }]}>Tag</Text>
              <Text style={[styles.v, { color: colors.ink }]}>{item.tag || '-'}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: colors.muted }]}>创建</Text>
              <Text style={[styles.v, { color: colors.ink }]}>{formatDateTimeEpochSeconds(item.createdTime)}</Text>
            </View>
            <View style={styles.opsRow}>
              <AppButton label="编辑" variant="primary" compact onPress={() => openEdit(item.id)} disabled={busy} />
              <AppButton
                label={item.status === 1 ? '禁用' : '启用'}
                variant={item.status === 1 ? 'danger' : 'primary'}
                compact
                onPress={() => setStatus(item.id, item.status === 1 ? 2 : 1)}
                disabled={pendingId === item.id}
              />
              <AppButton
                label="测试"
                variant="secondary"
                compact
                onPress={() => testChannel(item.id)}
                disabled={pendingId === item.id}
              />
              <AppButton
                label="余额"
                variant="secondary"
                compact
                onPress={() => updateBalance(item.id)}
                disabled={pendingId === item.id}
              />
              <AppButton
                label="复制ID"
                variant="secondary"
                compact
                onPress={() => copy(String(item.id))}
              />
              <AppButton
                label="复制渠道"
                variant="secondary"
                compact
                onPress={() => copyChannel(item.id)}
                disabled={pendingId === item.id}
              />
              <AppButton
                label="删除"
                variant="danger"
                compact
                onPress={() => remove(item.id)}
                disabled={pendingId === item.id}
              />
            </View>
            {rowResult?.id === item.id && (
              <InlineNotice message={rowResult.message} tone={rowResult.ok ? 'success' : 'danger'} />
            )}
          </Surface>
        )}
        ListEmptyComponent={
          <EmptyState title="暂无渠道" description="创建渠道后会显示在这里。" icon="hub" />
        }
      />

      <Modal
        transparent
        visible={formOpen}
        animationType="slide"
        onRequestClose={() => {
          setFormOpen(false);
          setModelsPickerOpen(false);
        }}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: colors.overlay, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Surface style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>
                {editingId ? `编辑 Channel #${editingId}` : '新增渠道'}
              </Text>
              <View style={styles.modalHeaderActions}>
                <AppButton
                  label="关闭"
                  variant="secondary"
                  compact
                  onPress={() => {
                    setFormOpen(false);
                    setModelsPickerOpen(false);
                  }}
                  disabled={busy}
                />
                <AppButton
                  label={busy ? '保存中…' : '保存'}
                  variant="primary"
                  compact
                  onPress={save}
                  disabled={busy}
                />
              </View>
            </View>

            {!!error && <InlineNotice message={error} />}

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalKeyboard}
            >
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>基本信息</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>名称*</Text>
                  <ThemedTextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="Channel name"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.flex1}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Type*</Text>
                  <ThemedTextInput
                    value={typeInput}
                    onChangeText={setTypeInput}
                    placeholder="1"
                    keyboardType="numeric"
                    style={styles.flex1}
                  />
                </View>
                <View style={styles.quickRow}>
                  {[1, 3, 4, 14, 20, 24, 25, 43].map((t) => (
                    <AppButton
                      key={t}
                      label={channelTypeLabel(t)}
                      variant="secondary"
                      compact
                      onPress={() => setTypeInput(String(t))}
                      disabled={busy}
                    />
                  ))}
                </View>

                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>分组</Text>
                  <DropdownSelect
                    title="选择分组（可多选）"
                    multiple
                    value={groupInput}
                    onChange={setGroupInput}
                    options={groupOptions}
                    placeholder="default"
                    style={[styles.input, styles.flex1]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>启用</Text>
                  <Switch value={statusEnabled} onValueChange={setStatusEnabled} />
                </View>
                {!editingId && (
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>多Key</Text>
                    <Switch value={isMultiKey} onValueChange={setIsMultiKey} />
                  </View>
                )}
                {!editingId && isMultiKey && (
                  <View style={styles.chipRow}>
                    {(['random', 'polling'] as const).map((m) => {
                      const active = multiKeyMode === m;
                      return (
                        <Pressable
                          key={m}
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              backgroundColor: active ? colors.accent : colors.surface,
                              borderColor: active ? colors.accent : colors.border,
                            },
                            (busy || pressed) && { opacity: busy ? 0.5 : 0.8 },
                          ]}
                          onPress={() => setMultiKeyMode(m)}
                          disabled={busy}
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.ink }]}>
                            {m === 'random' ? '随机' : '轮询'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>BaseURL</Text>
                  <ThemedTextInput
                    value={baseUrlInput}
                    onChangeText={setBaseUrlInput}
                    placeholder="https://api.openai.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.flex1}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>
                    {editingId ? 'Key(留空不改)' : 'Key*'}
                  </Text>
                  <ThemedTextInput
                    value={keyInput}
                    onChangeText={setKeyInput}
                    placeholder={editingId ? '留空不修改' : 'API key'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.flex1, styles.textArea]}
                  />
                </View>
                {editingId && isMultiKey && keyInput.trim() && (
                  <View style={styles.chipRow}>
                    {(['replace', 'append'] as const).map((m) => {
                      const active = keyMode === m;
                      return (
                        <Pressable
                          key={m}
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              backgroundColor: active ? colors.accent : colors.surface,
                              borderColor: active ? colors.accent : colors.border,
                            },
                            (busy || pressed) && { opacity: busy ? 0.5 : 0.8 },
                          ]}
                          onPress={() => setKeyMode(m)}
                          disabled={busy}
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.ink }]}>
                            {m === 'replace' ? '覆盖' : '追加'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>模型 / 权重</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Models</Text>
                  <ThemedTextInput
                    value={modelsInput}
                    onChangeText={setModelsInput}
                    placeholder="gpt-4o,gpt-4o-mini"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.flex1, styles.textArea]}
                  />
                </View>
                <View style={styles.inlineRow}>
                  <AppButton
                    label={fetchModelsBusy ? '获取中…' : '获取模型'}
                    variant="primary"
                    compact
                    onPress={fetchUpstreamModels}
                    disabled={busy || fetchModelsBusy}
                  />
                  {!!fetchedModels.length && (
                    <Text style={[styles.hint, { color: colors.muted }]}>{`已获取 ${fetchedModels.length} 个`}</Text>
                  )}
                </View>
                {!!fetchModelsError && <InlineNotice message={fetchModelsError} />}
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Weight</Text>
                  <ThemedTextInput
                    value={weightInput}
                    onChangeText={setWeightInput}
                    placeholder="0"
                    keyboardType="numeric"
                    style={styles.flex1}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Priority</Text>
                  <ThemedTextInput
                    value={priorityInput}
                    onChangeText={setPriorityInput}
                    placeholder="0"
                    keyboardType="numeric"
                    style={styles.flex1}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>Tag / 备注</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Tag</Text>
                  <ThemedTextInput
                    value={tagInput}
                    onChangeText={setTagInput}
                    placeholder="tag"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.flex1}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Remark</Text>
                  <ThemedTextInput
                    value={remarkInput}
                    onChangeText={setRemarkInput}
                    placeholder="remark"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.flex1}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>高级（可选）</Text>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Other</Text>
                  <ThemedTextInput
                    value={otherInput}
                    onChangeText={setOtherInput}
                    placeholder="other"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.flex1, styles.textArea]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Setting</Text>
                  <ThemedTextInput
                    value={settingInput}
                    onChangeText={setSettingInput}
                    placeholder="channel setting"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.flex1, styles.textArea]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>ModelMap</Text>
                  <ThemedTextInput
                    value={modelMappingInput}
                    onChangeText={setModelMappingInput}
                    placeholder="model_mapping"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.flex1, styles.textArea]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Param</Text>
                  <ThemedTextInput
                    value={paramOverrideInput}
                    onChangeText={setParamOverrideInput}
                    placeholder="param_override"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.flex1, styles.textArea]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>Header</Text>
                  <ThemedTextInput
                    value={headerOverrideInput}
                    onChangeText={setHeaderOverrideInput}
                    placeholder="header_override"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.flex1, styles.textArea]}
                  />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Surface>
        </View>
      </Modal>

      <Modal
        transparent
        visible={modelsPickerOpen}
        animationType="slide"
        onRequestClose={() => setModelsPickerOpen(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: colors.overlay, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Surface style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>选择模型</Text>
              <View style={styles.modalHeaderActions}>
                <AppButton label="关闭" variant="secondary" compact onPress={() => setModelsPickerOpen(false)} />
              </View>
            </View>

            <ThemedTextInput
              value={modelsPickerKeyword}
              onChangeText={setModelsPickerKeyword}
              placeholder="搜索模型"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FlatList
              data={filteredFetchedModels}
              keyExtractor={(it) => it}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<EmptyState title="暂无模型" icon="view-in-ar" />}
              renderItem={({ item }) => {
                const active = selectedModels.has(item);
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.modelRow,
                      { borderBottomColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => toggleModelInModelsInput(item)}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.modelText, { color: colors.ink }]} numberOfLines={1}>
                      {item}
                    </Text>
                    {active ? (
                      <MaterialIcons name="check" size={18} color={colors.ink} style={styles.modelCheck} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
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
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  searchCard: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12, fontWeight: '600' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formLabel: { minWidth: 64, flexShrink: 0, fontSize: 12, fontWeight: '800' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: { minHeight: 64, textAlignVertical: 'top' },
  flex1: { flex: 1 },
  inlineRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  pagerInfo: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  item: { gap: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  k: { fontSize: 12, fontWeight: '700' },
  v: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  opsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  hint: { fontSize: 12, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'flex-end',
  },
  modalCard: { maxHeight: '92%', padding: 12, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  modalHeaderActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  modalKeyboard: { flexShrink: 1 },
  modalBody: { paddingBottom: 12, gap: 10 },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modelText: { flex: 1, fontSize: 12, fontWeight: '800' },
  modelCheck: { width: 22, textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 12, fontWeight: '600' },
});