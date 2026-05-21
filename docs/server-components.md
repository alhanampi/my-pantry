# Express Backend

## Structure

```
backend/src/
  index.ts          # entry point — starts HTTP server, validates env vars
  app.ts            # Express app setup (middleware, routes)
  middleware/
    auth.ts         # requireAuth middleware
  routes/
    auth.ts         # /api/auth/* (sync, me, link)
    pantry.ts       # /api/pantry/* (products, shopping)
  db/
    index.ts        # Prisma client singleton
```

---

## App setup (`app.ts`)

The Express app applies these middleware in order, before any routes:

| Middleware | Purpose |
|---|---|
| `helmet()` | Sets secure HTTP headers |
| `cors(...)` | Allows only `FRONTEND_ORIGIN` (or `localhost:5173` in dev) |
| `express.json({ limit: '10kb' })` | Parses JSON bodies, capped at 10 KB |
| `rateLimit(...)` | 60 requests / 15 min — applied to `/api/auth` only |

Do not remove or weaken any of these.

---

## Route pattern

Every route handler follows this structure:

```ts
router.post('/resource', requireAuth, validationRules, async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return
  }

  try {
    const userId = req.clerkUserId!  // set by requireAuth
    // ... Prisma query
    res.json({ result })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})
```

Order always: **auth middleware → validation rules → handler**.

---

## Auth middleware

`requireAuth` (`backend/src/middleware/auth.ts`) verifies the `Authorization: Bearer <token>` header using Clerk's `verifyToken()` and stores the verified user ID on `req.clerkUserId`.

- **Never read `userId` from `req.body`, `req.params`, or `req.query`.**
- After `requireAuth`, `req.clerkUserId` is always a non-null string — use `req.clerkUserId!`.

---

## Input validation

Use `express-validator` for all mutating routes. Define rule arrays separately and pass them to the route before the handler:

```ts
const productFields = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('quantity').optional().isString(),
  // ...
]

router.post('/products', requireAuth, productFields, async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return
  }
  // ...
})
```

---

## Database access

Use the Prisma singleton from `backend/src/db/index.ts`. Import it as `prisma`.

- All queries use Prisma's query builder — no `$queryRaw` or `$executeRaw`.
- All user-owned data queries scope by `ownerId: { in: accessibleUserIds(userId) }`.
- Parse URL numeric IDs with `parseInt(req.params.id, 10)` before passing to Prisma.

### `accessibleUserIds(userId)`

Defined in `backend/src/routes/pantry.ts`. Returns an array of user IDs whose data the caller may access: the caller's own ID plus their linked partner's ID (if any). Always call this before querying or mutating user-owned resources.

---

## Ownership verification for mutations

Before updating or deleting a record, verify ownership with a `findFirst` using the accessible IDs. Return `404` if not found:

```ts
const ids = await accessibleUserIds(userId)
const existing = await prisma.product.findFirst({
  where: { id: productId, ownerId: { in: ids } },
})
if (!existing) { res.status(404).json({ error: 'Not found' }); return }
```

Use `404` (not `403`) — revealing that a record exists but is forbidden leaks information.

---

## Error handling

Every async route handler is wrapped in `try/catch`. On unexpected errors return:

```ts
res.status(500).json({ error: 'Server error' })
```

Do not expose stack traces, exception messages, or Prisma error details to the client. For known Prisma errors (e.g. unique constraint `P2002`) return a specific `409` response.

---

## Explicitly prohibited

| Prohibited | Why |
|---|---|
| Reading `userId` from the request body, params, or query | Client input is attacker-controlled |
| Skipping `requireAuth` on any route that returns or mutates user data | Every data endpoint must be authenticated |
| Raw SQL (`$queryRaw`, `$executeRaw`) | Bypasses Prisma's type safety |
| Queries on user-owned tables without an `ownerId` filter | Would expose all users' data |
| Exposing raw exception messages in error responses | Leaks internal implementation details |
| Removing or weakening `helmet`, CORS, or rate limiting | Core security layer |
