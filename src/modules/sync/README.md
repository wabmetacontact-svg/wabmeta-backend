# Pushing to TeamOS

WabMeta owns the clients, the admin team that brought them in, and the money
received. TeamOS owns tasks, salaries, leave and performance. This module sends
the first set to the second, one way, and nothing comes back.

## Switching it on

Four environment variables, two of them required. With either of the required
ones missing the sync is simply off: the scheduler ticks, `runSync()` returns
immediately, and nothing is queued or sent.

| Variable | Required | What it does |
| --- | --- | --- |
| `TEAMOS_SYNC_URL` | yes | `https://team-os-coral.vercel.app/api/sync/wabmeta` |
| `TEAMOS_SYNC_SECRET` | yes | Shared with TeamOS's `WABMETA_SYNC_SECRET`. Every request is signed with it |
| `TEAMOS_SYNC_CLIENTS` | no | `owned` (default) mirrors only organizations an onboarder owns; `all` mirrors every one |
| `TEAMOS_SYNC_ENABLED` | no | Set to `false` to stop the sync without removing the credentials |

TeamOS needs two of its own, set in Vercel: `WABMETA_SYNC_SECRET` (the same
value) and `WABMETA_TENANT_ID` (which workspace to write into — find it with
`npm run db:tenants` in the TeamOS repo).

## How it works

```
scheduler, every minute
  └─ runSync()                     one advisory lock, so one instance at a time
       ├─ project()                reads AdminUser, Organization, Payment,
       │                           WalletTransaction, ManualPayment
       ├─ enqueue()                upserts one SyncEvent row per mirrored thing,
       │                           skipping anything whose fingerprint is unchanged
       └─ deliverDue()             POSTs batches of 100, signed, redirect: manual
                                     applied/unchanged -> DELIVERED
                                     failed + retry    -> backoff, try again
                                     failed, no retry  -> DEAD
```

### Why a projector rather than a hook at each write

There is no single place money is recorded in this codebase. A successful plan
payment is written in `billing.service.ts` *and* in `razorpay.routes.ts`,
refunds in `recordRefund`, wallet credits in `creditWalletAtomic`, offline
payments in `clientBilling.ts`, plus the webhook paths. Hooking each one is six
edits that all have to be remembered, and the seventh payment path somebody adds
next year would silently never reach TeamOS — nothing would fail, the money
would just be missing.

Reading the tables instead means a new payment path is picked up because it
writes to `Payment`, not because anybody remembered to call something. The cost
is that a change is seen on the next tick instead of instantly, which is seconds.

It also keeps this module out of `creditWalletAtomic`, the function that once
wrote seven credit rows for one payment and now carries a careful row lock.

### The fingerprint

`SyncEvent` holds **one row per mirrored thing**, not one per change, with a
sha256 of the payload. Re-reading every client every minute therefore costs one
comparison per client and no request. A change back to a previous state is still
noticed, because the comparison is against the last *sent* state, not against a
list of states ever seen.

### What counts as money

Exactly the three sources `receivedBetween()` in `modules/admin/revenue.ts`
counts, so the two never disagree:

| Source | Becomes | Category |
| --- | --- | --- |
| `Payment` SUCCESS/REFUNDED with a Razorpay id | entry **in**, full amount | WabMeta plan |
| `Payment.refundedAmount` > 0 | separate entry **out** | WabMeta refund |
| `WalletTransaction` credit, completed | entry **in** | WabMeta wallet |
| `ManualPayment` **VERIFIED only** | entry **in** | WabMeta offline |

A refund is its own entry rather than a smaller payment, so the ledger shows
both what arrived and what went back and the net is still right.

Offline payments are sent only once verified. A pending one can later be
rejected, and the contract has no way to retract an entry — it would sit in
TeamOS as money owed for good. Pending and rejected ones stay on WabMeta's own
Offline Payments screen.

## History

The cursor starts at *now* on the first run, so switching the sync on does not
push years of payments in one go. Clients and the team are sent in full
immediately (they are small); money flows from the moment it is enabled.

Earlier money goes over through the backfill, deliberately, a month at a time:

```bash
# see what would go, without sending anything
npm run teamos:backfill -- --from 2026-01-01

# send it
npm run teamos:backfill -- --from 2026-01-01 --apply
```

It pushes the team and the clients first, then walks the range oldest month
first — a historical payment names its client, and TeamOS holds any payment
whose client it has not been told about yet.

Its window is measured on **when the money arrived**, not on when the row was
last edited, so asking for January gives January. The live sync uses the other
measure (`by: 'changed'`), because a refund entered today against a March
payment has to go out today.

Safe to run twice, and safe to run while the scheduled sync is running: every
event is keyed on its row's own id, so the second one reports `unchanged`. If it
dies halfway, run the same command again.

## When something is wrong

`stats()` returns the queue, the oldest thing still waiting, and the last ten
errors. `reviveDead()` puts parked events back.

A 4xx other than 429 parks an event immediately rather than retrying ten times:
a wrong secret, a stale clock or a contract mismatch will not fix itself, and a
queue full of those hides the events that could still go out.

A redirect is a failure, never a success. TeamOS sits behind a sign-in gate
that, until it was fixed, answered every `/api` request with a 307 to its login
page — and `fetch` follows redirects by default, so that page would have come
back as a 200 and every payment would have been marked delivered. If
`lastError` says `redirected to …`, the URL is wrong or something is gating
`/api` again.

## The contract lives in two places

`sync.types.ts` here and `src/lib/wabmeta.ts` in TeamOS describe the same
events, and nothing links them. A field renamed on one side compiles cleanly on
the other and fails at runtime with a 400. Change both, together.
