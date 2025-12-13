import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const { baseUrl, setBaseUrl } = useSettings();
  const { userId, accessToken, setCredentials, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [userIdInput, setUserIdInput] = useState(userId);
  const [accessTokenInput, setAccessTokenInput] = useState(accessToken);
  const [showToken, setShowToken] = useState(false);

  const inputStyle = useMemo(
    () => [styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight],
    [colorScheme]
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedText type="title">设置</ThemedText>

      <ThemedText type="subtitle">Base URL</ThemedText>
      <TextInput
        value={baseUrlInput}
        onChangeText={setBaseUrlInput}
        placeholder="例如：https://example.com"
        autoCapitalize="none"
        autoCorrect={false}
        style={inputStyle}
      />
      <Pressable style={styles.button} onPress={() => setBaseUrl(baseUrlInput)}>
        <ThemedText type="defaultSemiBold">保存</ThemedText>
      </Pressable>

      <ThemedText type="subtitle">身份</ThemedText>
      <TextInput
        value={userIdInput}
        onChangeText={setUserIdInput}
        placeholder="New-Api-User"
        autoCapitalize="none"
        autoCorrect={false}
        style={inputStyle}
      />
      <TextInput
        value={accessTokenInput}
        onChangeText={setAccessTokenInput}
        placeholder="系统访问令牌（Bearer ...）"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!showToken}
        style={inputStyle}
      />
      <View style={styles.tokenRow}>
        <Pressable style={styles.tokenToggle} onPress={() => setShowToken((v) => !v)}>
          <ThemedText type="defaultSemiBold">{showToken ? '隐藏密钥' : '显示密钥'}</ThemedText>
        </Pressable>
      </View>
      <Pressable
        style={styles.button}
        onPress={() => setCredentials({ userId: userIdInput.trim(), accessToken: accessTokenInput.trim() })}
      >
        <ThemedText type="defaultSemiBold">保存身份</ThemedText>
      </Pressable>

      <Pressable style={[styles.button, styles.danger]} onPress={() => logout({ baseUrl })}>
        <ThemedText type="defaultSemiBold">退出登录</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 10,
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
  danger: {
    borderColor: '#d11',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tokenToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
