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
- Infinite-scroll results grid, 4 recipes per page (`IntersectionObserver` sentinel).
- Detail view with an adjustable servings stepper that scales ingredient amounts and nutrition (calories/protein/carbs/fat) live.
- "Send to a new shopping list" creates a shopping list titled with the recipe name and seeded with the scaled ingredients, then offers to jump straight to it.
- Recipe titles, ingredient names, and instructions are translated to Spanish via **Groq** when the UI is in Spanish (Spoonacular itself doesn't support Spanish content) — fixed nutrition labels/units stay on the normal i18n system. Falls back to English on any translation error.
- Works fully for guests too (recipe browsing needs no auth; "send to list" writes to `localStorage` same as the rest of guest mode).

### Multiple Shopping Lists

- Every account has a non-deletable "General" shopping list, created automatically on first use.
- Additional named lists can be created (e.g. one per recipe sent from the Recipes tab), up to 20 per user.
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
 └── ShoppingList[]       — named shopping lists (one auto-created "General" list per user, plus any created manually or from Recipes)
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
│
├── backend/                  # Backend source
│   ├── prisma/
│   │   └── schema.prisma     # Models: User, UserLink, LinkInvitation, PushSubscription, Product, ShoppingItem, ShoppingList
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
│       │   ├── spoonacular.ts # Server-only Spoonacular client (searchRecipes/getRecipeInformation)
│       │   └── groq.ts       # translateRecipeContent — recipe content → Spanish, cached, fails soft to English
│       ├── middleware/
│       │   └── auth.ts       # Clerk JWT verification
│       └── routes/
│           ├── auth.ts       # /sync, /me, /link, /invite
│           ├── pantry.ts     # Products and shopping list CRUD (listId-aware)
│           ├── shoppingLists.ts # Shopping list CRUD (/api/pantry/shopping-lists)
│           ├── recipes.ts    # Public recipe search/detail proxy (/api/recipes), own rate limiter
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
    │   ├── recipesApi.ts        # Recipe search/detail calls (public — no token, unlike the rest of src/api/)
    │   ├── overpass.ts          # Geoapify Places API wrapper and shop-type map
    │   ├── productSuggestionsApi.ts # Open Food Facts live suggestions
    │   └── notificationsApi.ts  # Push subscription register/unregister calls
    ├── components/
    │   ├── Header/              # AppBar with hamburger drawer (mobile) and tabs (desktop)
    │   ├── BottomNav/
    │   ├── AddProductModal/
    │   ├── AuthModal/           # Account linking modal
    │   ├── ConfirmDialog/
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
    │   │   ├── RecipeCardGrid/    # Infinite-scroll grid (IntersectionObserver sentinel)
    │   │   ├── RecipeCard/        # Photo, title, ingredient chips
    │   │   ├── RecipeDetailPanel/ # Servings scaler, scaled ingredients/nutrition, "send to list"
    │   │   ├── ServingsStepper/   # Thin wrapper reusing QuantityStepper
    │   │   └── RecipesSkeleton.tsx # Skeleton UI shown while a search/detail loads
    │   └── AboutView/
    ├── context/
    │   └── AuthContext.tsx      # Partner state, link/invite flow, and guest migration trigger
    ├── contexts/
    │   └── ThemeContext.tsx
    ├── hooks/
    │   ├── useAppState.ts       # Central state: wires pantry hooks to UI handlers
    │   ├── usePantry.ts         # React Query hooks for products, shopping lists, and shopping list items
    │   ├── useRecipes.ts        # React Query hooks for recipe search (infinite) and detail — public, no isSignedIn gate
    │   ├── useNearbyStores.ts
    │   ├── useLocalStorage.ts
    │   ├── useProductSuggestions.ts
    │   ├── usePushNotifications.ts  # Web Push subscription management
    │   ├── useGuestStorage.ts       # localStorage CRUD for unauthenticated sessions
    │   ├── useGuestMigration.ts     # Migrates guest data to server on sign-in
    │   └── useDebounce.ts
    ├── styles/
    │   ├── colorSchemes.ts      # 6 selectable color schemes + CSS variable injection
    │   └── theme.ts             # MUI base theme options
    ├── utils/
    │   ├── types.ts             # Shared TypeScript interfaces and types
    │   ├── helpers.ts           # Date formatting and other shared utilities
    │   └── migrations.ts        # One-time localStorage key migration (ES → EN field names)
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
GROQ_API_KEY=...                   # optional — recipe content is served in English without it
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
| Rate limiting          | `express-rate-limit` (60 req / 15 min on auth routes)                            |
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
- [x] Multiple shopping lists, to decide where to buy what — schema/backend/frontend shipped; migration not yet applied to the shared dev DB, see `ROADMAP.md`
- [ ] Send items from shopping list to pantry automatically
- [ ] Share shopping list (public link or PDF)
- [ ] Export pantry to CSV
- [x] Recipes tab — search/filter, infinite scroll, detail with servings + nutrition scaling, "send to a new shopping list" (Spoonacular, server-side key)

### v1.5 — Recipe Chat & Multiple Lists

Related to the v1.4 items above. Multiple shopping lists and the Recipes tab shipped (see above); the free-form AI chat below is still pending — see `ROADMAP.md` for the technical design.

- [ ] Free AI chat (Groq) to think through a recipe from what you have or want to cook
- [ ] Automatic extraction of missing ingredients from the recipe into the shopping list
- [x] Multiple named shopping lists — a "General" list per user plus any created manually or from a recipe; no rename/delete UI yet (endpoints exist)
- [x] Groq wired up — currently used to translate recipe content (title/ingredients/instructions) to Spanish, not yet for the free-form chat above

### v1.6 — Testing & Environments

See `ROADMAP.md` for the technical design.

- [x] Unit tests for frontend hooks and business logic (Vitest + React Testing Library)
- [x] Integration tests for backend routes (Vitest + supertest)
- [x] CI on GitHub Actions: type-check + tests on every PR
- [ ] Development environment separated from production (DB, Clerk, env vars) — `.env.example` files and the runbook are ready (`docs/environments.md`); creating the actual Neon dev branch / Clerk dev instance / Vercel Preview env vars is a manual step

### v1.7 — Quality of Life & Reliability

See `ROADMAP.md` for the technical design.

- [ ] Undo on delete (toast with "Undo" instead of a hard confirm) in pantry and shopping list
- [ ] Invite a partner via QR code, as an alternative to the shareable link
- [ ] Production error monitoring (Sentry free tier)
- [ ] More languages beyond ES/EN
- [ ] Conflict resolution for edits made on two devices while one was offline
- [ ] Lightweight, privacy-friendly usage analytics

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

---

## License

Personal project. No distribution license at this time.
