import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Surface } from '@/components/ui/surface';
import { Layout, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

function isValidUrl(value: string) {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());
}

export default function SettingsScreen() {
  const { baseUrl, setBaseUrl, isLoaded: settingsLoaded } = useSettings();
  const { userId, accessToken, isLoaded: authLoaded, setCredentials, logout } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [userIdInput, setUserIdInput] = useState(userId);
  const [accessTokenInput, setAccessTokenInput] = useState(accessToken);
  const [showToken, setShowToken] = useState(false);
  const [busyAction, setBusyAction] = useState<'server' | 'identity' | 'logout' | null>(null);
  const [urlError, setUrlError] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  // 记录挂载时的初始值，用于异步恢复后仅回填未编辑的字段
  const initialValues = useRef({ baseUrl, userId, accessToken });

  useEffect(() => {
    if (!settingsLoaded || !authLoaded) return;
    const initial = initialValues.current;
    setBaseUrlInput((cur) => (cur === initial.baseUrl ? baseUrl : cur));
    setUserIdInput((cur) => (cur === initial.userId ? userId : cur));
    setAccessTokenInput((cur) => (cur === initial.accessToken ? accessToken : cur));
  }, [settingsLoaded, authLoaded, baseUrl, userId, accessToken]);

  const serverChanged = baseUrlInput.trim() !== baseUrl;
  const identityChanged = userIdInput.trim() !== userId || accessTokenInput.trim() !== accessToken;

  async function saveServer() {
    const next = baseUrlInput.trim();
    if (!isValidUrl(next)) {
      setUrlError('请输入以 http:// 或 https:// 开头的有效地址');
      return;
    }
    setBusyAction('server');
    setUrlError('');
    setSavedMessage('');
    try {
      await setBaseUrl(next);
      setSavedMessage('服务器地址已保存');
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setBusyAction(null);
    }
  }

  async function saveIdentity() {
    const nextUserId = userIdInput.trim();
    const nextToken = accessTokenInput.trim();
    if (!nextUserId || !nextToken) {
      setIdentityError('用户 ID 和访问令牌均不能为空');
      return;
    }
    setBusyAction('identity');
    setIdentityError('');
    setSavedMessage('');
    try {
      await setCredentials({ userId: nextUserId, accessToken: nextToken });
      setSavedMessage('访问凭据已更新');
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setBusyAction(null);
    }
  }

  function confirmLogout() {
    Alert.alert('退出当前账号？', '本机保存的用户 ID 和访问令牌将被清除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出登录',
        style: 'destructive',
        onPress: async () => {
          setBusyAction('logout');
          try {
            await logout({ baseUrl });
          } finally {
            setBusyAction(null);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>设置</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>管理服务连接和当前访问身份</Text>
        </View>

        {!!savedMessage && <InlineNotice message={savedMessage} tone="success" />}

        <Surface style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialIcons name="dns" size={20} color={colors.accent} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>服务连接</Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>当前 API 实例地址</Text>
            </View>
          </View>
          <FormField
            label="服务器地址"
            value={baseUrlInput}
            onChangeText={(value) => {
              setBaseUrlInput(value);
              setUrlError('');
              setSavedMessage('');
            }}
            error={urlError}
            placeholder="https://api.example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={() => void saveServer()}
          />
          <View style={styles.actionRow}>
            <AppButton
              label="保存服务器地址"
              icon="save"
              loading={busyAction === 'server'}
              disabled={!serverChanged}
              onPress={() => void saveServer()}
            />
          </View>
        </Surface>

        <Surface style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialIcons name="badge" size={20} color={colors.accent} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>访问身份</Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>用于请求认证的用户 ID 和令牌</Text>
            </View>
          </View>
          <FormField
            label="用户 ID"
            value={userIdInput}
            onChangeText={(value) => {
              setUserIdInput(value);
              setIdentityError('');
              setSavedMessage('');
            }}
            placeholder="例如 1001"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FormField
            label="系统访问令牌"
            value={accessTokenInput}
            onChangeText={(value) => {
              setAccessTokenInput(value);
              setIdentityError('');
              setSavedMessage('');
            }}
            error={identityError}
            placeholder="输入访问令牌"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showToken}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showToken ? '隐藏访问令牌' : '显示访问令牌'}
                onPress={() => setShowToken((current) => !current)}
                style={({ pressed }) => [
                  styles.tokenToggle,
                  pressed ? { backgroundColor: colors.surfaceMuted } : null,
                ]}>
                <MaterialIcons
                  name={showToken ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            }
          />
          <View style={styles.actionRow}>
            <AppButton
              label="更新访问凭据"
              icon="save"
              loading={busyAction === 'identity'}
              disabled={!identityChanged}
              onPress={() => void saveIdentity()}
            />
          </View>
        </Surface>

        <Surface style={[styles.section, styles.sessionSection]}>
          <View style={styles.sessionCopy}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>当前会话</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>退出后需要重新输入访问凭据</Text>
          </View>
          <AppButton
            label="退出登录"
            icon="logout"
            variant="danger"
            loading={busyAction === 'logout'}
            onPress={confirmLogout}
          />
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    gap: 4,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tokenToggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  sessionCopy: {
    minWidth: 220,
    flex: 1,
    gap: 2,
  },
});