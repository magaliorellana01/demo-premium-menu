// Lógica pura de la pantalla de ingreso: validación de los campos y mensajes de error en
// español. Sin red ni React (se prueba con scripts/probar-permisos.mjs).

export const MENSAJE_CREDENCIALES = 'Email o contraseña incorrectos.'

const EMAIL_PLAUSIBLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Revisa lo que escribió la persona antes de pedirle nada a la base.
 * Devuelve { ok, email, errores: { email?, password? } }; `email` ya viene sin espacios y en minúsculas.
 * La contraseña no se recorta: los espacios pueden ser parte de ella.
 */
export function validarLogin({ email = '', password = '' } = {}) {
  const limpio = String(email).trim().toLowerCase()
  const errores = {}
  if (!limpio) errores.email = 'Ingresá tu email.'
  else if (!EMAIL_PLAUSIBLE.test(limpio)) errores.email = 'Revisá el email: parece incompleto.'
  if (!password) errores.password = 'Ingresá tu contraseña.'
  return { ok: Object.keys(errores).length === 0, email: limpio, errores }
}

const CODIGOS_DE_CREDENCIALES = ['invalid_credentials', 'invalid_grant', 'email_not_confirmed', 'user_banned', 'user_not_found']

/**
 * Traduce el error de inicio de sesión de Supabase a un mensaje en español.
 * Para cualquier problema de credenciales (contraseña mala, email inexistente, cuenta sin confirmar
 * o bloqueada) devuelve el MISMO mensaje, así no se revela qué dato falló ni si la cuenta existe.
 */
export function mensajeErrorLogin(error) {
  if (!error) return ''
  const codigo = String(error.code ?? '')
  const estado = Number(error.status)
  const texto = String(error.message ?? '')

  if (CODIGOS_DE_CREDENCIALES.includes(codigo) || /invalid login credentials/i.test(texto)) return MENSAJE_CREDENCIALES
  if (estado === 429 || codigo.startsWith('over_') || /rate limit/i.test(texto)) {
    return 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.'
  }
  if (estado >= 500) return 'Tuvimos un problema de nuestro lado. Probá de nuevo en unos minutos.'
  if (!estado || error.name === 'AuthRetryableFetchError' || /failed to fetch|network|load failed/i.test(texto)) {
    return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
  }
  return 'No pudimos iniciar sesión. Probá de nuevo en unos minutos.'
}
