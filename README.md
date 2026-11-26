# Demo Premium · Menú digital

Demo del plan Premium de OESTACK: menú digital con identidad de marca propia, imágenes de productos
y un panel de administración. Es una sola app (React + Vite) que sirve a todos los locales, con un
único proyecto de Supabase (Postgres + Auth + Storage) y datos separados por local (multi-tenant).

- Menú público: `/:slug` (ej. `/aroma`)
- Panel de administración: `/admin` (login, permisos, categorías, productos con fotos, ajustes del local, cuenta y clientes)

Estado: **Tarea 12** (alta de clientes, cuenta del usuario y vista de clientes). El menú público está completo (portada, información del local, etiquetas con filtros, variantes y adicionales).

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
| `VITE_PUBLIC_URL`        | Dirección pública del sitio, sin barra final (`https://menu.oestack.com`). Se usa en las etiquetas Open Graph, que necesitan URLs absolutas, y es **lo que codifica el QR** (`<VITE_PUBLIC_URL>/<slug>`). Si falta, las etiquetas quedan relativas (sirve en desarrollo, no para compartir) y el panel no genera QR |

Vite incorpora estas variables al momento del build: si se cambian, hay que volver a publicar.

**La clave secreta** (`sb_secret_...`, o la vieja `service_role`) saltea toda la seguridad. Nunca va en el frontend (`src/`), nunca con
prefijo `VITE_`, nunca en git ni en el hosting. La única excepción es `SUPABASE_SECRET_KEY` en el `.env` de **tu computadora**, que usan
los scripts de clientes (ver "Clientes"). Control: `npm run verificar:secretos`.

Variables nuevas (solo para `npm run verificar:permisos`, ver "Panel de administración"): `TEST_USER1_EMAIL`, `TEST_USER1_PASSWORD`,
`TEST_USER2_EMAIL` y `TEST_USER2_PASSWORD`. Son credenciales de usuarios de **prueba**, van solo en `.env` (que no se versiona) y no empiezan
con `VITE_`, así que Vite nunca las incluye en el sitio publicado.
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
12. Antes del panel: crear los usuarios de prueba y correr `supabase/08-admin-base.sql` (ver "Panel de administración" más abajo).
13. Para reordenar categorías desde el panel: correr `supabase/09-admin-categorias.sql` (ver "Categorías" más abajo).
14. Para administrar productos: correr `supabase/10-admin-productos.sql` (ver "Productos" más abajo).
15. Para los ajustes del local: correr `supabase/11-admin-ajustes.sql` (ver "Ajustes" más abajo). Si alguna vez se vuelve a correr
    `schema.sql`, hay que volver a correr el `11` después: `schema.sql` devuelve el permiso de actualizar toda la tabla (el trigger sigue protegiendo).
16. Para el alta de clientes: correr `supabase/12-admin-clientes.sql` (ver "Clientes" más abajo).
17. `npm run dev` y abrir `/aroma`.

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
  probar-horarios.mjs, probar-contacto.mjs, probar-filtros.mjs, probar-precios.mjs, probar-permisos.mjs, probar-categorias.mjs, probar-productos.mjs, probar-ajustes.mjs, probar-cuenta.mjs, probar-clientes.mjs, probar-demo.mjs, probar-qr.mjs   Pruebas de lógica pura (npm run probar)
  verificar-permisos.mjs   Aislamiento entre locales contra Supabase real (npm run verificar:permisos)
  verificar-secretos.mjs   Busca claves secretas en el repo, en dist/ y, con --historial, en git (npm run verificar:secretos)
  verificar-auth.mjs    Registro, contraseñas y cierre de sesión contra Supabase real (npm run verificar:auth)
  probar-atras.mjs      "Atrás" y "adelante" con cambios sin guardar, en Chrome (npm run probar:atras)
  clientes/             Alta, contraseña, estado y baja de clientes, y usuarios de prueba (solo en tu computadora)
  demo/                 Cuenta demo: demo:guardar, demo:reiniciar y la copia versionada (aroma.json)
  optimizar-imagenes.mjs  Optimiza logos y fotos de brand/ para la web (npm run imagenes)
  generar-marca.mjs     Íconos, favicon e imagen Open Graph desde el logo (npm run marca)
  aroma-imagenes.json   Renombres de las fotos de Aroma
  lib/logo.mjs          Recorte del logo y medición del símbolo (lo usan los dos scripts)
  lib/                  También: secretos.mjs (detector), historial.mjs (historial de git), env-archivo.mjs y chrome.mjs (Chrome sin dependencias)
  fuentes/              Liberation Serif Italic (subconjunto latino, TTF) para escribir la frase en la imagen social
src/
  lib/                  supabasePublico.js (cliente liviano), locales.js (getLocal), imagenes.js (srcset), formato.js, useLocal.js,
                        useCategoriaActiva.js, useAparecer.js, usePausarFueraDePantalla.js, movimiento.js, demo.js,
                        horarios.js (puro), contacto.js (enlaces seguros), visita.js, useAhora.js (reloj por minuto),
                        etiquetas.js (vocabulario, reutilizable en el panel), filtros.js (búsqueda y filtros, puro), useFiltros.js,
                        precios.js (formato ARS, variantes y adicionales; límites reutilizables en el panel),
                        tema.js (colores del local y contraste, puro), useTema.js, atras.js ("atrás" antes que el router)
  components/           Carta (arma la página), Portada, Granos, EstadoLocal, Aviso, NavCategorias, Busqueda, Destacados,
                        SeccionCategoria, TarjetaProducto, Precio, Visitanos, PantallaMensaje, Esqueleto y Pie
  pages/                Menú (/:slug) y "local no encontrado"
  admin/                Panel de administración (/admin), cargado solo en esas rutas (ver abajo)
  styles/               tokens.css (marca), fuentes.css, base.css, pantalla.css, portada.css, menu.css, busqueda.css, precios.css, visitanos.css, esqueleto.css
