# RailJee frontend

Next.js 15 App Router site, hosted on Netlify, with Supabase auth. It talks to the NestJS API at `https://api.railjee.in/business/v1/` (repo `railji-backend`).

## Rules

- **Write a plan doc first.** Before implementing any change, however small, write a plan in `docs/plans/YYYY-MM-DD-<topic>.md`. Cover: why, what changes (file by file), what's out of scope, risks, and how to test. Implement only after the plan exists, and update its status when the work is done.
- Keep changes small and readable, and match the surrounding code.
- Every exam requires a logged-in user, free papers included. Don't add logged-out exam access. The parked issues are in `../PARKED_ISSUES.md`.
