# Signup flow: return users to the test they clicked

- **Date:** 2026-10-28
- **Status:** Implemented and tested locally, not committed. Testing on a real Android phone inside the Facebook app is still pending.
- **Repo:** RailJee (frontend)

## Why

The Meta ad sent about 154 mobile visitors to the home page and got 1 signup and 0 tests started. Every exam requires login (by design; see `../../../PARKED_ISSUES.md`), so the signup and sign-in path decides whether an ad visitor ever reaches a test.

## Problems

1. The middleware keeps only the path when it redirects to sign-in, so `?dept=` is lost (`src/middleware.ts:47`). Without it, the exam page tries up to 11 departments one after another.
2. The sign-in page's Google callback URL doesn't encode `redirect` (`src/app/auth/signin/page.tsx:54`).
3. The links between sign-in and sign-up drop `redirect`.
4. Sign-up ignores `?redirect=` in all three places it sends the user on:
   - the email confirmation link
   - the Google callback URL
   - the "OK" button after signup, which goes to `/auth/signin`
5. Open redirect: the callback follows any URL, including other websites (`src/app/auth/callback/route.ts:35`).
6. Google blocks OAuth inside the Facebook/Instagram in-app browser (`disallowed_useragent`). Most ad traffic is Android inside the Facebook app.

## Changes

| File | Change |
|---|---|
| `src/lib/safeRedirect.ts` (new) | `getSafeRedirect(value)`: returns the value only if it is a same-site path (starts with `/`, not `//` or `/\`); otherwise `/`. |
| `src/lib/inAppBrowser.ts` (new) | `isInAppBrowser(ua)` checks for `FBAN\|FBAV\|FB_IAB\|Instagram`. `chromeIntentUrl(url)` builds an Android intent link that opens Chrome. |
| `src/components/auth/GoogleAuthButton.tsx` (new) | The shared Google button (it was duplicated in both pages). In a Facebook/Instagram in-app browser it shows "Open in Chrome" on Android, or an "Open in browser" hint on iOS. |
| `src/middleware.ts` | The redirect keeps `pathname + search`. A user who is already signed in and opens an auth page goes to the safe `redirect` instead of `/`. |
| `src/app/auth/callback/route.ts` | Uses `getSafeRedirect`. On error it keeps `redirect` on the sign-in URL. |
| `src/app/auth/signin/page.tsx` | Uses `getSafeRedirect` and an encoded redirect in the Google URL. The sign-up link keeps `redirect`. On `?error=callback_error` it shows: "We couldn't finish signing you in. If you just confirmed your email, it's confirmed." |
| `src/app/auth/signup/page.tsx` | Reads `redirect` and passes it to the email confirmation link, the Google URL and the "OK" button. The sign-in link keeps `redirect`. |

## Out of scope

- The Meta Pixel and the `CompleteRegistration` event, which another session owns.
- Logged-out exam access, which is parked.

## Risks

- Supabase's allowed redirect URLs must accept `/auth/callback?redirect=...`. The sign-in page already uses this form, so it should already be allowed.
- An email confirmation opened in a different browser can't complete the code exchange, because Supabase's default (PKCE) flow needs the browser that started the signup. The email is still confirmed. The user lands on `/auth/signin?error=callback_error`, which now shows a friendly message.

## Testing

- Run `npx tsc --noEmit` and `npm run lint`.
- On the local dev server:
  - Logged out, open `/exam/<id>?dept=civil` and check that the sign-in URL keeps the full redirect.
  - Switch between sign-in and sign-up and check that `redirect` is kept.
  - Open `/auth/callback?redirect=https://evil.com` and check that it lands on `/`.
  - Spoof a Facebook user agent and check that the Google button is replaced.
- On the deploy preview, test with a real Android phone inside the Facebook app. The user does this.
