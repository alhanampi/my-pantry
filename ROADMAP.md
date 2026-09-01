# Technical Roadmap

This file tracks the technical design of **pending** work only — data model changes, endpoints, and open decisions. Product-level status (what's shipped) lives in the [README Roadmap](README.md#roadmap). Once a feature ships, its entry here can be deleted; the README checklist is the record of what's done.

---

## v1.2 remaining — Maps & Location

- **Filter supermarkets by maximum distance**: `NearbyStores` already gets results from Geoapify with lat/lng; add a client-side or query-param distance filter (Geoapify Places supports a `bias`/radius param — check if it's already being passed and just needs a user-facing control).
- **Save a preferred store per product**: needs a new field on `Product` (e.g. `preferredStoreId` or a free-text `preferredStoreName` if we don't want a full `Store` table) plus UI on the product card/form.

## v1.3 remaining — Expiration Alerts

- **Weekly expiration dashboard**: new view or section aggregating `Product.expiryDate` within the next 7 days, reusing the existing expiry-sorting logic already used for push notifications (`backend/src/services/webpush.ts` or wherever the daily cron query lives).
- **Deleted products history**: currently deletes are hard deletes. Needs either a `deletedAt` soft-delete column on `Product` (simplest) or a separate `ProductHistory` table if we want to keep full change history, not just last-deleted state.
- **Customizable calendar tab**: a calendar view grouping products by `expiryDate` — frontend-only if the dashboard above already exposes the data via a hook.

## v1.4 — Sharing & Export

- **Real-time sync between linked accounts**: polling (short-interval `refetchInterval` on the existing React Query hooks) is the low-effort option; WebSockets would need a persistent connection which doesn't fit the current Vercel Functions deployment well (would need a separate always-on service, e.g. a small websocket relay). Recommend polling first, revisit WebSockets only if polling proves too laggy.
- **Send items from shopping list to pantry automatically**: when a `ShoppingItem` is marked `purchased`, offer to create a matching `Product`. Needs a mapping decision (which shopping fields map to which product fields — mostly 1:1 already per `src/utils/types.ts`).
- **Share shopping list (public link or PDF)**: public link needs a new unauthenticated read-only route (careful: must not leak other lists — scope by a random unguessable share token, not by `ownerId`). PDF export is simpler and fully client-side (e.g. render to a printable view, no new backend needed).
- **Export pantry to CSV**: client-side only — serialize the already-fetched `Product[]` to CSV and trigger a download, no backend change needed.

---

## v1.5 — Recipes tab (Spoonacular + Groq translation) — shipped

**Shipped**: a "Recipes" tab (`src/views/RecipesView/`) — search/filters (query, cuisine, diet, includeIngredients, maxCalories), infinite scroll 4-at-a-time, a detail panel with an adjustable-servings scaler for ingredients and nutrition, and "send to a new shopping list" (creates a `ShoppingList` titled with the recipe name, seeded with the scaled ingredients — see "Multiple Shopping Lists" below, which this feature required as a prerequisite and which shipped in the same pass).

Backend: `backend/src/services/spoonacular.ts` (key server-only, proxied through `GET/POST /api/recipes/*`, no `requireAuth` — public browsing incl. guests — own rate limiter) and `backend/src/services/groq.ts` (`translateRecipeContent`, since Spoonacular doesn't support Spanish on `complexSearch`/`recipe information`; module-scoped cache, fails soft to English on any error). `src/api/spoonacularApi.ts` (the old unwired `VITE_SPOONACULAR_KEY` client scaffold) was removed — retired in favor of the server-side proxy.

**Randomized results** (added after initial ship): `searchRecipes` always passes `sort=random` to Spoonacular's `complexSearch`, including when a query/filters are active (a deliberate product decision — relevance sort was dropped entirely rather than only randomizing the unfiltered default view). Since Spoonacular re-randomizes per request rather than taking a stable seed, consecutive offset-paginated pages during one infinite-scroll session can occasionally repeat or skip a recipe — accepted trade-off, not worth a bespoke pagination/seeding scheme for a "browse for inspiration" feature.

**Favorite recipes** (added after initial ship): a heart icon (top-right corner of the recipe photo, on both the search-result cards and the detail view) saves/unsaves a recipe; filled when saved. A separate **Favorites** tab (`src/views/FavoriteRecipesView/`, positioned Pantry → Recipes → Favorites → Shopping in the nav) lists saved recipes as the same card grid with no search bar or pagination — a personal, bounded list.
- Schema: `FavoriteRecipe { id, ownerId, recipeId, createdAt }`, `@@unique([ownerId, recipeId])`, capped at `MAX_FAVORITES_PER_USER = 100`. Just a bookmark onto a Spoonacular recipe id in the DB — the list is still re-hydrated (and re-translated, if the UI language calls for it) via the same recipe-detail lookup used elsewhere. Personal per-user, not shared with a linked partner via `accessibleUserIds` like pantry/shopping data is — favoriting felt closer to a personal bookmark than shared household data.

**Client-side response caching** (reversal, added after Spoonacular's free-tier daily quota got exhausted in development): the original decision here was "Spoonacular stays the single source of truth, no caching, on every read" — reversed, since real quota exhaustion (`402` from Spoonacular → `503 quotaExceeded` from the backend) made the app briefly unusable. `src/utils/recipeCache.ts` is a small TTL+LRU cache over `localStorage` (same defensive try/catch style as `useGuestStorage.ts`); `src/api/recipesApi.ts`'s `apiSearchRecipes`/`apiGetRecipeDetail` are cache-first (search: 1h TTL, detail: 24h TTL, since recipe content barely changes) and fall back to a stale cached value instead of throwing when the live call fails — so `quotaExceeded` degrades to "slightly old data" rather than an error screen wherever something was already seen. This applies to favorites hydration too, since it goes through the same `apiGetRecipeDetail`. Also fixed alongside this: `RecipesFilterBar`'s inputs had no debounce, so every keystroke fired a brand-new search (and thus a new Spoonacular call) — `RecipesView` now debounces `filters` (400ms, via the existing `useDebounce` hook) before passing them to `useRecipeSearch`.
  - **TODO once the daily Spoonacular quota renews**: manually verify search, recipe detail, and favorites still work end-to-end against live Spoonacular (not just cached data) — confirm the cache-first path doesn't accidentally mask a real regression, and that the stale-fallback path stops kicking in once quota is available again.
- Backend: `backend/src/routes/recipeFavorites.ts`, mounted inside `recipes.ts` at `/favorites` *before* the `/:id` catch-all route (Express would otherwise match `/api/recipes/favorites` against `GET /:id` with `id='favorites'`). `GET /ids` is a cheap DB-only read (marks the heart on cards being browsed without paying for a Spoonacular hydration call); `GET /` hydrates the full list into cards, skipping any favorite whose recipe 404s upstream rather than failing the whole list. The serialization helpers (`serializeCard`/`serializeDetail`/`handleSpoonacularError`) were factored out of `recipes.ts` into `backend/src/services/recipeSerializers.ts` so both route files share them.
- Frontend: `src/hooks/useFavorites.ts` — same guest/signed-in duality as `usePantry.ts` (signed-in hits the backend; guests get a `number[]` of recipe ids in `localStorage` via `guestStorage`, hydrated into cards client-side through the existing public per-id detail endpoint).

**AI cooking-assistant chat — shipped** (built after the Recipes tab, in a later pass — the design sketched below at v1.5 planning time called for a single-turn `POST /api/ai/recipe-chat`; what actually shipped is a full multi-turn, streaming, DB-persisted chat instead, described here):

A **Chat** tab (`src/views/ChatView/`, positioned Pantry → Recipes → Favorites → Chat → Shopping in the nav) where the user has an open-ended conversation with Groq about what to cook — ingredients on hand, available time, dietary restrictions, proximity to shops — and can ask for a concrete recipe suggestion (a real Spoonacular recipe with a photo and a link, not AI-invented text) at any point, then send its missing ingredients to a new shopping list.

- **Sign-in required, no guest mode** — unlike Recipes/Favorites. Conversation history is DB-persisted per account (`ChatConversation`/`ChatMessage` models, `ownerId`-scoped like `FavoriteRecipe`, not shared with a linked partner), so there's nothing sensible to store for an anonymous guest. `ChatView` shows a "sign in to chat" prompt when signed out.
- **Dietary restrictions and servings are collected up front via UI**, not asked conversationally by the model — `NewChatOnboarding` (predefined restriction chips: vegetarian/vegan/gluten-free/etc., plus free-text custom entries, via `DietaryChipPicker`) + a servings stepper, shown before a new conversation's first message. Both are stored on the `ChatConversation` row and fed into every system-prompt build.
- **Streaming replies**: `POST /api/chat/conversations/:id/messages` streams via hand-rolled SSE (`res.write('data: {...}\n\n')`, no library) — `backend/src/services/chatAssistant.ts`'s `streamChatReply` iterates Groq's streamed chunks; the frontend's `streamChatMessage` (`src/api/chatApi.ts`) parses frames with a plain `ReadableStream`/`TextDecoder` reader, tolerating a frame split across chunk boundaries. The user's message is persisted before Groq is ever called, so a Groq failure never loses what was typed; only the assistant's optimistic placeholder rolls back on error (`useChatSession.ts`).
- **Time estimates are deliberately pessimistic**: the system prompt instructs the model to round up, assume home-cook (not professional-kitchen) pace, and — when the user might walk to a nearby store for something missing — ask how many blocks away and add ~2-3 minutes/block **round trip** (doubled) to the estimate. `nearbyStoresSummary` (store names + distances from the existing `useNearbyStores`/Geoapify integration, reused client-side — no new server-side geolocation call) is passed along so the model can reference real nearby options.
- **Recipe suggestions route through Spoonacular, not freeform AI text** — so every suggestion has a real photo and a "view full recipe" link (`sourceUrl`, added to `RecipeCard`/`RecipeDetail` and `serializeCard`/`serializeDetail` in `recipeSerializers.ts` — a small shared addition, not chat-only). The explicit "Suggest a recipe" button calls `extractSearchCriteria` (a separate, non-streaming, low-temperature Groq JSON-mode call reading the whole transcript) to derive Spoonacular search terms; `diet` is derived deterministically from the conversation's own predefined restriction chips (`mapDietaryRestrictionsToSpoonacularDiet`) rather than asked of the model. Selecting a suggestion reuses `RecipesView/RecipeDetailPanel` as-is (photo, translated ingredients/instructions/nutrition, servings scaling defaulted to the conversation's own servings via a new `initialServings` prop) and the existing `sendRecipeToShoppingList` mutation — no bespoke suggestion-card UI or ingredient-checklist was built, since the real recipe detail flow already covers it.
- **Markdown rendering**: assistant replies render via `react-markdown` + `remark-gfm` + `rehype-sanitize` (a deliberate, explicitly-requested exception to "don't add tooling without being asked") — no `rehype-raw` plugin, so raw HTML in the model's output is never rendered live, with `rehype-sanitize`'s default schema as a second explicit layer. User-typed messages stay plain text.
- **Guardrail instead of summarization**: a conversation stops accepting new messages past `MAX_MESSAGES_PER_CONVERSATION = 60` (400 `conversationTooLong`) rather than truncating/summarizing history — the full transcript is sent to Groq every turn, same "accepted limitation" style as the Groq translation cache elsewhere.
- Backend: `backend/src/routes/chat.ts` (`requireAuth` everywhere, own `chatLimiter` — 15/min, tighter than `recipesLimiter` since streaming LLM calls are the most expensive thing in the app), `backend/src/services/chatAssistant.ts` (own `Groq` client, separate from `groq.ts`'s translation-only one — this one throws real typed errors instead of failing soft, since chat needs to surface "AI isn't configured" to the user). Frontend: `src/hooks/useChat.ts` (conversations/suggest-recipe as normal `useQuery`/`useMutation`) + `src/hooks/useChatSession.ts` (sending a message is *not* a mutation — streaming doesn't fit that shape, so it's a plain async function owning local message state) + `src/hooks/useGeolocation.ts` (extracted from `ShoppingView/NearbyStores`' previously-inline geolocation call so both can share it).

**Metric/imperial unit-system preference** (added after initial ship): a persisted, account-wide preference (`User.unitSystem`, nullable — `null` means never explicitly chosen, resolved from the UI language instead: `es` → metric, otherwise imperial) surfaced as a switch in two places — Header's Preferencias section and `RecipeDetailPanel` — both driving the same `useUnitSystem` hook (signed-in: `GET`/`PATCH /api/auth/me`; guest: `guestStorage`'s `guest_unit_system` key, migrated into the account on sign-in via `useGuestMigration`, best-effort so a failure there doesn't fail the rest of the migration). No manual unit-conversion math: Spoonacular already returns a `measures: { us, metric }` object per ingredient whenever `fillIngredients=true`/`includeNutrition=true` are requested (both already are) — `recipeSerializers.ts` threads both sets onto `RecipeIngredient.measures`, and `RecipeDetailPanel` picks whichever is active and runs it through the existing servings `ratio` scaler, so toggling is instant client-side with no refetch. Nutrition (calories/protein/carbs/fat) needs no conversion — unit-consistent between the two systems. The chat assistant also gets this: `chatAssistant.ts`'s `resolveUnitSystem` (mirrored client-side) resolves the account's stored preference against the conversation's language, and `buildSystemPrompt` gets a new sentence steering it toward the right units when it mentions a quantity itself.

---

## v1.5 — Multiple Shopping Lists — shipped

**Shipped**: `ShoppingList` model (`id`, `name`, `ownerId`, `isGeneral`, `createdAt`), `ShoppingItem.listId`, `GET/POST/PUT/DELETE /api/pantry/shopping-lists` (`backend/src/routes/shoppingLists.ts`, cap `MAX_LISTS_PER_USER = 20`, `isGeneral` not deletable, lazy-seeds a "General" list on first `GET`), existing `/api/pantry/shopping*` endpoints gained `listId` (GET/DELETE default to the caller's General list when omitted, POST requires it explicitly). Frontend: `usePantry`'s shopping-item query is list-scoped (`['shoppingList', listId]`), `guestStorage` got the same `listId` dimension, and `ShoppingView` has a `ShoppingListSelector` (hidden when the user only has one list).

**Migration applied**: the `sqlite`/`postgresql` migration-lock drift that originally blocked this (`prisma/migrations/migration_lock.toml` said `sqlite`; the two checked-in migrations were genuine sqlite SQL from a pre-Clerk schema shape, unusable against the real Postgres DB) was repaired by baselining — the two broken migrations were archived to `backend/prisma/migrations_archive/` and replaced with one accurate baseline migration generated from the real pre-`ShoppingList` schema, marked applied via `prisma migrate resolve` (no data touched). The two-phase `ShoppingList` migration then ran normally: phase 1 (nullable `listId`) → `backfill-shopping-lists.ts` (also fixed: it was missing `import 'dotenv/config'`, so `DATABASE_URL` never loaded when run standalone) → verified `listId IS NULL` = 0 → phase 2 (`listId` `NOT NULL` + FK). Applied non-interactively (`prisma migrate dev` needs a TTY this environment doesn't have) via `prisma migrate diff --script` + `prisma migrate deploy`.

**Delete list UI** (added after initial ship): a "Delete list" button next to "Add product" in `ShoppingView`'s `TopBar`, shown only when the currently selected list isn't General (`selectedList.isGeneral`, checked client-side — the backend already rejected this, the button just avoids a doomed request). Confirms first via the new generic `ConfirmActionDialog` (see below) before calling the existing `DELETE /api/pantry/shopping-lists/:id`. No rename UI yet — the `PUT` endpoint exists for whenever that's wanted.

**Future: archive instead of delete**. Not built yet — noted here as an explicit product decision to pick up later, not to be inferred/half-implemented from this entry. The idea: let a user keep a list around for reuse (e.g. a recurring "Asado" or "Fiesta" list) without it cluttering the `ShoppingListSelector` dropdown — an `archived: Boolean` (or `archivedAt: DateTime?`) column on `ShoppingList`, list-fetch endpoints/queries exclude archived lists by default, and a separate "Archived lists" surface (a filter toggle in the selector, or its own small view) to unarchive one back into the active dropdown. Deliberately kept separate from delete rather than folded in as a delete option, since the two have different data-retention implications (archive keeps the list + items; delete is the current permanent, cascading behavior) and different UI (archive doesn't need the "are you sure, this can't be undone" framing delete does).

**Generic confirm-before-destructive-action dialog** (added after initial ship): `src/components/ConfirmActionDialog/` — a reusable "are you sure?" prompt (title/body/confirm label as props, danger-red confirm button, cancel). This is new: nothing in the codebase asked "are you sure?" before a delete previously (individual pantry/shopping items delete immediately, no confirmation) — the two first uses are deleting a shopping list and removing a recipe from favorites (see the Recipes tab section above). Reach for this component rather than adding another one-off dialog (`ZeroQuantityDialog`/`ZeroShoppingQtyDialog` remain separate since they're not yes/no confirmations — they offer a choice of *what* to do, not whether to proceed).

---

## v1.6 remaining — Environments

**Shipped**: Vitest on both frontend (`vitest.config.ts` via `vite.config.ts`'s `test` block, React Testing Library, example tests for `usePantry`/`pantryApi`) and backend (`backend/vitest.config.mts`, supertest against `backend/src/app.ts`, example tests for `middleware/auth.ts`/`routes/pantry.ts`, Prisma and Clerk mocked per the open decision below); `.github/workflows/ci.yml` running type-check + tests on every PR against `main`; `.env.example` (root) and `backend/.env.example` documenting every env var; `docs/environments.md` runbook.

**Still open** — the actual environment separation, which needs dashboard access this repo doesn't have:
- **Database**: create a Neon `dev` branch, put its `DATABASE_URL`/`DATABASE_URL_UNPOOLED` in `backend/.env` (see `docs/environments.md`).
- **Auth**: create a Clerk development instance, put its keys in `.env`/`backend/.env`.
- **Vercel**: split the project's env vars into distinct Preview and Production values in the dashboard, so PR previews hit the dev DB/Clerk instance, not production.

**Resolved**: backend tests stay fully mocked (Prisma + Clerk) rather than hitting a real DB — keeps CI decoupled from whether the dev Neon branch above exists yet. Revisit adding a handful of real DB-backed tests once the branch is set up.

---

## v1.7 — Quality of Life & Reliability

**Undo on delete**: replace (or supplement) the current hard-confirm delete flow in pantry/shopping with a toast showing "Undo" for a few seconds before the delete actually commits — a small reusable toast/undo component, no backend change needed (the item just isn't sent to the DELETE endpoint until the undo window closes).

**Invite via QR code**: the invite link already exists (`LinkInvitation` model, shareable URL per README v1.1). A QR code is just a client-side rendering of that same URL (e.g. a small QR-generation lib) shown next to the existing share options — no new backend endpoint needed.

**Production error monitoring (Sentry)**: add the Sentry SDK to both frontend (`main.tsx`) and backend (`app.ts`) using Sentry's free tier. Decide whether to start with just one side (backend errors are usually higher-signal first) or both at once.

**More languages**: i18next is already wired with `es`/`en` under `src/i18n/locales/`; adding a language is mostly translation work — copy `en.json`'s key structure into a new locale file and register it in `src/i18n/index.ts`.

**Offline conflict resolution**: the service worker (`src/sw.ts`) already caches for offline use, but there's no defined behavior for what happens when the same item was edited on two devices while one was offline and both come back online. Needs a decision: simplest is last-write-wins (already the implicit behavior via `updatedAt`), the more correct option is surfacing a merge conflict to the user — worth explicitly deciding rather than leaving as undefined behavior.

**Lightweight usage analytics**: a privacy-friendly, cookie-free option (e.g. self-hosted Plausible, or a minimal custom event counter) to understand which features actually get used before investing more in any of them.

**Navigation icons — resolved**: the tab icons (Header's desktop tabs and BottomNav's mobile nav — pantry/recipes/favorites/chat/shopping) previously mixed `react-icons/md`'s filled variants with one `@mui/icons-material` icon (`EmojiObjectsIcon`, for Chat), which never read as visually consistent despite a couple of rounds of size/weight tweaks. Fixed by moving all 5 to the `MdOutline*` variant of `react-icons/md` (`MdOutlineStorefront`, `MdOutlineRestaurantMenu`, `MdOutlineFavorite`, `MdOutlineLightbulb`, `MdOutlineShoppingCart`) — same thin, uniform stroke across the board, no new icon family introduced (stays inside the already-documented `react-icons/md` convention, see `docs/ui.md`). `@mui/icons-material` was removed from `package.json` entirely — it had no other usage in the codebase.

**Open decisions**:
- Sentry/analytics both touch privacy — worth deciding what's collected (and disclosing it) before wiring either in, even at hobby-project scale.

---

## v1.8 — Smart Planning

Builds on the v1.5 recipe chat, moving from "one recipe" to "plan ahead":

- **Weekly meal plan**: extend the recipe-chat flow to produce a set of recipes for the week in one go, then union all their ingredients, subtract what's already in the pantry, and push the remainder to the shopping list in one action (reuses the v1.5 backend endpoint and the v1.4 "send items to pantry" plumbing conceptually, just in bulk).
- **Recurring items**: add a `recurrenceDays` (or similar) field to `Product`, and a scheduled check (piggybacking on the existing daily Vercel Cron used for expiry notifications in `backend/src/services/webpush.ts`) that flags items due to be re-added — surfaced as a suggestion, not an automatic add, to avoid surprising the user.
- **Dietary tags**: new `tags: string[]` (or a join table if tags need to be shared/managed centrally) on `Product`, surfaced to the recipe-chat prompt so the AI avoids suggesting ingredients that conflict with them.

**Open decisions**: whether recurring items and dietary tags are per-product or per-user defaults (e.g. "I'm vegetarian" as a profile setting vs. tagging each product individually).

---

## v1.9 — Reach & Control

- **Native app packaging (Capacitor)**: wraps the existing React build in a native shell for iOS/Android app store distribution — the PWA's existing service worker and manifest mean most of the groundwork is already there; main work is Capacitor config, native push notification bridging (currently Web Push/VAPID, which doesn't work the same way in a native wrapper — needs FCM/APNs research), and store listings.
- **Full backup/restore**: a new endpoint (or client-side aggregation of existing GET endpoints) that serializes pantry + shopping lists + history to a single JSON file for download, and a matching import flow that re-creates records for the current user — needs conflict handling for import (merge vs. replace).
- **Household roles**: depends on the "real households" backlog item (a proper group model replacing `UserLink`'s 1:1 pairing) landing first; roles are an access-control layer on top of that model, not implementable against today's schema.
- **Finer notification preferences**: extend `PushSubscription` (or a new per-user `NotificationPreferences` row) with boolean flags per category, checked before sending in `backend/src/services/webpush.ts`.
- **Full-text search and combined filters**: mostly frontend — the pantry is already fully fetched client-side per user, so search/filtering can start as an in-memory filter over the existing `Product[]`; only worth moving server-side if pantry sizes grow large enough to matter.

---

## v1.10 — Spending & Analytics

Split out on its own (rather than folded into v1.8) because it's chart/stats-heavy — different skillset and pacing than the planning features above.

**Schema**: `Product` currently has no `price` field and no `category` field (`location` exists but describes storage location, e.g. "fridge", not a spend category like "dairy"/"produce"). Needed:
- Add `price: Decimal?` to `Product` (or a separate `Purchase` model if a product can be bought multiple times at different prices over time and history matters — the latter is more correct for "spending trends over time" below, but bigger lift).
- Add `category: String?` to `Product` for the by-category breakdown — likely a fixed enum/list picked from a dropdown rather than free text, to keep chart groupings clean.

**Backend**: new aggregation endpoints, e.g. `GET /api/stats/spending?range=month`, computing sums/group-by in Prisma (or raw aggregation queries) scoped by `accessibleUserIds` like every other query.

**Frontend**: a **charting library** — recommend **Recharts** (React-native API, composes well with the existing MUI-based UI, no heavy canvas dependency). New view or section (e.g. `src/views/StatsView/`) following the existing view/hook/api layering (`docs/data-fetching.md`).

**Features to chart**:
- Monthly spend by category (bar/pie).
- Spending trend over time (line chart, week/month buckets).
- Most-bought items (ranked list or bar chart).
- Waste tracking: expired-and-deleted-unused vs. marked-consumed — this depends on the "deleted products history" item from v1.3 remaining (need to know *why* a product left the pantry, not just that it did) and on "send items from shopping list to pantry automatically" from v1.4 existing so consumption is actually tracked.

**Open decisions**:
- `price` on `Product` vs. a separate `Purchase`/`Expense` model — affects how much history is preserved and how big a migration this is. Recommend starting simple (`price` on `Product`) and only introducing a separate model if trend analysis over repeated purchases turns out to need it.
- Currency handling if the household ever spans more than one currency (probably out of scope for v1 of this feature).

---

## Ideas backlog (unprioritized)

Suggestions to consider for future versions — not yet scheduled into a vX.Y block:

- **Barcode scanning**: use the phone camera to scan a product barcode and prefill name/brand (e.g. via a barcode-lookup API or an on-device barcode reader lib).
- **Restock suggestions from consumption history**: track how often a product gets re-added after running out, suggest adding it to the shopping list proactively.
- **Grouped weekly expiration digest**: one push notification summarizing everything expiring this week, instead of (or in addition to) per-product alerts.
- **Real households, not just 1:1 partners**: `UserLink` today only supports a single partner pairing; a proper household/group model would let more than 2 people share a pantry.
- **Receipt OCR import**: photograph a supermarket receipt and auto-populate the pantry from the parsed items (would need an OCR service — another candidate for a free-tier API check).
- **Quick-add via voice or keyboard shortcuts**: faster product entry for power users.
- **Auto dark mode by time of day**: schedule-based scheme switching on top of the existing 6 color schemes.
