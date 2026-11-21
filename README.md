# Demo Premium · Menú digital

Demo del plan Premium de OESTACK: menú digital con identidad de marca propia, imágenes de productos
y un panel de administración. Es una sola app (React + Vite) que sirve a todos los locales, con un
único proyecto de Supabase (Postgres + Auth + Storage) y datos separados por local (multi-tenant).

- Menú público: `/:slug` (ej. `/aroma`)
- Panel de administración: `/admin` (se construye en la Tarea 4)

Estado: **Tarea 2** (menú público: estructura, logo e imágenes). La navegación por categorías, el pulido visual y el resto del diseño vienen en la Tarea 3.

## Cómo correrlo

```
npm install
cp .env.example .env     # y completar las dos variables (ver abajo)
npm run dev
```

Abrir http://localhost:5173/aroma. Otros comandos: `npm run build` (genera `dist/`), `npm run preview`,
`npm run lint`, `npm run verificar:rls` y `npm run imagenes`.

Antes de la primera vez hay que crear el proyecto de Supabase y pegar `supabase/schema.sql`
y después `supabase/02-imagenes.sql` en el SQL Editor (paso a paso más abajo).

## Variables de entorno

Ver `.env.example`. Van en `.env` (ignorado por git).

| Variable                 | Qué es                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | URL del proyecto (`https://xxxx.supabase.co`)                       |
| `VITE_SUPABASE_ANON_KEY` | Clave pública `anon` / `publishable`                                |

Vite incorpora estas variables al momento del build: si se cambian, hay que volver a publicar.

**Nunca** uses ni expongas la clave `service_role` en el frontend ni en `.env`: saltea toda la seguridad.
La anon key es pública por diseño; lo que protege los datos son las políticas RLS de `supabase/schema.sql`.

## Crear el proyecto de Supabase

1. Entrar a https://supabase.com, iniciar sesión y crear un proyecto nuevo (**New project**). Elegir un nombre,
   una contraseña de base de datos (guardarla en un gestor de contraseñas) y una región cercana (São Paulo).
2. Esperar a que termine de crearse (un par de minutos).
3. Ir a **SQL Editor > New query**, pegar **todo** el contenido de `supabase/schema.sql` y apretar **Run**.
   Debe terminar con "Success". Se puede volver a correr sin duplicar los datos.
4. Ir a **Project Settings > API** (o el botón **Connect**) y copiar la **Project URL** y la clave **anon**
   (o "publishable"). No copiar la `service_role`.
5. Pegarlas en `.env` (copia de `.env.example`).
6. En **SQL Editor > New query**, pegar y correr `supabase/02-imagenes.sql`: carga el logo y las imágenes de los
   productos y marca los destacados. Se puede correr más de una vez. Al final devuelve una fila de control
   (18 productos, 18 con imagen, 5 destacados).
7. `npm run dev` y abrir `/aroma`.

## Comprobar que se puede leer pero no escribir

Con la anon key en `.env`:

```
npm run verificar:rls
```

Lee el menú y después intenta insertar, modificar y borrar productos, categorías y locales, subir un
archivo a Storage y leer las tablas internas. Cada intento de escritura **tiene** que fallar
(`permission denied` o `violates row-level security policy`). Si alguno funciona, el script lo marca como `FALLÓ`.

Prueba manual equivalente con `curl` (reemplazar URL y clave): la lectura devuelve datos y el `POST` es rechazado.

```
curl "$URL/rest/v1/productos?select=nombre,precio&limit=3" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"

curl -X POST "$URL/rest/v1/productos" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" -d '{"nombre":"intruso","precio":1}'
```

## Estructura

```
public/
  fonts/                Fuentes autoalojadas (woff2) y sus licencias
  locales/aroma/        Logo e imágenes optimizadas del local (productos/<nombre>-480.webp y -800.webp)
  _redirects            Para que /:slug funcione al recargar (Cloudflare Pages)
scripts/
  verificar-rls.mjs     Prueba de lectura/escritura con la anon key
  optimizar-imagenes.mjs  Optimiza logos y fotos de brand/ para la web (npm run imagenes)
  aroma-imagenes.json   Renombres de las fotos de Aroma
src/
  lib/                  supabase.js (cliente), locales.js (getLocal), imagenes.js (srcset), formato.js, useLocal.js
  components/           Encabezado, Destacados, SeccionCategoria, TarjetaProducto y Pie
  pages/                Menú (/:slug) y "local no encontrado"
  admin/                Panel de administración (Tarea 4)
  styles/               tokens.css (marca), fuentes.css, base.css, menu.css
supabase/
  schema.sql            Tablas, índices, RLS, políticas, bucket y datos de ejemplo
  02-imagenes.sql       Logo, imágenes y destacados del local aroma (se corre después de schema.sql)
brand/                  Material de origen de la marca (NO se versiona, ver .gitignore)
```

## Modelo de datos y seguridad

- `locales` (con `slug` único y `tema` jsonb), `categorias`, `productos`, `usuarios_locales` (rol `owner` o `editor`)
  y `admins` (equipo de OESTACK).
- RLS activado en todas las tablas. El público lee solo locales activos, sus categorías activas y todos sus productos
  (los no disponibles también: la interfaz los muestra atenuados). Escriben solo los miembros del local y los admins.
- Los `editor` gestionan categorías y productos; los `owner` además editan los datos del local. Crear locales y
  asignar usuarios es solo de admins.
- Storage: bucket público `imagenes` (webp, jpeg y png, máx. 2 MB). Cada local sube solo a su carpeta `<local_id>/...`.
- El slug `admin` está reservado para el panel.

## Optimizar imágenes (logos y fotos de productos)

`scripts/optimizar-imagenes.mjs` toma el material de origen (`brand/`) y deja las versiones livianas en `public/`.
Usa [sharp](https://sharp.pixelplumbing.com/) (devDependency), así que alcanza con `npm install`. Se corre con
`npm run imagenes` (los argumentos van después de `--`):

```
# Fotos de productos: recorte 4:5, WebP en 480 y 800 px, apuntando a 60 KB o menos
npm run imagenes -- productos brand public/locales/aroma/productos --config scripts/aroma-imagenes.json

# Logos: recorta el margen vacío (logo, logo-claro y logo-completo)
npm run imagenes -- logo brand public/locales/aroma
```

Las fotos de origen ya vienen en WebP: el script solo las recorta, las achica y las recomprime.
Se renombran con `--config` (un JSON con `renombres` y, si un recorte corta el producto, `encuadre`
con el foco `[x, y]` de 0 a 1). Para otro local: copiar el JSON, ajustar los nombres y cambiar las carpetas.
Si una imagen no llega al objetivo sin perder calidad (mínimo q62), el script lo avisa en lugar de degradarla.

En la base, `imagen_url` guarda la versión de 800 px (`.../espresso-800.webp`) y `src/lib/imagenes.js` deduce la de 480 px
para el `srcset`. Una imagen que no siga ese nombre se usa tal cual.

## Marca

Identidad de Aroma (cafetería ficticia), tomada del brand book. Tokens en `src/styles/tokens.css`:
colores Espresso, Porcelana, Cobre, Salvia y Arena; Liberation Serif Italic para titulares y Lato para el texto.
El cobre oscuro `#905d3c` es un color derivado (no está en el PDF) para texto chico, porque el cobre original
no llega a contraste AA. Material original en `brand/` (no versionado).
