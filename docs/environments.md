# Entornos: dev vs. producción

Hoy hay una sola base de datos (Neon), una sola instancia de Clerk y una sola configuración de env vars en Vercel — es decir, desarrollar localmente o correr tests de integración toca los mismos datos/usuarios reales que producción. Esta guía es el runbook para separar eso, un paso a la vez. Ninguno de estos pasos es automatizable desde el repo: requieren entrar a los dashboards de Neon, Clerk y Vercel con tu cuenta.

## 1. Base de datos: crear un branch de Neon para dev

1. Entrá al [dashboard de Neon](https://console.neon.tech), abrí el proyecto de mi-despensa.
2. Creá un branch nuevo a partir de `main` (o el branch de producción actual) y llamalo `dev`.
3. En el branch `dev`, copiá los dos connection strings que da Neon:
   - **Pooled connection** → `DATABASE_URL` en `backend/.env`.
   - **Direct connection** → `DATABASE_URL_UNPOOLED` en `backend/.env`.
4. Nunca apuntes `backend/.env` local al branch de producción.

## 2. Auth: crear una instancia de desarrollo en Clerk

1. En el [dashboard de Clerk](https://dashboard.clerk.com), el proyecto ya tiene (o podés crear) una instancia **Development** separada de la de **Production**.
2. Copiá las claves de la instancia de desarrollo:
   - Publishable key → `VITE_CLERK_PUBLISHABLE_KEY` en `.env` (raíz).
   - Secret key → `CLERK_SECRET_KEY` en `backend/.env`.
3. Los usuarios/sesiones de la instancia de desarrollo son completamente independientes de los de producción — podés crear usuarios de prueba sin riesgo.

## 3. Completar los `.env` locales

Copiá los templates y completá con los valores de los pasos 1 y 2 (más las claves de Resend/Geoapify/Spoonacular que ya tengas):

```
cp .env.example .env
cp backend/.env.example backend/.env
```

Ver `.env.example` / `backend/.env.example` para qué variable va en cada archivo.

## 4. Vercel: separar Preview de Production

1. En el proyecto de Vercel → **Settings → Environment Variables**.
2. Para cada variable, en vez de un único valor "para todos los entornos", definí valores distintos por *Environment*:
   - **Production** → los valores reales (Neon branch de producción, instancia Clerk Production).
   - **Preview** (y opcionalmente **Development**) → los valores del branch `dev` de Neon y la instancia Clerk Development.
3. Esto hace que los preview deployments de PRs (`vercel.json` ya define el build) nunca toquen la base de datos ni los usuarios de producción.

## Notas

- El código no distingue entornos por lógica propia — todo pasa por env vars (`import.meta.env.*` en frontend, `process.env.*` en backend), así que este cambio es puramente de configuración, no de código.
- Los tests (`npm test` / `npm test --prefix backend`) no dependen de nada de esto: mockean Prisma y Clerk, así que corren igual sin un branch `dev` configurado. Ver `ROADMAP.md` v1.6 para la decisión de mantenerlos mockeados por ahora.
