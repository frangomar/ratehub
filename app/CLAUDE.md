# RateHub App — Instrucciones para el agente

## LEÉ ESTO PRIMERO

Este proyecto se construye **por fases, una por sesión**. Para saber qué hacer:

1. Leer **`../docs/ROADMAP.md`** — ahí está el estado de cada fase y el checklist.
2. Leer **`../docs/PROMPT-MAESTRO.md`** — la especificación completa del producto.
3. Identificar la primera fase con estado ⏳ Pendiente.
4. Implementar esa fase siguiendo el checklist. No arrancar la siguiente.

## Estado actual del proyecto

Ver `../docs/ROADMAP.md` para el estado actualizado.

## Comandos (ejecutar desde esta carpeta `app/`)

```bash
pnpm dev          # servidor de desarrollo → http://localhost:3000
pnpm lint         # ESLint — debe pasar en verde
pnpm typecheck    # TypeScript strict — debe pasar en verde
pnpm test         # Vitest — debe pasar en verde
pnpm build        # build de producción
```

## Rama de trabajo

`claude/friendly-shannon-tl0uah` — commitear y pushear ahí al terminar cada fase.

## Reglas que no se negocian

- TypeScript `strict` — sin `any` salvo justificación explícita.
- Secretos solo en el servidor — `import "server-only"` en todo módulo que use la service role key o descifre tokens. Nada de credenciales en el bundle del cliente.
- RLS en todas las tablas de Supabase. Un test de aislamiento que falla bloquea todo.
- Validar toda entrada externa con Zod.
- Idioma de la UI: español de Argentina, trato de vos.
- **No construir nada de la sección 7 del PROMPT-MAESTRO** (fuera del MVP).

## Estructura de `app/src/`

```
app/src/
├─ app/              → Next.js App Router (páginas, layouts, routes)
├─ components/       → UI compartida (shadcn en components/ui)
├─ lib/
│  ├─ env.ts         → validación Zod de variables de entorno (YA IMPLEMENTADO)
│  ├─ supabase/      → browser.ts, server.ts, admin.ts (YA IMPLEMENTADO)
│  ├─ auth/          → guards: requireUser, requireOrgRole, requireStaff
│  ├─ crypto/        → encrypt/decrypt AES-256-GCM (server-only)
│  ├─ integrations/  → contrato del proveedor, registry, mock, google
│  ├─ sync/          → motor de sincronización
│  ├─ email/         → cliente Resend + plantillas
│  └─ metrics/       → consultas calculadas al vuelo
└─ types/
   └─ database.ts    → generado por supabase gen types (placeholder hasta Fase 1)
```
