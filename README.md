# Demo Premium · Menú digital

Demo del plan Premium de OESTACK: menú digital con identidad de marca propia, imágenes de productos
y un panel de administración. Es una sola app (React + Vite) que sirve a todos los locales, con un
único proyecto de Supabase (Postgres + Auth + Storage) y datos separados por local (multi-tenant).

- Menú público: `/:slug` (ej. `/aroma`)
- Panel de administración: `/admin` (se construye más adelante)

Estado: **Tarea 4** (portada, animación de ambiente y acabados de marca). Todavía no hay contacto del local, buscador, QR ni panel.

## Cómo correrlo

```
npm install
cp .env.example .env     # y completar las dos variables (ver abajo)
npm run dev
```

Abrir http://localhost:5173/aroma. Otros comandos: `npm run build` (genera `dist/`), `npm run preview`,
`npm run lint`, `npm run verificar:rls` y `npm run imagenes`.

Antes de la primera vez hay que crear el proyecto de Supabase y pegar `supabase/schema.sql`
y después `supabase/02-imagenes.sql`, `supabase/03-frase.sql` y `supabase/04-imagenes-480.sql` en el SQL Editor (paso a paso más abajo).

## Variables de entorno

Ver `.env.example`. Van en `.env` (ignorado por git).

| Variable                 | Qué es                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | URL del proyecto (`https://xxxx.supabase.co`)                       |
| `VITE_SUPABASE_ANON_KEY` | Clave pública `anon` / `publishable`                                |
| `VITE_PUBLIC_URL`        | Dirección pública del sitio, sin barra final (`https://menu.oestack.com`). Se usa en las etiquetas Open Graph, que necesitan URLs absolutas. Si falta, quedan relativas (sirve en desarrollo, no para compartir) |

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
7. Pegar y correr `supabase/03-frase.sql`: agrega la frase de tono ("menos prisa, más aroma.") al `tema` del local.
   Es opcional: sin frase, el encabezado simplemente no la muestra.
8. Pegar y correr `supabase/04-imagenes-480.sql`: pasa `imagen_url` de la versión de 800 px a la de 480 px (las de 800 px
   ya no existen). Se puede correr más de una vez; si el `02` ya se corrió con 800 px, este paso es obligatorio. Al final devuelve
   una fila de control (`quedan_800 = 0`, `con_480 = 18`, `productos = 18`).
9. Pegar y correr `supabase/05-info-aviso.sql`: agrega las columnas del aviso (`aviso_texto`, `aviso_activo`) y carga datos
   ficticios de Aroma (horarios, dirección, WhatsApp, Instagram). Se puede correr más de una vez. **Antes de mostrarlo,
   reemplazar** el WhatsApp (`TODO 00000000000`) y el Instagram (`TODO-reemplazar-instagram`) por los reales: el archivo trae
   el bloque comentado para hacerlo. Los permisos no cambian (la anon ya lee `locales` por tabla).
10. Pegar y correr `supabase/06-etiquetas.sql`: carga etiquetas de ejemplo (vegano, vegetariano, sin TACC, sin lactosa, nuevo) en
    los 18 productos de Aroma. Se puede correr más de una vez (cada corrida deja las etiquetas como figuran en el archivo) y no
    cambia el esquema ni los permisos. Al final devuelve una fila de control (`productos = 18`, `con_etiquetas = 18`) y el
    recuento por etiqueta. Sin este paso el menú funciona igual, solo que sin chips de filtro.
11. Pegar y correr `supabase/07-variantes-adicionales.sql`: agrega `productos.variantes` y `categorias.adicionales` (jsonb), sus
    restricciones y datos de ejemplo de Aroma (variantes en espresso, capuchino, latte y moca; adicionales en Cafés). Se puede correr
    más de una vez y **no cambia permisos ni políticas RLS**: la lectura anónima está dada por tabla, no por columna, así que las
    columnas nuevas ya son legibles. Al final devuelve `con_variantes = 5` y `categorias_con_adicionales = 1`, y una segunda consulta
    que debe venir vacía. Sin este paso el menú funciona igual, solo que sin variantes ni adicionales.
