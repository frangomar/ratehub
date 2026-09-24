# Prompt maestro — MVP de RateHub

> Documento para un agente de código (Claude Code, Cursor o similar). Colocalo en la raíz del repo como `docs/PROMPT-MAESTRO.md` y pedile al agente que lo lea completo antes de empezar.

---

## 0. Cómo tenés que trabajar (reglas para el agente)

1. **Trabajá por fases (sección 9) y detenete al final de cada una.** Al terminar una fase, entregá: resumen de lo hecho, cómo probarlo localmente, decisiones que tomaste y dudas abiertas. No empieces la fase siguiente hasta que el humano la apruebe.
2. **No inventes endpoints, parámetros ni APIs.** Todo lo relativo a Google Business Profile (GBP), Supabase, Vercel y Next.js verificalo contra la documentación oficial vigente antes de implementarlo. Si la documentación contradice este documento, frená y avisá; no elijas en silencio.
3. **Usá las versiones estables actuales** de cada librería (verificalas con npm). No agregues dependencias que no estén en este documento sin justificar por qué.
4. **Alcance cerrado.** No construyas nada de la sección 7 ("Fuera del MVP") aunque parezca fácil. Si algo del alcance es ambiguo, preguntá.
5. **Seguridad multi-tenant primero.** Ningún dato de una organización puede ser visible para otra. Esto se garantiza en la base de datos (RLS) y se verifica con tests automáticos (fase 1). Un test de aislamiento que falla bloquea todo lo demás.
6. **Secretos solo en el servidor.** Ningún token, clave de servicio ni credencial de Google puede llegar al navegador. Todo módulo que use la service role key o descifre tokens lleva `import "server-only"`.
7. **Código:** TypeScript en modo `strict`, sin `any` salvo justificado. Validación de toda entrada externa con Zod. Commits pequeños y descriptivos.

---

## 1. Contexto del producto

**RateHub** (ratehub.com.ar) es una SaaS B2B que centraliza en un solo dashboard las reseñas online de un negocio que hoy están dispersas en distintas plataformas.

- **Cliente:** negocios con uno o varios locales (restaurantes, hoteles, comercios, clínicas, apps).
- **MVP:** una sola fuente real, Google Business Profile, conectada por OAuth por el propio cliente. Solo lectura.
- **Futuro:** Meta (Facebook), TripAdvisor, App Store, Play Store. La arquitectura debe permitir agregarlas sin tocar el núcleo (patrón adaptador, sección 3.3).
- **Acceso:** solo por invitación. No hay registro abierto. El equipo de RateHub crea la organización del cliente e invita al dueño por email.
- **URL del producto:** `https://app.ratehub.com.ar`. La landing (`ratehub.com.ar`) es otro proyecto y otro repo; no la toques.
- **Idioma de la interfaz:** español de Argentina, con trato de vos. Fechas en zona horaria `America/Argentina/Buenos_Aires`; en la base de datos todo se guarda en UTC.
- **Dispositivos:** web app responsiva; tiene que funcionar bien en desktop y en el navegador del celular.

### 1.1 Conceptos clave (no los mezcles)

- **Login ≠ conexión de datos.** Entrar a RateHub (autenticación del usuario) es independiente de conectar Google Business Profile (autorización OAuth con el scope `business.manage`). Quien usa el dashboard puede no ser el dueño de la cuenta de Google del negocio. El login nunca pide `business.manage`.
- **La integración pertenece a la organización, no al usuario.** Si el usuario que conectó Google deja la organización, la integración sigue funcionando.
- **No existe "un dashboard por cliente".** Hay una sola app; cada cliente es una fila en `organizations` y ve solo sus datos.

---

## 2. Restricciones de Google que el diseño DEBE respetar

Fuente: https://developers.google.com/my-business/content/policies (leela completa antes de la fase 6).

1. **Almacenamiento limitado.** La política permite guardar cantidades limitadas de contenido solo para mejorar el rendimiento, por no más de 30 días, de forma segura y sin manipularlo ni agregarlo. En consecuencia:
   - Cada review de Google guarda `fetched_at` y `expires_at = fetched_at + 30 días`.
   - Cada sync que vuelve a traer una review renueva su `fetched_at`/`expires_at`.
   - Un proceso diario borra las reviews con `expires_at < now()`.
   - Un sync completo semanal por local garantiza que ninguna copia supere los 7 días de antigüedad.
   - **No persistas métricas derivadas** (promedios, conteos, tendencias) en tablas. Calculalas al momento de la consulta.
   - El promedio y el total de reviews de cada local se muestran **tal como los devuelve Google** (`averageRating`, `totalReviewCount`), no recalculados.
   - Cada proveedor declara su `retentionDays` y si permite agregación entre fuentes (`allowCrossSourceAggregation`). En el MVP no se muestran métricas combinadas entre plataformas.
2. **Desconexión fácil.** El cliente debe poder desconectar Google en un clic (con confirmación). Al desconectar: revocar el token en Google, borrar credenciales, locales y reviews de esa integración, y registrar el evento.
3. **Transparencia.** RateHub no modifica nada en la cuenta de Google del cliente (MVP de solo lectura). La pantalla de conexión explica en lenguaje simple qué datos leemos y que no publicamos nada.
4. **Marca.** La interfaz no debe imitar la de Google Business Profile. Mostrá la fuente de cada review con su nombre ("Google") y respetá la atribución que la API provea.
5. **Acceso manual.** Los usuarios acceden por la interfaz. No se expone ninguna API pública de RateHub que dé acceso programático a datos de GBP.
6. **Cuenta demo.** Google puede pedir una demo en 7 días. El seed de datos y el proveedor simulado (sección 3.3) sirven para montarla.
7. **App OAuth en modo "Testing".** Mientras la app de OAuth no esté verificada, solo pueden conectarse los usuarios de prueba cargados en Google Cloud, y los refresh tokens pueden vencer a los pocos días. El sistema debe manejar un `invalid_grant` pasando la integración a `needs_reauth` y mostrando "Reconectá tu cuenta de Google".

