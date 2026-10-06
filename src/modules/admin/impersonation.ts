// src/modules/admin/impersonation.ts
//
// What an admin may change while viewing the app as a client (the 30-minute
// "view as" token from impersonateUser).
//
// The team runs clients' accounts from inside them - templates, contacts,
// campaigns, chatbots, settings, the inbox and the wallet - so the view lets
// them make changes. Two areas stay view-only:
//
//   - the login itself: password, sessions, profile, deleting the account,
//     and leaving, transferring or deleting the organization - the client
//     must never find they are locked out of, or no longer own, their account;
//   - the plan: upgrading or cancelling it. Plans are set from the admin
//     panel, where they are recorded and verified.
//
// Reads are always allowed. Every change made in the view is logged with the
// admin who made it (see the auth middleware).

/** Path prefixes under /api that stay view-only, with what to call them. */
const VIEW_ONLY: readonly { prefix: string; area: string }[] = [
  // The login and the ownership of the account.
  { prefix: '/api/auth', area: 'account' },
  { prefix: '/api/users', area: 'account' },
  // The plan.
  { prefix: '/api/billing', area: 'billing' },
];

/** Organization routes that take the account away from its owner. */
const ORG_TAKEOVER = /^\/api\/organizations\/[^/]+(\/(leave|transfer))?\/?$/;

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Matches a prefix as a whole path segment: /api/inbox, /api/inbox/..., not /api/inboxes. */
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}-`);

/**
 * null when the request is allowed in the admin view, otherwise the area it
 * touches. `path` is the request path without the query string.
 */
export const impersonationBlocks = (method: string, path: string): string | null => {
  const m = method.toUpperCase();
  if (READS.has(m)) return null;
  const p = path.replace(/\/+$/, '') || '/';
  for (const v of VIEW_ONLY) if (under(p, v.prefix)) return v.area;
  // DELETE /api/organizations/:id, POST .../leave, POST .../transfer. Editing
  // the organization's details (PUT /:id) and its team stays allowed.
  if (ORG_TAKEOVER.test(p) && (m === 'DELETE' || /\/(leave|transfer)$/.test(p))) return 'account';
  return null;
};

export const IMPERSONATION_BLOCKED_MESSAGE: Record<string, string> = {
  account: 'The client’s login, profile and ownership cannot be changed from the admin view.',
  billing: 'The plan cannot be changed from the admin view. Set it from the admin panel.',
};