12. `npm run dev` y abrir `/aroma`.

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
  locales/aroma/        Logos (logo, logo-claro, logo-completo) e imágenes de productos (<nombre>-240.webp y -480.webp)
  favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png, og-image.png
                        Íconos e imagen para redes (se generan con `npm run marca`)
  manifest.webmanifest  Web app: nombre, colores de marca, display standalone e íconos
  robots.txt
  _redirects            Para que /:slug funcione al recargar (Cloudflare Pages)
scripts/
  verificar-rls.mjs     Prueba de lectura/escritura con la anon key
  probar-horarios.mjs, probar-contacto.mjs, probar-filtros.mjs, probar-precios.mjs   Pruebas de horarios, enlaces, búsqueda/filtros y precios (npm run probar)
  optimizar-imagenes.mjs  Optimiza logos y fotos de brand/ para la web (npm run imagenes)
  generar-marca.mjs     Íconos, favicon e imagen Open Graph desde el logo (npm run marca)
  aroma-imagenes.json   Renombres de las fotos de Aroma
  lib/logo.mjs          Recorte del logo y medición del símbolo (lo usan los dos scripts)
  fuentes/              Liberation Serif Italic (subconjunto latino, TTF) para escribir la frase en la imagen social
src/
  lib/                  supabasePublico.js (cliente liviano), locales.js (getLocal), imagenes.js (srcset), formato.js, useLocal.js,
                        useCategoriaActiva.js, useAparecer.js, usePausarFueraDePantalla.js, movimiento.js, demo.js,
                        horarios.js (puro), contacto.js (enlaces seguros), visita.js, useAhora.js (reloj por minuto),
                        etiquetas.js (vocabulario, reutilizable en el panel), filtros.js (búsqueda y filtros, puro), useFiltros.js,
                        precios.js (formato ARS, variantes y adicionales; límites reutilizables en el panel)
  components/           Carta (arma la página), Portada, Granos, EstadoLocal, Aviso, NavCategorias, Busqueda, Destacados,
                        SeccionCategoria, TarjetaProducto, Precio, Visitanos, PantallaMensaje, Esqueleto y Pie
  pages/                Menú (/:slug) y "local no encontrado"
  admin/                Panel de administración (más adelante)
  styles/               tokens.css (marca), fuentes.css, base.css, pantalla.css, portada.css, menu.css, busqueda.css, precios.css, visitanos.css, esqueleto.css
supabase/
  schema.sql            Tablas, índices, RLS, políticas, bucket y datos de ejemplo
  02-imagenes.sql       Logo, imágenes y destacados del local aroma (se corre después de schema.sql)
  03-frase.sql          Frase de tono del encabezado (tema.frase)
  04-imagenes-480.sql   Migra imagen_url de la versión de 800 px a la de 480 px
  05-info-aviso.sql     Columnas del aviso y datos de contacto/horarios de ejemplo
  06-etiquetas.sql      Etiquetas de ejemplo en los productos de aroma
  07-variantes-adicionales.sql   Variantes de producto, adicionales por categoría, restricciones y ejemplos
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

## Cómo funciona el menú público

- **Portada:** bloque tipográfico sobre espresso (75 % de la pantalla, máximo 46 rem) con el logo claro, la frase
  (`tema.frase`), la descripción y el botón "Ver la carta", que baja a la primera sección (destacados o, si no hay,
  la primera categoría) y la deja justo debajo de la barra. Entra de a poco (logo, frase, descripción y botón, con retardos
  de 0,12 s). El logo claro se deduce del logo principal por convención: `.../logo.webp` -> `.../logo-claro.webp`.
