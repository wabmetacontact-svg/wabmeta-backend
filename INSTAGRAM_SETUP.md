# Instagram DM — Meta setup (step by step)

Goal: connect an Instagram Professional account so DMs arrive in the WabMeta unified
inbox and you can reply. Do this in the [Meta Developer dashboard](https://developers.facebook.com/apps).

The app code is ready — this is the one-time Meta configuration.

---

## 0. Prerequisites

- A **Facebook Page** (create one if you don't have it).
- An **Instagram Professional account** (Business or Creator) — in the Instagram app:
  Settings → *Account type and tools* → *Switch to professional account*.
- **Link** the Instagram account to the Facebook Page:
  Facebook Page → Settings → *Linked accounts* → Instagram → connect.
- Your Meta app (you already have `META_APP_ID` / `META_APP_SECRET`).
- The local backend + ngrok running (the tunnel URL below).

> ngrok URL right now: `https://pericemental-degradingly-mike.ngrok-free.dev`
> (If ngrok restarts, this changes — redo step 3 with the new URL.)

---

## 1. Add the Instagram product to your Meta app

1. developers.facebook.com → your app.
2. Left menu → **Add product** → **Instagram** → *Set up*.
3. Under **Instagram → API setup with Instagram login** (or *Facebook login for Business*),
   follow the prompts to connect your Instagram Professional account.

## 2. Permissions

In **App review → Permissions and features**, request/enable (Standard access is fine for
dev-mode testing with app roles):

- `instagram_basic`
- `instagram_manage_messages`   ← the important one for DMs
- `pages_manage_metadata`
- `pages_read_engagement`

In dev mode you don't need full App Review — just add yourself and the sender as **testers**
(App roles → Roles → add Instagram testers; accept the invite in the Instagram app under
Settings → Apps and websites → Tester invites).

## 3. Subscribe the Instagram webhook

App → **Webhooks** (or Instagram → Webhooks) → *Instagram*:

- **Callback URL:** `https://pericemental-degradingly-mike.ngrok-free.dev/api/webhooks/instagram`
- **Verify token:** `wabmeta_webhook_verify_2024`
  (or whatever `META_VERIFY_TOKEN` is set to in the backend `.env`)
- Click **Verify and save** (the backend answers the GET challenge automatically).
- **Subscribe** to the **`messages`** field (also `messaging_postbacks` if you want button taps).

Then, on the Page/IG object, make sure the app is **subscribed** to the Instagram account
(Messenger/Instagram → *Webhooks* → add subscription for the connected IG account).

## 4. Connect the account in WabMeta

1. Get a long-lived **access token** for the IG account (from step 1's flow, or Graph API
   Explorer with the permissions above).
2. WabMeta → **Channels → Instagram → Settings** → connect (the connect flow calls
   `POST /api/instagram/connect` and stores the account).

## 5. Test

1. From **another** Instagram account, send a DM to your connected IG account.
2. It appears live in **WabMeta → Inbox** with an Instagram badge.
3. Reply from the inbox → the reply is delivered on Instagram.

---

## Troubleshooting

- **Webhook verify fails:** the verify token must match `META_VERIFY_TOKEN` (default
  `wabmeta_webhook_verify_2024`), and the backend + ngrok must be running.
- **DM doesn't appear:** confirm the `messages` field is subscribed *and* the app is
  subscribed to that IG account; check the backend logs for `Instagram webhook`.
- **Reply fails:** the stored access token must have `instagram_manage_messages` and not be
  expired; Instagram only allows replies within the 24-hour messaging window (or after a
  user-initiated message).
- **24-hour window:** like WhatsApp, you can freely reply within 24h of the user's last
  message; outside that, only specific message tags are allowed.
