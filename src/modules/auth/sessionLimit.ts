// src/modules/auth/sessionLimit.ts
//
// Ek organization ek waqt me kitne logins chala sakti hai.
//
// Seat limit invite par lagti hai (organizations.service inviteMember), par
// usse password sharing nahi rukti: ek hi login 10 logon ko de do aur seats
// khareedne ki zaroorat hi nahi padti. Isliye cap ab *sessions* par bhi hai.
//
// Session = ek zinda RefreshToken row. Cap poore org par hai, ek user par
// nahi - kyunki jo cheez bik rahi hai wo seats hain, devices nahi.
//
// Cap lagne par nayi login block nahi hoti, sabse purani session nikal di
// jaati hai. Block karna support ka sar-dard hai: kisi ka purane phone par
// session pada reh gaya to wo apne hi account se bahar ho jata. Nikalne se
// dabaav wahi rehta hai - 10 log 3 seats par ghoom-ghoom kar ek dusre ko
// logout karte rahenge, jo seats khareedne ki asli wajah ban jaati hai.

/**
 * Har seat par kitne devices. Ek banda laptop aur phone dono par hota hai,
 * isliye 1 rakhna genuine users ko satata.
 */
export const DEVICES_PER_SEAT = Number(process.env.DEVICES_PER_SEAT || 2);

/** Itne se kam cap kabhi nahi - warna ek-seat wala apne hi phone se lade. */
export const MIN_SESSION_CAP = 2;

/** Isse upar ka matlab "unlimited" hai (plans me 999999 likha jata hai). */
const UNLIMITED_SEATS = 9999;

export interface SessionRow {
  id: string;
  createdAt: Date | string;
}

/**
 * Is plan par ek saath kitne logins.
 *
 * `null` = koi cap nahi (unlimited seats wale plans, ya plan hi missing).
 * Plan missing par cap na lagana jaan-boojhkar hai - data adhoora hone par
 * kisi ko logout nahi karna chahiye.
 */
export const sessionCapForSeats = (
  maxTeamMembers: number | null | undefined
): number | null => {
  if (maxTeamMembers === null || maxTeamMembers === undefined) return null;
  if (!Number.isFinite(maxTeamMembers) || maxTeamMembers <= 0) return null;
  if (maxTeamMembers >= UNLIMITED_SEATS) return null;

  return Math.max(MIN_SESSION_CAP, maxTeamMembers * DEVICES_PER_SEAT);
};

/**
 * Nayi session banane se pehle kaun si purani sessions hatani hain.
 *
 * Nayi session ke liye jagah chahiye, isliye cap se ek kam par kaata jata
 * hai. Sabse purani pehle jaati hai.
 */
export const sessionsToEvict = (
  sessions: SessionRow[],
  cap: number | null
): string[] => {
  if (cap === null) return [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const keep = Math.max(0, cap - 1);
  if (sorted.length <= keep) return [];

  return sorted.slice(0, sorted.length - keep).map((s) => s.id);
};
