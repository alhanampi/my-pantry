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
| Shopping lists (the list of lists) | `['shoppingLists']` |
| Shopping list items | `['shoppingList', listId]` |
| Recipe search | `['recipes', 'search', filters, i18n.language]` |
| Recipe detail | `['recipes', 'detail', id, i18n.language]` |
| Favorite recipe ids | `['recipes', 'favorites', 'ids']` |
| Favorite recipe cards | `['recipes', 'favorites', 'cards', i18n.language]` |
| Chat conversations (the list) | `['chat', 'conversations']` |
| Chat conversation detail (incl. messages) | `['chat', 'conversation', id]` |

Keep query keys simple and stable. After a mutation, invalidate the relevant key (see data-mutations.md).

### Exception: recipe queries have no `enabled: !!isSignedIn`

`/api/recipes/*` is a public, unauthenticated endpoint (browsing and viewing recipes works for guests too — sending a recipe's ingredients to a shopping list is the only part that needs a destination, and that works client-side via `guestStorage` same as everything else in guest mode). `useRecipeSearch`/`useRecipeDetail` (`src/hooks/useRecipes.ts`) and `apiSearchRecipes`/`apiGetRecipeDetail` (`src/api/recipesApi.ts`) are the only place in the codebase without `enabled: !!isSignedIn` and without a `token` first parameter — both are deliberate, documented exceptions to the rules above, not an oversight. Favorites are different: `/api/recipes/favorites*` IS `requireAuth`'d (per-user data, unlike search/detail), so `useFavoriteIds`/`useFavoriteRecipes`/`useToggleFavorite` (`src/hooks/useFavorites.ts`) follow the normal `enabled: !!isSignedIn` + guest-storage-fallback pattern from `usePantry.ts`, and `apiGetFavoriteIds`/`apiGetFavoriteRecipes`/`apiAddFavorite`/`apiRemoveFavorite` (`src/api/recipesApi.ts`) do take a token — only the two public calls above are the exception.

### Exception: streaming a chat reply doesn't go through `useQuery`/`useMutation`

`POST /api/chat/conversations/:id/messages` streams its response as hand-rolled SSE frames (`data: {...}\n\n`), which doesn't fit React Query's single-resolved-value model. `streamChatMessage` (`src/api/chatApi.ts`) is a third exception to the "API functions just call `fetch` and return typed data" rule — it reads the response body incrementally via `ReadableStream`/`TextDecoder` and invokes `onToken`/`onDone`/`onError` callbacks instead of returning a value. It's called from `useChatSession` (`src/hooks/useChatSession.ts`), a hook that owns local message state directly rather than wrapping a `useMutation` — optimistic user+placeholder-assistant bubbles are pushed immediately, tokens are appended to the placeholder as they arrive, and `['chat', 'conversation', id]` is invalidated once the stream's `done` frame arrives to reconcile with the server-persisted messages. Every other chat operation (listing/creating/deleting conversations, requesting a recipe suggestion) is a normal `useQuery`/`useMutation` in `src/hooks/useChat.ts` — only sending a message itself is different, and only because of streaming.

Unlike recipe search/detail, chat requires `enabled: !!isSignedIn` like normal — conversation history is DB-persisted per-user, there's no guest mode for chat (see data-mutations.md).

---

## Explicitly prohibited

| Prohibited | Why |
|---|---|
| `fetch()` or API calls directly inside a component | Bypasses React Query's caching and loading state |
| Storing the Clerk token in `useState` or module scope | Tokens expire; always call `getToken()` fresh |
| Queries without `enabled: !!isSignedIn` | Would fire unauthenticated requests |
| Hardcoding the API base URL in individual functions | Use `import.meta.env.VITE_API_URL` via the shared `API_URL` constant |
