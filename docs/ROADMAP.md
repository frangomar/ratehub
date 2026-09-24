# RateHub App — Roadmap de fases

> Una fase por sesión. Cada fase termina con `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde, un resumen para el humano, y pausa para aprobación.

---

## Estado general

| Fase | Nombre | Estado |
|------|--------|--------|
| 0 | Base del proyecto | ✅ Completada |
| 1 | Base de datos y aislamiento | ⏳ Pendiente |
| 2 | Autenticación | ⏳ Pendiente |
| 3 | Admin e invitaciones | ⏳ Pendiente |
| 4 | Proveedores y sincronización (mock) | ⏳ Pendiente |
| 5 | Dashboard | ⏳ Pendiente |
| 6 | Google Business Profile real | ⏳ Pendiente |
| 7 | Producción | ⏳ Pendiente |

---

## Fase 0 — Base del proyecto ✅

**Objetivo:** andamio del proyecto listo para construir encima.

### Checklist
- [x] Next.js 15 (App Router) + TypeScript strict
- [x] pnpm como gestor de paquetes
- [x] ESLint + Prettier configurados
- [x] Tailwind CSS v4 + shadcn/ui inicializado
- [x] `src/lib/env.ts` con validación Zod de variables de entorno
- [x] `.env.example` con todas las variables documentadas
- [x] Clientes Supabase skeleton (server, browser, admin — sin lógica aún)
- [x] Página mínima en `/` que redirige (placeholder)
- [x] CI en GitHub Actions: lint, typecheck, test en cada PR
- [x] `docs/PROMPT-MAESTRO.md` y `docs/ROADMAP.md` en el repo
- [x] `supabase/config.toml` para desarrollo local

### Terminado cuando
Preview de Vercel funciona y CI corre en cada PR.

---

## Fase 1 — Base de datos y aislamiento ⏳

**Objetivo:** esquema Postgres completo con RLS multi-tenant probado.

### Checklist
- [ ] Migraciones SQL completas (sección 4 del PROMPT-MAESTRO)
- [ ] Funciones auxiliares RLS: `is_org_member`, `org_role`, `is_staff`
- [ ] Políticas RLS en todas las tablas
- [ ] `supabase/seed.sql`: 2 orgs, 3 usuarios, 1 staff, datos mock
- [ ] Tipos generados: `supabase gen types typescript`
- [ ] Tests de aislamiento obligatorios (sección 4.2): ninguna fuga entre tenants
- [ ] Tests de permisos: member no puede invitar; owner sí, solo en su org
- [ ] `integration_credentials` y `oauth_states`: nadie puede leerlos con sesión de usuario

### Terminado cuando
Todos los tests de aislamiento pasan y **fallarían** si se quita una política RLS.

---

## Fase 2 — Autenticación ⏳

**Objetivo:** login funcional con guards de acceso por organización.

### Checklist
- [ ] Clientes Supabase implementados: `server.ts`, `browser.ts`, `admin.ts`
- [ ] `middleware.ts` para refresco de sesión (según `@supabase/ssr`)
- [ ] `/login`: magic link (`shouldCreateUser: false`) + "Continuar con Google"
- [ ] `auth/callback/route.ts`: callback de Supabase Auth
- [ ] Guards: `requireUser`, `requireOrgRole`, `requireStaff` en `lib/auth/guards.ts`
- [ ] Redirección post-login: staff → `/admin`, con org → `/o/[slug]`, sin org → `/sin-acceso`
- [ ] `/sin-acceso`: mensaje claro con instrucciones
- [ ] `o/[orgSlug]/layout.tsx`: valida sesión + membresía en servidor, 404 si no existe/no es miembro
- [ ] `admin/layout.tsx`: exige `is_staff`, 404 si no
- [ ] Cookie `last_org` para recordar la última org usada

### Terminado cuando
Los usuarios del seed entran a su organización y no pueden abrir la de otros.

---

## Fase 3 — Admin e invitaciones ⏳

**Objetivo:** staff puede crear organizaciones e invitar owners; owners pueden invitar members.

### Checklist
- [ ] Panel admin `/admin`: listado de organizaciones
- [ ] `/admin/organizaciones/nueva`: formulario (nombre, slug, email owner, is_demo)
- [ ] `/admin/organizaciones/[orgId]`: detalle con miembros, integraciones, sync_runs, acciones
- [ ] Generación de token de invitación (32 bytes base64url, sha256 en DB, vence 7 días)
- [ ] Email de invitación con Resend (plantilla en español)
- [ ] `/invitacion/[token]`: todos los estados (inválido, vencido, email distinto, aceptar)
- [ ] Creación de membresía con service role tras validación
- [ ] `audit_log`: registro de `integration.connected`, `member.invited`, `staff.viewed_org`
- [ ] Configuración → Miembros: owner invita, reenvía, revoca, quita miembros
- [ ] Documentación en README: cómo marcar el primer staff

### Terminado cuando
Staff crea una org, el invitado recibe el email, entra como owner, e invita a un member.

---

## Fase 4 — Proveedores y sincronización (con mock) ⏳

**Objetivo:** motor de sync funcionando con el proveedor simulado.

### Checklist
- [ ] Contrato del proveedor (`src/lib/integrations/types.ts`)
- [ ] Registry de proveedores (`src/lib/integrations/registry.ts`)
- [ ] Proveedor mock: locales y reviews deterministas por semilla de org
- [ ] `lib/crypto/tokens.ts`: encrypt/decrypt AES-256-GCM con `key_version`
- [ ] Onboarding mock: conectable sin OAuth real para orgs demo o `ENABLE_MOCK_PROVIDER=true`
- [ ] Motor de sync (`src/lib/sync/engine.ts`): upsert por cursor, renovar `fetched_at`/`expires_at`
- [ ] Planificador (`scheduler.ts`): incremental >6h, full >7 días
- [ ] Cola con `FOR UPDATE SKIP LOCKED` en función SQL
- [ ] `/api/cron/tick`: protegido con `CRON_SECRET`, presupuesto de tiempo
- [ ] `/api/cron/purge`: borra reviews vencidas, oauth_states y sync_runs viejos
- [ ] "Sincronizar ahora": límite de frecuencia 15 minutos
- [ ] Backoff exponencial con jitter ante 429/5xx (máximo 3 intentos)
- [ ] `sync/config.ts`: constantes de frecuencias y presupuesto
- [ ] Tests del motor: sync completo, incremental, cursor entre ticks, purga

### Terminado cuando
Una org demo tiene locales y reviews que se sincronizan por cron, se retoman por cursor y se purgan por vencimiento.

---

## Fase 5 — Dashboard ⏳

**Objetivo:** todas las pantallas de la sección 6 funcionando con datos mock.

### Checklist
- [ ] Tokens de diseño en `tailwind.config.ts` (colores, tipografía, radios)
- [ ] Layout con sidebar (desktop) y menú superior (mobile)
- [ ] Selector de local global persistido en URL (`?local=`)
- [ ] Onboarding: paso 1 (conectar), paso 2 (elegir locales), paso 3 (progreso sync)
- [ ] Resumen: puntaje oficial, reseñas últimos 30 días, % respondidas, distribución 1-5, volumen semanal 12 sem
- [ ] Las 5 reseñas más recientes con link "Ver todas"
- [ ] Reseñas: listado paginado (25/página cursor), filtros en URL, orden, "ver más"
- [ ] Locales: tabla/tarjetas, estado, última sync, activar/desactivar, "Sincronizar ahora"
- [ ] Configuración → Integraciones: estado, cuenta, error legible, reconectar/desconectar
- [ ] Configuración → Miembros (UI completa)
- [ ] Configuración → Cuenta: nombre y cerrar sesión
- [ ] Estados en todas las pantallas: carga (skeletons), vacío, error, `needs_reauth`
- [ ] Responsive: funciona en desktop y 375 px
- [ ] Contraste AA, foco de teclado, `prefers-reduced-motion`, táctiles 44 px

### Terminado cuando
Todas las pantallas de la sección 6 funcionan en desktop y en 375 px, con todos sus estados.

---

## Fase 6 — Google Business Profile real ⏳

**Objetivo:** conexión OAuth real con GBP funcionando de punta a punta.

### Checklist
- [ ] Leer la política de contenido de GBP completa antes de implementar
- [ ] `GET /api/integrations/google_business_profile/start`: PKCE, `oauth_states`, redirect
- [ ] `GET /api/integrations/google_business_profile/callback`: validación completa
  - [ ] Verificar `business.manage` en scopes
  - [ ] Verificar presencia de `refresh_token`
  - [ ] Verificar id_token o userinfo para obtener `sub` y `email`
- [ ] Listado de cuentas: `mybusinessaccountmanagement.googleapis.com/v1/accounts`
- [ ] Listado de locales: `mybusinessbusinessinformation.googleapis.com/v1/{account}/locations`
- [ ] Fetch de reviews: `mybusiness.googleapis.com/v4/{account}/{location}/reviews`
- [ ] Mapper: `starRating ONE…FIVE → 1-5`, todos los campos del contrato
- [ ] `official_average_rating` y `official_total_reviews` desde respuesta de Google
- [ ] Refresco automático de access token (vence en <60 segundos)
- [ ] Manejo de `invalid_grant`: estado `needs_reauth`, banner en toda la app
- [ ] Desconexión: revocar token, borrar credentials/locations/reviews, audit_log
- [ ] Tests del mapper con fixtures JSON reales anonimizadas
- [ ] Banner "Reconectá tu cuenta de Google" cuando `needs_reauth`
- [ ] Documentación en README: configuración de Google Cloud, APIs a habilitar

### Terminado cuando
Con cuenta de prueba en Google Cloud: conectar → importar locales y reviews reales → desconectar y todo queda borrado.

---

## Fase 7 — Producción ⏳

**Objetivo:** app lista para el primer cliente real.

### Checklist
- [ ] `/legal/privacidad`: política con sección de datos de Google (placeholders para asesoría legal)
- [ ] `/legal/terminos`: con placeholders
- [ ] Headers de seguridad: CSP básica, `X-Frame-Options: DENY`, `Referrer-Policy`
- [ ] Ningún secreto en el bundle del cliente (revisar build)
- [ ] Endpoints de cron rechazan sin `CRON_SECRET`
- [ ] Desconectar Google probado de punta a punta en producción
- [ ] Dominio `app.ratehub.com.ar` en Vercel + CNAME en Cloudflare (DNS only)
- [ ] Proyecto Supabase `ratehub-prod` en `sa-east-1`
- [ ] Migraciones aplicadas a producción vía `supabase db push`
- [ ] Auth de Supabase: Site URL, Redirect URLs, SMTP con Resend, plantillas en español
- [ ] Variables de entorno de producción completas y validadas
- [ ] README completo: setup local, variables, primer staff, Google Cloud, agregar proveedor
- [ ] Guía para enviar app OAuth a verificación de Google (video demo, justificación de scope)
- [ ] Checklist 8.5 del PROMPT-MAESTRO completo

### Terminado cuando
El fundador puede invitar al primer cliente real y el checklist 8.5 está completo.

---

## Decisiones de arquitectura registradas

| Decisión | Razón |
|----------|-------|
| Next.js App Router (no Pages) | Server Components, Server Actions, despliegue nativo Vercel |
| supabase-js sin ORM | RLS aplica automáticamente con el cliente de sesión del usuario; un ORM con conexión directa saltearía RLS |
| AES-256-GCM para tokens | Cifrado autenticado; `key_version` permite rotación sin downtime |
| Cola en `sync_runs` sin infra extra | Suficiente para MVP; migrar a Inngest/Trigger.dev sin cambiar proveedores |
| Proveedor `mock` con semilla por org | Desarrollo sin API real, previews de Vercel, cuenta demo para Google |

---

## Notas para el equipo

- **Primer staff:** `update profiles set is_staff = true where email = 'tu@email.com';` — ejecutar en Supabase SQL editor, nunca desde la app.
- **Google Cloud:** el agente documenta la configuración en el README; el humano crea los proyectos y clientes OAuth.
- **Previews de Vercel:** usan Supabase staging + solo proveedor mock (URLs de preview cambian, no se registran en Google OAuth).