---

## 3. Stack y arquitectura

### 3.1 Stack recomendado

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript strict** | Frontend y backend (Server Components, Server Actions, Route Handlers) en un solo proyecto; despliegue nativo en Vercel. |
| Base de datos | **Postgres en Supabase** (región `sa-east-1`, São Paulo) | Datos relacionales (organizaciones, miembros, locales, reviews). **Row Level Security** aplica el aislamiento multi-tenant en la base, no solo en el código. `jsonb` para los campos propios de cada plataforma. |
| Auth | **Supabase Auth** vía `@supabase/ssr` | Magic link por email + "Continuar con Google" (solo scopes `openid email profile`). El JWT de sesión alimenta las políticas RLS. |
| Acceso a datos | **supabase-js + tipos generados** (`supabase gen types`), sin ORM | Las lecturas con la sesión del usuario pasan por RLS automáticamente. Un ORM con conexión directa saltearía RLS y reintroduciría el riesgo de fuga entre tenants. |
| Migraciones | **Supabase CLI**, SQL versionado en `supabase/migrations` | Esquema reproducible; nada se cambia a mano en producción. |
| UI | **Tailwind CSS + shadcn/ui**, íconos `lucide-react` | Componentes accesibles y editables en el repo. |
| Gráficos | **Recharts** | Suficiente para distribución de estrellas y tendencia semanal. |
| Validación | **Zod** | Entradas de formularios, query params, variables de entorno y respuestas de APIs externas. |
| Email | **Resend** (dominio de envío `send.ratehub.com.ar`) | Invitaciones y SMTP personalizado para los emails de Supabase Auth. |
| Jobs | **Tabla `sync_runs` como cola + cron** | Sin infraestructura extra en el MVP. Si crece, migrar a Inngest o Trigger.dev sin cambiar los proveedores. |
| Cifrado | **AES-256-GCM** (`node:crypto`) con clave en variable de entorno | Los refresh tokens de Google se guardan cifrados; incluye `key_version` para rotar la clave. |
| Tests | **Vitest** (unitarios e integración contra Supabase local) | Tests de aislamiento RLS obligatorios. |
| Paquetes | **pnpm** | |

### 3.2 Estructura de carpetas

```
ratehub-app/
├─ docs/
│  └─ PROMPT-MAESTRO.md
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/              # SQL versionado (esquema, RLS, funciones)
│  ├─ seed.sql                 # 2 orgs, 3 usuarios, 1 staff, datos mock
│  └─ tests/                   # tests de RLS
├─ src/
│  ├─ app/
│  │  ├─ (public)/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ sin-acceso/page.tsx
│  │  │  └─ legal/{privacidad,terminos}/page.tsx
│  │  ├─ auth/callback/route.ts            # callback de Supabase Auth
│  │  ├─ invitacion/[token]/page.tsx
│  │  ├─ o/[orgSlug]/
│  │  │  ├─ layout.tsx                     # exige sesión + membresía
│  │  │  ├─ page.tsx                       # Resumen
│  │  │  ├─ reviews/page.tsx
│  │  │  ├─ locales/page.tsx
│  │  │  ├─ onboarding/page.tsx            # wizard de conexión
│  │  │  └─ configuracion/
│  │  │     ├─ integraciones/page.tsx
│  │  │     ├─ miembros/page.tsx
│  │  │     └─ cuenta/page.tsx
│  │  ├─ admin/                            # solo staff de RateHub
│  │  │  ├─ layout.tsx                     # exige is_staff
│  │  │  ├─ page.tsx                       # listado de organizaciones
│  │  │  ├─ organizaciones/nueva/page.tsx
│  │  │  └─ organizaciones/[orgId]/page.tsx
│  │  ├─ api/
│  │  │  ├─ integrations/[provider]/start/route.ts
│  │  │  ├─ integrations/[provider]/callback/route.ts
│  │  │  └─ cron/{tick,purge}/route.ts
│  │  └─ page.tsx                          # redirige a la org del usuario
│  ├─ components/              # UI compartida (shadcn en components/ui)
│  ├─ lib/
│  │  ├─ env.ts                # validación Zod de variables de entorno
│  │  ├─ supabase/
│  │  │  ├─ server.ts          # cliente con la sesión del usuario (RLS)
│  │  │  ├─ browser.ts
│  │  │  └─ admin.ts           # service role — server-only
│  │  ├─ auth/guards.ts        # requireUser, requireOrgRole, requireStaff
│  │  ├─ crypto/tokens.ts      # encrypt/decrypt — server-only
│  │  ├─ integrations/
│  │  │  ├─ types.ts           # contrato del proveedor
│  │  │  ├─ registry.ts        # mapa provider → implementación
│  │  │  ├─ mock/              # proveedor simulado
│  │  │  └─ google/            # oauth.ts, client.ts, mapper.ts, provider.ts
│  │  ├─ sync/                 # engine.ts, scheduler.ts, purge.ts
│  │  ├─ email/                # cliente Resend + plantillas
│  │  └─ metrics/              # consultas de métricas calculadas al vuelo
│  └─ types/database.ts        # generado por supabase gen types
├─ proxy.ts / middleware.ts    # refresco de sesión (el nombre depende de la versión de Next.js)
├─ vercel.json                 # crons y región de funciones
└─ .env.example
```

