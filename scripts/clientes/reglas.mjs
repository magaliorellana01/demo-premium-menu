// Reglas puras del alta de clientes: slug, email, contraseña temporal, datos por defecto del
// local y la ficha que se le manda al cliente. Sin red (scripts/probar-clientes.mjs).
import { problemaDeContrasena } from '../../src/admin/contrasena.js'

/** Rutas del panel o carpetas del sitio: un local no puede llamarse así. */
export const SLUGS_RESERVADOS = ['admin', 'login', 'clientes', 'cuenta', 'api', 'assets', 'fonts', 'locales']
/** Locales de la demo y de las pruebas: borrarlos o cambiarles el estado pide un paso extra. */
export const LOCALES_PROTEGIDOS = ['aroma', 'local-prueba']

// La base acepta de 2 a 60; en el alta se pide algo cómodo para una dirección impresa.
export const SLUG_MIN = 3
export const SLUG_MAX = 40
export const NOMBRE_MAX = 60 // igual que la base

/** Devuelve el problema del slug, o '' si sirve. No lo "arregla": lo que se escribe es lo que se imprime. */
export function problemaDeSlug(slug) {
  const s = String(slug ?? '')
  if (!s) return 'Falta el slug.'
  if (s.length < SLUG_MIN || s.length > SLUG_MAX) return `El slug tiene que tener de ${SLUG_MIN} a ${SLUG_MAX} caracteres.`
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) return 'El slug solo admite minúsculas sin tildes ni eñes, números y guiones en el medio (por ejemplo cafe-del-puerto).'
  if (SLUGS_RESERVADOS.includes(s)) return `"${s}" está reservado.`
  return ''
}

export const normalizarEmail = (email) => String(email ?? '').trim().toLowerCase()

/** Devuelve el problema del email (ya normalizado), o ''. */
export function problemaDeEmail(email) {
  const e = String(email ?? '')
  if (!e) return 'Falta el email.'
  if (e.length > 254) return 'El email es demasiado largo.'
  const [usuario, dominio, ...resto] = e.split('@')
  const usuarioOk = Boolean(usuario) && usuario.length <= 64 && /^[a-z0-9._%+-]+$/.test(usuario) && !/^\.|\.$|\.\./.test(usuario)
  const dominioOk = Boolean(dominio) && /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(dominio)
  return resto.length || !usuarioOk || !dominioOk ? 'Revisá el email: no parece válido.' : ''
}

export function problemaDeNombre(nombre) {
  const n = String(nombre ?? '').trim()
  if (!n) return 'Falta el nombre del local.'
  if (n.length > NOMBRE_MAX) return `El nombre admite hasta ${NOMBRE_MAX} caracteres.`
  // Un salto de línea rompería la ficha y el título de la pestaña.
  if (/\p{Cc}/u.test(n)) return 'El nombre tiene caracteres que no se pueden usar.'
  return ''
}

// Sin caracteres que se confunden (0 O 1 l I) y solo con símbolos que sobreviven a un mensaje:
// * _ ~ ` dan formato en WhatsApp; comillas, barras y espacios se rompen al copiar o en .env.
const GRUPOS = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!#$%+=?@^&-']
const TODOS = GRUPOS.join('')
export const LARGO_TEMPORAL = 16

/** Entero uniforme en [0, tope) con el generador criptográfico (sin sesgo de módulo). */
function alAzar(tope) {
  const limite = Math.floor(0x100000000 / tope) * tope
  const caja = new Uint32Array(1)
  do globalThis.crypto.getRandomValues(caja)
  while (caja[0] >= limite)
  return caja[0] % tope
}

export function generarContrasena(largo = LARGO_TEMPORAL) {
  if (!Number.isInteger(largo) || largo < 12 || largo > 64) throw new Error('El largo tiene que ser de 12 a 64.')
  // Una de cada grupo y el resto de cualquiera; después se mezclan (Fisher-Yates).
  const letras = GRUPOS.map((g) => g[alAzar(g.length)])
  while (letras.length < largo) letras.push(TODOS[alAzar(TODOS.length)])
  for (let i = letras.length - 1; i > 0; i--) {
    const j = alAzar(i + 1)
    ;[letras[i], letras[j]] = [letras[j], letras[i]]
  }
  const contrasena = letras.join('')
  const problema = problemaDeContrasena(contrasena)
  if (problema) throw new Error(`La contraseña generada no cumple la política. ${problema}`)
  return contrasena
}

// Colores neutros (grises y azul pizarra), para que un local nuevo no salga con la marca de Aroma.
export const TEMA_NEUTRO = { fondo: '#f6f6f4', texto: '#1f2328', acento: '#46607a', portada: '#1f2933' }

/**
 * La fila de un local nuevo. Nace INACTIVO. Los textos y horarios van vacíos a propósito:
 * cualquier texto inventado se publicaría como si lo hubiera escrito el cliente, y la lista de
 * primeros pasos del panel pide completarlos.
 */
export function localNuevo({ nombre, slug }) {
  return {
    slug,
    nombre: nombre.trim(),
    activo: false,
    tema: { ...TEMA_NEUTRO },
    horarios: {},
    descripcion: null,
    direccion: null,
    whatsapp: null,
    instagram: null,
    logo_url: null,
    aviso_texto: null,
    aviso_activo: false,
  }
}

export function direcciones(urlPublica, slug) {
  const base = String(urlPublica || 'http://localhost:5173').replace(/\/+$/, '')
  return { menu: `${base}/${slug}`, panel: `${base}/admin` }
}

/**
 * El mensaje para el cliente. `contrasena` null = usuario que ya existía (usa la suya).
 * Solo se muestra en pantalla: no se guarda en ningún lado.
 */
export function fichaDeAlta({ nombre, slug, email, contrasena, urlPublica }) {
  const { menu, panel } = direcciones(urlPublica, slug)
  return [
    `¡Hola! Ya está creada la cuenta de ${nombre} en el menú digital.`,
    '',
    `Tu menú: ${menu}`,
    '(Se va a poder ver cuando lo publiquemos.)',
    '',
    `Panel para editarlo: ${panel}`,
    `Email: ${email}`,
    contrasena ? `Contraseña temporal: ${contrasena}` : 'Contraseña: la que ya usás en el panel.',
    '',
    'Qué hacer:',
    `1. Entrá al panel con tu email${contrasena ? ' y la contraseña temporal' : ''}.`,
    ...(contrasena
      ? ['2. Tocá "Mi cuenta" (arriba) y cambiá la contraseña por una tuya.', '3. En "Inicio" vas a ver los primeros pasos: logo, contacto, horarios y tus productos.', '4. Cuando esté todo listo, avisanos y publicamos tu menú.']
      : ['2. Elegí el local y seguí los primeros pasos de "Inicio".', '3. Cuando esté todo listo, avisanos y publicamos tu menú.']),
    '',
    'No compartas tu contraseña.',
  ].join('\n')
}
