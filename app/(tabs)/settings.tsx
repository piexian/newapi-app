import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { Surface } from '@/components/ui/surface';
import { Layout, Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

function isValidUrl(value: string) {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());
}

export default function SettingsScreen() {
  const { baseUrl, setBaseUrl } = useSettings();
  const { userId, accessToken, setCredentials, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [userIdInput, setUserIdInput] = useState(userId);
  const [accessTokenInput, setAccessTokenInput] = useState(accessToken);
  const [showToken, setShowToken] = useState(false);
  const [busyAction, setBusyAction] = useState<'server' | 'identity' | 'logout' | null>(null);
  const [urlError, setUrlError] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
        <Text style={styles.subtitle}>管理服务连接和当前访问身份</Text>
      </View>

      {!!savedMessage && (
        <View style={styles.successNotice} accessibilityRole="alert">
          <MaterialIcons name="check-circle" size={19} color={Palette.accent} />
          <Text style={styles.successText}>{savedMessage}</Text>
        </View>
      )}

      <Surface style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <MaterialIcons name="dns" size={19} color={Palette.accent} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>服务连接</Text>
            <Text style={styles.sectionHint}>当前 API 实例地址</Text>
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
            onPress={() => void saveServer()}
          />
        </View>
      </Surface>

      <Surface style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <MaterialIcons name="badge" size={19} color={Palette.accent} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>访问身份</Text>
            <Text style={styles.sectionHint}>用于请求认证的用户 ID 和令牌</Text>
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
              style={({ pressed }) => [styles.tokenToggle, pressed ? styles.tokenTogglePressed : null]}>
              <MaterialIcons
                name={showToken ? 'visibility-off' : 'visibility'}
                size={20}
                color={Palette.muted}
              />
            </Pressable>
          }
        />
        <View style={styles.actionRow}>
          <AppButton
            label="更新访问凭据"
            icon="save"
            loading={busyAction === 'identity'}
            onPress={() => void saveIdentity()}
          />
        </View>
      </Surface>

      <Surface style={[styles.section, styles.sessionSection]}>
        <View style={styles.sessionCopy}>
          <Text style={styles.sectionTitle}>当前会话</Text>
          <Text style={styles.sectionHint}>退出后需要重新输入访问凭据</Text>
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.canvas,
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
    color: Palette.ink,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  successNotice: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.medium,
    backgroundColor: Palette.accentSoft,
  },
  successText: {
    color: Palette.accentStrong,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: Palette.accentSoft,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: Palette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionHint: {
    color: Palette.muted,
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
  tokenTogglePressed: {
    backgroundColor: Palette.surfaceMuted,
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