### 3.3 Patrón adaptador para fuentes de reviews

Todo lo específico de una plataforma vive en `src/lib/integrations/<proveedor>/`. El resto del sistema (sync, UI, métricas) solo conoce el contrato:

```ts
// src/lib/integrations/types.ts
export type ProviderId = "google_business_profile" | "mock";
// futuros: "meta" | "tripadvisor" | "app_store" | "play_store"

export interface ProviderCapabilities {
  authKind: "oauth2" | "api_key";
  retentionDays: number | null;          // Google: 30
  allowCrossSourceAggregation: boolean;  // Google: false
  providesOfficialAggregate: boolean;    // Google: true (averageRating, totalReviewCount)
}

export interface ExternalLocation {
  externalId: string;          // p. ej. "locations/123"
  externalAccountId: string;   // p. ej. "accounts/456"
  name: string;
  address: string | null;
  mapsUrl: string | null;
}

export interface NormalizedReview {
  externalId: string;
  rating: number | null;       // 1–5
  comment: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  language: string | null;
  createdAtSource: Date;
  updatedAtSource: Date;
  replyText: string | null;
  replyUpdatedAt: Date | null;
  raw: unknown;                // payload original para raw_payload jsonb
}

export interface ReviewPage {
  reviews: NormalizedReview[];
  nextCursor: string | null;
  officialAggregate?: { averageRating: number; totalReviewCount: number };
}

export interface ReviewProvider {
  id: ProviderId;
  capabilities: ProviderCapabilities;
  // OAuth (solo si authKind === "oauth2")
  buildAuthUrl?(params: { state: string; codeChallenge: string; redirectUri: string }): string;
  exchangeCode?(params: { code: string; codeVerifier: string; redirectUri: string }): Promise<Credentials>;
  refreshCredentials(creds: Credentials): Promise<Credentials>;
  revoke(creds: Credentials): Promise<void>;
  // Datos
  getAccountIdentity(creds: Credentials): Promise<{ externalAccountId: string; email: string | null }>;
  listLocations(creds: Credentials): Promise<ExternalLocation[]>;
  fetchReviews(creds: Credentials, location: ExternalLocation, cursor: string | null): Promise<ReviewPage>;
}
```

- **Proveedor `mock`:** genera locales y reviews deterministas (con semilla por organización) e implementa todo el contrato sin red. Sirve para desarrollar la UI y el sync antes de tener acceso a la API de Google, para los previews de Vercel y para la cuenta demo. Se habilita con `ENABLE_MOCK_PROVIDER=true`; en producción queda deshabilitado salvo para organizaciones marcadas como demo.
- Agregar una fuente nueva = crear su carpeta, implementar el contrato, sumarla al `registry` y al enum de la base. Nada más.

### 3.4 Reglas de acceso a datos

| Quién | Cliente de Supabase | Qué puede hacer |
|---|---|---|
| Usuario en páginas y Server Actions | `lib/supabase/server.ts` (sesión del usuario) | Todo lo que permitan las políticas RLS. Es el camino por defecto. |
| Callback OAuth, motor de sync, crons, aceptación de invitaciones, panel admin | `lib/supabase/admin.ts` (service role) | Todo. Por eso cada función que lo usa **primero** valida autorización con `requireOrgRole` / `requireStaff` / `CRON_SECRET` y recibe el `org_id` explícito. |

Nunca uses el cliente admin para lecturas que el usuario podría hacer con su sesión.

---

## 4. Modelo de datos

Esquema de referencia. Implementalo como migraciones SQL; podés ajustar detalles si lo justificás, pero no cambies las relaciones ni el aislamiento.