- **Granos de café:** 12 granos SVG que caen despacio solo en la portada (cobre y arena, baja opacidad). Se animan únicamente
  `transform` y `opacity`, se pausan cuando la portada sale de pantalla (`IntersectionObserver`) y son decorativos
  (`aria-hidden`, sin clics). Con `prefers-reduced-motion` quedan 6 granos quietos y la portada aparece sin animación.
- **Barra de categorías:** se pega arriba recién al pasar la portada. El esqueleto de carga incluye una portada del mismo tamaño,
  así que no hay saltos de diseño (CLS 0).
- **Pantallas de aviso:** "local no encontrado" y el error de carga usan el logo, las tipografías y un mensaje amable con un
  botón para volver o reintentar. Mientras no haya una identidad propia de OESTACK usan la marca de la demo (`src/lib/demo.js`).
- **Navegación:** barra fija con un enlace por categoría (enlaces normales a `#id`, funcionan aun sin JavaScript).
  La categoría que se está leyendo se marca con `aria-current` usando un `IntersectionObserver`.
- **Destacados:** una sola fila horizontal con `scroll-snap`, sin barra visible. Se desliza con el dedo, el trackpad,
  el teclado (Tab recorre las tarjetas) o, en pantallas de 1024 px o más **cuando las tarjetas no entran en el ancho**,
  con los botones anterior y siguiente. La rueda vertical del mouse sigue desplazando la página a propósito, para no
  "atrapar" el scroll; con Shift + rueda o con el trackpad horizontal, la fila se mueve.
- **Tarjetas de producto:** son contenido estático (no se tocan). En las categorías son horizontales y compactas: miniatura 4:5
  a un lado; al otro, nombre y precio en la misma línea, descripción y etiquetas. Una columna en celular y dos desde 768 px.
  Los productos no disponibles se ven atenuados y con la leyenda "No disponible".
- **Imágenes:** cada foto existe en 240 y 480 px y el `srcset` con su `sizes` deja que el navegador elija la más chica que alcance.
- **Cliente de datos:** el menú público usa solo `@supabase/postgrest-js` (cliente liviano de lectura, en `src/lib/supabasePublico.js`);
  su versión está fijada igual a la que trae `@supabase/supabase-js` para no duplicar código. El panel de administración usará el cliente
  completo, cargado solo en `/admin`.
- **Movimiento:** la aparición de secciones y tarjetas se desactiva con `prefers-reduced-motion`.
  El contenido nunca queda oculto si falla el JavaScript o el navegador no soporta `IntersectionObserver`.
- **Frase de tono:** sale de `locales.tema.frase`; cada local puede tener la suya.

## Información del local, horarios y aviso

- **"Abierto ahora":** debajo de la descripción de la portada, en texto ("Abierto ahora · hasta las 20:00", "Cierra pronto · hasta las 20:00",
  "Cerrado · abre mañana a las 8:00"). Se recalcula cada minuto y al volver a la pestaña. Siempre usa la **zona horaria del local**, no la del
  dispositivo. Sin horarios válidos, la línea no aparece.
- **Visitanos:** sección al final de la carta (con enlace en la barra) con los horarios de la semana (hoy resaltado), la dirección
  y los botones de WhatsApp, Instagram y "Cómo llegar" (se abren en otra pestaña con `rel="noopener noreferrer"`). Lo que falte
  en la base simplemente no se muestra. Los enlaces se arman en `src/lib/contacto.js` y solo aceptan https.
- **Aviso:** franja fina arriba de la portada, editable desde la base (`aviso_texto`, hasta 200 caracteres, y `aviso_activo`).
  Se puede cerrar y el cierre se recuerda solo durante la sesión (`sessionStorage`). No mueve el diseño (CLS 0) y se anuncia
  con `role="status"`.

### Formato de `locales.horarios` (jsonb)

```json
{
  "zona": "America/Argentina/Buenos_Aires",
  "semana": {
    "lunes":   [{ "desde": "08:00", "hasta": "13:00" }, { "desde": "16:00", "hasta": "20:00" }],
    "martes":  [{ "desde": "08:00", "hasta": "20:00" }],
    "viernes": [{ "desde": "20:00", "hasta": "02:00" }],
    "domingo": []
  }
}
```

