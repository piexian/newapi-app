import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { Surface } from '@/components/ui/surface';
import { Layout, Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';

type FieldErrors = Partial<Record<'baseUrl' | 'userId' | 'accessToken', string>>;

function validateUrl(value: string) {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { baseUrl, setBaseUrl } = useSettings();
  const { userId, accessToken, setCredentials } = useAuth();
  const userIdRef = useRef<TextInput>(null);
  const tokenRef = useRef<TextInput>(null);

  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [userIdInput, setUserIdInput] = useState(userId);
  const [accessTokenInput, setAccessTokenInput] = useState(accessToken);
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');

  async function onLogin() {
    const nextErrors: FieldErrors = {};
    const nextBaseUrl = baseUrlInput.trim();
    const nextUserId = userIdInput.trim();
    const nextToken = accessTokenInput.trim();

    if (!nextBaseUrl) nextErrors.baseUrl = '请输入服务器地址';
    else if (!validateUrl(nextBaseUrl)) nextErrors.baseUrl = '请输入以 http:// 或 https:// 开头的有效地址';
    if (!nextUserId) nextErrors.userId = '请输入用户 ID';
    if (!nextToken) nextErrors.accessToken = '请输入系统访问令牌';

    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      await setBaseUrl(nextBaseUrl);
      await setCredentials({ userId: nextUserId, accessToken: nextToken });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 36 },
        ]}>
        <View
          style={[
            styles.content,
            { width: Math.min(Layout.formMaxWidth, Math.max(0, width - Layout.pagePadding * 2)) },
          ]}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>N</Text>
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandName}>NewAPI</Text>
              <Text style={styles.brandMeta}>移动工作台</Text>
            </View>
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>连接你的服务</Text>
            <Text style={styles.subtitle}>输入实例地址和访问凭据，继续进入控制台。</Text>
          </View>

          <Surface style={styles.formCard}>
            <View style={styles.formSection}>
              <View style={styles.sectionHeading}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>1</Text>
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>服务实例</Text>
                  <Text style={styles.sectionHint}>你部署的 NewAPI 地址</Text>
                </View>
              </View>
              <FormField
                label="服务器地址"
                value={baseUrlInput}
                onChangeText={(value) => {
                  setBaseUrlInput(value);
                  if (errors.baseUrl) setErrors((current) => ({ ...current, baseUrl: undefined }));
                }}
                error={errors.baseUrl}
                placeholder="https://api.example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
                onSubmitEditing={() => userIdRef.current?.focus()}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.formSection}>
              <View style={styles.sectionHeading}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>2</Text>
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>访问凭据</Text>
                  <Text style={styles.sectionHint}>使用系统分配的用户 ID 和令牌</Text>
                </View>
              </View>
              <FormField
                ref={userIdRef}
                label="用户 ID"
                value={userIdInput}
                onChangeText={(value) => {
                  setUserIdInput(value);
                  if (errors.userId) setErrors((current) => ({ ...current, userId: undefined }));
                }}
                error={errors.userId}
                placeholder="例如 1001"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => tokenRef.current?.focus()}
              />
              <FormField
                ref={tokenRef}
                label="系统访问令牌"
                value={accessTokenInput}
                onChangeText={(value) => {
                  setAccessTokenInput(value);
                  if (errors.accessToken) {
                    setErrors((current) => ({ ...current, accessToken: undefined }));
                  }
                }}
                error={errors.accessToken}
                placeholder="输入访问令牌"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showToken}
                returnKeyType="go"
                onSubmitEditing={() => void onLogin()}
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
            </View>

            {!!submitError && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <MaterialIcons name="error-outline" size={19} color={Palette.danger} />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}

            <AppButton
              label={busy ? '正在保存' : '保存并进入控制台'}
              icon="arrow-forward"
              fullWidth
              loading={busy}
              onPress={() => void onLogin()}
            />
          </Surface>

          <View style={styles.securityNote}>
            <MaterialIcons name="lock-outline" size={16} color={Palette.muted} />
            <Text style={styles.securityText}>凭据仅保存在当前设备</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Layout.pagePadding,
    justifyContent: 'center',
  },
  content: {
    maxWidth: Layout.formMaxWidth,
    alignSelf: 'center',
    gap: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.accent,
  },
  brandLetter: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  brandText: {
    gap: 1,
  },
  brandName: {
    color: Palette.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  brandMeta: {
    color: Palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  intro: {
    gap: 8,
  },
  title: {
    color: Palette.ink,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
  },
  subtitle: {
    maxWidth: 440,
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  formCard: {
    gap: 20,
    padding: 20,
  },
  formSection: {
    gap: 15,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.accentSoft,
  },
  stepText: {
    color: Palette.accent,
    fontSize: 13,
    fontWeight: '800',
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
  divider: {
    height: 1,
    backgroundColor: Palette.border,
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
  errorBanner: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.medium,
    backgroundColor: Palette.dangerSoft,
  },
  errorText: {
    flex: 1,
    color: Palette.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  securityNote: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityText: {
    color: Palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
});