```sql
create extension if not exists citext;

-- Tipos
create type member_role as enum ('owner', 'member');
create type provider_id as enum ('google_business_profile', 'mock');
create type integration_status as enum ('connected', 'needs_reauth', 'error', 'disconnected');
create type sync_kind as enum ('initial', 'incremental', 'full', 'manual');
create type sync_status as enum ('queued', 'running', 'succeeded', 'failed');

-- Perfil de cada usuario de auth.users
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  is_staff boolean not null default false,   -- solo se cambia por SQL, nunca desde la app
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,                 -- [a-z0-9-], usado en /o/[orgSlug]
  is_demo boolean not null default false,    -- habilita el proveedor mock en producción
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table memberships (
  org_id uuid not null references organizations on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  email citext not null,
  role member_role not null,
  token_hash text not null unique,           -- sha256 del token; el token en claro solo viaja en el email
  invited_by uuid references profiles(id),
  expires_at timestamptz not null,           -- 7 días
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  provider provider_id not null,
  status integration_status not null,
  external_account_id text not null,         -- identificador de la cuenta Google (sub)
  external_account_email text,
  connected_by uuid references profiles(id),
  connected_at timestamptz not null default now(),
  last_error text,
  unique (org_id, provider, external_account_id)
);

-- Credenciales separadas: RLS activado y SIN políticas → solo accesible con service role
create table integration_credentials (
  integration_id uuid primary key references integrations on delete cascade,
  encrypted_refresh_token text not null,
  encrypted_access_token text,
  access_token_expires_at timestamptz,
  granted_scopes text[] not null,
  key_version smallint not null default 1,
  updated_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  integration_id uuid not null references integrations on delete cascade,
  provider provider_id not null,
  external_id text not null,                 -- "locations/{id}"
  external_account_id text not null,         -- "accounts/{id}" (la API de reviews v4 necesita ambos)
  name text not null,
  address text,
  maps_url text,
  is_active boolean not null default false,  -- el cliente elige qué locales importar
  official_average_rating numeric(2,1),      -- tal como lo devuelve Google
  official_total_reviews integer,
  official_aggregate_fetched_at timestamptz,
  last_incremental_sync_at timestamptz,
  last_full_sync_at timestamptz,
  last_manual_sync_requested_at timestamptz,
  created_at timestamptz not null default now(),
  unique (integration_id, external_id)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  location_id uuid not null references locations on delete cascade,
  provider provider_id not null,
  external_id text not null,
  rating smallint check (rating between 1 and 5),
  comment text,
  author_name text,
  author_avatar_url text,
  language text,
  created_at_source timestamptz not null,
  updated_at_source timestamptz not null,
  reply_text text,
  reply_updated_at timestamptz,
  raw_payload jsonb not null,
  fetched_at timestamptz not null,
  expires_at timestamptz,                    -- null si el proveedor no impone retención
  unique (location_id, external_id)
);
create index on reviews (org_id, location_id, created_at_source desc);
create index on reviews (expires_at) where expires_at is not null;

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  integration_id uuid not null references integrations on delete cascade,
  location_id uuid references locations on delete cascade,
  kind sync_kind not null,
  status sync_status not null default 'queued',
  cursor text,                               -- permite retomar entre ejecuciones del cron
  attempts smallint not null default 0,
  reviews_upserted integer not null default 0,
  reviews_deleted integer not null default 0,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
-- como máximo un job pendiente o en curso por local
create unique index on sync_runs (location_id) where status in ('queued', 'running');

create table oauth_states (
  state_hash text primary key,
  org_id uuid not null references organizations on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  provider provider_id not null,
  code_verifier_encrypted text not null,     -- PKCE
  expires_at timestamptz not null,           -- 10 minutos
  used_at timestamptz
);

create table audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references organizations on delete set null,
  actor_user_id uuid references profiles(id),
  action text not null,                      -- 'integration.connected', 'integration.disconnected', 'member.invited', 'staff.viewed_org', ...
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

### 4.1 RLS

Activá RLS en **todas** las tablas. Funciones auxiliares `security definer` con `set search_path = public`:

- `is_org_member(org uuid) → boolean`
- `org_role(org uuid) → member_role`
- `is_staff() → boolean`

| Tabla | SELECT | INSERT / UPDATE / DELETE desde la sesión del usuario |
|---|---|---|
| `profiles` | el propio perfil, y perfiles de miembros de sus organizaciones | UPDATE del propio `full_name` |
| `organizations` | miembro | ninguno (lo hace staff vía service role) |
| `memberships` | miembro de esa org | DELETE si `org_role = 'owner'` (no puede borrarse el último owner) |
| `invitations` | owner de esa org | INSERT/UPDATE (revocar) si owner |
| `integrations` | miembro | ninguno (lo hace el callback OAuth) |
| `integration_credentials` | **nadie** | **nadie** |
| `locations` | miembro | UPDATE de `is_active` si owner |
| `reviews`, `sync_runs` | miembro | ninguno |
| `oauth_states` | nadie | nadie |
| `audit_log` | owner de esa org | nadie |

Staff accede vía service role desde `/admin` y cada vista de una organización registra `staff.viewed_org` en `audit_log`.

### 4.2 Tests de aislamiento (obligatorios)

Con el seed (org A con usuario A-owner y A-member; org B con B-owner; un staff), verificá con clientes autenticados reales que:

- A-member no ve ninguna fila de B en `organizations`, `locations`, `reviews`, `integrations`, `sync_runs`, `memberships`.
- Nadie autenticado puede leer `integration_credentials` ni `oauth_states`.
- A-member no puede cambiar `is_active` ni invitar; A-owner sí, pero solo en A.
- Un usuario sin membresía no ve nada.

---

## 5. Autenticación, invitaciones y flujo OAuth con Google Business Profile

### 5.1 Login (Supabase Auth)

- **Magic link:** `/login` llama `signInWithOtp` con `shouldCreateUser: false`. Así nadie puede registrarse desde el login.
- **"Continuar con Google":** Supabase Auth con scopes `openid email profile` únicamente. Usa un **cliente OAuth distinto** del de la integración (sección 5.3).
- **Después del login:** si el usuario es staff → `/admin`. Si tiene una membresía → `/o/[slug]`. Si tiene varias → la última usada (cookie `last_org`). Si no tiene ninguna → `/sin-acceso` ("Tu cuenta no tiene acceso a ninguna organización. Si esperabas una invitación, escribinos a hola@ratehub.com.ar").
- El refresco de sesión va en `proxy.ts`/`middleware.ts` según indique `@supabase/ssr` para la versión de Next.js instalada.
- `o/[orgSlug]/layout.tsx` valida sesión y membresía en el servidor. Si el slug no existe o el usuario no es miembro, devuelve 404 (no reveles que la organización existe).

### 5.2 Invitaciones

1. Staff crea la organización en `/admin/organizaciones/nueva` (nombre, slug, email del dueño, `is_demo`). Se crean la organización y una invitación con rol `owner`, y se envía el email con Resend.
2. El owner puede invitar miembros desde **Configuración → Miembros** (rol `member`).
3. Token: 32 bytes aleatorios en base64url. En la base se guarda solo el sha256. Vence a los 7 días. Staff y owners pueden reenviar (genera un token nuevo) o revocar.
4. `/invitacion/[token]`:
   - Token inválido, vencido, revocado o ya usado → mensaje claro con qué hacer ("Pedile a quien te invitó que te mande una invitación nueva").
   - Sin sesión → formulario con el email invitado precargado y bloqueado; envía magic link con `shouldCreateUser: true` y vuelve a esta página. También se ofrece "Continuar con Google".
   - Con sesión y email distinto del invitado (comparación sin mayúsculas) → "Esta invitación es para x@y.com. Cerrá sesión e ingresá con ese email."
   - Con sesión y email correcto → botón "Unirme a {organización}". Crea la membresía (service role, tras validar), marca `accepted_at`, registra en `audit_log` y redirige: al onboarding si la organización no tiene integraciones; si no, al Resumen.
5. El primer staff (el fundador) se marca con `update profiles set is_staff = true where email = '...'`. Documentalo en el README.

### 5.3 Conexión con Google Business Profile (OAuth 2.0, servidor)

**Configuración en Google Cloud** (la hace el humano; el agente la documenta en el README):

- APIs a habilitar (verificá los nombres vigentes): My Business Account Management API, My Business Business Information API y Google My Business API (v4, reviews).
- Pantalla de consentimiento externa:
  - Nombre: RateHub.
  - Dominio autorizado: `ratehub.com.ar`.
  - Página principal: `https://ratehub.com.ar`.
  - Política de privacidad: `https://app.ratehub.com.ar/legal/privacidad`.
  - Términos: `https://app.ratehub.com.ar/legal/terminos`.
