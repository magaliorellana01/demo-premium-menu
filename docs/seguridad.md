# Seguridad: revisión previa al despliegue

Revisión del 26/11/2026, antes de publicar la demo en Vercel. Está escrita para alguien que no es
especialista. Las pruebas se hicieron contra el proyecto real de Supabase y en Chrome, con datos de
prueba que se borraron al terminar. El local `aroma` quedó igual que antes.

## Resumen

**No encontramos** ninguna forma de que alguien sin cuenta modifique datos, lea correos o permisos,
vea locales inactivos o ejecute código en el menú o en el panel.

**Antes de publicar la demo hay que hacer dos cosas en Supabase** (pasos en [Pendiente](#pendiente)):

1. Exigir **símbolos** en las contraseñas (H1).
2. Correr `supabase/13-limites-publicos.sql` (H2 y H3).

## Hallazgos

La gravedad es la que tiene **en este proyecto**, no en general.

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| H1 | Supabase acepta contraseñas **sin símbolos** | Media | Pendiente: ajuste en Supabase |
| H2 | La foto de un producto puede ser **cualquier dirección**, también de otro sitio (el logo tampoco ata el dominio) | Media | Pendiente: SQL preparado |
| H3 | La descripción y las etiquetas de un producto **no tienen límite** en la base | Baja | Pendiente: mismo SQL |
| H4 | El texto del **aviso apagado** se puede leer desde la API | Baja | Aceptado: no escribir ahí nada reservado |
| H5 | El bucket confía en el **tipo declarado** del archivo, no en su contenido | Baja | Aceptado (ver "Archivos") |
| H6 | Después de "Salir", el **token de acceso** sigue valiendo para los datos hasta 60 minutos | Baja | Aceptado (así funciona Supabase) |
| H7 | No hay **bloqueo por cuenta** ante contraseñas equivocadas, solo límites por IP | Baja | Aceptado, con contraseñas largas |
| H8 | Las cuentas de prueba 1 y 2 usan correos de **un proveedor público** que quizá no son tuyos | Media si algún día se activan mails | Recomendado: cambiarlas o borrarlas |
| H9 | Las cabeceras de seguridad del sitio todavía no están puestas | Media al publicar | Propuesta lista abajo (Tarea 14) |

### H1. Contraseñas sin símbolos

- **Evidencia** (`npm run verificar:auth`): con un usuario descartable y la contraseña actual correcta, Supabase **aceptó** una
  contraseña nueva de letras y números, sin ningún símbolo. Sí rechazó: sin mayúscula, sin minúscula, sin número, de 11
  caracteres, repetir la actual y cambiarla sin la actual, con la actual vacía o equivocada.
- **Riesgo:** el panel sí exige el símbolo, pero quien use la API directamente puede saltearlo en **su propia** cuenta. No permite
  entrar a cuentas ajenas.
- **Qué hacer:** ver [Pendiente](#pendiente), paso 1. Después, `npm run verificar:auth` tiene que dar todo `OK`.

### H2. Direcciones de imágenes sin controlar

- **Evidencia:** la base aceptó como foto de un producto `javascript:...`, un texto suelto y una imagen de otro sitio; el menú
  público **pidió** esa imagen externa. Como logo aceptó una dirección de otro dominio que imitaba la forma de la nuestra.
  Chrome **no ejecutó** el `javascript:` (una imagen nunca ejecuta código).
- **Riesgo:** quien puede editar un menú (**también la cuenta demo, que es pública**), salteando el panel, puede mostrar en ese
  menú una imagen alojada afuera: el dueño de ese sitio ve la dirección IP de cada visitante y puede cambiar la imagen cuando
  quiera. No permite robar sesiones ni ejecutar código.
- **Qué hacer:** correr el SQL (paso 2). La cabecera `Content-Security-Policy` propuesta es una segunda barrera.

### H3. Textos sin límite

- **Evidencia:** se guardó un producto con una descripción de 200.000 caracteres y 300 etiquetas.
- **Riesgo:** inflar un menú hasta que cargue lento o se vea roto (en la demo, hasta el próximo reinicio).
- **Qué hacer:** el mismo SQL. Sigue sin haber tope de **cantidad** de productos y categorías (ver "Cuenta demo").

### H4. Aviso apagado

- **Evidencia:** la lectura anónima de `locales` devuelve `aviso_texto` aunque `aviso_activo` sea `false`.
- **Riesgo:** un borrador de aviso es visible para quien consulte la API.

### H8. Correos de las cuentas de prueba

- **Qué se vio:** los dos usuarios de prueba creados a mano usan direcciones genéricas de un proveedor público. Uno es **dueño de `aroma`**.
- **Riesgo:** hoy es bajo, porque el servicio de mail por defecto de Supabase solo entrega a direcciones del equipo del proyecto.
  Si algún día se configura un servidor de mail propio, quien sea dueño de esas casillas podría pedir una contraseña nueva.
- **Qué hacer:** cambiarles el correo por uno tuyo o terminado en `@example.com` (y actualizar el `.env`), o sacarles el acceso a `aroma`.

## Qué es público a propósito

El menú es público: cualquiera, sin cuenta, puede leer **de los locales activos**:

| Tabla | Qué se lee |
|---|---|
| `locales` | nombre, dirección web (slug), descripción, logo, colores y frase, WhatsApp, Instagram, dirección, horarios, aviso (texto y si está activo), si está activo, fecha del último cambio e id |
| `categorias` | las **visibles**: nombre, orden, adicionales e ids |
| `productos` | los de categorías visibles, **también los no disponibles**: nombre, descripción, precio, foto, etiquetas, opciones, orden, destacado e ids |

Además, **cualquier foto del bucket se puede ver si se conoce su dirección exacta**, incluida la de un local inactivo (el bucket es
público). La dirección tiene un identificador del local y un nombre al azar, y **no se puede listar**. No subir ahí nada privado.

## Qué se comprobó

### Datos y permisos (`npm run verificar:rls` y `npm run verificar:permisos`)

- Sin cuenta, `usuarios_locales` y `admins` responden "permiso denegado". Ninguna columna pública tiene correos ni ids de usuarios.
- No se ven locales inactivos ni categorías ocultas, tampoco filtrando, pidiéndolos como relación o contando filas.
- Sin cuenta no se puede ejecutar ninguna función de la base, ni leer los esquemas internos, la lista de usuarios o la
  descripción de la API.
- Storage: sin cuenta no se listan buckets ni carpetas, **aun habiendo archivos**; un dueño de otro local tampoco lista carpetas ajenas.
- Dueños, editores y la cuenta demo escriben solo en su local. Solo un admin de OESTACK llega a todos (se probó con un admin de
  pruebas, que después se borró; al terminar la revisión **no había ningún admin** cargado).

### Textos maliciosos (XSS)

- **Código:** en `src/` no hay `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write` ni similares. Los
  enlaces de WhatsApp, Instagram y mapas se arman validando el dato; los colores solo admiten `#RRGGBB`.
- **En Chrome:** se cargaron textos con `<script>`, `<img onerror>` y `<svg onload>` **directamente por la API** en un local
  temporal: nombre, descripción, aviso, frase, dirección, categorías, productos, opciones, adicionales y etiquetas. En el menú
  público y en 8 pantallas del panel (también la tarjeta del QR) se ven **como texto** y nada se ejecuta. Lo mismo con parámetros
  maliciosos en la dirección.
- **Rechazados por la base:** enlaces `javascript:` o de otros sitios en Instagram, `javascript:` y HTML en WhatsApp, logos
  `javascript:` o `data:`, colores con CSS escondido, horarios y zona horaria con HTML, y un slug con HTML.
- **Rechazados por el panel:** esos datos en los formularios de Instagram y WhatsApp, y archivos SVG, HTML o un HTML
  disfrazado de PNG como logo o como foto.

### Archivos

- El bucket **rechaza** SVG (también con el tipo en mayúsculas), HTML, XHTML, XML, JavaScript, PDF, GIF, texto, tipo genérico y
  archivos de más de 2 MB.
- **Limitación conocida:** mira el tipo que **declara** quien sube. Un HTML declarado como imagen **se acepta**.
- **Riesgo real:** se probaron 6 casos abriéndolos en Chrome y **ninguno se ejecutó**: Supabase los entrega como la imagen declarada
  (una imagen rota) o, si el nombre termina en `.html`, `.htm` o `.xhtml`, como texto plano con `nosniff`. A algunas imágenes no
  les agrega `nosniff`. Además se entregan desde el dominio de Supabase, **no desde el del sitio**, así que no podrían leer la
  sesión del panel. Lo que queda: alguien **con cuenta** puede guardar ahí archivos que no son imágenes (en la demo, hasta 60).

### Registro, ingreso y sesión (`npm run verificar:auth`)

- El registro está cerrado: la API rechaza registrarse, entrar como "usuario anónimo" y crear cuentas con enlace por mail. El único
  método activo es correo y contraseña.
- Cambiar la contraseña exige la actual.
- **"Salir"** borra la sesión del navegador (se comprobó en Chrome: sin tokens ni cookies después) y anula el token que la renueva.
  Queda una marca sin datos personales que recuerda que ya descargaste el QR de un local.
- **H6:** el token de acceso que ya existía sigue sirviendo para leer y escribir datos hasta que vence (60 minutos). Solo importa
  si alguien lo copió antes. Para la cuenta demo, `npm run demo:reiniciar` borra la cuenta y corta ese acceso en el momento.
- **Límites de intentos** según la [documentación de Supabase](https://supabase.com/docs/guides/auth/rate-limits) (son los valores por
  defecto; los de tu proyecto se ven en *Authentication > Rate Limits*): ingreso y renovación de sesión, **150 pedidos cada 5
  minutos por IP, con ráfagas de hasta 30**; registro, enlaces por mail y verificación, 30 cada 5 minutos por IP; mails con el
  servicio por defecto, 2 por hora. La documentación **no menciona bloqueo por cuenta** (H7): tras 10 errores seguidos, la contraseña
  correcta siguió entrando. No se forzó el límite hasta el bloqueo. Quien reparta intentos entre muchas IP no queda frenado por
  esto: la defensa son las contraseñas largas. Opcional: activar **CAPTCHA** (requiere cambiar la pantalla de ingreso).

### Dependencias

`npm audit` (26/11/2026): **0 vulnerabilidades** en 115 paquetes, con y sin los de desarrollo. Las firmas del registro de npm
verifican. Se sumaron `uqr` 0.1.3 (genera el QR, MIT, sin dependencias) y `jsqr` 1.4.0 (solo para las pruebas: no se publica).
Esto es una foto del día: conviene repetir `npm audit` antes de cada despliegue.

### Secretos en git

`npm run verificar:secretos '--' --historial` revisa los archivos de ahora, `dist/` y **cada versión de cada archivo y cada mensaje
de commit** de todas las ramas y el último stash. Resultado: 25 commits y 407 versiones, **sin hallazgos**; un aviso por una clave
`publishable` inventada en una prueba (no es la del proyecto). Aparte, se buscaron los ids y correos de los usuarios reales: ninguno
aparece. El control se probó con un secreto falso borrado en otra rama: lo encuentra. No revisa commits descartados que no cuelgan
de ninguna rama (no se publican con `git push`).

`VITE_DEMO_PASSWORD` es **pública a propósito**: va en el sitio de la demo. La clave `anon`/`publishable` también es pública por
diseño; lo que protege los datos son las reglas de la base.

### Consola y registros

Ni el panel ni el menú escriben contraseñas, tokens ni claves en la consola, tampoco con errores forzados (contraseña equivocada,
sin conexión). Los scripts tampoco al fallar (clave equivocada, contraseña inválida, sin red). La **única** excepción es a propósito:
`alta:cliente` y `cliente:password` muestran **una vez** la contraseña temporal para dársela al cliente. No guardes ni compartas esa
pantalla.

## Riesgos aceptados

### La cuenta demo es pública

Cualquiera puede entrar como dueño de `aroma`. Está limitada a ese local y no es admin, pero **puede**, hasta el próximo reinicio:

- Cambiar textos, precios, fotos, logo y colores del menú, también con contenido ofensivo, o borrarlo entero.
- Poner **su propio** WhatsApp, Instagram o dirección: un visitante podría escribirle creyendo que es el local.
- Crear muchas categorías y productos (no hay tope de cantidad) y subir hasta 60 archivos de 2 MB.
- Con la API, intentar cambiar la contraseña o el correo de la cuenta, agregarle un segundo factor o cerrar las sesiones de las
  demás personas. (No se probó contra la cuenta demo para no dejarla inutilizable.)

**Qué hacer:** correr `npm run demo:reiniciar` seguido (borra y vuelve a crear la cuenta) y **antes de mostrar la demo**. Mirar
`/aroma` de vez en cuando. No usar `aroma` para un cliente real. La contraseña de la demo no se tiene que usar en ningún otro lado.
En el sitio de clientes reales, **no** cargar `VITE_DEMO_EMAIL` ni `VITE_DEMO_PASSWORD`.

### Otros

- La sesión se guarda en el navegador (`localStorage`). Si algún día hubiera una falla de XSS, podría leerse: por eso importan la
  política de contenido y no sumar dependencias sin revisarlas.
- Quien tenga la **clave secreta** o tu cuenta de Supabase puede todo. Activá la verificación en dos pasos en Supabase, GitHub y Vercel.
- Los usuarios de prueba `zz-prueba-*` (uno es **admin**) solo deben existir mientras se prueba: `npm run pruebas:usuarios '--' borrar`.

## Pendiente

### 1. Exigir símbolos en las contraseñas (Supabase)

1. Entrá a <https://supabase.com/dashboard> y abrí tu proyecto.
2. En el menú de la izquierda: **Authentication** > **Sign In / Providers** > **Email** (hacé clic en la fila para abrirla).
3. En **Password requirements** elegí la opción que **incluye símbolos**: *Lowercase, uppercase letters, digits and symbols*.
4. Revisá que **Minimum password length** diga **12** y que **Require current password when updating** siga activado.
5. Bajá y tocá **Save**. Sin ese botón el cambio no se aplica.
6. En tu computadora: `npm run verificar:auth`. Tiene que terminar con todo `OK`.

Si ya estaba elegida esa opción: cambiala por otra, guardá, volvé a elegirla, guardá y repetí la prueba. Si sigue fallando,
consultá al soporte de Supabase con el resultado.

### 2. Límites a lo que se publica (SQL)

1. Abrí en tu editor el archivo `supabase/13-limites-publicos.sql`, seleccioná **todo** y copialo.
2. En Supabase: **SQL Editor** (menú de la izquierda) > **New query**. Pegá y tocá **Run**.
3. Si aparece un error que dice *Hay datos que no cumplen*, no se cambió nada: anotá la lista y revisala.
4. Si salió bien, la tabla de abajo muestra `limites_nuevos = 4`, `rechaza_otro_sitio = true`, `aroma_categorias = 3` y
   `aroma_productos = 18` (los dos últimos, con la demo recién reiniciada).
5. En tu computadora: `npm run verificar:permisos`. La sección *Límites de lo que se publica* ya no tiene que figurar como `SALTEADO`.

### 3. Recomendado

- Cambiar los correos de las cuentas de prueba (H8).
- Revisar *Authentication > Rate Limits* y, si tu plan lo permite, activar *Prevent use of leaked passwords*.
- Confirmar que `VITE_PUBLIC_URL` es el **dominio definitivo antes de imprimir los QR**.

### 4. Cabeceras y rutas en Vercel (Tarea 14)

**Todavía no están puestas.** Crear `vercel.json` en la raíz con esto, cambiando `https://TU-PROYECTO.supabase.co` (aparece 2
veces) por el valor de `VITE_SUPABASE_URL`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [{ "source": "/", "destination": "/aroma", "permanent": false }],
  "rewrites": [{ "source": "/:ruta((?!.*\\.[A-Za-z0-9]+$).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; style-src-attr 'none'; img-src 'self' blob: https://TU-PROYECTO.supabase.co; font-src 'self'; connect-src 'self' https://TU-PROYECTO.supabase.co; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

Qué significa:

- **Rutas:** las direcciones sin extensión (`/aroma`, `/admin/...`) abren la aplicación; un archivo inexistente (`/algo.js`) tiene
  que dar **404**; `/` lleva a `/aroma` de forma temporal (se puede cambiar más adelante).
- **`Content-Security-Policy`:** el navegador solo carga código del propio sitio, y datos e imágenes del sitio y de tu Supabase.
  `blob:` es para la vista previa de fotos antes de subirlas.
- **Estilos en línea:** `style-src` necesita `'unsafe-inline'` porque el panel y la pantalla del QR insertan sus estilos dentro de la
  página (así no suman archivos al menú público). Los **scripts** en línea siguen prohibidos, y `style-src-attr 'none'` bloquea los
  estilos escritos como atributo. Sacar `'unsafe-inline'` requiere cambiar cómo se cargan esos estilos.
- `X-Frame-Options` y `frame-ancestors` impiden meter el sitio dentro de otra página. Vercel ya agrega `Strict-Transport-Security`.

**Qué se probó y qué no.** Se probó en tu computadora con un servidor que imita esas reglas: menú, ingreso, panel, QR
(descargas e impresión) y la preparación de un logo y una foto, sin bloqueos. **No se probó en Vercel.** Al activarlo, en una
vista previa (*preview*) y con la consola del navegador abierta (F12):

1. `/` lleva a `/aroma`; `/aroma` y `/admin` abren al entrar directo y al recargar.
2. `/assets/no-existe.js` y `/no-existe.png` dan **404** (y no la página de inicio).
3. En **Network**, la respuesta trae las cinco cabeceras.
4. El menú muestra datos, fotos, logo y fuentes. En el panel: ingresar, subir una foto y un logo **de verdad** (la subida no se
   probó con la política activada), guardar, descargar el QR e imprimir.
5. Ningún mensaje de *Content Security Policy* en la consola. Las vistas previas de Vercel pueden agregar su **barra de
   herramientas**, que esta política bloquearía: desactivala en el proyecto antes que abrir la política.
6. Si el proyecto de Supabase pasa a usar un dominio propio, actualizar la política y el SQL 13.

`public/_redirects` es de otro hosting y Vercel no lo usa: se puede borrar en la Tarea 14.

## Cómo repetir las comprobaciones

| Comando | Qué revisa |
|---|---|
| `npm run probar` | Lógica sin conexión (incluye el QR y el escáner de secretos) |
| `npm run verificar:rls` | Lo que puede ver y hacer alguien sin cuenta |
| `npm run verificar:permisos` | Qué puede cada tipo de cuenta, y Storage |
| `npm run verificar:auth` | Registro, contraseñas y cierre de sesión (usa la clave secreta; crea y borra un usuario) |
| `npm run build` y `npm run verificar:secretos '--' --historial` | Claves en el código, en lo publicado y en el historial |
| `npm audit` | Fallas conocidas en dependencias |

Las pruebas en Chrome de esta revisión (textos maliciosos, impresión y cabeceras) fueron de una sola vez y no quedaron en el repositorio.