- `zona`: nombre IANA; opcional (por defecto `America/Argentina/Buenos_Aires`).
- Claves de día sin tildes: `lunes`, `martes`, `miercoles`, `jueves`, `viernes`, `sabado`, `domingo`.
- Cada día es una lista de tramos `{desde, hasta}` en `HH:MM`: **varios tramos** (corte de mediodía) son varios elementos.
- **Día cerrado:** lista vacía `[]` o clave ausente.
- **Cruce de medianoche:** si `hasta` es menor que `desde` (ej. `20:00` a `02:00`), el tramo termina al día siguiente.
  `"24:00"` también vale como cierre a medianoche.
- La apertura es inclusiva y el cierre exclusivo (a las 20:00 en punto de un local que cierra a las 20:00, ya figura cerrado).
- Tramos inválidos se ignoran sin romper el resto; si ninguno sirve, no se muestran horarios.

`npm run probar` corre las pruebas de `src/lib/horarios.js` y `src/lib/contacto.js` (con distintas zonas, cierres, cruces
de medianoche y cambios de día).

## Etiquetas, buscador y filtros

- **Vocabulario:** `src/lib/etiquetas.js` define las etiquetas estándar, en este orden: Vegano, Vegetariano, Sin TACC, Sin lactosa,
  Picante y Nuevo (cada una con `clave`, `nombre`, `descripcion` corta y `tono`). Está pensado para que el panel de administración
  lo reutilice en el selector de etiquetas. En la base se guarda la **clave** en `productos.etiquetas` (`vegano`, `sin-tacc`...);
  "Sin TACC", "sin tacc" y "sin-tacc" se tratan como la misma.
- **Etiquetas fuera del vocabulario:** se muestran igual, como texto simple (chip neutro, con la primera letra en mayúscula), y
  también se pueden filtrar. Aparecen después de las del vocabulario.
- **Tarjetas:** cada etiqueta es un chip con su texto (nunca solo color ni solo ícono): salvia para las dietéticas, cobre suave para
  "Picante", cobre lleno para "Nuevo" y arena para las ajenas. Los destacados (tarjeta vertical) no muestran etiquetas.
- **Buscador** (`role="search"`, entre la barra de categorías y los destacados): busca en nombre, descripción y etiquetas, sin
  distinguir mayúsculas ni tildes (normalización NFD). Con varias palabras, el producto debe contenerlas todas. Espera 150 ms
  desde la última letra, tiene texto de 16 px (el iPhone no hace zoom), botón para borrar y se limpia con Escape.
- **Filtros:** una fila de chips (botones con `aria-pressed`, 44 px de alto) con **solo** las etiquetas que existen en los productos
  del local, en el orden del vocabulario. Se combinan: el producto tiene que cumplir **todas** las elegidas. En celular la fila se
  desliza sin barra visible.
- **Resultados:** se filtran las tarjetas de cada categoría y las categorías vacías desaparecen de la lista y de la barra (la barra
  sigue marcando la categoría que se está leyendo). Mientras hay búsqueda o filtros, **los destacados se ocultan** (los resultados ya
  muestran esos productos en su categoría). Los productos "No disponible" también se filtran y se ven atenuados. Un texto con
  `aria-live="polite"` anuncia la cantidad ("7 productos") y, si no hay coincidencias, aparece un estado vacío con el botón
  "Limpiar filtros". El buscador no se mueve de lugar al filtrar (el recuento y la fila de chips reservan su alto).
- **Enlace compartible:** la búsqueda y los filtros se reflejan en la URL con `history.replaceState` (sin llenar el historial):
  `/aroma?q=licuado&etiquetas=vegano,sin-tacc`. Al abrir ese enlace se restauran. Las etiquetas que el local no tiene se ignoran.