supabase/
  schema.sql            Tablas, índices, RLS, políticas, bucket y datos de ejemplo
  02-imagenes.sql       Logo, imágenes y destacados del local aroma (se corre después de schema.sql)
  03-frase.sql          Frase de tono del encabezado (tema.frase)
  04-imagenes-480.sql   Migra imagen_url de la versión de 800 px a la de 480 px
  05-info-aviso.sql     Columnas del aviso y datos de contacto/horarios de ejemplo
  06-etiquetas.sql      Etiquetas de ejemplo en los productos de aroma
  07-variantes-adicionales.sql   Variantes de producto, adicionales por categoría, restricciones y ejemplos
  08-admin-base.sql     Panel: slug "login" reservado, local de prueba inactivo y membresías de los usuarios de prueba
  09-admin-categorias.sql   Función para reordenar categorías de forma atómica
  10-admin-productos.sql    Límites de nombres y precio, y función para reordenar productos
  11-admin-ajustes.sql      Protección de columnas de locales, validaciones, updated_at y carpeta del logo
  12-admin-clientes.sql     Slugs reservados del panel y permisos de los scripts de clientes
  12b-tope-demo.sql         Tope de 60 archivos en la carpeta de la demo (Storage)
  13-limites-publicos.sql   Direcciones de imágenes y largo de los textos que se publican
docs/
  seguridad.md          Revisión de seguridad: hallazgos, riesgos aceptados, pendientes y cabeceras para Vercel
brand/                  Material de origen de la marca (NO se versiona, ver .gitignore)
```

## Modelo de datos y seguridad

- `locales` (con `slug` único y `tema` jsonb), `categorias`, `productos`, `usuarios_locales` (rol `owner` o `editor`)
  y `admins` (equipo de OESTACK).
- RLS activado en todas las tablas. El público lee solo locales activos, sus categorías activas y todos sus productos
  (los no disponibles también: la interfaz los muestra atenuados). Escriben solo los miembros del local y los admins.
- Los `editor` gestionan categorías y productos; los `owner` además editan los datos del local. Crear locales y
  asignar usuarios es solo de admins.
- Storage: bucket público `imagenes` (webp, jpeg y png, máx. 2 MB). Cada local sube solo a su carpeta `<local_id>/...`;
  en `<local_id>/logo/` solo escriben el dueño y los admins.
- En `locales`, además del RLS (qué filas), hay protección por columna (qué datos): ver "Ajustes".
- El slug `admin` está reservado para el panel.

## Cómo funciona el menú público

- **Portada:** bloque tipográfico sobre espresso (75 % de la pantalla, máximo 46 rem) con el logo claro, la frase
  (`tema.frase`), la descripción y el botón "Ver la carta", que baja a la primera sección (destacados o, si no hay,
  la primera categoría) y la deja justo debajo de la barra. Entra de a poco (logo, frase, descripción y botón, con retardos
  de 0,12 s). Para los logos de la app, la versión clara se deduce por convención: `.../logo.webp` -> `.../logo-claro.webp`
  (si la portada es clara se usa la oscura). Un logo subido desde el panel se usa tal cual. Si la imagen no carga, queda el nombre.
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
- **Colores propios:** `locales.tema` admite además `fondo`, `texto`, `acento` y `portada` (`#RRGGBB`). El resto (texto suave,
  enlaces, bordes y texto sobre botones y portada) se calcula en `src/lib/tema.js` para que se lea. Sin colores propios no se
  aplica ninguna variable y valen los de `tokens.css`. Con tema propio, mientras carga puede verse un instante el esqueleto con
  los colores de Aroma; el favicon, la imagen para redes y el `preload` del logo en `index.html` son fijos.

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

## Panel de administración (`/admin`)

Cada local edita su propio menú desde `/admin`: ingreso y permisos, **categorías**, **productos** con fotos, **ajustes** del local y **su cuenta**.

**Rutas**
- `/admin/login`: ingreso con email y contraseña (sin "olvidé mi contraseña": se genera una temporal con `npm run cliente:password`).
- `/admin/cuenta`: email y rol, **cambiar contraseña** y salir. Se llega desde "Mi cuenta", en el encabezado.
- `/admin/clientes`: todos los locales, **solo para admins** de OESTACK (ver "Vista de clientes").
- `/admin`: va directo al único local del usuario; si tiene varios, o es admin de OESTACK, muestra un selector.
- `/admin/:slug`: panel del local con *Inicio* (resumen: estado, cantidad de categorías y productos, enlace al menú público), *Categorías*,
  *Productos* y *Ajustes*. Se usa bien desde el celular.
- Todas llevan `<meta name="robots" content="noindex">`. Los slugs `admin`, `login`, `clientes` y `cuenta` están reservados en la base (un local no puede llamarse así).
- Sin sesión, cualquier ruta protegida lleva al login (y vuelve a donde se quería ir). Con sesión pero sin permiso sobre ese local aparece
  "No tenés acceso a este local", sin revelar si el local existe. Si la sesión vence, se vuelve al login con el aviso "Tu sesión venció".

**Código dividido:** el panel se carga con `React.lazy` solo en `/admin/*`. El cliente completo de Supabase (`@supabase/supabase-js`) y todo lo del
panel viajan en su propio archivo (~228 kB, ~60 kB comprimido); el menú público sigue usando el cliente liviano (`postgrest-js`) y no lo descarga.
La carga diferida suma al JS del menú público unos 2,4 kB (menos de 1 kB comprimido) por el mecanismo de Vite. Los estilos del panel
(`src/admin/admin.css`) viajan dentro de ese mismo archivo.

