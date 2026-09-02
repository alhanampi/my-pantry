# My Pantry 🧺

A Progressive Web App (PWA) for managing your household pantry. Track what you have at home, when products expire, build your shopping list, and find nearby supermarkets — all from your phone, no installation required.

Still in development!

## See a live demo!

https://my-pantry-j9zkt3bw2-pamina-goldenberg-thierys-projects.vercel.app/

---

## What is a PWA?

A **Progressive Web App** is a web application that behaves like a native app:

- **Installable** — can be added to your phone's home screen directly from the browser, no app store needed.
- **Offline-first** — the service worker caches static assets so the app loads without a connection.
- **Responsive** — designed mobile-first, works on any screen size.
- **Secure** — runs over HTTPS only.

This project uses `vite-plugin-pwa`, which automatically generates the `manifest.json` and service worker.

---

## Features

### Pantry

- Add products with name, quantity, brand, expiration date, purchase date, location, and notes.
- Table view on desktop, expandable cards on mobile.
- Sort by any column.
- Real-time search.
- Edit and delete products with confirmation.

### Shopping List

- Move products from the pantry directly to the shopping list.
- Add items manually.
- Mark items as purchased with a checkbox.
- Clear all purchased items in one click.

### Recipes

- Search recipes by keyword, cuisine, diet, included ingredients, and max calories, via a server-side **Spoonacular** proxy (the API key never reaches the client).
- Results are always random (`sort=random`, even with filters/a search query active) and reshuffle every time the tab is opened or the page reloads — there's no "default browsing order" to get stale.
- Infinite-scroll results grid, 4 recipes per page (`IntersectionObserver` sentinel).
- Search and detail responses are cached client-side (`src/utils/recipeCache.ts`, a TTL+LRU cache over `localStorage`: 1h for search results, 24h for recipe details) to reduce Spoonacular quota usage — a failed live call falls back to a stale cached value instead of erroring. Filter inputs in `RecipesFilterBar` are debounced (400ms) before triggering a new search, so typing doesn't fire a request per keystroke.
- Detail view with an adjustable servings stepper that scales ingredient amounts and nutrition (calories/protein/carbs/fat) live.
- "Send to a new shopping list" creates a shopping list titled with the recipe name and seeded with the scaled ingredients, then offers to jump straight to it.
- Recipe titles, ingredient names, and instructions are translated to Spanish via **Groq** when the UI is in Spanish (Spoonacular itself doesn't support Spanish content) — fixed nutrition labels/units stay on the normal i18n system. Falls back to English on any translation error.
- Works fully for guests too (recipe browsing needs no auth; "send to list" writes to `localStorage` same as the rest of guest mode).

### Favorite Recipes

- A heart icon in the top-right corner of a recipe's photo — on the search grid cards and on the detail view — saves/unsaves it as a favorite; filled red when saved, regardless of color scheme.
- A separate **Favorites** tab (between Recipes and Shopping) lists saved recipes as the same card grid, no search bar or pagination (personal list, not expected to be huge).
- Signed-in: favorites are a per-user DB table storing just the Spoonacular recipe id (`FavoriteRecipe`, capped at 100/user) — Spoonacular stays the single source of truth for content, so the list is re-hydrated (and re-translated, if needed) via the same recipe-detail lookup each time it's opened. Personal, not shared with a linked partner. Guests: same idea, ids only, in `localStorage`.
- Saving a recipe is immediate; removing one asks for confirmation first ("Remove from favorites?") via a reusable `ConfirmActionDialog`.

### Chat (AI cooking assistant)

- A **Chat** tab (between Favorites and Shopping) for an open-ended conversation with an AI cooking assistant about what to cook — ingredients on hand, available time, dietary restrictions, proximity to shops.
- **Sign-in required, no guest mode** — conversations are persisted per account in the database, not shared with a linked partner. Signed-out users see a "sign in to chat" prompt.
- Before the first message, `NewChatOnboarding` collects dietary restrictions (predefined chips — vegetarian, vegan, gluten-free, etc. — plus free-text custom entries) and a servings count; both are stored on the conversation and factored into every reply.
- Replies stream token-by-token via server-sent events, powered by **Groq**. Time estimates are deliberately pessimistic (home-cook pace, plus round-trip walking time to a nearby store when relevant, using the same nearby-stores data as the Shopping tab).
- A "Suggest a recipe" action turns the conversation so far into a real **Spoonacular** recipe suggestion (photo + link, not AI-invented text), reusing the same recipe detail view as the Recipes tab — including "send to a new shopping list".
- Assistant replies render as Markdown (`react-markdown` + `remark-gfm`, sanitized with `rehype-sanitize`); user messages stay plain text.
- A conversation stops accepting new messages after 60, with an explicit "conversation too long" error rather than silently truncating history.

### Multiple Shopping Lists

- Every account has a non-deletable "General" shopping list, created automatically on first use.
- Additional named lists can be created (e.g. one per recipe sent from the Recipes tab), up to 20 per user.
- Any non-General list can be deleted (button next to "Add product", shown only when that list is selected) — asks for confirmation first, since it permanently deletes the list and everything in it.
- Planned for later: archiving a list instead of deleting it, so it can be reused without cluttering the list dropdown — see `ROADMAP.md`.
- A list selector appears above the shopping list items whenever there is more than one list.

### Nearby Supermarkets

- Device geolocation.
- Place search via **Geoapify Places API**.
- Filter by store type (supermarket, grocery, bakery, deli, and more) via a multi-select dropdown.
- Distance calculated with the Haversine formula; results sorted by distance, capped at 25.
- 5-minute cache with React Query.
- Clicking a store opens an interactive map dialog (MapLibre GL + OpenFreeMap tiles) with a "Open in Google Maps" directions link.

### Loading States

- Pantry and shopping list views render a skeleton UI (`PantrySkeleton`, `ShoppingSkeleton`) that mirrors the real layout while data loads, instead of a global spinner — the app shell (header, bottom nav) stays visible throughout.

### Quantity Management

- Inline quantity stepper (+ / −) on every pantry card/row and every shopping list item.
- When a pantry item reaches 0, a dialog offers to move it to the shopping list before deleting.
- When a shopping list item reaches 0, a dialog asks whether to remove it or reset to 1.

### Shared Pantry

- Send a link invitation by username from the profile menu; an optional email is sent via Resend if configured.
- Invitations include a shareable `?invite=<token>` URL (48-hour expiry) the recipient can open to accept.
- Pending invitations are shown in an inbox inside the profile menu.
- Once accepted, both users see and edit the same pantry and shopping list.
- All data is stored in PostgreSQL and scoped to the linked pair.

### Push Notifications

- Bell icon in the header to subscribe / unsubscribe from browser push notifications.
- A daily Vercel Cron job (09:00 UTC) finds products expiring within 7 days and pushes a notification to all subscribed users.
- Notifications are delivered via VAPID/Web Push; stale subscriptions are cleaned up automatically on send failure.

### Guest Mode

- Unauthenticated users can add, edit, and delete pantry products and shopping list items without signing in.
- Data is stored in `localStorage` under the `guest_products` and `guest_shopping` keys.
- On sign-in, guest data is automatically migrated to the server via `useGuestMigration` and the local keys are cleared.

### Internationalization

- Full Spanish and English support.
- Language persists across sessions via `localStorage`.
- Over 300 product suggestions per language.

### Authentication

- Sign-up and login managed by **Clerk** (email + password + username).
- Clerk handles email verification, password security, and session management.
- Backend verifies Clerk JWTs on every protected request; user data for sync is fetched directly from Clerk's API (never trusted from the client).

### Customization

- Color theme picker.
- Mobile-first design with bottom navigation on mobile and tabs on desktop.
- On mobile, a hamburger drawer groups all header actions clearly.
- All navigation icons (pantry/recipes/favorites/chat/shopping, on both the desktop tabs and the mobile bottom nav) come from `react-icons/md`'s `MdOutline*` set exclusively — `@mui/icons-material` was removed from the project. The selected tab visually merges into the page background (no separate "floating chip" or underline indicator) on both Header's desktop tabs and BottomNav's mobile tabs, which are icon-only (no text labels, `aria-label` kept for accessibility).

---

## Architecture

```
Browser → Vercel CDN (React SPA)
              ↓ /api/*
         Vercel Functions (Express app, api/index.ts)
              ↓
         Neon PostgreSQL (serverless Postgres)
         Clerk API (JWT verification + user data)
```

In production, the React frontend and the Express backend are deployed together on Vercel. The frontend is a static build served from the CDN; the backend runs as a single Vercel Function (`api/index.ts`) that handles all `/api/*` routes via a `vercel.json` rewrite.

For local development, both frontend and backend start together with a single `npm run dev` command (uses `concurrently`).

---

## Stack

### Frontend

| Technology                   | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| React 18 + TypeScript        | UI and component logic                     |
| Vite 5                       | Bundler and dev server                     |
| MUI v5                       | UI components                              |
| styled-components v6         | Layout and container styles                |
| TanStack React Query v5      | Server state: fetching, caching, mutations |
| Clerk (`@clerk/clerk-react`) | Authentication UI and session management   |
| i18next + react-i18next      | Internationalization (ES / EN)             |
| react-map-gl + MapLibre GL   | Nearby supermarkets map                    |
| react-icons v5               | Icon set (Material Design, `react-icons/md`) |
| react-markdown + remark-gfm + rehype-sanitize | Renders assistant chat replies as sanitized Markdown |
| axios                        | HTTP client for API calls                  |
| vite-plugin-pwa              | Service worker and PWA manifest            |
| concurrently                 | Runs frontend and backend in one terminal  |

### Backend

| Technology                         | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| Express 4                          | HTTP framework, exported as a Vercel Function |
| TypeScript                         | Type safety                                   |
| Prisma 5                           | ORM                                           |
| Neon PostgreSQL                    | Serverless Postgres database                  |
| Clerk (`@clerk/backend`)           | JWT verification + user data fetch            |
| express-validator                  | Request body validation                       |
| helmet + cors + express-rate-limit | Security headers, CORS, rate limiting         |
| web-push                           | VAPID push notification delivery              |
| Resend                             | Transactional email for link invitations      |
| groq-sdk                           | Groq API client, used to translate recipe content to Spanish |

---

## Data Model

```
User (Clerk ID)
 ├── UserLink[]           — links two users to share a pantry
 ├── LinkInvitation[]     — pending/accepted/declined invitations (48-hour expiry)
 ├── PushSubscription[]   — Web Push endpoints for this user
 ├── Product[]            — pantry items owned by this user
 ├── ShoppingItem[]       — shopping list items owned by this user (each belongs to a ShoppingList)
 ├── ShoppingList[]       — named shopping lists (one auto-created "General" list per user, plus any created manually or from Recipes)
 └── ChatConversation[]   — AI chat conversations (dietaryRestrictions, servings), personal, capped at 20/user
      └── ChatMessage[]   — messages in a conversation (role: 'user' | 'assistant'), capped at 60/conversation
```

When two users are linked, all pantry and shopping list reads include items from both users. Writes always set the current user as owner.

> **Note**: `ShoppingItem.listId` is currently nullable in `schema.prisma` (phase 1 of a two-phase migration) — see `ROADMAP.md`'s "Multiple Shopping Lists" entry for why the `NOT NULL` phase 2 migration and the one-time backfill script haven't run yet on the shared dev database.

---

## Project Structure

```
mi-despensa-app/
├── api/
│   └── index.ts              # Vercel Function entry point (re-exports Express app)
├── vercel.json               # Rewrites /api/* → api/index; defines daily cron at 09:00 UTC
├── knip.json                 # Codebase integrity check config (unused files/exports/deps), two workspaces: `.` and `backend`
│
├── backend/                  # Backend source
│   ├── prisma/
│   │   ├── schema.prisma     # Models: User, UserLink, LinkInvitation, PushSubscription, Product, ShoppingItem, ShoppingList, FavoriteRecipe, ChatConversation, ChatMessage
│   │   └── seed.ts           # Dev-only: seeds a fixed test user's pantry with products at various expiry distances
│   ├── scripts/
│   │   └── backfill-shopping-lists.ts # One-time idempotent backfill: General list per user + listId on old items
│   └── src/
│       ├── app.ts            # Express app (no listen — shared by local and Vercel)
│       ├── index.ts          # Local dev entry: imports app, calls listen
│       ├── db/
│       │   └── index.ts      # Prisma client singleton (serverless-safe)
│       ├── services/
│       │   ├── webpush.ts    # VAPID push delivery and stale-subscription cleanup
│       │   ├── email.ts      # Resend transactional email (optional)
│       │   ├── spoonacular.ts # Server-only Spoonacular client (searchRecipes/getRecipeInformation, always sort=random)
│       │   ├── groq.ts       # translateRecipeContent — recipe content → Spanish, cached, fails soft to English
│       │   ├── chatAssistant.ts # streamChatReply (SSE streaming) + extractSearchCriteria — own Groq client, throws real errors (no fail-soft)
│       │   └── recipeSerializers.ts # serializeCard/serializeDetail — shared between recipes.ts, recipeFavorites.ts, and chat.ts
│       ├── middleware/
│       │   └── auth.ts       # Clerk JWT verification
│       └── routes/
│           ├── auth.ts       # /sync, /me, /link, /invite
│           ├── pantry.ts     # Products and shopping list CRUD (listId-aware)
│           ├── shoppingLists.ts # Shopping list CRUD (/api/pantry/shopping-lists)
│           ├── recipes.ts    # Public recipe search/detail proxy (/api/recipes), own rate limiter; mounts recipeFavorites.ts
│           ├── recipeFavorites.ts # Favorites CRUD (/api/recipes/favorites), auth'd, capped at 100/user
│           ├── chat.ts       # Chat conversations/messages CRUD + streaming reply (/api/chat), requireAuth everywhere, own rate limiter (15/min)
│           └── notifications.ts # Push subscription CRUD + cron handler
│
└── src/                      # Frontend
    ├── main.tsx              # Entry: ClerkProvider + QueryClientProvider
    ├── App.tsx               # Root layout and global state
    ├── App.styles.ts         # Root layout styled-components
    ├── sw.ts                 # Service worker source (injectManifest, handles push + notificationclick)
    ├── api/
    │   ├── authApi.ts           # Sync and link calls
    │   ├── pantryApi.ts         # Products, shopping list, and shopping list CRUD calls
    │   ├── recipesApi.ts        # Recipe search/detail (public, no token) + favorites CRUD (auth'd, token as usual)
    │   ├── chatApi.ts           # Conversations CRUD + streamChatMessage (parses SSE frames via ReadableStream/TextDecoder)
    │   ├── overpass.ts          # Geoapify Places API wrapper and shop-type map
    │   ├── productSuggestionsApi.ts # Open Food Facts live suggestions
    │   └── notificationsApi.ts  # Push subscription register/unregister calls
    ├── components/
    │   ├── Header/              # AppBar with hamburger drawer (mobile) and tabs (desktop)
    │   ├── BottomNav/
    │   ├── AddProductModal/
    │   ├── AuthModal/           # Account linking modal
    │   ├── ConfirmDialog/       # Actually a post-action success/cancel notice, despite the name
    │   ├── ConfirmActionDialog/ # Generic pre-action "are you sure?" — delete list, remove favorite
    │   ├── QuantityStepper/
    │   ├── ZeroQuantityDialog/  # Prompt when a pantry item hits 0 (offer to add to cart)
    │   ├── ZeroShoppingQtyDialog/ # Prompt when a shopping item hits 0 (offer to delete)
    │   ├── NotificationBell/    # Bell icon with subscribe/unsubscribe toggle
    │   └── ThemePicker/
    ├── views/
    │   ├── PantryView/
    │   │   └── PantrySkeleton.tsx   # Skeleton UI shown while pantry data loads
    │   ├── ShoppingView/
    │   │   ├── NearbyStores/    # Store list with type filter
    │   │   ├── StoreMapDialog/  # MapLibre GL dialog opened per store
    │   │   ├── ShoppingListSelector/ # List picker, shown when the user has more than one list
    │   │   └── ShoppingSkeleton.tsx # Skeleton UI shown while shopping list loads
    │   ├── RecipesView/
    │   │   ├── RecipesFilterBar/  # Search + cuisine/diet/ingredients/maxCalories filters
    │   │   ├── RecipeCardGrid/    # Grid — infinite scroll when onLoadMore is passed, static otherwise
    │   │   ├── RecipeCard/        # Photo (+ favorite heart button), title, ingredient chips
    │   │   ├── RecipeDetailPanel/ # Servings scaler, scaled ingredients/nutrition, favorite heart, "send to list"
    │   │   ├── ServingsStepper/   # Thin wrapper reusing QuantityStepper
    │   │   └── RecipesSkeleton.tsx # Skeleton UI shown while a search/detail loads
    │   ├── FavoriteRecipesView/  # Bounded grid of saved recipes — reuses RecipeCardGrid/RecipeDetailPanel from RecipesView
    │   ├── ChatView/             # AI cooking-assistant chat (sign-in required)
    │   │   ├── ChatSidebar/      # Conversation list
    │   │   ├── ChatMessageList/  # Rendered messages (Markdown for assistant replies)
    │   │   ├── ChatComposer/     # Message input + "Suggest a recipe" action
    │   │   ├── ChatSuggestionCards/ # Recipe suggestion cards (Spoonacular-backed)
    │   │   ├── NewChatOnboarding/ # Collects dietary restrictions + servings before the first message
    │   │   ├── DietaryChipPicker/ # Predefined + free-text dietary restriction chips
    │   │   └── ChatSkeleton.tsx  # Skeleton UI shown while a conversation loads
    │   └── AboutView/
    ├── context/
    │   └── AuthContext.tsx      # Partner state, link/invite flow, and guest migration trigger
    ├── contexts/
    │   └── ThemeContext.tsx
    ├── hooks/
    │   ├── useAppState.ts       # Central state: wires pantry hooks to UI handlers
    │   ├── usePantry.ts         # React Query hooks for products, shopping lists (incl. delete), and shopping list items
    │   ├── useRecipes.ts        # React Query hooks for recipe search (infinite) and detail — public, no isSignedIn gate
    │   ├── useFavorites.ts      # Favorite recipe ids/cards + toggle — signed-in (DB) or guest (localStorage); useFavoriteToggle wraps the mutation with a confirm-before-remove step
    │   ├── useChat.ts           # Conversations list + suggest-recipe as normal React Query hooks
    │   ├── useChatSession.ts    # Sending a message — plain async function owning local message state (streaming doesn't fit useMutation)
    │   ├── useGeolocation.ts    # Device geolocation, extracted from NearbyStores so ChatView can share it
    │   ├── useNearbyStores.ts
    │   ├── useLocalStorage.ts
    │   ├── useProductSuggestions.ts
    │   ├── usePushNotifications.ts  # Web Push subscription management
    │   ├── useGuestStorage.ts       # localStorage CRUD for unauthenticated sessions
    │   ├── useGuestMigration.ts     # Migrates guest data to server on sign-in
    │   └── useDebounce.ts
    ├── styles/
    │   └── colorSchemes.ts      # 6 selectable color schemes + CSS variable injection + MUI base theme (baseThemeOptions/createAppTheme())
    ├── utils/
    │   ├── types.ts             # Shared TypeScript interfaces and types
    │   ├── helpers.ts           # Date formatting and other shared utilities
    │   ├── migrations.ts        # One-time localStorage key migration (ES → EN field names)
    │   └── recipeCache.ts       # TTL+LRU cache over localStorage for Spoonacular search/detail responses
    ├── i18n/
    │   ├── index.ts          # i18next init and language detection
    │   └── locales/
    │       ├── es.json
    │       └── en.json
    └── data/
        ├── productSuggestions.ts  # Registry that maps language code → suggestion list
        ├── products.es.json
        └── products.en.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) application:
  - Enable **Email + Password** and **Username** as required fields
  - Copy the **Publishable Key** and **Secret Key**
- A [Neon](https://neon.tech) PostgreSQL database:
  - Copy the **pooled connection string** (`DATABASE_URL`) and **direct connection string** (`DATABASE_URL_UNPOOLED`)
- A [Geoapify](https://www.geoapify.com) API key (for the nearby stores feature)

### 1. Install dependencies

```bash
npm install          # frontend
cd backend && npm install
```

### 2. Configure environment variables

**Frontend** (`.env`):

```
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_GEOAPIFY_KEY=...
VITE_VAPID_PUBLIC_KEY=...          # from step 3 below
```

**Backend** (`backend/.env`):

```
PORT=3001
CLERK_SECRET_KEY=sk_test_...
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://...?sslmode=require          # pooled (pgbouncer)
DATABASE_URL_UNPOOLED=postgresql://...?sslmode=require  # direct
VAPID_PUBLIC_KEY=...               # from step 3 below
VAPID_PRIVATE_KEY=...              # from step 3 below
VAPID_SUBJECT=mailto:you@email.com
CRON_SECRET=...                    # any random secret string
RESEND_API_KEY=...                 # optional — only needed to send invitation emails
EMAIL_FROM=My Pantry <noreply@mypantry.app>  # optional — sender address for invitation emails
SPOONACULAR_KEY=...                # optional — server-only; recipes routes return a configError without it
GROQ_API_KEY=...                   # optional for recipe translation (falls back to English); required for the Chat tab (returns a config error without it)
```

### 3. Generate VAPID keys (one-time)

```bash
cd backend
npx web-push generate-vapid-keys
```

Copy the output into both `.env` files as shown above. The same public key goes in both the frontend and backend envs.

### 4. Push the schema

If you are setting up for the first time, or after the push notification migration:

```bash
# Run the pre-migration SQL once in the Neon SQL editor (or via psql):
#   UPDATE "Product" SET "expiryDate" = NULL WHERE "expiryDate" = '';
# (see backend/prisma/pre-push.sql)

cd backend
npx prisma db push
```

### 5. Run locally

```bash
npm run dev   # starts frontend (Vite) and backend (Express) together via concurrently
```

### Available scripts

**Root** (`package.json`):

| Script                | What it does                                                        |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev`           | Runs Vite dev server and the backend together via `concurrently`     |
| `npm run build`         | Runs `prisma generate` then `vite build` (used by the Vercel build)  |
| `npm run preview`       | Serves the production frontend build locally                        |
| `npm run type-check`    | Runs `tsc --noEmit` on the frontend                                  |
| `npm run format`        | Formats `src/**/*.{ts,tsx,json}` with Prettier                       |
| `npm run test`          | Runs frontend tests (Vitest + React Testing Library)                 |
| `npm run test:coverage` | Runs frontend tests with coverage                                    |
| `npm run knip`          | Runs `knip` to find unused files, exports, and dependencies (root + `api/` workspace) |

**Backend** (`backend/package.json`):

| Script              | What it does                              |
| -------------------- | ------------------------------------------ |
| `npm run dev`         | Runs the Express server with `tsx watch`   |
| `npm run build`       | Compiles TypeScript with `tsc`             |
| `npm start`           | Runs the compiled server (`dist/index.js`) |
| `npm run db:migrate`  | Runs `prisma migrate dev`                  |
| `npm run db:generate` | Runs `prisma generate`                     |
| `npm run backfill:shopping-lists` | One-time idempotent backfill: ensures every user has a "General" shopping list and re-points pre-existing items at it |
| `npm run test`        | Runs backend tests (Vitest + supertest)    |

### Deploying to Vercel

Set all environment variables in the Vercel project settings (both frontend `VITE_*` and backend variables). The build command (`npm run build`) runs `prisma generate` and `vite build`. No separate backend deployment is needed — the Express app is served as a Vercel Function automatically.

---

## Security

Authentication is fully delegated to Clerk:

| Concern                | Handled by                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- |
| Password hashing       | Clerk (managed, bcrypt-equivalent)                                               |
| Email verification     | Clerk (configurable, on by default)                                              |
| Brute-force protection | Clerk (automatic lockout)                                                        |
| Session rotation       | Clerk (short-lived JWTs, auto-refresh)                                           |
| JWT verification       | `@clerk/backend` on every protected request                                      |
| User data integrity    | Backend fetches user info from Clerk's API — never trusts client-provided values |
| HTTP security headers  | `helmet`                                                                         |
| CORS                   | Restricted to `FRONTEND_ORIGIN`                                                  |
| Rate limiting          | `express-rate-limit` (60 req / 15 min on auth routes; own limiters on recipes and chat routes, chat tighter at 15 req/min given streaming LLM cost) |
| Cron endpoint          | `CRON_SECRET` header required; unauthorized calls return 401                   |

---

## Roadmap

### v1.0 — Foundation ✅

- [x] Pantry product CRUD
- [x] Shopping list with checkboxes
- [x] Internationalization ES / EN
- [x] Installable PWA (service worker + manifest)
- [x] Responsive views: table on desktop / cards on mobile
- [x] Product suggestions while typing
- [x] Skeleton loading states for pantry and shopping views

### v1.1 — Auth & Sync ✅

- [x] Express + Prisma backend deployed as a Vercel Function
- [x] Neon PostgreSQL (serverless, free tier)
- [x] Authentication via Clerk (email + password + username)
- [x] Account linking model (partner / family)
- [x] Pantry and shopping list persisted in the database
- [x] Shared pantry between linked accounts (both users see and edit the same data)
- [x] Link invitation system (shareable URL, 48-hour expiry, optional email via Resend)
- [x] Guest mode: unauthenticated users can add products stored in localStorage, migrated to the server on sign-in

### v1.2 — Maps & Location

- [x] Nearby supermarkets via Geoapify Places API
- [x] Filter by store type (supermarket, grocery, bakery, deli, etc.)
- [x] Interactive map dialog per store (MapLibre GL + OpenFreeMap) with Google Maps directions link
- [ ] Filter supermarkets by maximum distance
- [ ] Save a preferred store per product

### v1.3 — Expiration Alerts

- [x] Push notifications for products expiring soon (VAPID/Web Push, daily Vercel Cron)
- [ ] Weekly expiration dashboard
- [ ] Deleted products history
- [ ] Customizable calendar tab to see what's about to expire

### v1.4 — Sharing & Export

- [ ] Real-time sync between linked accounts (WebSockets or polling)
- [x] Multiple shopping lists, to decide where to buy what — create, switch, and delete (with confirmation); archiving instead of deleting is planned for later, see `ROADMAP.md`
- [ ] Send items from shopping list to pantry automatically
- [ ] Share shopping list (public link or PDF)
- [ ] Export pantry to CSV
- [x] Recipes tab — search/filter, always-random results, infinite scroll, detail with servings + nutrition scaling, "send to a new shopping list" (Spoonacular, server-side key)
- [x] Favorite recipes — heart icon on the recipe photo (search cards and detail view) saves/unsaves it (removing asks for confirmation); separate Favorites tab lists them

### v1.5 — Recipe Chat & Multiple Lists

Related to the v1.4 items above. Multiple shopping lists and the Recipes tab shipped (see above), and so has the AI chat — see `ROADMAP.md` for the technical design and how the shipped version differs from the original single-turn design.

- [x] Free-form AI chat (Groq) to think through a recipe from what you have or want to cook — streaming, DB-persisted, sign-in required, dietary restrictions + servings collected up front, recipe suggestions routed through Spoonacular (see the Chat feature above)
- [ ] Automatic extraction of missing ingredients from the recipe into the shopping list (the chat's "suggest a recipe" flow already reuses the existing recipe-detail "send to a new shopping list" action; a dedicated extraction-from-freeform-text flow is still pending)
- [x] Multiple named shopping lists — a "General" list per user plus any created manually or from a recipe; no rename/delete UI yet (endpoints exist)
- [x] Groq wired up — used both to translate recipe content (title/ingredients/instructions) to Spanish and to power the Chat tab's streaming replies and recipe-suggestion extraction
- [x] Metric or imperial system settings — a switch in Preferencias and on each recipe's detail view (same persisted account preference either way), auto-converts ingredient amounts instantly (no refetch), and is passed to the AI chat prompt
- [x] Client-side response caching for recipe search/detail (TTL+LRU over `localStorage`) plus debounced filter inputs, to reduce Spoonacular API quota usage

### v1.6 — Testing & Environments

See `ROADMAP.md` for the technical design.

- [x] Unit tests for frontend hooks and business logic (Vitest + React Testing Library)
- [x] Integration tests for backend routes (Vitest + supertest)
- [x] CI on GitHub Actions: type-check + tests on every PR
- [x] Codebase integrity check (`knip`) — finds unused files, exports, and dependencies across the two workspaces (`.` and `backend`), `npm run knip`
- [ ] Development environment separated from production (DB, Clerk, env vars) — `.env.example` files and the runbook are ready (`docs/environments.md`); creating the actual Neon dev branch / Clerk dev instance / Vercel Preview env vars is a manual step

### v1.7 — Quality of Life & Reliability

See `ROADMAP.md` for the technical design.

- [ ] Undo on delete (toast with "Undo" instead of a hard confirm) in pantry and shopping list
- [ ] Invite a partner via QR code, as an alternative to the shareable link
- [ ] Production error monitoring (Sentry free tier)
- [ ] More languages beyond ES/EN
- [ ] header and general UI improvements to account for the app's growth
- [ ] Conflict resolution for edits made on two devices while one was offline
- [ ] Lightweight, privacy-friendly usage analytics
- [x] Migrate from MUI icons to react-icons — `@mui/icons-material` removed from the project entirely
- [x] Revisit the navigation tab icons with a deliberate pass over [react-icons](https://react-icons.github.io/react-icons/) for a fully consistent set — all 5 nav tabs now use the `MdOutline*` variant, with the selected tab merging visually into the page background on both desktop tabs and mobile bottom nav

### v1.8 — Smart Planning

See `ROADMAP.md` for the technical design.

- [ ] Weekly meal plan (via the AI chat) that generates a full shopping list, not just one recipe at a time
- [ ] Recurring items — mark a product as "repeats every N days/weeks" and get suggested to re-add it when due
- [ ] Dietary tags (vegan, gluten-free, etc.) on products, respected by the recipe chat's suggestions

### v1.9 — Reach & Control

See `ROADMAP.md` for the technical design.

- [ ] Package as a native app (Capacitor) for the Play Store / App Store, reusing the existing React codebase
- [ ] Full backup/restore — export everything (pantry, lists, history) to JSON and import it back
- [ ] Roles within a shared household (admin vs. member), once real households (backlog) exist
- [ ] Finer-grained notification preferences (choose which push categories to receive)
- [ ] Full-text search and combined filters in the pantry (location + near expiry + brand)

### v1.10 — Spending & Analytics

See `ROADMAP.md` for the technical design.

- [ ] Track price per purchase
- [ ] Monthly spending summary by category, with charts
- [ ] Spending trends over time and most-bought items
- [ ] Waste tracking: expired-unused vs. consumed, visualized

---

## Claude Code Tooling

The `.claude/` directory contains agents and slash commands that Claude Code uses to keep the codebase consistent.

### Agents (`.claude/agents/`)

| Agent             | Invoked by       | What it does                                                                                                                                                             |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `readme-updater`  | `/update-readme` | Reads the codebase and patches `README.md` with missing features, stack entries, project structure changes, and completed roadmap items. Never removes accurate content. |

### Commands (`.claude/commands/`)

| Command                    | What it does                                                               |
| -------------------------- | -------------------------------------------------------------------------- |
| `/update-readme`           | Runs the `readme-updater` agent to sync `README.md` with the codebase.     |
| `/create-docs`             | Scaffolds a new standards doc in `docs/` for a given layer of the app.     |
| `/merge-and-create-branch` | Commits current changes, merges to main, and creates a new branch locally (no push — done explicitly). |

### Coding standards (`docs/`)

| File                   | Covers                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `ui.md`                | MUI + styled-components conventions, CSS variables, color scheme system, responsive breakpoints |
| `auth.md`              | Clerk integration on frontend and backend, token flow, `requireAuth` middleware                 |
| `data-fetching.md`     | React Query `useQuery` patterns, `src/api/` layer, token-per-request rule                       |
| `data-mutations.md`    | React Query `useMutation` patterns, Express validation, Prisma ownership checks                 |
| `routing.md`           | View-state navigation (no URL router), auth gating via `isSignedIn`                             |
| `server-components.md` | Express backend structure, middleware order, `accessibleUserIds()`, error handling              |
| `environments.md`      | Runbook for separating dev/production environments (Neon branch, Clerk dev instance, Vercel Preview env vars) |

---

## License

Personal project. No distribution license at this time.
