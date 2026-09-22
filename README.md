# RateHub — Sitio web estático

Sitio de marketing y páginas legales para **RateHub** (ratehub.com.ar).  
Stack: [Astro](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/), salida 100% estática.

## Páginas

| Ruta | Descripción |
|---|---|
| `/` | Home: hero, features, cómo funciona, contacto |
| `/privacidad` | Política de privacidad (español) |
| `/privacy` | Privacy Policy (English) — para revisores de Google |
| `/terminos` | Términos de servicio |

## Requisitos

- Node.js 18 o superior
- npm 9 o superior

## Correr localmente

```bash
# Clonar e instalar dependencias
git clone <repo-url>
cd ratehub
npm install

# Servidor de desarrollo con hot-reload
npm run dev
# → http://localhost:4321
```

## Build de producción

```bash
npm run build
# Genera la carpeta dist/ con HTML/CSS/JS estático

npm run preview
# Sirve el build localmente en http://localhost:4321
```

## Deploy

### Cloudflare Pages (recomendado)

1. Conectá el repositorio en [pages.cloudflare.com](https://pages.cloudflare.com).
2. Configurá el build:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. En **Custom domains**, agregá `ratehub.com.ar` y `www.ratehub.com.ar`.
4. Actualizá los nameservers de tu dominio en el registrar para apuntar a Cloudflare.

### Vercel

1. Conectá el repositorio en [vercel.com](https://vercel.com).
2. Vercel detecta Astro automáticamente.
3. En **Settings → Domains**, agregá `ratehub.com.ar`.
4. Apuntá el DNS: `A 76.76.21.21` o CNAME `cname.vercel-dns.com`.

### Netlify

1. Conectá el repositorio en [app.netlify.com](https://app.netlify.com).
2. Configurá:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. En **Domain management**, agregá `ratehub.com.ar`.

### Deploy manual (cualquier hosting estático)

```bash
npm run build
# Subí el contenido de dist/ al servidor o bucket S3/R2/GCS
```

## Apuntar el dominio ratehub.com.ar

Según el proveedor de hosting:

| Plataforma | Registro DNS |
|---|---|
| Cloudflare Pages | NS → Cloudflare (delegación completa) |
| Vercel | `A 76.76.21.21` |
| Netlify | `A 75.2.60.5` o CNAME `apex-loadbalancer.netlify.com` |

Para `www.ratehub.com.ar` en todos los casos: `CNAME www → <tu-dominio-del-proveedor>`.

## Variables de entorno

El sitio es 100% estático y no requiere variables de entorno en producción.  
El dominio canónico está configurado en `astro.config.mjs`:

```js
site: 'https://ratehub.com.ar',
```

## Estructura del proyecto

```
src/
├── layouts/
│   └── Layout.astro       # Layout base con meta tags SEO y OG
├── pages/
│   ├── index.astro        # Home
│   ├── privacidad.astro   # Política de privacidad (ES)
│   ├── privacy.astro      # Privacy Policy (EN)
│   └── terminos.astro     # Términos de servicio
├── components/
│   ├── Header.astro       # Navegación sticky con menú móvil
│   └── Footer.astro       # Footer con links y disclaimers
└── styles/
    └── global.css         # Tailwind base + utilidades globales
public/
└── favicon.svg
```

## Notas importantes sobre privacidad y Google

- La política de privacidad está disponible en español (`/privacidad`) e inglés (`/privacy`).
- La versión en inglés es la que los revisores de Google leen durante el proceso de aprobación de la Google Business Profile API.
- Ambas versiones declaran explícitamente el cumplimiento con la **Google API Services User Data Policy** y los requisitos de **Limited Use**.
- Si se modifica el alcance de los datos de Google que accede la app, actualizar ambas políticas antes de solicitar la aprobación.
