import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { storageKeys } from '@/lib/keys';
import { getItem as plainGetItem, removeItem as plainRemoveItem, setItem as plainSetItem } from '@/lib/storage';

/**
 * 安全存储层。
 *
 * - 原生端（Android / iOS）敏感凭据（accessToken）强制走 expo-secure-store，
 *   写入失败时直接抛出错误，不静默降级写入明文 AsyncStorage。
 * - Web 端无原生密钥库，使用 AsyncStorage 保存。
 * - 原生端首次读取时做一次性迁移：若旧版将其明文存于 AsyncStorage，
 *   先迁入 SecureStore 再删除旧明文。
 */

const SECURE_KEY_ACCESS_TOKEN = storageKeys.accessToken;

function isWebPlatform(): boolean {
  return Platform.OS === 'web';
}

export async function getAccessToken(): Promise<string> {
  if (isWebPlatform()) {
    return (await plainGetItem(SECURE_KEY_ACCESS_TOKEN)) ?? '';
  }

  const secure = await SecureStore.getItemAsync(SECURE_KEY_ACCESS_TOKEN);
  if (secure !== null) return secure;

  const legacy = await plainGetItem(SECURE_KEY_ACCESS_TOKEN);
  if (legacy !== null && legacy !== '') {
    await SecureStore.setItemAsync(SECURE_KEY_ACCESS_TOKEN, legacy);
    await plainRemoveItem(SECURE_KEY_ACCESS_TOKEN);
    return legacy;
  }

  return '';
}

export async function setAccessToken(value: string): Promise<void> {
  if (isWebPlatform()) {
    await plainSetItem(SECURE_KEY_ACCESS_TOKEN, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(SECURE_KEY_ACCESS_TOKEN, value);
  } catch (error) {
    const detail = error instanceof Error && error.message ? `：${error.message}` : '';
    throw new Error(`安全存储写入失败，请检查系统密钥库状态后重试${detail}`);
  }

  await plainRemoveItem(SECURE_KEY_ACCESS_TOKEN);
}

export async function removeAccessToken(): Promise<void> {
  if (isWebPlatform()) {
    await plainRemoveItem(SECURE_KEY_ACCESS_TOKEN);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS_TOKEN);
  } finally {
    await plainRemoveItem(SECURE_KEY_ACCESS_TOKEN);
  }
}