**La protección de rutas del frontend es solo comodidad. La seguridad real vive en el RLS de la base** (`supabase/schema.sql`): aunque alguien se
saltee la interfaz, Postgres rechaza lo que no le corresponde. El panel usa solo la clave pública (anon) y actúa siempre como el usuario logueado.

**Reglas de permisos** (iguales en el RLS y en `src/admin/permisos.js`, que es lo que usa la interfaz: `usePermisos(slug)`)

| Rol | Categorías y productos de su local | Datos del local (nombre, horarios, contacto, aviso) | Crear locales y asignar usuarios |
|---|---|---|---|
| `editor` | sí | no | no |
| `owner` (dueño) | sí | sí | no |
| `admin` (equipo de OESTACK) | sí, en todos los locales | sí, en todos | sí |

Un usuario solo lee sus propias filas de `usuarios_locales` y `admins` (políticas `usuarios_locales_lectura_propia` y `admins_lectura_propia`, que ya
existían en `schema.sql`). Escribir en esas tablas es solo de admins (`usuarios_locales`) o de nadie por la API (`admins`: se cargan desde el SQL Editor).

### Estética del panel

El panel usa **la misma marca que el menú público de Aroma**: los tokens de `src/styles/tokens.css`, las fuentes autoalojadas (Lato y
Liberation Serif Italic), botones píldora, chips, el campo del buscador y tarjetas porcelana. `src/admin/tokens-admin.css` solo agrega lo que
faltaba, derivado de los colores de marca (la única excepción es el rojo de error y acciones destructivas, que la paleta no tiene).
Componentes compartidos en `src/admin/ui/`: `Boton`, `Campo`, `Tarjeta`, `Alerta`, `Interruptor` (`role="switch"`), `AvisoEstado`
(región `aria-live` para "Guardado" y errores) y `Confirmacion` (en línea, sin modales). En el celular la navegación es una barra inferior.

> El panel usa los tokens **fijos** de Aroma: no toma los colores de `locales.tema` (solo la vista previa de Ajustes). Si más adelante
> cada cliente tiene su propia marca, habrá que decidir si el panel hereda su tema o se mantiene igual para todos.

### Categorías (`/admin/:slug/categorias`)

- Listado en el orden del menú, con la cantidad de productos y si está visible u oculta. Estados de carga (esqueleto), vacío y error con "Reintentar".
- **Crear y editar** el nombre (hasta 60 caracteres; se recortan los espacios). No se permiten dos nombres que den el mismo enlace de sección
  (por ejemplo "Cafés" y "cafes"), porque romperían la barra de categorías del menú. La tabla no tiene columna de descripción.
- **Ocultar o mostrar** con un interruptor (columna `activa`). Lo oculto desaparece del menú público (RLS). Las categorías **sin productos**
  tampoco aparecen en el menú.
- **Reordenar** con los botones subir y bajar (usables con teclado y lector de pantalla, con anuncio de la nueva posición). Se guarda con la
  función `reordenar_categorias` (ver abajo).
- **Adicionales** (`categorias.adicionales`): alta, edición y baja; hasta 8, nombre obligatorio y sin repetir, precio no negativo
  (se puede escribir "600", "1.200" o "1.200,50"). Reutiliza `src/lib/precios.js`; la base además lo valida.
- **Eliminar:** solo categorías vacías, con confirmación en línea. Si tiene productos se informa cuántos y se ofrece ocultarla (la clave foránea
  también lo impide en la base).
- Permisos: `usePermisos(slug).puedeGestionarMenu` (dueño, editor y admin) decide qué controles se ven; **el permiso real lo impone el RLS**.

**`supabase/09-admin-categorias.sql`:** reordenar son varios `UPDATE`; hechos sueltos, una falla dejaría órdenes repetidos. La función
`public.reordenar_categorias(local, ids)` lo hace en **una sola transacción**. Es `SECURITY INVOKER` (el RLS sigue valiendo), comprueba que quien
la llama sea miembro o admin, exige la lista exacta de categorías del local, bloquea las filas mientras reordena y solo la pueden ejecutar usuarios
con sesión. No cambia tablas ni políticas. Su consulta de control debe dar `security_definer = false`, `anon_puede = false` y `con_sesion_puede = true`.

### Productos (`/admin/:slug/productos`)

- **Lista** agrupada por categoría, en el orden del menú, con miniatura, precio (o "desde $X") y etiquetas. Búsqueda por nombre y filtros por
  categoría y estado (se guardan en la URL). Estados de carga, vacío (si no hay categorías, enlaza a Categorías) y error con "Reintentar".
- **Acciones rápidas** en cada fila, sin abrir el formulario: "Disponible / Agotado" y "Destacado".
- **Reordenar** dentro de la categoría con subir y bajar (función `reordenar_productos`, una sola transacción). Con búsqueda o filtro de estado
  los botones se ocultan, porque se verían huecos.
- **Alta y edición** en pantalla propia (`/productos/nuevo` y `/productos/:id`): nombre (máx. 60), descripción (máx. 200, límite solo de la
  interfaz), precio ("1.500" o "1500,50"), categoría, disponible, destacado, etiquetas y hasta 4 opciones. Con opciones, el precio principal
  es el de la más barata. Los nuevos van al final de su categoría. Si guardar falla, no se pierde lo escrito.
- **Eliminar** con confirmación en línea; borra también las fotos subidas desde el panel.

#### Fotos

Todo se prepara **en el navegador**, sin dependencias ni transformaciones de pago de Supabase:

- Entrada: JPG, PNG o WebP de hasta 10 MB (en el iPhone, el selector entrega JPG). Se respeta la orientación EXIF y se recorta al centro en 4:5,
  con vista previa antes de guardar.