- Cliente OAuth "RateHub – Integración GBP" (tipo aplicación web), con redirect URIs:
  - `https://app.ratehub.com.ar/api/integrations/google_business_profile/callback`
  - `http://localhost:3000/api/integrations/google_business_profile/callback`
- Cliente OAuth "RateHub – Login", con el redirect URI que indique Supabase Auth.

**Inicio** — `GET /api/integrations/google_business_profile/start?org={slug}`

1. `requireOrgRole(org, 'owner')`.
2. Generá un `state` (32 bytes) y un `code_verifier` PKCE. Guardá `sha256(state)`, org, usuario, verifier cifrado y vencimiento a 10 minutos en `oauth_states`.
3. Redirigí a `https://accounts.google.com/o/oauth2/v2/auth` con:
   - `client_id`, `redirect_uri`, `response_type=code`
   - `scope=openid email https://www.googleapis.com/auth/business.manage`
   - `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`
   - `state`, `code_challenge`, `code_challenge_method=S256`

**Callback** — `GET /api/integrations/google_business_profile/callback`

1. Si viene `error` (por ejemplo `access_denied`) → volvé a `/o/[slug]/onboarding?error=cancelado` con el mensaje "No se conectó la cuenta. Podés intentarlo de nuevo cuando quieras."
2. Validá el `state`: existe, no fue usado, no venció y pertenece al usuario con sesión actual. Marcalo como usado. Revalidá que el usuario sigue siendo owner.
3. Intercambiá el `code` en `https://oauth2.googleapis.com/token` con el `code_verifier`.
4. Verificá que `scope` incluya `business.manage`. Google permite consentimiento granular: si el usuario destildó el permiso, no guardes nada y explicá que ese permiso es necesario para leer las reseñas.
5. Verificá que haya `refresh_token`. Si no hay, mostrá un error claro y registralo.
6. Obtené la identidad de la cuenta de Google (`sub` y `email` del `id_token` verificado, o del endpoint userinfo).
7. Hacé upsert de `integrations` (status `connected`) e `integration_credentials` con los tokens cifrados. Registrá `integration.connected` en `audit_log`.
8. Redirigí a `/o/[slug]/onboarding?paso=locales`.

**Listado de locales** (paso 2 del onboarding)

- Cuentas: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`, con paginación.
- Locales por cuenta: `GET https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations?readMask=name,title,storefrontAddress,metadata`, con paginación. `metadata.mapsUri` → `maps_url`.
- Guardá todos en `locations` con `is_active=false`. El owner elige con checkboxes. Al confirmar, se marcan `is_active=true` y se encola un sync `initial` por cada local elegido.
- Si la cuenta no tiene locales: "Esta cuenta de Google no administra ningún perfil de negocio. Conectá la cuenta que figura como propietaria o administradora del perfil."

**Reviews**

- `GET https://mybusiness.googleapis.com/v4/{accountName}/{locationName}/reviews?pageSize=50&orderBy=updateTime desc&pageToken=...`
- Mapeo:
  - `starRating` `ONE…FIVE` → 1–5
  - `comment`
  - `reviewer.displayName` y `reviewer.profilePhotoUrl` (respetá `isAnonymous`)
  - `createTime` y `updateTime`
  - `reviewReply.comment` y `reviewReply.updateTime`
  - `reviewId` → `external_id`
- `averageRating` y `totalReviewCount` de la respuesta → columnas `official_*` de `locations`.

**Tokens**

- Antes de cada llamada, si el access token vence en menos de 60 segundos, refrescalo en `https://oauth2.googleapis.com/token` con `grant_type=refresh_token`. Si Google devuelve un refresh token nuevo, guardalo.
- Un `401` → refrescá y reintentá una sola vez. Un `invalid_grant` → integración en `needs_reauth`, se cancelan los jobs pendientes y se muestra un banner en toda la app de esa organización: "Se perdió la conexión con Google. Reconectá tu cuenta para seguir viendo reseñas nuevas." (botón "Reconectar Google", que repite el flujo de inicio).
- Las llamadas a Google se hacen **solo desde el servidor**.

**Desconexión** — **Configuración → Integraciones → "Desconectar Google"**, solo owner, con diálogo de confirmación que explica que se borrarán las reseñas importadas.

