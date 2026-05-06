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
- Add products with name, quantity, category, expiration date, and store.
- Table view on desktop, expandable cards on mobile.
- Sort by any column.
- Real-time search.
- Delete products with confirmation dialog.

### Shopping List
- Move products from the pantry directly to the shopping list.
- Mark items as purchased with a checkbox.
- Clear all purchased items in one click.

### Nearby Supermarkets
- Device geolocation.
- Supermarket search via **Geoapify Places API**.
- Distance calculated with the Haversine formula.
- 5-minute cache with React Query.

### Internationalization
- Full Spanish and English support.
- Language persists across sessions via `localStorage`.
- Over 300 product suggestions per language.

### Authentication
- Sign-up and login managed by **Clerk** (email + password + username).
- Clerk handles email verification, password security, and session management.
- Account linking between users (to share the pantry with a partner or family member).
- Backend verifies Clerk JWTs on every protected request; user data for sync is fetched directly from Clerk's API (never trusted from the client).

### Customization
- Color theme picker.
- Mobile-first design with bottom navigation on mobile and tabs on desktop.

---

## Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI and component logic |
| Vite 5 | Bundler and dev server |
| MUI v5 | UI components |
| styled-components v6 | Layout and container styles |
| TanStack React Query v5 | Fetching, caching, and server state |
| Clerk (`@clerk/clerk-react`) | Authentication UI and session management |
| i18next + react-i18next | Internationalization (ES / EN) |
| react-map-gl + MapLibre GL | Nearby supermarkets map |
| vite-plugin-pwa | Service worker and PWA manifest |

### Backend
| Technology | Purpose |
|---|---|
| Express 4 | HTTP server |
| TypeScript | Type safety |
| Prisma 5 | ORM |
| SQLite | Database |
| Clerk (`@clerk/backend`) | JWT verification + user data fetch |
| helmet + cors + express-rate-limit | Security headers, CORS, rate limiting |

---

## Project Structure

```
mi-despensa-app/
├── backend/                  # REST API
│   ├── prisma/
│   │   ├── schema.prisma     # Models: User (Clerk ID), UserLink
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts          # Express server entry point
│   │   ├── db/               # Prisma Client instance
│   │   ├── middleware/
│   │   │   └── auth.ts       # Clerk JWT verification
│   │   └── routes/
│   │       └── auth.ts       # /sync, /me, /link
│   └── data/                 # SQLite file (git-ignored)
│
└── src/                      # Frontend
    ├── main.tsx              # Entry point: ClerkProvider + QueryClient
    ├── App.tsx               # Routes and global state
    ├── api/
    │   ├── authApi.ts        # Sync and link backend calls
    │   ├── overpass.ts       # OpenStreetMap API queries
    │   └── productSuggestionsApi.ts
    ├── components/
    │   ├── Header/           # AppBar with search, language toggle, and tabs
    │   ├── BottomNav/        # Bottom navigation bar (mobile)
    │   ├── AddProductModal/  # Add product modal
    │   ├── AuthModal/        # Account linking modal
    │   ├── ConfirmDialog/    # Generic confirmation dialog
    │   ├── QuantityStepper/  # +/- quantity control
    │   └── ThemePicker/      # Color theme selector
    ├── views/
    │   ├── PantryView/       # Main pantry view
    │   ├── ShoppingView/     # Shopping list view
    │   └── AboutView/        # App info screen
    ├── context/
    │   └── AuthContext.tsx   # Partner state and link modal
    ├── contexts/
    │   └── ThemeContext.tsx  # Active color theme
    ├── hooks/
    │   ├── useAppState.ts    # Central pantry and list state
    │   ├── useLocalStorage.ts # localStorage persistence
    │   ├── useNearbyStores.ts # React Query → Geoapify API
    │   ├── useProductSuggestions.ts
    │   └── useDebounce.ts
    ├── i18n/
    │   ├── index.js          # i18next configuration
    │   └── locales/
    │       ├── es.json
    │       └── en.json
    ├── data/
    │   ├── products.json     # ~130 suggestions in Spanish
    │   └── products.en.json  # ~130 suggestions in English
    └── styles/
        └── theme.js          # Base MUI theme (green #2e7d32)
```

---

## Getting Started

### Prerequisites

- A [Clerk](https://clerk.com) account with an application configured:
  - Enable **Email + Password** authentication
  - Enable **Username** as a required sign-up field
  - Copy the **Publishable Key** and **Secret Key** from the Clerk dashboard

### Frontend

```bash
npm install
npm run dev
```

Frontend environment variables (`.env`):
```
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_GEOAPIFY_KEY=your_geoapify_key
```

### Backend

```bash
cd backend
npm install
npx prisma db push
npm run dev
```

Backend environment variables (`backend/.env`):
```
PORT=3001
CLERK_SECRET_KEY=sk_test_...
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL="file:./data/app.db"
```

---

## Security

Authentication is fully delegated to Clerk:

| Concern | Handled by |
|---|---|
| Password hashing | Clerk (bcrypt-equivalent, managed) |
| Email verification | Clerk (configurable, on by default) |
| Brute-force protection | Clerk (automatic lockout) |
| Session rotation | Clerk (short-lived JWTs, auto-refresh) |
| JWT verification | `@clerk/backend` on every protected request |
| User data integrity | Backend fetches user info from Clerk's API directly — never trusts client-provided values |
| HTTP security headers | `helmet` |
| CORS | Restricted to `FRONTEND_ORIGIN` |
| Rate limiting | `express-rate-limit` (60 req / 15 min) |

---

## Roadmap

### v1.0 — Foundation ✅
- [x] Pantry product CRUD
- [x] Shopping list with checkboxes
- [x] Internationalization ES / EN
- [x] Installable PWA (service worker + manifest)
- [x] Responsive views: table on desktop / cards on mobile
- [x] Product suggestions while typing

### v1.1 — Auth & Sync 🚧
- [x] Express + Prisma + SQLite backend
- [x] Authentication via Clerk (email + password + username)
- [x] Account linking model (partner / family)
- [ ] Persist pantry data in the database (currently localStorage)
- [ ] Real-time sync between linked accounts
- [ ] Multiple shopping lists, to decide where to buy what
- [ ] Send from shopping list to pantry automatically
- [ ] Auto expiry date for some products

### v1.2 — Maps & Location
- [x] Nearby supermarkets via Geoapify Places API
- [ ] Filter supermarkets by maximum distance
- [ ] Save a preferred store per product

### v1.3 — Expiration Alerts
- [ ] Push notifications for products expiring soon
- [ ] Weekly expiration dashboard
- [ ] Deleted products history
- [ ] Customizable calendar tab, to see what's about to expire and when the discounts are

### v1.4 — Sharing & Export
- [ ] Share shopping list (public link or PDF)
- [ ] Export pantry to CSV
- [ ] Recipe suggestions tag based on available ingredients using spoonacular

---

## License

Personal project. No distribution license at this time.