- Salida: **480x600** (objetivo: hasta 80 kB) y **240x300**. El original nunca se sube. Una imagen con muchísima textura puede pasar los 80 kB:
  no se baja de la calidad 0,5.
- **WebP, con respaldo en JPEG:** algunos navegadores (Safari) no saben generar WebP desde un canvas y devuelven un PNG sin avisar. Se comprueba
  el tipo real y, si no es WebP, las dos versiones se generan en JPEG.
- Ruta: `<local_id>/productos/<nombre>-<único>-480.webp` (o `.jpg`) y `-240`, con caché de un año. Cada subida usa un nombre nuevo.
- **Orden seguro** (`src/admin/guardarProducto.js`): subir lo nuevo, actualizar la base y recién ahí borrar lo viejo. Si no se puede saber si la
  base guardó, **no se borra nada**: es preferible un archivo de más (se informa en pantalla) que un producto sin foto.

**Qué guarda `productos.imagen_url`** (siempre la versión de 480 px; la de 240 se deduce por el nombre):

| Origen | Valor |
| --- | --- |
| Fotos del demo | ruta local: `/locales/aroma/productos/espresso-480.webp` |
| Fotos del panel | URL pública de Storage: `<SUPABASE_URL>/storage/v1/object/public/imagenes/<local_id>/productos/…-480.webp` |

Así el menú público arma el `srcset` igual para las dos, sin saber de dónde vienen. El panel solo borra archivos de la segunda forma que estén en
la carpeta del propio local y que ningún otro producto use. **Si algún día se cambia de proyecto de Supabase**, hay que copiar los archivos y
reemplazar la URL base en `imagen_url`.

**Límites de Storage:** el bucket rechaza otros tipos y archivos de más de 2 MB, y la política solo deja escribir en `<local_id>/`. Ojo: el bucket
mira el **tipo declarado**, no el contenido; un usuario con sesión podría subir a su propia carpeta otra cosa declarada como imagen.

**Archivos huérfanos:** si se cierra la pestaña o se corta la conexión en medio de un guardado pueden quedar fotos sin usar. Al final de
`supabase/10-admin-productos.sql` hay una consulta (comentada) que las lista.

**`supabase/10-admin-productos.sql`:** primero comprueba que los datos existentes cumplan (si no, se detiene sin aplicar nada); agrega nombres de
1 a 60 caracteres y precio sin `NaN`; y crea `reordenar_productos(local, categoría, ids)` (`SECURITY INVOKER`, lista exacta, filas bloqueadas, solo
con sesión). Su fila de control debe dar `security_definer = false`, `anon_puede = false`, `con_sesion_puede = true`, `limites = 6`,
`bucket_max_bytes = 2097152`, `politicas_storage = 1`, `aroma_categorias = 3` y `aroma_productos = 18`.

### Ajustes (`/admin/:slug/ajustes`)

Editan el **dueño** y los admins; un `editor` lo ve en modo lectura. Cada sección se guarda por separado y, si falla, no se pierde
lo escrito. Arriba (o al costado desde 1100 px) hay una **vista previa** con los mismos componentes del menú y lo que todavía no se guardó.

| Sección | Qué guarda | Límites y reglas |
| --- | --- | --- |
| Información y contacto | `nombre`, `descripcion`, `direccion`, `whatsapp`, `instagram` | Nombre 60, descripción 200 y dirección 120 caracteres. Solo se validan y envían los campos que cambiaron. El modelo no tiene teléfono ni enlace de mapa: "Cómo llegar" se arma con la dirección |
| Horarios | `horarios` | Por día: abierto (hasta 3 franjas), cerrado o 24 horas; "Copiar a todos los días". Sin superposiciones (también contra el día siguiente). Si cruza la medianoche, cierra a más tardar a las 12:00. Con los 7 días cerrados no se muestran horarios |
| Aviso | `aviso_texto`, `aviso_activo` | Hasta 200 caracteres. No se puede activar vacío |
| Apariencia | `tema` | Frase (80) y cuatro colores `#RRGGBB`. Avisa si un contraste queda bajo AA y **bloquea** si el texto sobre el fondo no llega a 3:1. Solo se guardan los colores distintos de los originales |
| Logo | `logo_url` | PNG, WebP o JPG de hasta 10 MB |
| Enlace y estado | `activo` (solo admins) | El enlace y el slug son de solo lectura: están impresos en los códigos QR |

- **WhatsApp** se guarda en formato internacional argentino para celulares (`549` + 10 dígitos; se sacan el 0 y el 15). No admite
  fijos; un número de otro país hay que escribirlo con `+`. **Instagram** se guarda como usuario (acepta el enlace https del perfil).
- **Logo:** se prepara en el navegador (recorte de bordes transparentes, hasta 640x320 sin agrandar; WebP, con respaldo en **PNG** para
  no perder la transparencia). Ruta: `<local_id>/logo/logo-<único>-<ancho>x<alto>.webp` (el menú usa las medidas del nombre para
  reservar el lugar). Mismo orden seguro que las fotos. En Aroma, "Volver al logo original" repone el de la app.
- **Cambios desde otro equipo:** cada guardado exige que `updated_at` no haya cambiado. Si cambiaron otras columnas, se guarda igual
  sin pisarlas; si cambió lo mismo que se estaba editando, pregunta con cuál quedarse.
- **Cambios sin guardar** (Ajustes y formulario de producto): al cambiar de sección, usar atrás o adelante o tocar "Salir", aparece un
  aviso en la pantalla (sin modal); al recargar o cerrar, el aviso del navegador. El "atrás" depende de `src/lib/atras.js`, que
  tiene que importarse en `main.jsx` antes de montar la app: sobre `window` los listeners corren en el orden en que se registran.

#### Qué protege la base (`supabase/11-admin-ajustes.sql`)