1. `POST https://oauth2.googleapis.com/revoke` con el refresh token (si falla, registralo y seguí igual).
2. Borrá `integration_credentials`, los `locations` de la integración (en cascada, sus `reviews` y `sync_runs`) y dejá `integrations.status = 'disconnected'`.
3. Registrá `integration.disconnected`. Todo debe completarse en la misma acción.

### 5.4 Motor de sincronización

- **`/api/cron/tick`** (cada 15 minutos, protegido con `Authorization: Bearer ${CRON_SECRET}`):
  1. **Planificar:** por cada local activo con integración `connected`, encolar `incremental` si `last_incremental_sync_at` es de hace más de 6 horas, y `full` si `last_full_sync_at` es de hace más de 7 días. El índice único impide duplicados.
  2. **Procesar:** reclamar jobs con una función SQL que use `FOR UPDATE SKIP LOCKED`. Procesar página por página hasta un presupuesto de tiempo (dejá margen respecto a la duración máxima de funciones del plan de Vercel). Guardar `cursor` después de cada página para retomar en el próximo tick.
- **Incremental:** pedir páginas ordenadas por `updateTime desc` hasta encontrar una review con `updateTime` anterior a `last_incremental_sync_at` menos 1 hora de margen.
- **Full / initial:** todas las páginas. Al terminar, borrar las reviews del local cuyo `fetched_at` sea anterior al inicio del run (se eliminaron en la fuente).
- **Upsert** por `(location_id, external_id)`, renovando `fetched_at` y `expires_at` (`fetched_at + retentionDays`).
- **Errores:** ante `429` o `5xx`, backoff exponencial con jitter (máximo 3 intentos por página). Si se agotan, el job pasa a `failed` con el error, y el próximo tick lo vuelve a planificar. Guardá `last_error` legible en la integración.
- **Manual:** botón "Sincronizar ahora" por local, para cualquier miembro, limitado a una vez cada 15 minutos (`last_manual_sync_requested_at`).
- **`/api/cron/purge`** (diario): borra reviews con `expires_at < now()`, `oauth_states` vencidos y `sync_runs` de más de 30 días.
- Las frecuencias y el presupuesto de tiempo van como constantes en `src/lib/sync/config.ts`.

---

## 6. Pantallas del MVP

Cada pantalla contempla los estados de carga (skeletons), vacío, error y `needs_reauth`.

### 6.1 Públicas

- **`/login`:** email + "Enviar link de acceso"; "Continuar con Google". Texto breve: "El acceso a RateHub es por invitación." Confirmación: "Te mandamos un link a {email}. Revisá también spam."
- **`/invitacion/[token]`:** los estados de la sección 5.2.
- **`/sin-acceso`.**
- **`/legal/privacidad` y `/legal/terminos`:** contenido en Markdown en el repo, con placeholders claramente marcados para que el fundador los complete con asesoramiento legal. La política de privacidad debe describir qué datos de Google se leen, para qué, cuánto tiempo se guardan (hasta 30 días, renovados en cada sincronización) y cómo desconectarse y pedir el borrado.

### 6.2 App del cliente (`/o/[orgSlug]/…`)

**Layout**
- Desktop: barra lateral con Resumen, Reseñas, Locales y Configuración, más el selector de organización si el usuario tiene varias.
- Mobile: barra superior con menú desplegable.
- Selector de local global (todos o uno), persistido en la URL (`?local=`).

**Onboarding** (se muestra si no hay integraciones activas; es la primera pantalla del owner)
1. "Conectá tu perfil de Google". Explica qué leemos (reseñas y datos básicos de tus locales), que no publicamos ni cambiamos nada y que podés desconectar cuando quieras. Botón "Conectar Google".
2. "Elegí los locales". Checkboxes con nombre y dirección. Botón "Importar locales".
3. "Estamos trayendo tus reseñas". Progreso por local (leído de `sync_runs`) y link al Resumen.

Un `member` sin integración conectada ve: "Todavía no hay fuentes conectadas. El dueño de la cuenta puede conectarlas desde Configuración."

**Resumen**
- Por local, o el listado de locales si se eligió "todos":
  - Puntaje y total de reseñas **oficiales de Google**, con la fecha de actualización.
  - Reseñas recibidas en los últimos 30 días.
  - Porcentaje respondidas por el dueño.
  - Distribución 1–5.
  - Volumen semanal de las últimas 12 semanas.
- Las 5 reseñas más recientes, con link a "Ver todas".
- No mostrar un promedio combinado entre locales ni entre fuentes.
- Todas las métricas derivadas salen de `src/lib/metrics`, se calculan al consultar y respetan `allowCrossSourceAggregation`. Una variable `DERIVED_METRICS_ENABLED` permite apagarlas y dejar solo los datos oficiales.

**Reseñas**
- Listado paginado (25 por página, por cursor).
- Filtros:
  - local
  - estrellas (multiselección)
  - período (7, 30 o 90 días, o personalizado)
  - con o sin respuesta del dueño
  - búsqueda por texto en comentario y autor (`ilike` en el MVP)
- Orden: más recientes, más antiguas, menor puntaje, mayor puntaje.
- Filtros en la URL. En mobile, los filtros se abren en un panel inferior.
- Cada reseña muestra:
  - estrellas y número
  - autor y avatar
  - fecha relativa, con la absoluta en tooltip
  - fuente ("Google")
  - texto completo, con "ver más" si es largo
  - respuesta del dueño si existe
- Botón "Ver perfil en Google" que abre `maps_url`. El MVP no responde reseñas.

**Locales**
- Tabla (tarjetas en mobile) con:
  - nombre y dirección
  - fuente
  - estado (activo o inactivo)
  - última sincronización
  - estado del último sync