- **Alergias:** al final de la carta figura "Ante alergias o intolerancias, consultá al personal." **Las etiquetas las carga cada
  local y son su responsabilidad**: la demo y la plataforma no verifican ingredientes ni alérgenos, y las etiquetas de Aroma son
  solo de ejemplo.
- Limitación conocida: el esqueleto de carga reserva siempre el lugar de la fila de chips; un local que no tenga ninguna etiqueta
  verá un pequeño salto al cargar, porque esa fila no se muestra.

## Variantes de producto y adicionales por categoría

Son información para el cliente: **no hay carrito ni pedidos**, y nada se suma automáticamente.

**Variantes** (`productos.variantes`, jsonb, por defecto `[]`): hasta **4** objetos `{ "nombre", "precio" }`.

```json
[{ "nombre": "Chico", "precio": 4800 }, { "nombre": "Grande", "precio": 6000 }]
```

- Con variantes, la tarjeta muestra cada una con su precio (nombre chico arriba, precio abajo; bajan de renglón sin romper el diseño,
  y un nombre largo se parte dentro de su columna) en lugar de un único precio. Los **destacados** muestran "desde $X" cuando hay
  variantes con precios distintos; si todas valen lo mismo, el precio a secas.
- **Regla del precio base:** la columna `productos.precio` sigue siendo obligatoria y, si hay variantes, **debe valer igual que el
  precio MÁS BAJO de las variantes**. Lo mantiene el panel de administración; la base no lo fuerza con una restricción (obligaría a
  cambiar precio y variantes siempre en la misma operación). El menú público toma el "desde" de las propias variantes, así que no
  depende de que coincidan; la segunda consulta de control de `07-variantes-adicionales.sql` lista los que no coinciden.
- Sin variantes todo funciona como antes.

**Adicionales** (`categorias.adicionales`, jsonb, por defecto `[]`): hasta **8** objetos `{ "nombre", "precio" }`.

```json
[{ "nombre": "Leche vegetal", "precio": 600 }, { "nombre": "Shot extra", "precio": 800 }]
```

Se muestran debajo del título de la categoría, en una línea sutil: "Podés sumar: Leche vegetal +$600  Shot extra +$800" (el precio en cobre y en negrita separa un adicional de otro). Con la lista
vacía no aparece nada. Siguen visibles mientras se busca o se filtra dentro de esa categoría.

**Límites y validación**
- Máximo 4 variantes por producto y 8 adicionales por categoría; nombres de 1 a 40 caracteres; precios numéricos de 0 a 99.999.999,99.
  Los valores están en `src/lib/precios.js` (`MAX_VARIANTES`, `MAX_ADICIONALES`, `LARGO_MAX_NOMBRE`, `PRECIO_MAXIMO`) para que el panel valide
  lo mismo.
- En la base, la función `public.lista_precios_valida(lista, maximo)` (sin acceso a tablas, `search_path` fijado) respalda dos restricciones
  CHECK: `productos_variantes_validas` y `categorias_adicionales_validos`.
- El menú lee los datos de forma **defensiva** (`src/lib/precios.js`): ignora lo inválido (elementos que no son objetos, nombre vacío, precio que
  no es número o es negativo), corta los nombres a 40 caracteres y se queda con los primeros 4 u 8 válidos. Si no queda ninguna variante válida,
  muestra el precio base; nunca rompe la página.
- La búsqueda no mira dentro de las variantes ni de los adicionales.

**Accesibilidad:** el precio visible ("$4.800") está oculto para los lectores de pantalla y se les da en su lugar un texto aparte
("4.800 pesos", "desde 4.800 pesos", "más 600 pesos"), porque no todos leen bien el signo `$`. Una variante se lee "Chico, 4.800 pesos".

## Medir el rendimiento (Lighthouse)

Con el build de producción y el servidor de vista previa:

```
npm run build
npm run preview          # sirve http://localhost:4173
```

Y en otra terminal (usa tu Chrome; el informe queda en `lighthouse.html`):

```
npx lighthouse http://localhost:4173/aroma --form-factor=mobile --view
```

