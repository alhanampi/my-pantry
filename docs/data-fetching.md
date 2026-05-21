# Data Fetching

## Stack

- **React Query** (`@tanstack/react-query`) for all server-state fetching and caching
- **`src/api/`** for the raw fetch functions (one file per domain)
- **Custom hooks** in `src/hooks/` that combine React Query with the API layer

---

## Rules

### All fetching goes through custom hooks

Components never call `fetch()` or API functions directly. Data fetching lives in custom hooks (`src/hooks/`) that use `useQuery`.

```ts
// src/hooks/usePantry.ts
export function usePantry() {
  const { getToken, isSignedIn } = useAuth()

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) return []
      return apiGetProducts(token)
    },
    enabled: !!isSignedIn,
  })

  // ...
}
```

### API functions live in `src/api/`

Raw fetch calls are plain async functions that accept a `token` as their first parameter. They do not call Clerk or React Query — they just call `fetch` and return typed data.

```ts
// src/api/pantryApi.ts
export async function apiGetProducts(token: string): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/pantry/products`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  // throw on non-ok status
  const json = await handleResponse<{ products: Product[] }>(res)
  return json.products
}
```

One file per domain: `pantryApi.ts` for products and shopping, `authApi.ts` for user sync and linking.

### Token is fetched fresh per query

Call `getToken()` from `useAuth()` (Clerk) inside the `queryFn`. Do not cache tokens in state or module scope.

### Queries only run when the user is signed in

Every query that touches the backend must include `enabled: !!isSignedIn`. Unauthenticated users must never trigger an API call.

### Error responses throw

`handleResponse<T>()` in `pantryApi.ts` checks `res.ok` and throws with the server's error message on failure. React Query catches the error and exposes it via `query.error`.

---

## QueryClient configuration

The `QueryClient` is created once in `src/main.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
})
```

- `staleTime: 5 min` — data is considered fresh for 5 minutes before a background refetch.
- `retry: 1` — failed requests retry once before surfacing an error.

Do not create additional `QueryClient` instances.

---

## Query keys

| Data | Query key |
|---|---|
| Pantry products | `['products']` |
| Shopping list | `['shoppingList']` |

Keep query keys simple and stable. After a mutation, invalidate the relevant key (see data-mutations.md).

---

## Explicitly prohibited

| Prohibited | Why |
|---|---|
| `fetch()` or API calls directly inside a component | Bypasses React Query's caching and loading state |
| Storing the Clerk token in `useState` or module scope | Tokens expire; always call `getToken()` fresh |
| Queries without `enabled: !!isSignedIn` | Would fire unauthenticated requests |
| Hardcoding the API base URL in individual functions | Use `import.meta.env.VITE_API_URL` via the shared `API_URL` constant |
