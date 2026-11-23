import { Platform } from 'react-native';

import { storageKeys } from '@/lib/keys';
import { getAccessToken, removeAccessToken, setAccessToken } from '@/lib/secure-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const SecureStore = jest.requireMock('expo-secure-store') as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const plainStorage = jest.requireMock('@/lib/storage') as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

const originalPlatformOS = Platform.OS;

function setPlatformOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    value: os,
    configurable: true,
  });
}

describe('lib/secure-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOS('android');
  });

  afterAll(() => {
    setPlatformOS(originalPlatformOS);
  });

  it('stores token in SecureStore on native and removes legacy plaintext copy', async () => {
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    plainStorage.removeItem.mockResolvedValue(undefined);

    await setAccessToken('sk-secret-token');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(storageKeys.accessToken, 'sk-secret-token');
    expect(plainStorage.removeItem).toHaveBeenCalledWith(storageKeys.accessToken);
    expect(plainStorage.setItem).not.toHaveBeenCalled();
  });

  it('throws and refuses to fall back to plaintext AsyncStorage when SecureStore write fails on native', async () => {
    SecureStore.setItemAsync.mockRejectedValue(new Error('Keystore locked'));

    await expect(setAccessToken('sk-secret-token')).rejects.toThrow(/安全存储写入失败.*Keystore locked/);
    expect(plainStorage.setItem).not.toHaveBeenCalled();
  });

  it('migrates legacy plaintext token from AsyncStorage to SecureStore on first native read', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);
    plainStorage.getItem.mockResolvedValue('legacy-token');
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    plainStorage.removeItem.mockResolvedValue(undefined);

    const token = await getAccessToken();

    expect(token).toBe('legacy-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(storageKeys.accessToken, 'legacy-token');
    expect(plainStorage.removeItem).toHaveBeenCalledWith(storageKeys.accessToken);
  });

  it('propagates SecureStore read failure on native instead of reading plaintext fallback', async () => {
    SecureStore.getItemAsync.mockRejectedValue(new Error('Decryption failed'));

    await expect(getAccessToken()).rejects.toThrow('Decryption failed');
    expect(plainStorage.getItem).not.toHaveBeenCalled();
  });

  it('still cleans legacy AsyncStorage entry in removeAccessToken even if SecureStore delete rejects', async () => {
    SecureStore.deleteItemAsync.mockRejectedValue(new Error('Keystore error'));
    plainStorage.removeItem.mockResolvedValue(undefined);

    await expect(removeAccessToken()).rejects.toThrow('Keystore error');
    expect(plainStorage.removeItem).toHaveBeenCalledWith(storageKeys.accessToken);
  });

  it('uses AsyncStorage directly on web platform', async () => {
    setPlatformOS('web');
    plainStorage.setItem.mockResolvedValue(undefined);
    plainStorage.getItem.mockResolvedValue('web-token');
    plainStorage.removeItem.mockResolvedValue(undefined);

    await setAccessToken('web-token');
    const token = await getAccessToken();
    await removeAccessToken();

    expect(token).toBe('web-token');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(plainStorage.setItem).toHaveBeenCalledWith(storageKeys.accessToken, 'web-token');
    expect(plainStorage.removeItem).toHaveBeenCalledWith(storageKeys.accessToken);
  });
});
