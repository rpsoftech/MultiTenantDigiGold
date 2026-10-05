import { adminSessionUser } from './admin-session';

function token(claims: Record<string, unknown>) {
  const payload = btoa(JSON.stringify(claims))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${btoa('{"alg":"HS256","typ":"JWT"}')}.${payload}.signature`;
}

const validClaims = {
  admin_uuid: 'admin-123',
  role: 'manager',
  aud: ['digigold:admin:access'],
  exp: 4102444800,
};

describe('adminSessionUser', () => {
  it.each(['manager', 'super_admin', 'custom', 'auditor'])(
    'restores display fields for backend role %s',
    (role) => {
      expect(adminSessionUser(token({ ...validClaims, role }))).toEqual({
        userId: 'admin-123',
        role: 'admin',
        isNewUser: false,
        kycStatus: 'not_started',
      });
    },
  );

  it('shows the username MainServer puts in the token as the admin name', () => {
    expect(
      adminSessionUser(token({ ...validClaims, username: 'demo-manager' }))
        .name,
    ).toBe('demo-manager');
    // Tokens from before the claim existed, or a blank one, leave the name unset.
    expect(adminSessionUser(token(validClaims)).name).toBeUndefined();
    expect(
      adminSessionUser(token({ ...validClaims, username: '  ' })).name,
    ).toBeUndefined();
  });

  it('accepts the JWT string form of the admin access audience', () => {
    expect(
      adminSessionUser(token({ ...validClaims, aud: 'digigold:admin:access' }))
        .userId,
    ).toBe('admin-123');
  });

  it.each([
    { aud: ['digigold:user:access'] },
    { aud: ['digigold:admin:refresh'] },
    { aud: undefined },
    { admin_uuid: undefined },
    { admin_uuid: '' },
    { role: '' },
    { role: undefined },
    { exp: 1 },
    { exp: '4102444800' },
    { exp: undefined },
  ])(
    'rejects incomplete, expired, or non-admin access claims %j',
    (invalidClaims) => {
      expect(() =>
        adminSessionUser(token({ ...validClaims, ...invalidClaims })),
      ).toThrow('Your admin session is invalid or expired.');
    },
  );

  it('rejects expiry at the current second', () => {
    expect(() =>
      adminSessionUser(
        token({ ...validClaims, exp: Math.floor(Date.now() / 1000) }),
      ),
    ).toThrow();
  });

  it.each(['', 'malformed-token', 'a.!.b', 'a.e30.b', 'a.bnVsbA.b', 'a.b.c.d'])(
    'rejects a malformed token %s',
    (value) => expect(() => adminSessionUser(value)).toThrow(),
  );
});