O en Chrome: abrir `http://localhost:4173/aroma`, DevTools (F12) > pestaña **Lighthouse** > modo **Mobile** > **Analyze page load**.
Conviene correrlo en una ventana de incógnito y varias veces: el rendimiento varía entre corridas.

## Optimizar imágenes (logos y fotos de productos)

`scripts/optimizar-imagenes.mjs` toma el material de origen (`brand/`) y deja las versiones livianas en `public/`.
Usa [sharp](https://sharp.pixelplumbing.com/) (devDependency), así que alcanza con `npm install`. Se corre con
`npm run imagenes` (los argumentos van después de `--`):

```
# Fotos de productos: recorte 4:5, WebP en 240 y 480 px, apuntando a 60 KB o menos
npm run imagenes -- productos brand public/locales/aroma/productos --config scripts/aroma-imagenes.json

# Logos: recorta el margen vacío (logo, logo-claro y logo-completo)
npm run imagenes -- logo brand public/locales/aroma
```

Las fotos de origen ya vienen en WebP: el script solo las recorta, las achica y las recomprime.
Se renombran con `--config` (un JSON con `renombres` y, si un recorte corta el producto, `encuadre`
con el foco `[x, y]` de 0 a 1). Para otro local: copiar el JSON, ajustar los nombres y cambiar las carpetas.
Si una imagen no llega al objetivo sin perder calidad (mínimo q62), el script lo avisa en lugar de degradarla.

En la base, `imagen_url` guarda la versión de 480 px (`.../espresso-480.webp`) y `src/lib/imagenes.js` deduce la de 240 px
para el `srcset`. Una imagen que no siga ese nombre se usa tal cual. Si en una corrida cambian los anchos, el script borra
las versiones en desuso de las fotos que procesa.

## Íconos, web app y vista previa (acabados de marca)

`scripts/generar-marca.mjs` genera, con sharp, el favicon (SVG y PNG de 32 px), el `apple-touch-icon` (180 px), los íconos de
192 y 512 px (más uno "maskable" de 512 px para Android) y la imagen para redes de 1200 x 630 px (fondo espresso, logo claro y
la frase en la tipografía de la marca). El símbolo de cuatro puntos se **mide sobre los píxeles del logo** y se redibuja en
vectores, así queda nítido a cualquier tamaño:

```
npm run marca -- brand public --frase "menos prisa, más aroma."
```

`public/manifest.webmanifest` (nombre "Aroma", colores de la marca, `display: standalone`) y `theme-color` permiten agregar el
menú a la pantalla de inicio. Las etiquetas Open Graph y Twitter de `index.html` usan `VITE_PUBLIC_URL` para armar la URL absoluta
de la imagen (`vite.config.js` reemplaza `__URL_PUBLICA__` al hacer el build).

**Limitación importante (varios locales):** al ser una app de una sola página, `index.html` es el mismo para todos los locales, y
quienes generan la vista previa (WhatsApp, Instagram, X, etc.) **no ejecutan JavaScript**: todos los locales compartirían el
título, la descripción y la imagen de Aroma. Para esta demo está bien. Cuando haya varios locales hará falta **una función en
Cloudflare Pages** (Pages Function o Worker) que, según el `slug` de la URL, lea el local desde Supabase e inyecte en el HTML:
`<title>`, `description`, las etiquetas `og:*` y `twitter:*` (con la imagen del local), el `preload` del logo claro y, si se
quiere, un manifiesto propio. En el mismo paso se resuelve la imagen social por local (hoy `og-image.png` es la de Aroma).

## Marca

Identidad de Aroma (cafetería ficticia), tomada del brand book. Tokens en `src/styles/tokens.css`:
colores Espresso, Porcelana, Cobre, Salvia y Arena; Liberation Serif Italic para titulares y Lato para el texto.
El cobre oscuro `#905d3c` es un color derivado (no está en el PDF) para texto chico, porque el cobre original
no llega a contraste AA. Material original en `brand/` (no versionado).