- Owner: activar o desactivar locales, "Agregar locales" (vuelve al paso 2 del onboarding).
- Todos: "Sincronizar ahora" con límite de frecuencia.

**Configuración**
- **Integraciones:** Google con estado, cuenta conectada (email), fecha de conexión, último error legible. Acciones "Reconectar" y "Desconectar" (solo owner).
- **Miembros:** listado con rol. El owner invita por email (rol member), reenvía o revoca invitaciones y quita miembros.
- **Cuenta:** nombre y cerrar sesión.

### 6.3 Admin (`/admin`, solo staff)

- **Organizaciones:** tabla con nombre, email del owner, estado de la integración, último sync, cantidad de reseñas guardadas y marca demo.
- **Nueva organización:** formulario de la sección 5.2.
- **Detalle de organización:**
  - miembros e invitaciones (reenviar o revocar)
  - integraciones con `last_error`
  - últimos 20 `sync_runs` con error
  - acción "Forzar sincronización"
  - acción "Suspender organización"
  - Cada visita registra `staff.viewed_org`.

### 6.4 Dirección visual y textos

- El usuario es un dueño o encargado de negocio, no un analista. La pantalla responde rápido a "¿cómo me están calificando y qué dijeron últimamente?".
- Definí tokens de diseño (colores, tipografía, espaciado, radios) en la configuración de Tailwind antes de construir pantallas. Usá una sola familia tipográfica bien elegida (no la de siempre) y dejá que la jerarquía la dé la tipografía.
- Evitá el kit genérico de SaaS: todo cortado en tarjetas idénticas con la misma sombra, gradientes decorativos, etiquetas en mayúsculas sobre cada título. Guardá el color para lo que significa algo: el puntaje. Usá una escala semántica para 1–2, 3 y 4–5, siempre acompañada del número, para no depender solo del color.
- Calidad mínima: contraste AA, foco de teclado visible, `prefers-reduced-motion` respetado, objetivos táctiles de 44 px en mobile, sin scroll horizontal en ningún ancho.
- Textos:
  - En oraciones, con verbos concretos: "Conectar Google", "Importar locales", "Sincronizar ahora".
  - La acción conserva su nombre en todo el flujo: el botón "Desconectar" produce el aviso "Google desconectado".
  - Los errores dicen qué pasó y cómo resolverlo, sin disculpas.
  - Los estados vacíos invitan a actuar.

---

## 7. Fuera del MVP (no construir)

- Cobros, planes, límites por plan o pasarela de pagos.
- Registro abierto (self-serve).
- Responder reseñas, o cualquier escritura en Google.
- IA: análisis de sentimiento, resúmenes, respuestas sugeridas.
- Alertas o notificaciones (email, WhatsApp, Slack, push).
- Integraciones reales distintas de Google (solo existe el contrato y el proveedor mock).
- Notificaciones en tiempo real de Google (Pub/Sub). El MVP usa polling.
- Exportaciones (CSV, PDF), reportes programados, widgets públicos de reseñas.
- API pública o webhooks.
- Comparación con competidores o datos de negocios que no son del cliente (ni Places API ni scraping).
- Roles más allá de owner y member, SSO, 2FA propio, white-label.
- Modo oscuro, multi-idioma, apps nativas.
- Búsqueda avanzada (full-text con ranking) y Sentry u otras herramientas de observabilidad pagas. Alcanza con los logs de Vercel y `sync_runs`.

---

## 8. Deploy en Vercel

### 8.1 Proyecto

- Repo nuevo en GitHub: `ratehub-app`. Proyecto nuevo en Vercel conectado a ese repo, **separado del de la landing**.
- Región de funciones: `gru1` (São Paulo), la misma región que Supabase `sa-east-1`. Configurala en `vercel.json` o en la configuración del proyecto, según lo que indique la documentación vigente.
- Crons en `vercel.json`: `/api/cron/tick` cada 15 minutos y `/api/cron/purge` diario.
  - **Verificá los límites de cron del plan de Vercel contratado.** Si el plan no permite esa frecuencia, disparalos desde Supabase con `pg_cron` + `pg_net`, con el mismo `CRON_SECRET`.
- Ramas:
  - `main` → producción.
  - Pull requests → previews. Los previews usan un proyecto de Supabase de staging y solo el proveedor mock, porque sus URLs cambian y no se registran en Google OAuth.

### 8.2 Variables de entorno (validadas con Zod en `src/lib/env.ts`; documentadas en `.env.example`)

| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | público | `https://app.ratehub.com.ar` |
| `NEXT_PUBLIC_SUPABASE_URL` | público | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | anon/publishable key (según la nomenclatura vigente de Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | service role/secret key |
| `GOOGLE_GBP_CLIENT_ID` | servidor | cliente OAuth de la integración |
| `GOOGLE_GBP_CLIENT_SECRET` | servidor | |
| `GOOGLE_GBP_REDIRECT_URI` | servidor | URL de callback según el entorno |
| `ENABLE_GOOGLE_PROVIDER` | servidor | `true` solo cuando la API esté aprobada |
| `ENABLE_MOCK_PROVIDER` | servidor | `true` en local y previews |
| `DERIVED_METRICS_ENABLED` | servidor | `true` por defecto |
| `TOKEN_ENCRYPTION_KEY` | servidor | 32 bytes en base64 (`openssl rand -base64 32`) |
| `TOKEN_ENCRYPTION_KEY_VERSION` | servidor | `1` |
| `CRON_SECRET` | servidor | secreto de los endpoints de cron |
| `RESEND_API_KEY` | servidor | |
| `EMAIL_FROM` | servidor | `RateHub <hola@send.ratehub.com.ar>` |

### 8.3 Supabase

- Proyectos: `ratehub-prod` y `ratehub-staging`, ambos en `sa-east-1`. Local con `supabase start`.
- Migraciones: `supabase db push` hacia staging y luego producción. Nunca se edita el esquema desde el panel.
- Auth:
  - Site URL `https://app.ratehub.com.ar`.
  - Redirect URLs: producción, `http://localhost:3000/**` y el patrón de previews de Vercel.
  - SMTP personalizado con Resend.
  - Proveedor Google con el cliente "RateHub – Login".
- Plantillas de email de Auth en español.

### 8.4 Dominio

1. En Vercel, en el proyecto `ratehub-app`, agregá `app.ratehub.com.ar`.
2. En Cloudflare, creá `CNAME app → <valor que indique Vercel para este proyecto>` en modo **DNS only** (nube gris). No reutilices el valor de la landing.
3. Esperá a que Vercel verifique el dominio y emita el certificado.

### 8.5 Checklist antes de producción

- [ ] Tests de aislamiento RLS pasando en CI.
- [ ] Ningún secreto en el bundle del cliente (revisar el build y buscar las claves).
- [ ] Headers de seguridad: CSP básica, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Endpoints de cron rechazan requests sin `CRON_SECRET`.
- [ ] Desconectar Google borra todo y revoca el token (probado de punta a punta).
- [ ] README con: setup local, variables, marcar el primer staff, configuración de Google Cloud, cómo agregar un proveedor nuevo.

---

## 9. Orden de construcción (fases con checkpoint)

Al final de cada fase: `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde, un resumen para el humano, y **pausa**.

**Fase 0 — Base del proyecto**
- Next.js + TS strict, pnpm, ESLint, Prettier, Tailwind, shadcn/ui.
- `src/lib/env.ts`, Supabase local y CI en GitHub Actions (lint, typecheck, test).
- Deploy de una página mínima en un preview de Vercel.
- *Terminado cuando:* el preview de Vercel funciona y CI corre en cada PR.

**Fase 1 — Base de datos y aislamiento**
- Migraciones de la sección 4, funciones auxiliares, RLS, seed y tests de la sección 4.2.
- Generación de tipos.
- *Terminado cuando:* todos los tests de aislamiento pasan y fallarían si se quita una política.

**Fase 2 — Autenticación**
- Clientes Supabase (server, browser, admin), login con magic link y Google, callback, refresco de sesión.
- Guards, redirecciones post-login, `/sin-acceso`.
- Layout de `/o/[orgSlug]` con validación de membresía y 404, layout de `/admin` con `requireStaff`.
- *Terminado cuando:* los usuarios del seed entran a su organización y no pueden abrir la de otros.

**Fase 3 — Admin e invitaciones**
- Panel admin (listado, alta, detalle).
- Emails con Resend, flujo completo de `/invitacion/[token]`.
- Configuración → Miembros, `audit_log`.
- *Terminado cuando:* staff crea una organización, el invitado recibe el email, entra y queda como owner, e invita a un member.

**Fase 4 — Proveedores y sincronización (con mock)**
- Contrato de la sección 3.3, `registry`, proveedor mock, cifrado de tokens.
- Motor de sync, planificador, cola con `SKIP LOCKED`, crons protegidos, purga, "Sincronizar ahora".
- Una integración mock conectable desde el onboarding sin OAuth real, para organizaciones demo o entornos con mock habilitado.
- *Terminado cuando:* una organización demo tiene locales y reseñas que se sincronizan por cron, se retoman por cursor y se purgan por vencimiento (con tests del motor).

**Fase 5 — Dashboard**
- Onboarding, Resumen, Reseñas, Locales, Configuración → Integraciones y Cuenta, con datos mock.
- Tokens de diseño y responsive completo.
- *Terminado cuando:* todas las pantallas de la sección 6 funcionan en desktop y en 375 px de ancho, con todos sus estados.

**Fase 6 — Google Business Profile real**
- Rutas OAuth start/callback con PKCE, validaciones de scope y refresh token.
- Listado de cuentas y locales, adaptador de reviews y mapeo.
- Refresco de tokens, `needs_reauth` y banner, desconexión con revocación.
- Tests del mapper con fixtures JSON de respuestas reales anonimizadas. Verificá cada endpoint contra la documentación oficial.
- *Terminado cuando:* con una cuenta de prueba cargada en Google Cloud se conecta, se importan locales y reseñas reales, se desconecta y todo queda borrado. **Requiere que el acceso a la API esté aprobado**; si no lo está, dejá la fase lista con tests sobre fixtures y marcá qué falta probar en vivo.

**Fase 7 — Producción**
- Páginas legales con placeholders, headers de seguridad, checklist de 8.5.
- Dominio `app.ratehub.com.ar`, proyecto Supabase de producción.
- Guía en el README para enviar la app OAuth a verificación de Google (qué pantallas grabar en el video demo y qué justificar sobre el scope `business.manage`).
- *Terminado cuando:* el checklist 8.5 está completo y el fundador puede invitar al primer cliente real.

---

## 10. Definición de MVP terminado

Un cliente invitado por RateHub puede:
1. Entrar con su email.
2. Conectar su cuenta de Google.
3. Elegir sus locales.
4. Ver sus reseñas actualizadas automáticamente, filtrarlas y ver sus métricas básicas en desktop y mobile.
5. Invitar a su equipo.
6. Desconectar Google cuando quiera, con todos sus datos borrados.

Ninguna organización puede ver datos de otra, y esto está demostrado por tests.
