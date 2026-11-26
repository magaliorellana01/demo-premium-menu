// Política de contraseñas y mensajes de "Cambiar contraseña". Sin red ni React: lo usan la
// pantalla Mi cuenta y los scripts de alta (scripts/clientes/). Se prueba con
// scripts/probar-cuenta.mjs.
//
// Es la misma política que conviene exigir en Supabase (Authentication > Providers > Email):
// lo que vale de verdad es lo que acepta Supabase; esto avisa antes y en español.

export const LARGO_MINIMO = 12
// bcrypt (lo que usa Supabase) solo mira los primeros 72 bytes.
export const BYTES_MAXIMOS = 72
// Los símbolos que Supabase cuenta como tales.
export const SIMBOLOS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~'

export const REQUISITOS = [
  { clave: 'largo', texto: `${LARGO_MINIMO} caracteres o más`, cumple: (c) => [...c].length >= LARGO_MINIMO },
  { clave: 'minuscula', texto: 'una letra minúscula', cumple: (c) => /[a-z]/.test(c) },
  { clave: 'mayuscula', texto: 'una letra mayúscula', cumple: (c) => /[A-Z]/.test(c) },
  { clave: 'numero', texto: 'un número', cumple: (c) => /[0-9]/.test(c) },
  { clave: 'simbolo', texto: 'un símbolo (por ejemplo ! # $ % ?)', cumple: (c) => [...c].some((x) => SIMBOLOS.includes(x)) },
]

/** Qué le falta a la contraseña: [] si cumple todo. */
export function faltantes(contrasena) {
  const texto = String(contrasena ?? '')
  return REQUISITOS.filter((r) => !r.cumple(texto))
}

const demasiadoLarga = (c) => new TextEncoder().encode(c).length > BYTES_MAXIMOS

/** "a, b y c". */
const enumerar = (partes) => (partes.length < 2 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`)

/** El problema de la contraseña en una frase, o '' si sirve. */
export function problemaDeContrasena(contrasena) {
  const texto = String(contrasena ?? '')
  if (demasiadoLarga(texto)) return 'Es demasiado larga: usá hasta 72 caracteres.'
  const faltan = faltantes(texto)
  return faltan.length ? `Le falta: ${enumerar(faltan.map((r) => r.texto))}.` : ''
}

/**
 * Valida el formulario de cambio. No recorta nada: los espacios pueden ser parte de la clave.
 * Devuelve { ok, errores: { actual?, nueva?, repetida? }, primerError }.
 */
export function validarCambio({ actual = '', nueva = '', repetida = '' } = {}) {
  const errores = {}
  if (!actual) errores.actual = 'Escribí tu contraseña actual.'
  if (!nueva) errores.nueva = 'Escribí la contraseña nueva.'
  else if (problemaDeContrasena(nueva)) errores.nueva = problemaDeContrasena(nueva)
  else if (nueva === actual) errores.nueva = 'La contraseña nueva tiene que ser distinta de la actual.'
  if (!repetida) errores.repetida = 'Repetí la contraseña nueva.'
  else if (nueva && repetida !== nueva) errores.repetida = 'No coincide con la contraseña nueva.'
  const primerError = ['actual', 'nueva', 'repetida'].find((c) => errores[c]) ?? null
  return { ok: primerError === null, errores, primerError }
}

const sinConexion = (error, estado) =>
  !estado || error.name === 'AuthRetryableFetchError' || /failed to fetch|network|load failed/i.test(String(error.message ?? ''))

/**
 * Traduce un error de Supabase al cambiar la contraseña.
 *   paso: 'verificar' (comprobar la actual) | 'cambiar'
 * Devuelve { campo: 'actual' | 'nueva' | null, mensaje }.
 */
export function errorDeCambio(error, paso) {
  const codigo = String(error?.code ?? '')
  const estado = Number(error?.status)
  const texto = String(error?.message ?? '')
  const general = (mensaje) => ({ campo: null, mensaje })

  if (estado === 429 || codigo.startsWith('over_') || /rate limit/i.test(texto)) {
    return general('Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.')
  }
  if (estado >= 500) return general('Tuvimos un problema de nuestro lado. Probá de nuevo en unos minutos.')
  if (sinConexion(error ?? {}, estado)) {
    return general(
      paso === 'cambiar'
        ? 'Se cortó la conexión y no sabemos si la contraseña llegó a cambiar. Probá ingresar con la nueva; si no entra, usá la anterior.'
        : 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.',
    )
  }
  if (paso === 'verificar') {
    if (codigo === 'invalid_credentials' || codigo === 'invalid_grant' || /invalid login credentials/i.test(texto)) {
      return { campo: 'actual', mensaje: 'La contraseña actual no es correcta.' }
    }
    return general('No pudimos comprobar tu contraseña actual. Probá de nuevo.')
  }
  if (codigo === 'current_password_mismatch' || codigo === 'current_password_invalid') {
    return { campo: 'actual', mensaje: 'La contraseña actual no es correcta.' }
  }
  if (codigo === 'same_password') return { campo: 'nueva', mensaje: 'La contraseña nueva tiene que ser distinta de la actual.' }
  if (codigo === 'weak_password') {
    return { campo: 'nueva', mensaje: 'Supabase la considera débil. Probá con una más larga o menos común.' }
  }
  if (codigo === 'reauthentication_needed' || codigo === 'session_not_found' || codigo === 'session_expired') {
    return general('Tu sesión es vieja. Salí, volvé a ingresar y probá de nuevo.')
  }
  return general('No pudimos cambiar la contraseña. Probá de nuevo en unos minutos.')
}
