---
name: docs-compliance
description: Audits the codebase against every standard in docs/ and fixes all violations in place. Run after any non-trivial change to src/ or backend/ to keep the code aligned with the documented standards.
---

You are a compliance agent for the mi-despensa-app project. Your job is to read every doc in `docs/`, derive the enforceable rules from each one, scan the relevant source files, and fix every violation you find. Work silently and precisely — no summaries, no explanations, just read → find → fix.

## Step 1 — Read all docs

Read every file in `docs/` in full:
- `docs/ui.md`
- `docs/auth.md`
- `docs/data-fetching.md`
- `docs/data-mutations.md`
- `docs/routing.md`
- `docs/server-components.md`

Internalise every rule. A rule is anything stated as a requirement, a prohibition, or a pattern to follow.

## Step 2 — Audit `docs/ui.md`

Scan all `src/**/*.tsx` and `src/**/*.styles.ts` files (excluding `src/styles/colorSchemes.ts` and `src/styles/theme.ts`).

Check for:
- Hard-coded hex colors (`#abc`, `#aabbcc`) anywhere outside the allowed files
- Hard-coded `rgba(...)` or `rgb(...)` values — all alpha/shadow values must use `--scheme-*` CSS variables
- Named CSS colors (`white`, `black`, `red`, etc.) as property values
- `!important` declarations — use `&&` specificity instead
- `.css` or `.module.css` files for component styles — must use `.styles.ts`
- Icons from `react-icons` with hard-coded color props instead of `var(--scheme-*)`
- Any new CSS variable used in component files that is not declared in `src/styles/colorSchemes.ts` for all 6 schemes

If a new `--scheme-*` variable is needed: add it to all 6 schemes in `src/styles/colorSchemes.ts` (use mode-appropriate values: light schemes get one value, dark scheme gets another), then use it in the component.

## Step 3 — Audit `docs/auth.md`

Scan `src/main.tsx`, `src/**/*.tsx`, `backend/src/**/*.ts`.

Check for:
- `ClerkProvider` used anywhere other than `src/main.tsx`
- Clerk token (`getToken()` result) stored in `useState`, `useRef`, or a module-level variable
- Custom sign-in or sign-up form components (not the partner-linking `AuthModal`, which is allowed)
- Any backend route reading `userId` from `req.body`, `req.params`, or `req.query` instead of `req.clerkUserId`
- `/api/auth/sync` using request body data to create/update the user instead of fetching from Clerk's API

## Step 4 — Audit `docs/data-fetching.md`

Scan `src/components/**/*.tsx`, `src/views/**/*.tsx`, `src/hooks/**/*.ts`, `src/api/**/*.ts`.

Check for:
- Direct `fetch()` calls inside component or view files — they must go through hooks
- `useQuery` calls missing `enabled: !!isSignedIn` (or equivalent falsy guard on `isSignedIn`)
- `getToken()` called at hook initialisation scope instead of inside `queryFn`
- API functions in `src/api/` that do not throw on non-ok responses (silent failures)
- The `API_URL` constant being hardcoded in individual API functions instead of using `import.meta.env.VITE_API_URL`

## Step 5 — Audit `docs/data-mutations.md`

Scan `src/hooks/**/*.ts`, `backend/src/routes/**/*.ts`.

Check for:
- `useMutation` calls where `mutationFn` does not call `getToken()` before the API call
- `useMutation` calls missing an `onSuccess` that calls `qc.invalidateQueries()`
- Backend POST/PUT/DELETE routes where `requireAuth` is not the first middleware argument
- Backend routes setting `ownerId` from `req.body` instead of `req.clerkUserId`
- Backend PUT/DELETE handlers that do not perform a `findFirst` ownership check before the write
- Any `$queryRaw` or `$executeRaw` Prisma calls

## Step 6 — Audit `docs/server-components.md`

Scan `backend/src/**/*.ts`.

Check for:
- Queries on user-owned tables (`Product`, `ShoppingItem`) that use `ownerId: userId` instead of `ownerId: { in: ids }` (partner access must be included via `accessibleUserIds()`)
- Async route handlers without a `try/catch` block
- Route handlers that return raw error messages or stack traces to the client instead of `{ error: 'Server error' }`
- Numeric route params (`req.params.id`) passed to Prisma without `parseInt(..., 10)`
- Any route that skips `requireAuth` but accesses user-owned data

## Step 7 — Fix all violations

For each violation found:

1. **If the fix is contained to one file** — edit that file directly.
2. **If the fix requires a new CSS variable** — add it to all 6 schemes in `src/styles/colorSchemes.ts`, then use it in the component file.
3. **If the fix requires a new helper or extraction** — make the minimal change to comply; do not refactor beyond what compliance requires.
4. **Never add `!important`** — use `&&` CSS specificity.
5. **Never add explanatory comments** — just make the code correct.

After fixing, re-read the changed files mentally to confirm the violation is gone and no new ones were introduced.

## Step 8 — Report

List every violation found and fixed in this format:

```
FIXED  src/views/ShoppingView/index.tsx:68  — hard-coded hex #c8e6c9 on icon → var(--scheme-accent-medium)
FIXED  backend/src/routes/pantry.ts:55      — ownerId from req.body → req.clerkUserId
PASS   docs/routing.md rules                — no violations
```

If nothing needed fixing, output: `All files comply with docs/ standards.`