- **Columnas:** el RLS decide qué filas se editan, no qué columnas. Se combinan dos defensas:
  - **permisos por columna:** desde la API no se puede actualizar `id`, `slug` ni `updated_at`, tampoco como admin (esos cambios van por el SQL Editor);
  - **trigger `proteger_local`:** `activo` solo lo cambia un admin (el permiso por columna no alcanza, porque admins y dueños usan el mismo
    rol de Postgres), y toda columna que se agregue en el futuro queda protegida hasta habilitarla en el trigger y en el `grant`.
- **Validaciones:** `tema` solo admite `frase` y los cuatro colores `#RRGGBB` (no entra CSS); estructura y superposiciones de `horarios`;
  largos máximos; Instagram sin otros esquemas que https; `logo_url` solo de la app o de la carpeta `logo/` del propio local. El
  formato exacto de WhatsApp e Instagram lo controla el panel, y el contraste también: la base no lo revisa.
- **Storage:** políticas restrictivas para que en `<local_id>/logo/` solo escriban el dueño y los admins.
- El script comprueba antes los datos existentes (si no cumplen, no aplica nada) y se puede volver a correr. Su fila de control:
  `columnas_editables` = las 10 de ajustes más `activo`, `update_de_tabla = false`, `anon_puede_actualizar = false`, `trigger_proteccion = 1`,
  `limites = 9`, `politicas_logo = 3`, `politicas_locales = 5`, `rechaza_css = true`, `rechaza_superpuestos = true`, `locales_cumplen = true`.

### Mi cuenta y primeros pasos

- **Cambiar contraseña** (`/admin/cuenta`): pide la actual (se comprueba ingresando de nuevo con ella) y la nueva dos veces. Política: 12 a 72
  caracteres con minúscula, mayúscula, número y símbolo (`src/admin/contrasena.js`). La pantalla avisa, pero **lo que obliga es lo que esté
  configurado en Supabase** (ver "Configuración manual"). No usa mails.
- **Primeros pasos** (Inicio): logo, contacto (WhatsApp o Instagram; los datos `TODO` no cuentan), horarios, primera categoría, primer producto
  con foto, publicar y descargar el QR. Cada uno se marca según los datos reales (el del QR, **solo en el navegador** donde se descargó o
  imprimió: no hay tabla para eso) y enlaza a su pantalla; a un editor no se lo manda a Ajustes. Con el menú
  sin publicar va arriba; ya publicado, plegado al final; con todo cumplido, no aparece. (Aroma lo muestra plegado: su contacto es de ejemplo.)

### Código QR (`/admin/:slug/qr`)

Para dueños, editores y admins. El QR lleva a `VITE_PUBLIC_URL + "/" + slug`, sin parámetros. **Si cambiás de dominio, los QR impresos
dejan de funcionar:** confirmá la dirección antes de imprimir. Sin `VITE_PUBLIC_URL` (o si es `localhost`, una IP, no usa `https://` o
trae carpetas o parámetros) la pantalla lo explica y no genera nada. Un local inactivo puede generar su QR, con aviso.

- **Descargas:** PNG (2072 px para `aroma`; nunca menos de 2048) y SVG vectorial para imprenta (`qr-<slug>.png` / `.svg`).
- **Tarjeta de mesa:** nombre, "Escaneá para ver el menú", QR y la dirección para tipear. **A6** (una) o **A4** (cuatro, con guías de
  corte). Se imprime con la ventana del navegador (CSS `@media print`), a escala 100 %.
- Siempre negro sobre blanco, con margen de 4 módulos y corrección de errores M o superior (no usa los colores del local).
- Se genera en el navegador. La librería (`uqr`) y el dibujo van en un archivo aparte que se descarga solo ahí
  (`GeneradorQR.jsx`, que a propósito no importa nada del panel para no agregar código al menú público). `npm run probar` decodifica
  el resultado con otro lector (`jsqr`, solo para pruebas).

### Vista de clientes (`/admin/clientes`)

Solo para admins: nombre, dirección, estado, cantidad de categorías y de productos, cuándo se modificaron **los datos del local** (`updated_at` no
cambia al editar categorías o productos), enlaces al menú y al panel, y activar o desactivar con confirmación. Es una sola consulta con conteos
(no necesita funciones SQL). A quien no es admin no se le muestra ni se consulta nada. **Alcance real de la seguridad:** los locales activos son
de lectura pública por diseño (son el menú), así que cualquiera con la clave pública puede listarlos; lo que la base impide es ver locales
inactivos ajenos y que cambie `activo` quien no es admin.

### Configuración manual en Supabase (una sola vez)

1. **Desactivar el registro público:** *Authentication > Sign In / Providers* (en algunos proyectos: *Authentication > Providers > Email*) y apagar
   **Allow new users to sign up**. Así nadie puede crearse una cuenta solo: los usuarios los creamos nosotros.
2. **Contraseñas:** en la misma sección, **Minimum password length** 12 y, en los caracteres requeridos, la opción que incluye
   **minúsculas, mayúsculas, números y símbolos** (la que no incluye símbolos deja pasar contraseñas que el panel rechaza). Activar también
   *Prevent use of leaked passwords* si el plan lo permite (según la documentación, desde el plan Pro).
3. **Confirmación de email:** los usuarios se crean con el email ya confirmado (el script lo hace solo; a mano, marcando **Auto Confirm User**).
4. **Contraseña actual (recomendado):** activar **Require current password when changing password** y guardar. Así la base también exige la
   contraseña actual (sin esto, solo la pide la pantalla). Dejar **apagado** *Require reauthentication when changing password* (o *Secure password
   change*): manda un código por mail, y el servicio por defecto no sirve para eso (ver abajo).
