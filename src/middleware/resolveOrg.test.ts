// Gate middleware pehle client ka X-Organization-Id header verified token se
// bhi upar rakhte the - locked plan wala user kisi unlocked org ka id bhej kar
// gate paar kar leta tha. Ye test us tarteeb ko wapas palatne se rokta hai.

import { describe, it, expect } from 'vitest';
import { resolveGateOrganizationId, claimsAnotherOrg } from './resolveOrg';

const req = (over: any = {}): any => ({
  header: (name: string) => over.headers?.[name.toLowerCase()],
  body: over.body,
  params: over.params,
  query: over.query,
  user: over.user,
});

describe('resolveGateOrganizationId', () => {
  it('token ka org jeetta hai, header ke hote hue bhi', () => {
    const r = req({
      user: { organizationId: 'org-real' },
      headers: { 'x-organization-id': 'org-someone-else' },
    });
    expect(resolveGateOrganizationId(r)).toBe('org-real');
  });

  it('token ka org body aur query se bhi upar hai', () => {
    const r = req({
      user: { organizationId: 'org-real' },
      body: { organizationId: 'org-body' },
      query: { organizationId: 'org-query' },
    });
    expect(resolveGateOrganizationId(r)).toBe('org-real');
  });

  it('authenticated user na ho to header fallback chalta hai', () => {
    const r = req({ headers: { 'x-organization-id': 'org-header' } });
    expect(resolveGateOrganizationId(r)).toBe('org-header');
  });

  it('kuch na ho to khali string', () => {
    expect(resolveGateOrganizationId(req())).toBe('');
  });
});

describe('claimsAnotherOrg', () => {
  it('header aur token alag hon to true', () => {
    const r = req({ user: { organizationId: 'a' }, headers: { 'x-organization-id': 'b' } });
    expect(claimsAnotherOrg(r)).toBe(true);
  });

  it('same hon to false', () => {
    const r = req({ user: { organizationId: 'a' }, headers: { 'x-organization-id': 'a' } });
    expect(claimsAnotherOrg(r)).toBe(false);
  });

  it('header na ho to false', () => {
    expect(claimsAnotherOrg(req({ user: { organizationId: 'a' } }))).toBe(false);
  });
});
