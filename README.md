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

### Nearby Supermarkets
- Device geolocation.
- Supermarket search via **Geoapify Places API**.
- Distance calculated with the Haversine formula.
- 5-minute cache with React Query.

### Shared Pantry
- Link two accounts (partner, family member) from the profile menu.
- Both users see and edit the same pantry and shopping list.
- All data is stored in PostgreSQL and scoped to the linked pair.

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

For local development, the frontend and backend run as separate processes.

---

## Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI and component logic |
| Vite 5 | Bundler and dev server |
| MUI v5 | UI components |
| styled-components v6 | Layout and container styles |
| TanStack React Query v5 | Server state: fetching, caching, mutations |
| Clerk (`@clerk/clerk-react`) | Authentication UI and session management |
| i18next + react-i18next | Internationalization (ES / EN) |
| react-map-gl + MapLibre GL | Nearby supermarkets map |
| vite-plugin-pwa | Service worker and PWA manifest |

### Backend
| Technology | Purpose |
|---|---|
| Express 4 | HTTP framework, exported as a Vercel Function |
| TypeScript | Type safety |
| Prisma 5 | ORM |
| Neon PostgreSQL | Serverless Postgres database |
| Clerk (`@clerk/backend`) | JWT verification + user data fetch |
| helmet + cors + express-rate-limit | Security headers, CORS, rate limiting |

---

## Data Model

```
User (Clerk ID)
 ├── UserLink          — links two users to share a pantry
 ├── Product[]         — pantry items owned by this user
 └── ShoppingItem[]    — shopping list items owned by this user
```

When two users are linked, all pantry and shopping list reads include items from both users. Writes always set the current user as owner.

---

## Project Structure

```
mi-despensa-app/
├── api/
│   └── index.ts              # Vercel Function entry point (re-exports Express app)
├── vercel.json               # Rewrites /api/* → api/index
│
├── backend/                  # Backend source
│   ├── prisma/
│   │   └── schema.prisma     # Models: User, UserLink, Product, ShoppingItem
│   └── src/
│       ├── app.ts            # Express app (no listen — shared by local and Vercel)
│       ├── index.ts          # Local dev entry: imports app, calls listen
│       ├── db/
│       │   └── index.ts      # Prisma client singleton (serverless-safe)
│       ├── middleware/
│       │   └── auth.ts       # Clerk JWT verification
│       └── routes/
│           ├── auth.ts       # /sync, /me, /link
│           └── pantry.ts     # Products and shopping list CRUD
│
└── src/                      # Frontend
    ├── main.tsx              # Entry: ClerkProvider + QueryClientProvider
    ├── App.tsx               # Root layout and global state
    ├── api/
    │   ├── authApi.ts        # Sync and link calls
    │   ├── pantryApi.ts      # Products and shopping list calls
    │   └── productSuggestionsApi.ts
    ├── components/
    │   ├── Header/           # AppBar with hamburger drawer (mobile) and tabs (desktop)
    │   ├── BottomNav/
    │   ├── AddProductModal/
    │   ├── AuthModal/        # Account linking modal
    │   ├── ConfirmDialog/
    │   ├── QuantityStepper/
    │   └── ThemePicker/
    ├── views/
    │   ├── PantryView/
    │   ├── ShoppingView/
    │   └── AboutView/
    ├── context/
    │   └── AuthContext.tsx   # Partner state and link modal
    ├── contexts/
    │   └── ThemeContext.tsx
    ├── hooks/
    │   ├── useAppState.ts    # Central state: wires pantry hooks to UI handlers
    │   ├── usePantry.ts      # React Query hooks for products and shopping list
    │   ├── useNearbyStores.ts
    │   ├── useProductSuggestions.ts
    │   └── useDebounce.ts
    ├── i18n/
    │   └── locales/
    │       ├── es.json
    │       └── en.json
    └── data/
        ├── products.json
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
```

**Backend** (`backend/.env`):
```
PORT=3001
CLERK_SECRET_KEY=sk_test_...
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://...?sslmode=require          # pooled (pgbouncer)
DATABASE_URL_UNPOOLED=postgresql://...?sslmode=require  # direct
```

### 3. Push the schema

```bash
cd backend
npx prisma db push
```

### 4. Run locally

```bash
# Terminal 1 — frontend
npm run dev

# Terminal 2 — backend
cd backend && npm run dev
```

### Deploying to Vercel

Set all environment variables in the Vercel project settings (both frontend `VITE_*` and backend variables). The build command (`npm run build`) runs `prisma generate` and `vite build`. No separate backend deployment is needed — the Express app is served as a Vercel Function automatically.

---

## Security

Authentication is fully delegated to Clerk:

| Concern | Handled by |
|---|---|
| Password hashing | Clerk (managed, bcrypt-equivalent) |
| Email verification | Clerk (configurable, on by default) |
| Brute-force protection | Clerk (automatic lockout) |
| Session rotation | Clerk (short-lived JWTs, auto-refresh) |
| JWT verification | `@clerk/backend` on every protected request |
| User data integrity | Backend fetches user info from Clerk's API — never trusts client-provided values |
| HTTP security headers | `helmet` |
| CORS | Restricted to `FRONTEND_ORIGIN` |
| Rate limiting | `express-rate-limit` (60 req / 15 min on auth routes) |

---

## Roadmap

### v1.0 — Foundation ✅
- [x] Pantry product CRUD
- [x] Shopping list with checkboxes
- [x] Internationalization ES / EN
- [x] Installable PWA (service worker + manifest)
- [x] Responsive views: table on desktop / cards on mobile
- [x] Product suggestions while typing

### v1.1 — Auth & Sync ✅
- [x] Express + Prisma backend deployed as a Vercel Function
- [x] Neon PostgreSQL (serverless, free tier)
- [x] Authentication via Clerk (email + password + username)
- [x] Account linking model (partner / family)
- [x] Pantry and shopping list persisted in the database
- [x] Shared pantry between linked accounts (both users see and edit the same data)

### v1.2 — Maps & Location
- [x] Nearby supermarkets via Geoapify Places API
- [ ] Filter supermarkets by maximum distance
- [ ] Save a preferred store per product

### v1.3 — Expiration Alerts
- [ ] Push notifications for products expiring soon
- [ ] Weekly expiration dashboard
- [ ] Deleted products history
- [ ] Customizable calendar tab to see what's about to expire

### v1.4 — Sharing & Export
- [ ] Real-time sync between linked accounts (WebSockets or polling)
- [ ] Multiple shopping lists, to decide where to buy what
- [ ] Send items from shopping list to pantry automatically
- [ ] Share shopping list (public link or PDF)
- [ ] Export pantry to CSV
- [ ] Recipe suggestions based on available ingredients

---

## License

Personal project. No distribution license at this time.
