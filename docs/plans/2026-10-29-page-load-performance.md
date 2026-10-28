# Page load performance on slow mobile connections

- **Date:** 2026-10-29
- **Status:** Implemented. Checked on the dev server; font preloads only show in a production build.
- **Repo:** RailJee (frontend)

## Why

Ad visitors are mostly on Android with mobile data. The root layout (`src/app/layout.tsx`) makes every page download things only one or two pages need.

## Problems

1. **The Razorpay checkout script loads on every page** (`layout.tsx:50`). It pulls in several third-party hosts, but only `SubscriptionPageClient` uses `window.Razorpay`.
2. **The home hero image (`/images/vande_bharat_01.avif`, 37 KB) is preloaded on every route** (`layout.tsx:48`), although only `components/home/Hero.tsx` shows it.
3. **All three fonts are preloaded on every page.** `next/font` preloads each font declared in the layout by default.
   - Plus Jakarta Sans is the body font, so it stays preloaded.
   - Geist is only used by shadcn headings (`font-heading`, `font-sans`).
   - Tiro Devanagari Hindi (normal and italic) is only used by `.font-hindi` on the exam question screen.

## Changes

| File | Change |
|---|---|
| `src/app/layout.tsx` | Remove the Razorpay `<script>` and the hero image preload. Set `preload: false` on Geist and Tiro Devanagari Hindi; the browser still downloads them on the pages that use them. The logo preload stays, because the logo shows on every page. |
| `src/app/subscription/page.tsx` | Load Razorpay there with `next/script` (`strategy="afterInteractive"`), so it's ready before the user clicks Subscribe. |
| `src/components/home/Hero.tsx` | Preload the hero image from the home page only, with React 19's `preload()` from `react-dom`, and give the `<img>` `fetchPriority="high"`. |

Nothing changes visually. Fonts, images and the payment flow stay the same.

## Out of scope

- Converting `<img>` to `next/image`. Images are `unoptimized: true` in `next.config.ts`, so it would gain little.
- Removing Geist entirely, which would change how shadcn headings look.

## Risks

- If someone clicks Subscribe before the script finishes loading, they get the existing "Razorpay SDK not loaded" error. `afterInteractive` starts the download as soon as the page hydrates, and the plans load from the API in parallel, so this is unlikely.
- A Hindi question may show a fallback serif font for a moment before Tiro loads (`display: swap`).

## Testing

- Run `npx tsc --noEmit` and lint.
- On the dev server, check in the network list that:
  - `/` loads the hero image and doesn't load `checkout.razorpay.com`.
  - `/departments` loads neither.
  - `/subscription` loads `checkout.razorpay.com` and has `window.Razorpay` defined.
