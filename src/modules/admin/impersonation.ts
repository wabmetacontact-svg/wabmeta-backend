// src/modules/admin/impersonation.ts
//
// What an admin may change while viewing the app as a client (the 30-minute
// "view as" token from impersonateUser).
//
// Onboarders set clients up from inside their account - templates, contacts,
// campaigns, chatbots, settings - so the view lets them make changes. A few
// areas stay view-only:
//
//   - the inbox: a reply sent from here would go to the client's customer in
//     the client's name, from somebody the customer never dealt with;
//   - the login itself: password, sessions, profile, deleting the account,
//     and leaving, transferring or deleting the organization - the client
//     must never find they are locked out of, or no longer own, their account;
//   - money: upgrading or cancelling the plan and topping up the wallet spend
//     the client's money. Plans and payments are set from the admin panel,
//     where they are recorded and verified.
//
// Reads are always allowed. Every change made in the view is logged with the
// admin who made it (see the auth middleware).

/** Path prefixes under /api that stay view-only, with what to call them. */
const VIEW_ONLY: readonly { prefix: string; area: string }[] = [
  // Inbox, on every channel.
  { prefix: '/api/inbox', area: 'inbox' },
  { prefix: '/api/instagram/send', area: 'inbox' },
  { prefix: '/api/telegram/send', area: 'inbox' },
  // The login and the ownership of the account.
  { prefix: '/api/auth', area: 'account' },
  { prefix: '/api/users', area: 'account' },
  // Money.
  { prefix: '/api/billing', area: 'billing' },
  { prefix: '/api/wallet', area: 'billing' },
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
  inbox: 'The inbox is view-only in the admin view. Replies go out in the client’s name, so only they can send them.',
  account: 'The client’s login, profile and ownership cannot be changed from the admin view.',
  billing: 'Plans and the wallet cannot be changed from the admin view. Record them from the admin panel.',
};
