# Mi Despensa 🧺

Aplicación web progresiva (PWA) para gestionar la despensa del hogar. Controla qué tenés en casa, cuándo vence cada producto, armá tu lista de compras y encontrá supermercados cercanos — todo desde el celular, sin instalar nada.

---

## ¿Qué es una PWA?

Una **Progressive Web App** es una aplicación web que se comporta como una app nativa:

- **Instalable** — se puede agregar a la pantalla de inicio del celular desde el navegador, sin pasar por una tienda de apps.
- **Offline-first** — el service worker cachea los recursos estáticos para que la app cargue sin conexión.
- **Responsive** — diseñada mobile-first, funciona en cualquier pantalla.
- **Segura** — solo corre sobre HTTPS.

En este proyecto la PWA está configurada con `vite-plugin-pwa`, que genera automáticamente el `manifest.json` y el service worker.

---

## Features

### Despensa
- Agregar productos con nombre, cantidad, categoría, fecha de vencimiento y tienda de compra.
- Vista en tabla (desktop) y tarjetas expandibles (mobile).
- Ordenar por cualquier columna.
- Buscador en tiempo real.
- Eliminar productos con confirmación.

### Lista de compras
- Mover productos de la despensa directamente a la lista de compras.
- Marcar ítems como comprados con un checkbox.
- Limpiar comprados de un solo clic.

### Supermercados cercanos
- Geolocalización del dispositivo.
- Búsqueda de supermercados vía **Overpass API** (OpenStreetMap, sin API key).
- Distancia calculada con fórmula de Haversine.
- Caché de 5 minutos con React Query.

### Internacionalización
- Español e inglés completos.
- El idioma persiste entre sesiones via `localStorage`.
- Más de 130 sugerencias de productos por idioma.

### Autenticación
- Registro e inicio de sesión con JWT.
- Vinculación de cuentas entre usuarios (para compartir despensa con la pareja o familia).

### Personalización
- Selector de tema de colores.
- Diseño mobile-first con navegación inferior en celular y tabs en desktop.

---

## Stack

### Frontend
| Tecnología | Uso |
|---|---|
| React 18 + TypeScript | UI y lógica de componentes |
| Vite 5 | Bundler y dev server |
| MUI v5 | Componentes de interfaz |
| styled-components v6 | Layout y estilos de contenedores |
| TanStack React Query v5 | Fetching, caché y estado de servidor |
| axios | Cliente HTTP |
| i18next + react-i18next | Internacionalización (ES / EN) |
| react-map-gl + MapLibre GL | Mapa de supermercados cercanos |
| vite-plugin-pwa | Service worker y manifiesto PWA |

### Backend
| Tecnología | Uso |
|---|---|
| Express 4 | Servidor HTTP |
| TypeScript | Tipado |
| Prisma 5 | ORM |
| SQLite | Base de datos |
| bcrypt | Hash de contraseñas |
| JWT | Autenticación stateless |
| helmet + cors + express-rate-limit | Seguridad |

---

## Estructura del proyecto

```
mi-despensa-app/
├── backend/                  # API REST
│   ├── prisma/
│   │   ├── schema.prisma     # Modelos: User, UserLink
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts          # Entrada del servidor Express
│   │   ├── db/               # Instancia de Prisma Client
│   │   ├── middleware/
│   │   │   └── auth.ts       # Verificación de JWT
│   │   └── routes/
│   │       └── auth.ts       # /register, /login, /link-account
│   └── data/                 # Archivo SQLite (ignorado en git)
│
└── src/                      # Frontend
    ├── main.tsx              # Punto de entrada: QueryClient + i18n
    ├── App.tsx               # Rutas y estado global
    ├── api/
    │   ├── authApi.ts        # Llamadas al backend de autenticación
    │   ├── overpass.ts       # Consultas a la API de OpenStreetMap
    │   └── productSuggestionsApi.ts
    ├── components/
    │   ├── Header/           # AppBar con buscador, idioma y tabs
    │   ├── BottomNav/        # Navegación inferior (mobile)
    │   ├── AddProductModal/  # Modal para agregar producto
    │   ├── AuthModal/        # Modal de login / registro
    │   ├── ConfirmDialog/    # Diálogo de confirmación genérico
    │   ├── QuantityStepper/  # Control de cantidad +/-
    │   └── ThemePicker/      # Selector de tema de color
    ├── views/
    │   ├── PantryView/       # Vista principal de la despensa
    │   ├── ShoppingView/     # Lista de compras
    │   └── AboutView/        # Información de la app
    ├── context/
    │   └── AuthContext.tsx   # Estado de autenticación global
    ├── contexts/
    │   └── ThemeContext.tsx  # Tema de color activo
    ├── hooks/
    │   ├── useAppState.ts    # Estado central de despensa y lista
    │   ├── useLocalStorage.ts # Persistencia en localStorage
    │   ├── useNearbyStores.ts # React Query → Overpass API
    │   ├── useProductSuggestions.ts
    │   └── useDebounce.ts
    ├── i18n/
    │   ├── index.js          # Configuración de i18next
    │   └── locales/
    │       ├── es.json
    │       └── en.json
    ├── data/
    │   ├── products.json     # ~130 sugerencias en español
    │   └── products.en.json  # ~130 sugerencias en inglés
    └── styles/
        └── theme.js          # Tema MUI base (verde #2e7d32)
```

---

## Instalación y desarrollo

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

Variables de entorno del backend (`backend/.env`):
```
DATABASE_URL="file:./data/dev.db"
JWT_SECRET="tu_secreto"
```

---

## Roadmap

### v1.0 — Base ✅
- [x] CRUD de productos en despensa
- [x] Lista de compras con checkboxes
- [x] Internacionalización ES / EN
- [x] PWA instalable (service worker + manifest)
- [x] Vista responsive: tabla desktop / tarjetas mobile
- [x] Sugerencias de productos al escribir

### v1.1 — Auth y sincronización 🚧
- [x] Backend Express + Prisma + SQLite
- [x] Registro / login con JWT
- [x] Modelo de vinculación entre cuentas (pareja / familia)
- [ ] Persistencia de despensa en base de datos (actualmente en localStorage)
- [ ] Sincronización en tiempo real entre usuarios vinculados

### v1.2 — Mapas y ubicación
- [x] Supermercados cercanos con Overpass API
- [ ] Filtro de supermercados por distancia máxima
- [ ] Guardar tienda favorita por producto

### v1.3 — Vencimientos y alertas
- [ ] Notificaciones push para productos próximos a vencer
- [ ] Dashboard de vencimientos de la semana
- [ ] Historial de productos eliminados

### v1.4 — Social y exportación
- [ ] Compartir lista de compras (link público o PDF)
- [ ] Exportar despensa a CSV
- [ ] Sugerencias de recetas basadas en lo que hay en casa

---

## Licencia

Proyecto personal. Sin licencia de distribución por el momento.
