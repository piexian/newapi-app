import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const { baseUrl, setBaseUrl } = useSettings();
  const { userId, accessToken, setCredentials } = useAuth();

  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [userIdInput, setUserIdInput] = useState(userId);
  const [accessTokenInput, setAccessTokenInput] = useState(accessToken);
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const inputStyle = useMemo(
    () => [
      styles.input,
      colorScheme === 'dark' ? styles.inputDark : styles.inputLight,
    ],
    [colorScheme]
  );

  async function onSaveBaseUrl() {
    setError('');
    await setBaseUrl(baseUrlInput);
  }

  async function onTokenLogin() {
    setError('');
    setBusy(true);
    try {
      await setCredentials({ userId: userIdInput.trim(), accessToken: accessTokenInput.trim() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.section}>
        <ThemedText type="title">NewAPI 手机端</ThemedText>
        <ThemedText>仅支持：UserId + 系统访问令牌 登录（暂时不做账号密码/2FA/Passkey/OAuth）</ThemedText>
        <ThemedText>每次请求会自动带：`New-Api-User` + `Authorization: Bearer ...`</ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">服务器地址（Base URL）</ThemedText>
        <TextInput
          value={baseUrlInput}
          onChangeText={setBaseUrlInput}
          placeholder="例如：https://example.com"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
        <Pressable style={styles.button} onPress={onSaveBaseUrl} disabled={busy}>
          <ThemedText type="defaultSemiBold">保存 Base URL</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">身份信息（必填）</ThemedText>
        <TextInput
          value={userIdInput}
          onChangeText={setUserIdInput}
          placeholder="New-Api-User（必填）"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
        <TextInput
          value={accessTokenInput}
          onChangeText={setAccessTokenInput}
          placeholder="系统访问令牌（必填）"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showToken}
          style={inputStyle}
        />
        <View style={styles.tokenRow}>
          <Pressable style={styles.tokenToggle} onPress={() => setShowToken((v) => !v)} disabled={busy}>
            <ThemedText type="defaultSemiBold">{showToken ? '隐藏密钥' : '显示密钥'}</ThemedText>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable style={[styles.button, styles.flex]} onPress={onTokenLogin} disabled={busy}>
            <ThemedText type="defaultSemiBold">保存并进入</ThemedText>
          </Pressable>
        </View>
      </ThemedView>

      {!!error && (
        <ThemedView style={styles.section}>
          <ThemedText style={styles.error}>{error}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">调试</ThemedText>
        <ThemedText>当前保存的 userId：{userId || '(空)'}</ThemedText>
        <ThemedText>当前保存的系统访问令牌：{accessToken ? '(已保存)' : '(空)'}</ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  section: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputLight: {
    borderColor: '#d0d0d0',
    backgroundColor: '#fff',
    color: '#11181C',
  },
  inputDark: {
    borderColor: '#333',
    backgroundColor: '#1e1f20',
    color: '#ECEDEE',
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#888',
  },
  error: {
    color: '#d11',
  },
  code: {
    fontFamily: 'ui-monospace',
    opacity: 0.9,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tokenRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  tokenToggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  flex: {
    flex: 1,
    alignItems: 'center',
  },
});
