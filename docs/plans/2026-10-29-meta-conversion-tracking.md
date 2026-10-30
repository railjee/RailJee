# Meta conversion tracking (Pixel + Conversions API)

- **Date:** 2026-10-29
- **Status:** Phase 1 implemented: `src/lib/metaTracking.ts` added; `MetaPixel.tsx` now imports the `FbqFunction` type from it (no behaviour change). Type check and lint pass; the helper logic passed a 15-case Node test with fake cookies. Not committed. Phases 2–4 not started.
- **Repos:** RailJee (frontend) and railji-backend (API). This doc is the single plan for both; railji-backend gets a pointer doc in Phase 2.
- **Pixel ID:** 1798627321470498

## Why

We are relaunching Meta ads in about two days and need conversion data Meta can optimise on. Today:

- PageView double-counts client-side navigations: our effect fires one, and `fbevents.js` fires another on `history.pushState`. Query-string changes (filters, `?dept=`) also count as page views.
- `CompleteRegistration` fires only from the browser, only for email signup, and even when the API answered 200 (existing user). Google signup is not tracked at all.
- No `ViewContent`, `InitiateCheckout` or `Purchase` events.
- UTM parameters, `fbclid`, `_fbp` and `_fbc` are not stored, so a signup can't be tied back to a campaign, ad set or ad.
- Our own testing (admin, test accounts, our Windows browsers) is mixed into real data.
- The Google signup reaches POST /users from the Next.js server, so the API sees user agent `node` and no client IP.

## Target event set

| Event | Browser (Pixel) | Server (Conversions API) | event_id (dedupe key) |
|---|---|---|---|
| PageView | every pathname change | — | — |
| ViewContent | paper / mock test opened | — | — |
| CompleteRegistration | after a 201 from POST /users | on 201 from POST /users | `reg-<supabaseId>` |
| InitiateCheckout | after the order is created | on POST /payments/order | Razorpay order id |
| Purchase | — | Razorpay `payment.captured` webhook | Razorpay payment id |

Meta dedupes a browser and server event with the same `event_name` + `event_id` (within 48 hours), so each conversion counts once while still getting the better match quality of the server copy.

## Key findings that shape the design

- **App Router** (Next 15). The Pixel loads in `src/components/MetaPixel.tsx` from the root layout.
- **Email signup calls POST /users from the browser** (`src/app/auth/signup/page.tsx` → `syncUserProfile` in `src/lib/api.ts`). Only **Google** goes through the Next.js server (`src/app/auth/callback/route.ts`). The callback also runs for every Google sign-in and every email confirmation link, which get 200; the 201-only rule handles both.
- **POST /users is public** (`AUTH_EXCLUDED_ROUTES`). Forwarded client IP/UA headers can only be trusted with a shared secret.
- **The backend `ValidationPipe` uses `forbidNonWhitelisted: true`.** If the frontend sends new fields before the backend DTO accepts them, every signup fails with 400. **Deploy the backend first.**
- **MongoDB/Mongoose**: adding optional schema fields needs no migration.
- Razorpay order `notes` already carry `userId`, `planId`, `departmentId` and `price`. `PaymentTransaction` already has unused `ipAddress` / `userAgent` fields.
- **Secrets in logs:** `main.ts` logs the whole config at startup (Mongo URI, JWT secret, Razorpay key secret and webhook secret). The webhook controller logs the full Razorpay body (customer email, phone) and the signature. Both are fixed in Phase 2; the already-logged secrets should be rotated.
- **Graph API version:** v26.0 is current (released 2026-07-29). Default to it, overridable by env.

## Phases

### Phase 1 — Frontend helper module (RailJee)

| File | Change |
|---|---|
| `src/lib/metaTracking.ts` (new) | Dependency-free helper used by the rest of the site and by the CCTS landing page session. |

Exports:

