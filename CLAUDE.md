# RateHub — Guía para el agente

## Estructura del repo

Este es un mono-repo con dos proyectos independientes:

| Carpeta | Qué es | Stack |
|---------|--------|-------|
| `/` (raíz, `src/`, `public/`) | Landing marketing — **no tocar** | Astro + Tailwind |
| `app/` | **Aplicación SaaS** (`app.ratehub.com.ar`) | Next.js 15 + TypeScript strict |
| `supabase/` | Migraciones, seed, tests de RLS | Supabase CLI |
| `docs/` | Documentación del proyecto | |

## Antes de hacer cualquier cosa

1. **Leé `docs/PROMPT-MAESTRO.md`** — contiene la especificación completa del producto, la arquitectura, el modelo de datos, los flujos OAuth y las reglas que el agente debe respetar.
2. **Leé `docs/ROADMAP.md`** — contiene el estado de cada fase (cuál está completa, cuál es la siguiente) y el checklist detallado de cada una.

## Trabajo por fases

El proyecto se construye **una fase por sesión**. El flujo es:

1. Leer PROMPT-MAESTRO.md y ROADMAP.md para entender el contexto.
2. Identificar la fase pendiente más reciente en ROADMAP.md.
3. Implementar esa fase siguiendo el checklist del ROADMAP.
4. Verificar con `pnpm lint`, `pnpm typecheck` y `pnpm test` (todos en verde).
5. Commitear y pushear a la rama `claude/friendly-shannon-tl0uah`.
6. Actualizar el estado de la fase en `docs/ROADMAP.md` a ✅ Completada.
7. **Parar y entregar el resumen al humano** para aprobación antes de la siguiente fase.

## Comandos principales (ejecutar desde `app/`)

```bash
cd app
pnpm dev          # servidor de desarrollo → http://localhost:3000
pnpm lint         # ESLint
pnpm typecheck    # TypeScript strict
pnpm test         # Vitest
pnpm build        # build de producción
```

## Rama de trabajo

Toda la app vive en la rama `claude/friendly-shannon-tl0uah`. No pushear a `main` sin aprobación humana.

## Reglas críticas (resumen del PROMPT-MAESTRO)

- **TypeScript strict** — sin `any` salvo justificación explícita.
- **Secretos solo en el servidor** — ningún token, service role key ni credencial de Google puede llegar al navegador. Los módulos del servidor llevan `import "server-only"`.
- **Aislamiento multi-tenant** — RLS en todas las tablas de Supabase. Un test que falle por fuga de datos entre orgs bloquea todo lo demás.
- **No construir nada de la sección 7 del PROMPT-MAESTRO** (fuera del MVP).
- **Validar toda entrada externa con Zod** — variables de entorno, formularios, respuestas de APIs externas.
- **Idioma de la UI:** español de Argentina, trato de vos. Fechas en `America/Argentina/Buenos_Aires` en la UI; UTC en la DB.
