# Small fixes: department links and stats sign-in

- **Date:** 2026-10-29
- **Status:** Implemented. Type check passes; checked on the dev server.
- **Repo:** RailJee (frontend). The backend's small fixes have their own plan in `railji-backend/docs/plans/2026-10-29-small-fixes.md`.

## Problems

1. **The footer's "Civil" link goes to `/departments/civil-engineering`** (`src/components/home/Footer.tsx:58`). The real slug is `civil`, so the page can't find the department.
2. **`generateStaticParams` for `/departments/[deptId]` lists outdated slugs** (`civil-engineering`, `others`) and misses legal, medical, security and stores. Pages for missing slugs still render on demand, because `dynamicParams` defaults to true. Only the pre-built list is wrong.
3. **The stats page's sign-in button pushes to `/login`**, which doesn't exist (`src/app/stats/page.tsx:212`). It also loses the way back to stats.

## Changes

| File | Change |
|---|---|
| `src/components/home/Footer.tsx` | Change `civil-engineering` to `civil`. |
| `src/app/departments/[deptId]/generateStaticParams.ts` | Use the 11 slugs returned by `GET /business/v1/departments`: civil, commercial, electrical, legal, mechanical, medical, operating, personnel, security, signal-telecom, stores. |
| `src/app/stats/page.tsx` | Go to `/auth/signin?redirect=/stats`. |

## Testing

- Run `npx tsc --noEmit` and lint.
- On the dev server, check that:
  - the footer's Civil link opens the Civil department;
  - logged out, `/stats` with "Sign in" opens `/auth/signin?redirect=%2Fstats`.
