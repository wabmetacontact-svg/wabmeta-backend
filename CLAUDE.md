# wabmeta-backend

Express + Prisma API for WabMeta. Part of the `wabmeta` DevMemory workspace,
alongside `wabmeta` (React web) and `wabmeta-mobile` (Expo).

## Session protocol

**Start every session with `handoff`.** It returns the current task, what the last
session did, the decisions that still bind you, and the recommended next step — so
you do not have to ask Sameer to re-explain the project.

```
project_connect  ->  handoff
```

**End every session with `session_end`,** with a summary of what you changed and
what is left. The next session reads it. A session that ends without this leaves
the next agent starting from nothing.

While working:

- `get_context` **before reading files.** It selects the files that matter for the
  task instead of you opening twenty to find three.
- `remember` any decision worth keeping — why a field is nullable, why a workaround
  exists, what an API constraint forced. If it took thinking to work out, it is
  worth a memory.
- `task_create` / `task_update` for anything spanning more than one session.

## Before you change a route

Nothing imports across a network boundary, so the type checker cannot see that the
web and mobile apps call this API. **277 calls in those two repositories resolve to
routes here.** Renaming a path, changing a method, or altering a response shape
breaks them with no compile error.

Run `impact_analysis` on the route file before editing it — it now lists the
cross-repository call sites by file and line. For one route:

```
api_contracts  scope: "wabmeta"  path: "inbox/conversations"
```

## Route prefixes live in app.ts

Every module's router is mounted in `src/app.ts`:

```ts
app.use('/api/templates', templatesRoutes);
```

The route files themselves write bare paths — `admin.routes.ts` declares
`router.get('/profile')`, which is served at `/api/admin/profile`. Searching for a
full URL will not find it. Search the suffix, or read the mount table first.

## Known: four client calls have no route here

Verified 2026-09-03 against every registered route:

| Call | Caller |
| --- | --- |
| `POST /api/inbox/conversations/:id/messages/:msgId/react` | WabMeta `src/pages/Inbox.tsx:890` |
| `PATCH /api/inbox/conversations/:id/messages/:msgId/star` | WabMeta `src/pages/Inbox.tsx:856` |
| `GET /api/chatbots/:id/stats` | wabmeta-mobile `src/services/api.ts:1000` |
| `GET /api/crm/pipelines/:id` | wabmeta-mobile `src/services/api.ts:1030` |

CRM serves `GET` and `POST /pipelines` but no `/pipelines/:id`. Do not silently
"fix" these by deleting the callers — ask which side is correct.

## meta.api.ts and whatsapp.api.ts talk to Facebook

Both build an axios client with `baseURL: https://graph.facebook.com/<version>`,
so their calls to `/me`, `/oauth/access_token` and `/${phoneNumberId}/messages` are
Graph API requests, **not** routes this backend serves. Never add local routes to
satisfy them.

## Shared types

`Template` is declared separately in all three repositories with nothing linking
them (here at `src/modules/meta/meta.types.ts:237`). Changing its shape means
changing all three, plus the Prisma schema and any migration that stores the field.
