# mi-despensa-app

PWA for managing a household pantry: inventory, shopping list, expiration notifications.

## Stack

- **Frontend**: React 18 + TypeScript + Vite 5, PWA via `vite-plugin-pwa`.
- **UI**: MUI v5 + styled-components v6 (`.styles.ts` files, no `.css`/`.module.css`).
- **Server state**: React Query (`@tanstack/react-query`).
- **Auth**: Clerk (`@clerk/clerk-react` on the frontend, `@clerk/backend` on the backend).
- **i18n**: i18next / react-i18next.
- **Maps**: MapLibre GL + react-map-gl (nearby supermarket search).
- **Backend**: Express + TypeScript, Prisma 5 (`backend/prisma/schema.prisma`).
- **Deploy**: Vercel (`api/` is the serverless entry point that wraps `backend/`).

No ESLint is configured in this repo. Tests (Vitest, frontend and backend) and CI (`.github/workflows/ci.yml`) **are** configured — don't assume otherwise.

## Environment variables

- Frontend (`VITE_*`, see `vite.config.ts` / `.env`): `VITE_API_URL`, Clerk public keys.
- Backend: Clerk private keys, `DATABASE_URL` (Prisma), VAPID keys (web push), Resend credentials (email).

Never hardcode URLs, keys, or secrets — always via `import.meta.env.*` (frontend) or `process.env.*` (backend).

## Service worker

`src/sw.ts` is the source of the service worker (`vite-plugin-pwa`, `injectManifest` mode) — handles push and `notificationclick`. Touching caching or push handling there has a direct impact in production (users with an old cached version); changes there need more care than a normal component.

## Structure

```
src/
  components/<Name>/       reusable components
  views/<Name>/            views (pantry, shopping, about), with nested subcomponents
  hooks/                   all fetching/mutation logic lives here
  api/                     one file per domain (pantryApi.ts, authApi.ts, ...)
  context(s)/              React contexts
  styles/                  colorSchemes.ts (6 schemes), theme.ts
  i18n/locales/
  utils/
  data/
backend/src/
  app.ts, index.ts
  db/                      Prisma client
  middleware/              auth.ts (Clerk verification)
  routes/                  auth.ts, notifications.ts, pantry.ts
  services/                email.ts, webpush.ts
docs/                      per-layer convention specs (see below)
```

## Commands

- `npm run dev` — runs frontend (Vite) and backend (Express) together via `concurrently`.
- `npm run build` — `prisma generate` + `vite build`.
- `npm run type-check` — `tsc --noEmit`.
- `npm run format` — prettier over `src/`.

Development environment: Windows, PowerShell.

## Code conventions

Detailed, actionable per-layer rules live in `docs/` — read them before assuming a pattern:

- `docs/ui.md` — styles, colors, schemes
- `docs/auth.md` — Clerk, where `ClerkProvider` goes, how the user is identified
- `docs/data-fetching.md` — hooks, React Query, `enabled: !!isSignedIn`
- `docs/data-mutations.md` — `useMutation`, query invalidation, ownership on the backend
- `docs/routing.md` — no router, navigation is view-state
- `docs/server-components.md` — structure and conventions of the Express/Prisma backend

Summary of the most important points:
- No React Router or any URL router — the active view is a string union in `useAppState`.
- Components never call `fetch()` directly; everything goes through hooks in `src/hooks/` + `src/api/`.
- Every user-data query goes with `enabled: !!isSignedIn`.
- The backend identifies the user via `req.clerkUserId` (never from body/params/query), and does an ownership check before writing.
- Colors: CSS variables `--scheme-*` defined in `src/styles/colorSchemes.ts` for the 6 schemes — never hardcoded hex/rgb in components.

## Guest mode

A pattern not covered in `docs/` but real and non-trivial — before touching `useGuestStorage`, `useGuestMigration`, or `AuthContext`:
- A signed-out user can use the app with data in `localStorage` (`src/utils/migrations.ts` migrates ES→EN keys from old versions).
- On sign-in, that data gets migrated to the server. The migration uses `Promise.allSettled` (not `Promise.all`) so one failing item doesn't take down the rest, and surfaces the error explicitly instead of swallowing it.
- React Query query keys must stay stable between guest and signed-in state so the cache doesn't end up inconsistent during/after migration.

## README maintenance

There's no automatic hook that updates the README on every edit (removed for cost reasons). When you want a pass, explicitly use `/update-readme`.

## Roadmap

`ROADMAP.md` (root) has the technical detail of everything that's planned but not implemented (data models, endpoints, open decisions). `README.md` has the product-facing version (checklist per version). Before proposing a new feature or an architecture decision, check whether it's already covered there.

## Git

Never run `git push` (neither on `main` nor on a branch) without it being explicitly requested at that moment — not even as part of another command (see `/merge-and-create-branch`, which commits/merges/creates a branch but doesn't push).

## Don't add tooling on your own initiative

No ESLint is configured. Don't add ESLint, and don't change the formatter, the test runner (Vitest), or the CI config (`.github/workflows/ci.yml`) unless explicitly asked — even if it seems like an obvious improvement. This does **not** apply to regular npm libraries/dependencies: adding those is fine without asking first.
