# Routing & Navigation

## Approach

This is a single-page application with **no URL-based router**. Navigation is purely view-state — the URL does not change when switching between sections.

There is no React Router, Next.js router, or any other routing library. Do not add one.

---

## Views

The active view is a string union stored in `useAppState`:

```ts
type View = 'pantry' | 'shopping' | 'recipes' | 'about'
```

Switching views calls `handleViewChange(view: View)` from `useAppState`. The relevant state and handler are passed down to `Header` (tab navigation on desktop) and `BottomNav` (icon bar on mobile). `bottomNavValue` is derived from `viewOrder = ['pantry', 'shopping', 'recipes']` (`about` stays outside this index, same as before).

```tsx
// src/App.tsx
{app.currentView === 'pantry' && <PantryView ... isLoading={app.isLoading} />}
{app.currentView === 'shopping' && <ShoppingView ... isLoading={app.isLoading} />}
{app.currentView === 'recipes' && <RecipesView ... />}
{app.currentView === 'about' && <AboutView />}
```

### Exception: `RecipesView` owns its own sub-state

`RecipesView` renders either a search grid or a recipe's detail (`selectedRecipeId` state local to the view) — there's no separate `View` union member or route for the detail, since there's no router to push a recipe id onto. This is a documented exception to the "flat views" pattern: every other view in `src/views/` renders one screen for one `AppView` value. If a future view needs the same in-tab drill-down, follow `RecipesView`'s pattern (local `useState` for the sub-screen, back button resets it) rather than adding a new top-level `AppView`.

Views receive `isLoading` as a prop and render their own skeleton UI while data loads, instead of a global spinner. This keeps the app shell (header, bottom nav) visible during loading.

---

## Auth gating

There are no protected routes. Instead, data queries only run when the user is signed in — enforced by `enabled: !!isSignedIn` in every `useQuery` call (see data-fetching.md).

Unauthenticated users see the app shell (header, bottom nav) but data areas are empty. The `<UserButton>` / `<SignInButton>` in the header handles sign-in.

Do not implement redirect-based auth guards. The SPA has no URLs to redirect to.

---

## Adding a new view

1. Create the view component in `src/views/NewView/index.tsx` (with a paired `NewView.styles.ts`).
2. Add `'newview'` to the `View` union type in `useAppState`.
3. Render it in `App.tsx` with the same conditional pattern as existing views.
4. Wire it up in `Header` (desktop tabs) and `BottomNav` (mobile icons).

---

## Explicitly prohibited

| Prohibited | Why |
|---|---|
| Adding React Router or any URL router | The app is intentionally URL-router-free; deep linking is not a requirement |
| Redirect-based auth gating on the frontend | There are no URLs to redirect from/to |
| Fetching data before checking `isSignedIn` | See data-fetching.md — all queries must be gated |
