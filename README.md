# My Pantry 🧺

A Progressive Web App (PWA) for managing your household pantry. Track what you have at home, when products expire, build your shopping list, and find nearby supermarkets — all from your phone, no installation required.

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
- Supermarket search via **Overpass API** (OpenStreetMap, no API key required).
- Distance calculated with the Haversine formula.
- 5-minute cache with React Query.

### Internationalization
- Full Spanish and English support.
- Language persists across sessions via `localStorage`.
- Over 130 product suggestions per language.

### Authentication
- Registration and login with JWT.
- Account linking between users (to share the pantry with a partner or family).

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
| axios | HTTP client |
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
| bcrypt | Password hashing |
| JWT | Stateless authentication |
| helmet + cors + express-rate-limit | Security |

---

## Project Structure

```
mi-despensa-app/
├── backend/                  # REST API
│   ├── prisma/
│   │   ├── schema.prisma     # Models: User, UserLink
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts          # Express server entry point
│   │   ├── db/               # Prisma Client instance
│   │   ├── middleware/
│   │   │   └── auth.ts       # JWT verification
│   │   └── routes/
│   │       └── auth.ts       # /register, /login, /link-account
│   └── data/                 # SQLite file (git-ignored)
│
└── src/                      # Frontend
    ├── main.tsx              # Entry point: QueryClient + i18n setup
    ├── App.tsx               # Routes and global state
    ├── api/
    │   ├── authApi.ts        # Auth backend calls
    │   ├── overpass.ts       # OpenStreetMap API queries
    │   └── productSuggestionsApi.ts
    ├── components/
    │   ├── Header/           # AppBar with search, language toggle, and tabs
    │   ├── BottomNav/        # Bottom navigation bar (mobile)
    │   ├── AddProductModal/  # Add product modal
    │   ├── AuthModal/        # Login / register modal
    │   ├── ConfirmDialog/    # Generic confirmation dialog
    │   ├── QuantityStepper/  # +/- quantity control
    │   └── ThemePicker/      # Color theme selector
    ├── views/
    │   ├── PantryView/       # Main pantry view
    │   ├── ShoppingView/     # Shopping list view
    │   └── AboutView/        # App info screen
    ├── context/
    │   └── AuthContext.tsx   # Global authentication state
    ├── contexts/
    │   └── ThemeContext.tsx  # Active color theme
    ├── hooks/
    │   ├── useAppState.ts    # Central pantry and list state
    │   ├── useLocalStorage.ts # localStorage persistence
    │   ├── useNearbyStores.ts # React Query → Overpass API
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

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

Backend environment variables (`backend/.env`):
```
DATABASE_URL="file:./data/dev.db"
JWT_SECRET="your_secret"
```

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
- [x] Registration / login with JWT
- [x] Account linking model (partner / family)
- [ ] Persist pantry data in the database (currently localStorage)
- [ ] Real-time sync between linked accounts

### v1.2 — Maps & Location
- [x] Nearby supermarkets via Overpass API
- [ ] Filter supermarkets by maximum distance
- [ ] Save a preferred store per product

### v1.3 — Expiration Alerts
- [ ] Push notifications for products expiring soon
- [ ] Weekly expiration dashboard
- [ ] Deleted products history

### v1.4 — Sharing & Export
- [ ] Share shopping list (public link or PDF)
- [ ] Export pantry to CSV
- [ ] Recipe suggestions based on available ingredients

---

## License

Personal project. No distribution license at this time.
