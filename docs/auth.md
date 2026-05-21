# Auth Coding Standards

## Stack

This app uses **Clerk** for authentication. Do not introduce any other auth library.

- **Frontend**: `@clerk/clerk-react`
- **Backend**: `@clerk/backend` (token verification only)

---

## Frontend setup

`ClerkProvider` is mounted once in `src/main.tsx`, wrapping the entire tree. Do not add it anywhere else.

```tsx
// src/main.tsx
import { ClerkProvider } from '@clerk/clerk-react'

<ClerkProvider publishableKey={VITE_CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
  ...
</ClerkProvider>
```

A custom `AuthProvider` (`src/context/AuthContext.tsx`) sits inside `App` and handles:
- Syncing the signed-in Clerk user to the backend DB on mount (`POST /api/auth/sync`)
- Storing the linked partner in React context
- Exposing `linkUser(username)` for the partner-linking flow

```tsx
// src/App.tsx
<AuthProvider>
  ...
</AuthProvider>
```

**Important:** `AuthProvider` is not the same as Clerk's provider. It is the app's own context for partner state. Do not confuse them.

---

## Getting a token (frontend)

Use `useAuth()` from `@clerk/clerk-react` to obtain a short-lived JWT for every API call:

```ts
import { useAuth } from '@clerk/clerk-react'

const { getToken, isSignedIn } = useAuth()

const token = await getToken()
if (!token) throw new Error('Not authenticated')
```

- Call `getToken()` fresh inside each query or mutation function. Do not cache or store the token in state.
- Check `isSignedIn` before triggering data queries (see data-fetching.md).

---

## Auth state (frontend)

| Hook / Component | Import from | Purpose |
|---|---|---|
| `useUser()` | `@clerk/clerk-react` | Full `User` object, `isSignedIn`, `isLoaded` |
| `useAuth()` | `@clerk/clerk-react` | `getToken()`, `isSignedIn` |
| `useAuth()` | `src/context/AuthContext` | Partner state, `linkUser()` — app-specific |
| `<SignInButton>` / `<SignUpButton>` | `@clerk/clerk-react` | Trigger Clerk-hosted auth modal |
| `<UserButton>` | `@clerk/clerk-react` | Avatar/account dropdown |

Do not build custom sign-in or sign-up forms.

---

## Backend — token verification

Every protected route uses the `requireAuth` middleware from `backend/src/middleware/auth.ts`.

```ts
import { verifyToken } from '@clerk/backend'

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.slice(7) // strip 'Bearer '
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }

  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    req.clerkUserId = payload.sub  // Clerk's stable user ID
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

After `requireAuth`, the user's ID is always available as `req.clerkUserId`. Never read an ID from the request body, URL params, or query string.

---

## Backend — user sync

On first sign-in the frontend calls `POST /api/auth/sync`. The backend fetches the canonical user record **from Clerk's API** (not from the request body) and upserts it into the database:

```ts
const clerkUser = await clerk.users.getUser(req.clerkUserId!)
// derive username / email from clerkUser, then upsert
```

This ensures the local DB record always reflects Clerk's authoritative data.

---

## Explicitly prohibited

| Prohibited | Why |
|---|---|
| Any auth library other than Clerk | One auth provider only |
| Storing `getToken()` result in component state | Tokens expire; call `getToken()` fresh per request |
| Reading `userId` from request body, params, or query string | Client input is attacker-controlled |
| Custom sign-in/sign-up forms | Use Clerk's built-in UI |
| Calling `/api/auth/sync` from a route without `requireAuth` | User data must only be written for verified callers |
