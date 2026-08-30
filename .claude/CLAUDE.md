# mi-despensa-app

PWA para gestionar la despensa del hogar: inventario, lista de compras, notificaciones de vencimiento.

## Stack

- **Frontend**: React 18 + TypeScript + Vite 5, PWA via `vite-plugin-pwa`.
- **UI**: MUI v5 + styled-components v6 (archivos `.styles.ts`, no `.css`/`.module.css`).
- **Estado de servidor**: React Query (`@tanstack/react-query`).
- **Auth**: Clerk (`@clerk/clerk-react` en frontend, `@clerk/backend` en backend).
- **i18n**: i18next / react-i18next.
- **Mapas**: MapLibre GL + react-map-gl (búsqueda de supermercados cercanos).
- **Backend**: Express + TypeScript, Prisma 5 (`backend/prisma/schema.prisma`).
- **Deploy**: Vercel (`api/` es el entry serverless que envuelve `backend/`).

No hay ESLint ni tests configurados en este repo — no asumas que existen.

## Variables de entorno

- Frontend (`VITE_*`, ver `vite.config.ts` / `.env`): `VITE_API_URL`, claves públicas de Clerk.
- Backend: claves privadas de Clerk, `DATABASE_URL` (Prisma), claves VAPID (web push), credenciales de Resend (email).

No hardcodees URLs, keys ni secretos — siempre vía `import.meta.env.*` (frontend) o `process.env.*` (backend).

## Service worker

`src/sw.ts` es el source del service worker (`vite-plugin-pwa`, modo `injectManifest`) — maneja push y `notificationclick`. Tocar caching o el manejo de push ahí tiene impacto directo en producción (usuarios con una versión vieja cacheada); cambios ahí requieren más cuidado que un componente normal.

## Estructura

```
src/
  components/<Nombre>/     componentes reutilizables
  views/<Nombre>/          vistas (pantry, shopping, about), con subcomponentes anidados
  hooks/                   toda la lógica de fetching/mutations vive acá
  api/                     un archivo por dominio (pantryApi.ts, authApi.ts, ...)
  context(s)/              contextos de React
  styles/                  colorSchemes.ts (6 esquemas), theme.ts
  i18n/locales/
  utils/
  data/
backend/src/
  app.ts, index.ts
  db/                      cliente Prisma
  middleware/              auth.ts (verificación Clerk)
  routes/                  auth.ts, notifications.ts, pantry.ts
  services/                email.ts, webpush.ts
docs/                      specs de convenciones por capa (ver abajo)
```

## Comandos

- `npm run dev` — levanta frontend (Vite) y backend (Express) juntos vía `concurrently`.
- `npm run build` — `prisma generate` + `vite build`.
- `npm run type-check` — `tsc --noEmit`.
- `npm run format` — prettier sobre `src/`.

Entorno de desarrollo: Windows, PowerShell.

## Convenciones de código

Las reglas detalladas y accionables por capa están en `docs/`, léelas antes de asumir un patrón:

- `docs/ui.md` — estilos, colores, esquemas
- `docs/auth.md` — Clerk, dónde va `ClerkProvider`, cómo se identifica al usuario
- `docs/data-fetching.md` — hooks, React Query, `enabled: !!isSignedIn`
- `docs/data-mutations.md` — `useMutation`, invalidación de queries, ownership en backend
- `docs/routing.md` — no hay router, navegación es view-state
- `docs/server-components.md` — estructura y convenciones del backend Express/Prisma

Resumen de lo más importante:
- Sin React Router ni ningún router de URLs — la vista activa es un string union en `useAppState`.
- Los componentes nunca llaman `fetch()` directo; todo pasa por hooks en `src/hooks/` + `src/api/`.
- Toda query de datos de usuario va con `enabled: !!isSignedIn`.
- El backend identifica al usuario con `req.clerkUserId` (nunca desde body/params/query), y hace ownership check antes de escribir.
- Colores: variables CSS `--scheme-*` definidas en `src/styles/colorSchemes.ts` para los 6 esquemas — nunca hex/rgb hardcodeado en componentes.

## Modo invitado (guest mode)

Patrón no cubierto en `docs/` pero real y no trivial — antes de tocar `useGuestStorage`, `useGuestMigration` o `AuthContext`:
- Un usuario no autenticado puede usar la app con datos en `localStorage` (`src/utils/migrations.ts` migra claves ES→EN de versiones viejas).
- Al iniciar sesión, esos datos se migran al servidor. La migración usa `Promise.allSettled` (no `Promise.all`) para que un item que falle no tumbe el resto, y expone el error de forma explícita en vez de tragárselo.
- Las query keys de React Query deben mantenerse estables entre el estado invitado y el autenticado para que el cache no quede inconsistente durante/después de la migración.

## Mantenimiento del README

No hay hook automático que actualice el README en cada edición (se sacó por costo). Cuando quieras una pasada, usá explícitamente `/update-readme`.

## Roadmap

`ROADMAP.md` (raíz) tiene el detalle técnico de todo lo que está planeado pero no implementado (modelos de datos, endpoints, decisiones abiertas). `README.md` tiene la versión de producto (checklist por versión). Antes de proponer una feature nueva o una decisión de arquitectura, revisar si ya está contemplada ahí.

## Git

Nunca hacer `git push` (ni de `main` ni de una branch) sin que se pida explícitamente en ese momento — ni siquiera como parte de otro comando (ver `/merge-and-create-branch`, que commitea/mergea/crea branch pero no pushea).

## No agregar herramientas por iniciativa propia

Hoy no hay ESLint, ni tests, ni CI configurados (`ROADMAP.md` v1.6 los tiene planeados). No los agregues, ni cambies de formatter/linter, ni introduzcas un framework de testing, salvo que se pida explícitamente — aunque parezca una mejora obvia.