5. **Comprobar que se aplica:** que el interruptor figure activado no alcanza. Con un usuario descartable, pedir `updateUser` sin
   `current_password` y con una contraseña sin símbolo: los dos tienen que ser rechazados. `npm run verificar:auth` lo prueba solo. El
   26/11/2026 ya se rechazaba el cambio sin la actual, pero **la contraseña sin símbolo se seguía aceptando**
   (sí se rechazaban menos de 12 caracteres, la falta de mayúsculas y repetir la anterior).

#### Los mails de Supabase

Según la [documentación](https://supabase.com/docs/guides/auth/auth-smtp), el servicio de mail **por defecto** solo entrega a direcciones del equipo
del proyecto (a las demás falla con *Email address not authorized*), permite **2 mails por hora**, no garantiza la entrega y no es para
producción. Por eso nada del alta ni del cambio de contraseña depende de un mail. Para usar mails con clientes haría falta un SMTP propio.

### Clientes: alta, contraseña, estado y baja

Estos comandos se corren **en tu computadora** y usan la clave secreta. Antes: correr `supabase/12-admin-clientes.sql` una vez y definir
`VITE_PUBLIC_URL` en el `.env` con la dirección real del sitio (si falta, los enlaces de la ficha apuntan a `localhost`).

**Tu propio acceso de admin:** `/admin/clientes` solo la ven los admins. Para agregarte: sección 4 de `supabase/08-admin-base.sql`, con tu email.

**Cómo conseguir la clave secreta** (una sola vez)

1. En https://supabase.com/dashboard, entrá al proyecto: **Project Settings > API Keys**.
2. En **Secret keys**, copiá la que empieza con `sb_secret_` (si no hay ninguna, creala ahí).
3. En el `.env` del proyecto, agregá la línea `SUPABASE_SECRET_KEY=` y pegá la clave después del igual.
4. No la pegues en chats, mails ni mensajes, no le pongas `VITE_` adelante y no la cargues en el hosting. Si se filtra, borrala en esa pantalla y creá otra.

**En PowerShell el `--` va entre comillas** (`'--'`): sin comillas, PowerShell lo borra y npm se queda con las opciones. Los scripts lo detectan y
frenan. En otras consolas se escribe `--` sin comillas. Sin opciones, preguntan lo que falta. Todos aceptan `--dry-run` (muestra qué harían
y no escribe) y piden confirmación antes de escribir.

**Ejemplo completo de un alta**

```powershell
npm run alta:cliente '--' --nombre "Café del Puerto" --slug cafe-del-puerto --email dueno@ejemplo.com --dry-run
npm run alta:cliente '--' --nombre "Café del Puerto" --slug cafe-del-puerto --email dueno@ejemplo.com
```

1. Valida el slug (3 a 40, minúsculas, números y guiones; sin tildes; no reservado ni usado) y el email, muestra el resumen y pide escribir `si`.
   **El slug no se puede cambiar después:** va impreso en el QR.
2. Crea el local **inactivo**, con colores neutros y sin horarios ni textos (cualquier texto inventado se publicaría como del cliente), el usuario
   con el email confirmado y una contraseña temporal de 16 caracteres, y lo agrega como dueño. Si algo falla en el medio, deshace lo que creó; si
   no puede, dice qué quedó y con qué comando limpiarlo. Repetir el mismo alta no duplica nada, y un alta que quedó a medias se completa.
3. Muestra **una sola vez** la ficha para copiar y mandarle al cliente (enlaces, email, contraseña temporal y qué hacer). No se guarda en
   ningún archivo: no redirijas la salida a un archivo. La ficha no incluye nada sobre la clave secreta.
4. El cliente entra, cambia la contraseña en **Mi cuenta** y sigue los **Primeros pasos**. Cuando termina, publicás el menú desde
   `/admin/clientes` o con `cliente:estado`.

Si la persona ya tiene usuario (por ejemplo, un segundo local): agregá `--usuario-existente`. No se le toca la contraseña.

**Otros comandos**

```powershell
npm run cliente:password '--' --email dueno@ejemplo.com
npm run cliente:estado '--' --slug cafe-del-puerto --activo si
npm run cliente:baja '--' --slug cafe-del-puerto --con-usuarios
npm run cliente:baja '--' --email dueno@ejemplo.com
```

- `cliente:password`: genera otra temporal y reemplaza la anterior; la muestra una vez. Para un admin o un usuario de la demo pide además el email
  completo. Las sesiones abiertas ya no se pueden renovar (una que esté en uso puede seguir funcionando hasta que venza su token, por defecto una hora).
- `cliente:estado`: publica (`--activo si`) u oculta (`--activo no`). Para `aroma` y `local-prueba` pide además escribir el slug.
- `cliente:baja`: **no se puede deshacer.** Muestra todo lo que va a borrar y pide dos confirmaciones (`si` y escribir el slug, o el email si es
  solo un usuario). `--slug` borra el local con sus categorías, productos, membresías y archivos de Storage; `--con-usuarios` borra además a
  quienes queden sin ningún local (nunca a un admin ni a quien tenga otro local). No borra `aroma`, `local-prueba`, sus usuarios ni admins sin
  `--permitir-protegidos`.

> **Antes de venderlo:** el título inicial, la descripción, la vista previa al compartir (Open Graph), el favicon, el manifest y la precarga del
> logo de `index.html` son **fijos y de Aroma**, igual que las pantallas de "local no encontrado" y de error. El enlace de un cliente se
> comparte con la vista previa de Aroma. Resolverlo requiere una tarea aparte.

**Alta a mano** (si no querés usar la clave secreta): crear el usuario en *Authentication > Users* con **Auto Confirm User** y asignarlo desde el
SQL Editor (plantillas en la sección 5 de `supabase/08-admin-base.sql`). Un **admin de OESTACK** solo se agrega desde el SQL Editor (sección 4)
o, para pruebas, con `pruebas:usuarios`.

### Cuenta demo

Para que cualquiera pruebe el panel: **`demo@oestack.com`** (sin buzón; no se le manda ningún mail), **dueña solo de `aroma`** y nunca admin. Se
usa el local real de la demo (datos ficticios): lo que alguien cambie **se ve en `/aroma`** hasta el próximo reinicio.

**Preparación (en tu computadora, con la clave secreta)**

0. Una sola vez: correr `supabase/12b-tope-demo.sql`. Pone un **tope de 60 archivos** en la carpeta de Aroma en Storage (una foto son 2),
   con un trigger que vale para cualquier forma de subir; las demás carpetas no cambian. Para sacarlo: `drop function public.tope_carpeta_demo() cascade;`.
1. En el `.env`: `DEMO_PASSWORD` (entre comillas; 12 o más caracteres con minúscula, mayúscula, número y símbolo). Va a ser pública:
   que no la uses en ningún otro lado.
2. Con Aroma como la querés mostrar: `npm run demo:guardar`. Muestra un resumen, pide confirmación y escribe `scripts/demo/aroma.json`
   (fila del local, categorías y productos con todos sus campos, y nombres de los archivos de Storage). Revisalo y commitealo. No guarda
   si hay datos de prueba (`ZZ...`).
3. `npm run demo:reiniciar`. La primera vez crea la cuenta (no hay un comando aparte para crearla).

**Reiniciar** (`npm run demo:reiniciar`, con `--dry-run` para ver qué haría). **Lo recomendable es correrlo antes de cada reunión.**

- Cierra las sesiones de la demo: **borra la cuenta y la crea de nuevo** con `DEMO_PASSWORD`. Así, hasta quien tenía una sesión abierta
  pierde el permiso en el acto, y se va todo lo que le hayan cambiado desde la API (contraseña, email, segundo factor, datos).
- Restaura los ajustes de Aroma, repone y corrige categorías y productos (con los mismos ids y el mismo orden), borra los agregados y
  borra de Storage lo que no esté en la copia. Primero repone y después borra: el menú no queda vacío.
- Una pestaña que quedó abierta ya no puede guardar nada; al recargarla dice "No tenés acceso a este local" hasta tocar "Salir" y volver a entrar.
- Solo trabaja con `aroma`. Se niega si la cuenta demo fuera admin o tuviera otro local. Se puede repetir; si se corta, volver a correrlo.
- Si cambiás Aroma a propósito (precios, productos), **guardá de nuevo** o el próximo reinicio lo deshace.
- Si la demo usara fotos subidas a Storage y alguien las borrara, no se pueden recuperar (la copia guarda nombres, no imágenes). Hoy usa las
  de la app (`/locales/aroma/...`), que no se pueden borrar desde el panel.

**En el panel:** con la cuenta demo aparece el aviso "Estás en una cuenta de demostración...", "Mi cuenta" no ofrece cambiar la contraseña y
"Salir" cierra solo la sesión de ese navegador (por defecto Supabase cerraría las de todas las personas que la estén usando).

**Tarjeta del ingreso:** si el despliegue tiene `VITE_DEMO_EMAIL` y `VITE_DEMO_PASSWORD`, `/admin/login` muestra el email, la contraseña y el
botón "Entrar a la demo". **Se cargan solo en el despliegue de la demo** (en Vercel: *Settings > Environment Variables*, y volver a desplegar).
`VITE_DEMO_PASSWORD` tiene que ser igual a `DEMO_PASSWORD`; si cambiás una, cambiá la otra y corré `demo:reiniciar`. En el hosting **nunca** van
`SUPABASE_SECRET_KEY`, `DEMO_PASSWORD` ni las `TEST_*`. El aviso y lo demás dependen de `VITE_DEMO_EMAIL`: en un despliegue sin ella que use la
misma base, la cuenta demo entraría igual (con los mismos permisos) pero sin esos avisos.

**Programar el reinicio (más adelante):** no está automatizado a propósito, porque requiere la clave secreta fuera de tu computadora. Si se
quiere, la opción más simple es el *Programador de tareas* de Windows en tu propia computadora (acción: `npm.cmd`, argumentos `run
demo:reiniciar`, carpeta del proyecto); como el comando pide confirmación, habría que agregarle antes una forma explícita de confirmar sin
teclado. Correrlo en un servidor (GitHub Actions, cron del hosting) implicaría guardar ahí la clave secreta: decidirlo con cuidado.

**Riesgos de una cuenta pública** (la interfaz no los evita: la API de Supabase es accesible con la contraseña)

| Riesgo | Alcance | Cómo se mitiga |
| --- | --- | --- |
| Cambiar la contraseña (o el email, o agregar un segundo factor) | Nadie más puede entrar a la demo | `demo:reiniciar` |
| Romper o escribir cualquier cosa en Aroma, incluso imágenes de otros sitios | Se ve en `/aroma`, que se muestra a clientes | `demo:reiniciar` antes de cada reunión |
| Subir muchos archivos a la carpeta de Aroma (2 MB cada uno) | Como mucho 60 archivos (unos 120 MB). Alguien podría llenarlo y dejar la demo sin poder subir fotos | `supabase/12b-tope-demo.sql` pone el tope; reiniciar lo libera |
| Pedir un enlace de subida firmado antes de un reinicio y usarlo después (**comprobado**: funciona; esos enlaces no dependen de la cuenta y duran unas 2 horas) | Puede dejar archivos en la carpeta de Aroma aun sin cuenta. No cambia el menú ni ningún dato, y vale el tope de 60 | El siguiente reinicio los borra. Si la demo quedó llena justo antes de una reunión, reiniciar de nuevo |
| Crear muchísimas categorías o productos, o descripciones enormes (sin tope en la base) | Puede llenar la base y romper `/aroma` | Reiniciar los borra. Para impedirlo hace falta una regla en la base |

Si la demo se publica en serio, conviene mirar de vez en cuando el uso en *Project Settings > Usage* y, para apagarla ya mismo, borrar la
cuenta: `npm run cliente:baja '--' --email demo@oestack.com --permitir-protegidos`.

### Usuarios de prueba y verificación de permisos

1. Crear **dos** usuarios de prueba en *Authentication > Users* (con **Auto Confirm User**), por ejemplo `prueba1@...` y `prueba2@...`.
2. Abrir `supabase/08-admin-base.sql`, reemplazar los dos `PEGAR-AQUI-EL-UUID-...` por el *User UID* de cada uno y correrlo en el SQL Editor.
   Deja al usuario 1 como `owner` de `aroma`, crea el local **`local-prueba`** (inactivo, con una categoría y un producto) y deja al usuario 2 como `owner`
   solo de ese local. Se puede correr más de una vez.
3. Completar en `.env` (no se versiona) `TEST_USER1_EMAIL`, `TEST_USER1_PASSWORD`, `TEST_USER2_EMAIL` y `TEST_USER2_PASSWORD`.
4. **Editor y admin de prueba:** `npm run pruebas:usuarios '--' crear` crea `zz-prueba-editor@example.com` (editor de `local-prueba`) y
   `zz-prueba-admin@example.com` (admin), con contraseñas aleatorias que escribe **solo** en tu `.env` (nunca en pantalla). Usa la clave secreta
   y no manda mails. **El admin de prueba puede ver y cambiar todos los locales:** al terminar, borralos con
   `npm run pruebas:usuarios '--' borrar` (también limpia el `.env`).
5. `npm run verificar:permisos` comprueba contra Supabase real, con la clave anon (nunca con la secreta): que el usuario 1 lee y escribe en su
   local; que no puede modificar ni crear nada en `local-prueba`; que el usuario 2 no puede tocar `aroma`; que un anónimo no puede escribir en
   ninguna tabla; que las imágenes solo se suben a la carpeta del propio local; las categorías (crear, editar, borrar, adicionales inválidos,
   borrado con productos y reordenar con la función 09, incluidos los intentos que deben fallar); los productos (crear, editar, borrar, límites de
   la base, categoría de otro local y reordenar con la función 10); las fotos en Storage (tipos y tamaño no permitidos, caché y que nadie
   escriba, borre ni liste carpetas ajenas); los ajustes (el dueño edita su local; no puede cambiar `slug`, `id`, `activo` ni `updated_at`; la
   base rechaza temas, enlaces y horarios inválidos); que nadie lee el local inactivo desde el menú público; y, si están los usuarios del paso 4:
   el **editor** edita categorías y productos pero no los ajustes ni la carpeta del logo; con `DEMO_PASSWORD`, que la **cuenta demo** edita
   aroma y nada fuera de él (no es admin ni cambia `slug` o `activo`); el **admin** cambia `activo` y el dueño no; nadie cambia
   el `slug`; y la base rechaza los slugs reservados. Sin esos usuarios, esas partes se informan como `SALTEADO`.
6. Cada comprobación imprime `OK` o `FALLÓ`. No deja basura (usa filas temporales inactivas y archivos con el mismo prefijo) y al final verifica
   que todo quedó como estaba. **Requiere haber corrido hasta el `12`.** Las pruebas de ajustes escriben sobre las filas **reales** de `aroma` y
   `local-prueba` (mientras corre, `/aroma` muestra datos de prueba); antes las copia (también a un archivo en la carpeta temporal del sistema)
   y al final las restaura, salvo `updated_at`. Si se corta, la corrida siguiente restaura primero. No conviene correrlo mientras se muestra la
   demo. El admin prueba `activo` solo sobre un local temporal que crea y borra.
7. `npm run probar` corre las pruebas de lógica pura, sin red.

### Otras comprobaciones

- `npm run verificar:secretos` (mejor después de `npm run build`, y siempre antes de commitear): falla si encuentra una clave `sb_secret_...`, un
  JWT con rol `service_role`, una variable secreta con valor, un `VITE_` con nombre de secreto o con contraseña, o los valores secretos de tu `.env`, en lo
  versionado (y lo nuevo sin ignorar) o en `dist/`. La única excepción: la contraseña de la demo (`VITE_DEMO_PASSWORD`) puede estar en `dist/`
  (no en el repo); falla si repite cualquier otra clave o contraseña. No muestra lo que encontró. Con `npm run verificar:secretos '--' --historial` revisa además todo el historial de git (todas las ramas,
  el último stash y los mensajes de commit).
- `npm run verificar:auth`: registro cerrado, reglas de contraseña, cambio con la actual y cierre de sesión. Usa la clave secreta solo
  para crear y borrar un usuario descartable. Correrlo después de tocar *Authentication* en Supabase.
- La revisión de seguridad completa y las cabeceras propuestas para Vercel están en [`docs/seguridad.md`](docs/seguridad.md).
- `npm run probar:atras`: compila y, en el Chrome instalado (sin dependencias; Node 22 o más nuevo), comprueba que con cambios sin guardar
  "atrás", "adelante", las pestañas y recargar pregunten antes. Usa el usuario de prueba 1 y no guarda nada. Correrlo al tocar `main.jsx`, las
  rutas, `lib/atras.js`, `GuardaDeSalida.jsx` o al actualizar React Router. Si Chrome está en otra ruta, definir `CHROME_PATH`.

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
para el `srcset` (también con `.jpg`). Una imagen que no siga ese nombre se usa tal cual. Si en una corrida cambian los anchos, el script borra
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
