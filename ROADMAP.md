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
- **Recipe suggestions (Spoonacular)**: client exists (`src/api/spoonacularApi.ts`) but is unwired. Superseded in practice by the v1.5 recipe chat below — decide whether to wire it up as a secondary "browse by ingredient" feature or drop it in favor of the chat flow.

---

## v1.5 — Recipe Chat (Groq)

**Goal**: user describes what they want to cook (or what they have), the AI proposes a recipe, and the missing ingredients get extracted into the shopping list.

**Provider**: [Groq](https://groq.com) — free tier, no credit card, fast inference on open-weight models (Llama 3.x). The API key is a single server-side secret owned by the app operator; **end users never see or need a key/account of their own** — same pattern as any other backend-only secret (Resend, Geoapify).

- Alternative: **Google Gemini (Flash)** — generous free daily quota and native JSON mode, which is convenient for structured ingredient extraction, but requires a Google Cloud project to set up. Keep as a fallback if Groq's free-tier rate limits (requests/minute) turn out to be too tight for real usage.

**Backend**:
- New route, e.g. `backend/src/routes/ai.ts`, mounted at `/api/ai`.
- `POST /api/ai/recipe-chat` — order per `docs/data-mutations.md`: `requireAuth` → `express-validator` (validate prompt length/content) → call Groq → return structured response. **The Groq key lives only in a backend env var** (`GROQ_API_KEY`), never exposed to the client — unlike the current Spoonacular key, which is `VITE_`-prefixed and client-side (don't repeat that pattern here).
- Response shape (ask the model for JSON, e.g. via Groq's JSON mode / a strict system prompt):
  ```json
  {
    "title": "string",
    "steps": ["string", ...],
    "ingredients": [{ "name": "string", "quantity": "string" }]
  }
  ```
- Basic guardrails: cap prompt length, maybe a simple per-user rate limit (reuse `express-rate-limit`, already a dependency) to avoid burning through the free-tier quota from one user hammering it.

**Frontend**:
- New hook (`src/hooks/useRecipeChat.ts`) following `docs/data-fetching.md` conventions (token fetched inside `mutationFn`/`queryFn`, `enabled: !!isSignedIn` where relevant).
- New API function in `src/api/` (e.g. `aiApi.ts`) — plain fetch wrapper, no Clerk/React Query logic inside, per `docs/data-fetching.md`.
- UI: a chat-style modal/panel (entry point likely from `ShoppingView` or a new lightweight view) showing the proposed recipe + an ingredient checklist, with an "Add to shopping list" action that reuses the existing `createShoppingItem` mutation (or a new bulk-create endpoint if adding N items one-by-one is too chatty).
- If Multiple Shopping Lists (below) ships in the same cycle, "Add to shopping list" should let the user pick which list.

**Open decisions**:
- Single-turn (one prompt → one recipe) vs. multi-turn chat (follow-ups like "make it vegetarian"). Start single-turn — much simpler, no conversation state to persist.
- Whether to persist recipe chat history at all, or treat it as ephemeral (not stored server-side beyond the request/response).

---

## v1.5 — Multiple Shopping Lists

**Current state**: `ShoppingItem` has a flat `ownerId`, no list concept. Sharing between partners is via `UserLink` (max 1 partner) + `accessibleUserIds(userId)` helper in `backend/src/routes/pantry.ts`, which every shopping query already filters by.

**Schema changes** (`backend/prisma/schema.prisma`):
- New model `ShoppingList { id, name, ownerId, createdAt }` (owned like `Product`/`ShoppingItem`, visible to the same `accessibleUserIds` set).
- Add `listId String` (FK to `ShoppingList`) on `ShoppingItem`.
- **Migration for existing data**: create one `ShoppingList` named "General" per existing `ownerId`/`accessibleUserIds` group, then backfill `listId` on all current `ShoppingItem` rows to point at it. Needs a data migration script alongside the Prisma schema migration (`prisma migrate dev` won't do the backfill on its own).

**Backend** (`backend/src/routes/pantry.ts` or a new `backend/src/routes/shoppingLists.ts`):
- `GET /api/pantry/shopping-lists` — list the user's lists.
- `POST /api/pantry/shopping-lists` — create a list.
- `PUT` / `DELETE /api/pantry/shopping-lists/:id` — rename/delete (with the same ownership `findFirst` check pattern used elsewhere per `docs/data-mutations.md`; deciding what happens to items when a list is deleted — cascade delete vs. reassign to "General" — is an open decision).
- Existing shopping endpoints (`GET/POST/PUT/DELETE /api/pantry/shopping...`) gain a required `listId` (query param on GET, body field on POST/PUT).

**Frontend**:
- `src/api/pantryApi.ts` — new functions for the list CRUD endpoints; existing shopping functions gain `listId`.
- `src/hooks/usePantry.ts` — query key becomes list-scoped (e.g. `['shoppingList', listId]`) instead of the current flat `['shoppingList']`; guest-mode (`guestStorage`) path also needs a `listId` dimension added to its local storage shape.
- `ShoppingView` — needs a list selector (tabs or a dropdown) above the item list; the "create shopping item" flow needs to know the currently selected list.

**Open decisions**:
- Cap on number of lists per user/household (avoid unbounded growth)?
- What happens to items when their list is deleted — block deletion if non-empty, cascade, or move to "General"?

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
