// Enlaces de contacto del local, armados desde los datos que ya tiene (sin columnas extra).
// Devuelven null cuando falta el dato o no sirve, para que la interfaz oculte ese botón.
// Los valores vienen de la base (los edita el local), así que se validan: nunca se
// arma un enlace con un protocolo que no sea https.

/** WhatsApp: acepta "+54 9 11 5555-1234", "5491155551234", etc. Devuelve un enlace wa.me o null. */
export function enlaceWhatsApp(numero, nombreLocal) {
  const digitos = String(numero ?? '').replace(/\D/g, '')
  if (digitos.length < 8 || digitos.length > 15) return null
  const mensaje = `Hola${nombreLocal ? ` ${nombreLocal}` : ''}, quería hacerles una consulta.`
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Instagram: acepta "usuario", "@usuario", "instagram.com/usuario" o la URL del perfil.
 * Una URL de otro sitio se descarta. Devuelve https://www.instagram.com/<usuario> o null.
 */
export function enlaceInstagram(valor) {
  let texto = String(valor ?? '').trim()
  if (!texto) return null

  if (/^[a-z][a-z0-9+.-]*:/i.test(texto) || texto.includes('/')) {
    // Parece una dirección: se normaliza y solo se acepta instagram.com con https.
    let url
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`)
    } catch {
      return null
    }
    const dominio = url.hostname.replace(/^www\./, '')
    if (url.protocol !== 'https:' || dominio !== 'instagram.com') return null
    texto = url.pathname.split('/').filter(Boolean)[0] ?? ''
  }

  const usuario = texto.replace(/^@/, '').trim()
  return usuario ? `https://www.instagram.com/${encodeURIComponent(usuario)}` : null
}

/** Búsqueda en Google Maps con la dirección escrita. */
export function enlaceMapas(direccion) {
  const texto = String(direccion ?? '').trim()
  return texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}` : null
}