- `initPixel()`: loads the Pixel once, sets `fbq.disablePushState = true` (stops Meta's own SPA PageView), returns `false` when tracking is off.
- `trackPageView()`, `trackEvent(name, params?, eventId?)`, `trackViewContent({ contentIds, contentType?, contentCategory?, contentName? })`.
- Internal traffic: `isInternal()`, `applyInternalFlagFromUrl()`. `?rj_internal=1` on any URL sets a 1-year `rj_internal` cookie; `?rj_internal=0` clears it. `NEXT_PUBLIC_TRACKING_DISABLED=true` turns tracking off for a whole build (local, deploy previews).
- Attribution: `captureAttribution()` stores `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `utm_id`, `fbclid`, `fbc`, landing path and first-seen time in a 90-day first-party cookie `rj_attr`. UTMs are first-touch; a new `fbclid` refreshes `fbclid`/`fbc` (Meta wants the latest click). `getAttribution()` returns it merged with the live `_fbp`/`_fbc` cookies. `parseAttributionCookie()` works on the server (for the OAuth callback).
- Registration dedupe: `registrationEventId(supabaseId)`, `firePendingRegistration()` (reads the short-lived `rj_reg` cookie the OAuth callback will set, fires the browser copy, deletes the cookie).

### Phase 2 — Backend (railji-backend) — deploy before Phase 3

| File | Change |
|---|---|
| `apps/railji-business/src/modules/meta/meta-capi.service.ts` (new) | Builds and sends Conversions API events: SHA-256 of normalised email and external_id, fire-and-forget POST with `AbortSignal.timeout`, never throws, one structured log line per send. Skips internal traffic. |
| `apps/railji-business/src/modules/meta/meta.module.ts` (new) | Provides the service. |
| `apps/railji-business/src/modules/meta/client-context.ts` (new) | Client IP/UA: trusted forwarded headers (only with the shared secret) → `X-Forwarded-For` → socket. |
| `apps/railji-business/src/config/config.ts`, `.env.example` | `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE`, `META_GRAPH_API_VERSION`, `INTERNAL_FORWARD_SECRET`, `INTERNAL_EMAILS`. |
| `libs/shared/src/schemas/user.schema.ts` | Optional `attribution` subdocument and `authProvider`. |
| `apps/railji-business/src/modules/users/dto/create-user.dto.ts` | Optional `attribution`, `authProvider`, `internal`. |
| `apps/railji-business/src/modules/users/users.controller.ts`, `users.service.ts` | Save attribution on create only. On 201: CompleteRegistration + `signup` log line with `auth_provider`. |
| `apps/railji-business/src/payments/...` | Order: store IP/UA/fbp/fbc on the transaction, send InitiateCheckout. Webhook `payment.captured`: send Purchase (value, INR, event_id = payment id). Masked ids in logs; remove the PII/signature logs. |
| `apps/railji-business/src/main.ts` | Stop logging the config. |

Internal exclusion on the server: request flagged `internal`, email in `INTERNAL_EMAILS`, or `userType` admin/superadmin.

### Phase 3 — Frontend wiring (RailJee)

| File | Change |
|---|---|
| `src/components/MetaPixel.tsx` | Use the helper; PageView on pathname change only; capture attribution; fire pending registration. Drop the sessionStorage queue (the fbq stub queues for us). |
| `src/lib/api.ts` | `syncUserProfile` sends attribution, `authProvider`, `internal`; returns `created`; accepts forwarded client headers. |
| `src/app/auth/signup/page.tsx` | Browser CompleteRegistration only when `created`, with `registrationEventId`. |
| `src/app/auth/callback/route.ts` | Read `rj_attr`/`rj_internal` cookies and client IP/UA, forward with the secret header; on 201 set `rj_reg`. |
| `src/components/ExamPageClient.tsx` | `trackViewContent` once per exam after the exam loads. |
| `src/components/subscription/SubscriptionPageClient.tsx` | Send fbp/fbc with the order; browser InitiateCheckout with the order id as eventID. |

### Phase 4 — Manual checklist

Env vars (Netlify + EC2), how to verify each event in Events Manager → Test events, and the infra changes the user makes (nginx `$request_time` and `$host`, CloudWatch retention 30–90 days, rotating leaked secrets).

## Out of scope

- Consent banner / regional consent mode (not required for the current India-only audience; revisit if targeting changes).
- Fixing the double access grant (both `/payments/verify` and the webhook grant access).
- Lead, Subscribe or custom events beyond the table above.
- The CCTS landing page itself (another session; it only imports the helper).

## Risks

- **Deploy order:** frontend Phase 3 before backend Phase 2 breaks signup (400). Mitigation: deploy backend first; Phase 3 sends new fields only after Phase 2 is live.
- **Cookie size:** long campaign names. Each value is truncated to 200 characters.
- **Ad blockers** block the Pixel; the server copies still arrive for registration and purchase.
- **Spoofed headers on the public POST /users:** forwarded IP/UA are honoured only with `INTERNAL_FORWARD_SECRET`.
- **Meta token leakage:** stays in env only; the config is no longer logged.

## Testing

- Phase 1: `npx tsc --noEmit`, `npm run lint`; on the dev server, with `?utm_source=fb&fbclid=test123`, check the `rj_attr` cookie, that `?rj_internal=1` stops the Pixel request, and that client-side navigation sends one PageView (Network tab, `facebook.com/tr`).
- Phases 2–3: Events Manager → Test events with `META_TEST_EVENT_CODE`; see the Phase 4 checklist.
