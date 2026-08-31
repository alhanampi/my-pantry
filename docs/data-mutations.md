# Data Mutations

## Stack

- **React Query `useMutation`** for all create, update, and delete operations on the frontend
- **Express + express-validator** for validation and routing on the backend
- **Prisma** for all database writes — no raw SQL

---

## Frontend rules

### Mutations live in custom hooks alongside their queries

Define mutations in the same hook file as the related queries (`src/hooks/usePantry.ts`). Do not call `useMutation` directly inside a component.

```ts
const createProduct = useMutation({
  mutationFn: async (data: ProductFormData): Promise<Product> => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    return apiCreateProduct(token, data)
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
})
```

### Always fetch a fresh token inside `mutationFn`

Call `getToken()` inside `mutationFn`, not at the hook level. Tokens expire and must be fetched just before each request.

### Invalidate after success

After every successful mutation call `queryClient.invalidateQueries()` with the affected query key in `onSuccess`. Do not manually update the cache.

| Mutation target | Key to invalidate |
|---|---|
| Products | `['products']` |
| Shopping list items | `['shoppingList']` |
| Shopping lists | `['shoppingLists']` |

`sendRecipeToShoppingList` (in `usePantry.ts`) creates a new `ShoppingList` titled with the recipe name, then creates one item per (already-scaled) ingredient via `Promise.all`, and invalidates both `['shoppingLists']` and `['shoppingList']` on success.

### Surface errors to the user

Check `mutation.error` or `mutation.isError` in the component and display a user-facing message. Do not silently swallow errors.

---

## Backend rules

### Route pattern: validate → auth → query

Every mutating route must follow this order:

1. `requireAuth` middleware verifies the Clerk JWT and sets `req.clerkUserId`
2. `express-validator` rules validate the request body
3. `validationResult()` is checked — return `400` if invalid
4. Prisma performs the write

```ts
router.post('/products', requireAuth, productFields, async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return
  }
  const userId = req.clerkUserId!
  // ... Prisma create
})
```

### `ownerId` is always set server-side

On create, `ownerId` is set from `req.clerkUserId`. It is never read from the request body.

```ts
// correct
const product = await prisma.product.create({
  data: { ...fields, ownerId: userId },  // userId from verified token
})

// forbidden — ownerId from body is attacker-controlled
const product = await prisma.product.create({
  data: { ...req.body },  // never
})
```

### Ownership is verified before update or delete

Before modifying a record, always do a `findFirst` scoped to `accessibleUserIds(userId)`. Return `404` if the record is not found — do not return `403` (which would confirm the record exists).

```ts
const ids = await accessibleUserIds(userId)
const existing = await prisma.product.findFirst({
  where: { id: productId, ownerId: { in: ids } },
})
if (!existing) { res.status(404).json({ error: 'Product not found' }); return }
// safe to update/delete
```

### Use Prisma — no raw SQL

All writes use Prisma's `.create()`, `.update()`, `.updateMany()`, `.delete()`, and `.deleteMany()`. Do not use `$queryRaw` or `$executeRaw`.

### Wrap every handler in try/catch

Return `{ error: 'Server error' }` with status `500` for unexpected failures. Do not let unhandled rejections crash the process.

---

## Partner access

`accessibleUserIds(userId)` returns an array containing the authenticated user's ID plus their linked partner's ID (if any). All reads and ownership checks for products and shopping items must use `ownerId: { in: ids }` — not just `ownerId: userId` — so partners can share the pantry.

---

## Explicitly prohibited

| Prohibited | Why |
|---|---|
| Reading `ownerId` from the request body | Attacker-controlled; always use `req.clerkUserId` |
| Update/delete without a prior `findFirst` ownership check | Would allow one user to modify another's data |
| Raw SQL (`$queryRaw`, `$executeRaw`) | Bypasses Prisma's type safety |
| `useMutation` directly inside a component | Mutations must live in `src/hooks/` |
| Skipping `invalidateQueries` after a successful mutation | UI would show stale data |
| Not validating the request body on mutating routes | Invalid data reaches the database |
