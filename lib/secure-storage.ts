import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { storageKeys } from '@/lib/keys';
import { getItem as plainGetItem, removeItem as plainRemoveItem } from '@/lib/storage';

/**
 * 安全存储层。
 *
 * - 敏感凭据（accessToken）走 expo-secure-store：Android Keystore /
 *   iOS Keychain 加密，root/备份无法直接读出明文。
 * - 非敏感配置（baseUrl、userId）仍走 AsyncStorage（SecureStore 单值约 2KB 上限，
 *   且这些不算机密）。
 *
 * 首次读取 accessToken 时做一次性迁移：若旧版把它明文存在 AsyncStorage，
 * 搬入 SecureStore 后从 AsyncStorage 删除，老用户升级无感。
 */

const SECURE_KEY_ACCESS_TOKEN = storageKeys.accessToken;

// SecureStore 的 key 只允许字母数字及 ._-，storageKeys.accessToken 已满足。
function isSecureKeyValid(key: string): boolean {
  return /^[\w.-]+$/.test(key);
}

export async function getAccessToken(): Promise<string> {
  if (!isSecureKeyValid(SECURE_KEY_ACCESS_TOKEN)) {
    // 理论上不会发生；退化为明文读取以保证可用性
    return (await plainGetItem(SECURE_KEY_ACCESS_TOKEN)) ?? '';
  }
  try {
    const secure = await SecureStore.getItemAsync(SECURE_KEY_ACCESS_TOKEN);
    if (secure !== null) return secure;

    // 一次性迁移：旧版明文存于 AsyncStorage
    const legacy = await plainGetItem(SECURE_KEY_ACCESS_TOKEN);
    if (legacy !== null && legacy !== '') {
      await SecureStore.setItemAsync(SECURE_KEY_ACCESS_TOKEN, legacy);
      await plainRemoveItem(SECURE_KEY_ACCESS_TOKEN);
      return legacy;
    }
    return '';
  } catch {
    // SecureStore 不可用（如 web）时回退 AsyncStorage
    return (await plainGetItem(SECURE_KEY_ACCESS_TOKEN)) ?? '';
  }
}

export async function setAccessToken(value: string): Promise<void> {
  if (!isSecureKeyValid(SECURE_KEY_ACCESS_TOKEN)) {
    await AsyncStorage.setItem(SECURE_KEY_ACCESS_TOKEN, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(SECURE_KEY_ACCESS_TOKEN, value);
    // 清理可能残留的旧明文
    await plainRemoveItem(SECURE_KEY_ACCESS_TOKEN);
  } catch {
    await AsyncStorage.setItem(SECURE_KEY_ACCESS_TOKEN, value);
  }
}

export async function removeAccessToken(): Promise<void> {
  try {
    if (isSecureKeyValid(SECURE_KEY_ACCESS_TOKEN)) {
      await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS_TOKEN);
    }
  } catch {
    // ignore
  }
  await plainRemoveItem(SECURE_KEY_ACCESS_TOKEN);
}
