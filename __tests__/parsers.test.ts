import { parseTokens, parseUser, parseUsers } from '@/lib/parsers';

describe('lib/parsers', () => {
  it('parses user envelope and Go sql.NullTime DeletedAt format', () => {
    const active = parseUser({
      success: true,
      data: {
        id: 7,
        username: 'alice',
        display_name: 'Alice',
        role: 10,
        quota: 500000,
        DeletedAt: { Valid: false, Time: '0001-01-01T00:00:00Z' },
      },
    });
    expect(active).toMatchObject({
      id: 7,
      username: 'alice',
      displayName: 'Alice',
      role: 10,
      quota: 500000,
      deletedAt: null,
    });

    const deleted = parseUser({
      success: true,
      data: {
        id: 8,
        username: 'bob',
        DeletedAt: { Valid: true, Time: '2026-10-01T00:00:00Z' },
      },
    });
    expect(deleted?.deletedAt).toBe('2026-10-01T00:00:00Z');
  });

  it('filters malformed user entries and preserves valid ones in parseUsers', () => {
    const users = parseUsers({
      success: true,
      data: {
        items: [
          { id: 1, username: 'admin', role: 100 },
          { id: 2, username: '' },
          null,
        ],
      },
    });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: 1, username: 'admin', role: 100 });
  });

  it('parses token list from nested envelope', () => {
    const tokens = parseTokens({
      success: true,
      data: {
        items: [
          {
            id: 42,
            name: 'prod-key',
            key: 'sk-test',
            status: 1,
            remain_quota: 1000,
            unlimited_quota: false,
          },
        ],
      },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      id: 42,
      name: 'prod-key',
      key: 'sk-test',
      status: 1,
      remainQuota: 1000,
      unlimitedQuota: false,
    });
  });
});
