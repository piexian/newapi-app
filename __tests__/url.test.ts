import { isCleartextHttpUrl, isValidServerUrl, joinUrl, normalizeBaseUrl } from '@/lib/url';

describe('lib/url', () => {
  it('normalizes trailing slashes and whitespace', () => {
    expect(normalizeBaseUrl('  https://api.example.com///  ')).toBe('https://api.example.com');
    expect(normalizeBaseUrl('   ')).toBe('');
  });

  it('joins base URL and relative or absolute paths cleanly', () => {
    expect(joinUrl('https://api.example.com/', '/api/user/self')).toBe('https://api.example.com/api/user/self');
    expect(joinUrl('https://api.example.com', 'api/status')).toBe('https://api.example.com/api/status');
    expect(joinUrl('', '/api/status')).toBe('/api/status');
  });

  it('validates https, LAN IP http, and localhost URLs while rejecting invalid inputs', () => {
    expect(isValidServerUrl('https://api.example.com')).toBe(true);
    expect(isValidServerUrl('http://192.168.1.10:3000')).toBe(true);
    expect(isValidServerUrl('http://localhost:3000')).toBe(true);

    expect(isValidServerUrl('')).toBe(false);
    expect(isValidServerUrl('api.example.com')).toBe(false);
    expect(isValidServerUrl('ftp://example.com')).toBe(false);
    expect(isValidServerUrl('javascript:alert(1)')).toBe(false);
    expect(isValidServerUrl('https://api.example.com/path with space')).toBe(false);
  });

  it('detects cleartext http URLs accurately', () => {
    expect(isCleartextHttpUrl('http://192.168.31.10:3000')).toBe(true);
    expect(isCleartextHttpUrl('HTTP://localhost:3000')).toBe(true);
    expect(isCleartextHttpUrl('https://api.example.com')).toBe(false);
    expect(isCleartextHttpUrl('not-a-url')).toBe(false);
  });
});
