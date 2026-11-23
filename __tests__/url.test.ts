import { Linking } from 'react-native';
import { createOnShouldStartLoadWithRequest } from 'react-native-webview/lib/WebViewShared';

import {
  isCleartextHttpUrl,
  isHttpsUrl,
  isValidServerUrl,
  joinUrl,
  normalizeBaseUrl,
  shouldAllowPaymentWebViewUrl,
} from '@/lib/url';

describe('lib/url', () => {
  it('normalizes trailing slashes and whitespace', () => {
    expect(normalizeBaseUrl('  https://api.example.com///  ')).toBe('https://api.example.com');
    expect(normalizeBaseUrl('   ')).toBe('');
  });

  it('joins base URL and relative or absolute paths cleanly', () => {
    expect(joinUrl('https://api.example.com/', '/api/user/self')).toBe('https://api.example.com/api/user/self');
    expect(joinUrl('https://api.example.com/v1/', '/api/status')).toBe('https://api.example.com/v1/api/status');
    expect(joinUrl('https://api.example.com', 'api/status')).toBe('https://api.example.com/api/status');
    expect(joinUrl('', '/api/status')).toBe('/api/status');
  });

  it('validates https, LAN IP http, localhost, and subpath URLs while rejecting query/hash/invalid inputs', () => {
    expect(isValidServerUrl('https://api.example.com')).toBe(true);
    expect(isValidServerUrl('https://api.example.com/subpath/')).toBe(true);
    expect(isValidServerUrl('http://192.168.1.10:3000')).toBe(true);
    expect(isValidServerUrl('http://localhost:3000')).toBe(true);

    expect(isValidServerUrl('')).toBe(false);
    expect(isValidServerUrl('api.example.com')).toBe(false);
    expect(isValidServerUrl('ftp://example.com')).toBe(false);
    expect(isValidServerUrl('javascript:alert(1)')).toBe(false);
    expect(isValidServerUrl('https://api.example.com/path with space')).toBe(false);
    expect(isValidServerUrl('https://api.example.com/#docs')).toBe(false);
    expect(isValidServerUrl('https://api.example.com/?foo=bar')).toBe(false);
  });

  it('validates HTTPS-only payment URLs including query parameters', () => {
    expect(isHttpsUrl('https://pay.example.com/checkout?order=123')).toBe(true);
    expect(isHttpsUrl('http://pay.example.com/checkout?order=123')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('intent://pay#Intent;end')).toBe(false);
  });

  it('allows initial about:blank and HTTPS in payment WebView while blocking HTTP without Linking.openURL', () => {
    const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const loadRequest = jest.fn();

    const handler = createOnShouldStartLoadWithRequest(
      loadRequest,
      ['*'],
      (request) => shouldAllowPaymentWebViewUrl(request.url)
    );

    const makeEvent = (url: string, lockIdentifier: number) =>
      ({
        nativeEvent: {
          url,
          lockIdentifier,
          title: '',
          loading: false,
          canGoBack: false,
          canGoForward: false,
          isTopFrame: true,
          navigationType: 'other' as const,
          mainDocumentURL: url,
        },
      }) as unknown as Parameters<typeof handler>[0];

    handler(makeEvent('about:blank', 1));
    handler(makeEvent('https://pay.example.com/checkout?order=1', 2));
    handler(makeEvent('http://192.168.1.10:3000/return', 3));
    handler(makeEvent('intent://pay#Intent;end', 4));

    expect(loadRequest).toHaveBeenNthCalledWith(1, true, 'about:blank', 1);
    expect(loadRequest).toHaveBeenNthCalledWith(2, true, 'https://pay.example.com/checkout?order=1', 2);
    expect(loadRequest).toHaveBeenNthCalledWith(3, false, 'http://192.168.1.10:3000/return', 3);
    expect(loadRequest).toHaveBeenNthCalledWith(4, false, 'intent://pay#Intent;end', 4);
    expect(canOpenSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();

    canOpenSpy.mockRestore();
    openSpy.mockRestore();
  });

  it('detects cleartext http URLs accurately', () => {
    expect(isCleartextHttpUrl('http://192.168.31.10:3000')).toBe(true);
    expect(isCleartextHttpUrl('HTTP://localhost:3000')).toBe(true);
    expect(isCleartextHttpUrl('https://api.example.com')).toBe(false);
    expect(isCleartextHttpUrl('http://192.168.31.10:3000/#hash')).toBe(false);
    expect(isCleartextHttpUrl('not-a-url')).toBe(false);
  });
});
