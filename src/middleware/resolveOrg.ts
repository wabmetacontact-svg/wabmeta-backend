// src/middleware/resolveOrg.ts
//
// Gate middleware (featureLock, connectionLock) kis organization ko dekhein.
//
// Pehle dono `X-Organization-Id` header ko sabse pehle padhte the, verified
// JWT se bhi pehle. Matlab jis org ka plan lock tha, wo user kisi dusre
// unlocked org ka id header me bhej kar gate paar kar leta tha. Data leak
// nahi hota (handler req.user.organizationId use karta hai), par paid feature
// bina paise ke chal jata tha.
//
// Ab verified token pehle aata hai. Header sirf tab dekha jata hai jab koi
// authenticated user hai hi nahi - warna wo ek client-controlled value hai
// jise koi bhi badal sakta hai.

import { Request } from 'express';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Gate middleware ke liye organization id.
 *
 * Authenticated request me hamesha token wala org. Header/body/query sirf
 * unauthenticated routes ke liye fallback hain.
 */
export const resolveGateOrganizationId = (req: Request): string => {
  const fromToken = str((req as any).user?.organizationId);
  if (fromToken) return fromToken;

  return (
    str(req.header('X-Organization-Id') || req.header('x-organization-id')) ||
    str(req.body?.organizationId) ||
    str(req.params?.organizationId) ||
    str(req.query?.organizationId) ||
    ''
  );
};

/**
 * Client ne apne token wale org se alag org maanga hai - spoof ki koshish ho
 * sakti hai, ya sirf ek purana client. Caller isse log karta hai; hum uspar
 * act nahi karte kyunki resolve() pehle hi token ko preference de chuka hai.
 */
export const claimsAnotherOrg = (req: Request): boolean => {
  const fromToken = str((req as any).user?.organizationId);
  const claimed = str(req.header('X-Organization-Id') || req.header('x-organization-id'));
  return !!fromToken && !!claimed && fromToken !== claimed;
};

export default resolveGateOrganizationId;
