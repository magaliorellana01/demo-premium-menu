// La cuenta de demostración, del lado del panel. Puro (scripts/probar-demo.mjs).
//
// VITE_DEMO_EMAIL y VITE_DEMO_PASSWORD son PÚBLICAS a propósito (Vite las publica) y solo se
// cargan en el despliegue de la demo. Sin ellas no hay tarjeta, aviso ni nada de esto.
// Es todo comodidad de la interfaz: lo que la cuenta puede hacer lo decide la base (RLS).

export const AVISO_DEMO = 'Estás en una cuenta de demostración. Los datos se reinician periódicamente.'
export const SIN_CAMBIO_DE_PASSWORD = 'La contraseña de la cuenta de demostración la usa todo el mundo, así que acá no se puede cambiar.'

const emailDe = (valor) => String(valor ?? '').trim().toLowerCase()

/** Lo que muestra la tarjeta del ingreso, o null si falta alguna de las dos. */
export function credencialesDemo({ email, password } = {}) {
  const limpio = emailDe(email)
  return limpio && password ? { email: limpio, password: String(password) } : null
}

/** ¿La sesión abierta es la de la cuenta demo? Alcanza con comparar el email. */
export function esUsuarioDemo(usuario, emailDemo) {
  const demo = emailDe(emailDemo)
  return Boolean(demo) && emailDe(usuario?.email) === demo
}

/**
 * Cómo cerrar la sesión. Por defecto Supabase cierra TODAS las sesiones del usuario: en la cuenta
 * compartida, el "Salir" de una persona sacaría a todas las que están probando.
 */
export const opcionesDeSalida = (esDemo) => (esDemo ? { scope: 'local' } : undefined)

/** El mensaje cuando falla "Entrar a la demo". `normal` es el que daría el ingreso común. */
export const mensajeDeErrorDemo = (normal, deCredenciales) =>
  normal === deCredenciales ? 'No pudimos entrar a la demo: puede que alguien haya cambiado la contraseña. Avisale a OESTACK.' : normal
