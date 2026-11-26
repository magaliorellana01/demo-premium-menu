// La dirección que codifica el QR y los estados de la pantalla. Puro y SIN la librería del QR:
// esto va con el resto del panel; el generador (qr.js) se descarga aparte.
// Se prueba con scripts/probar-qr.mjs.

export const AVISO_DOMINIO = 'Si cambiás de dominio, los QR impresos dejan de funcionar.'
export const AVISO_INACTIVO = 'Podés generar e imprimir el QR, pero el menú no se ve hasta que se active.'

export const PROBLEMAS_DE_URL = {
  falta: 'Falta configurar la dirección pública del sitio (VITE_PUBLIC_URL). Sin ella no generamos el QR: apuntaría a una dirección que no funciona en los celulares de tus clientes.',
  invalida: 'La dirección pública configurada (VITE_PUBLIC_URL) no es una dirección web válida.',
  'sin-https': 'La dirección pública configurada (VITE_PUBLIC_URL) tiene que empezar con https://',
  local: 'La dirección pública configurada (VITE_PUBLIC_URL) es de esta computadora o de una red interna: un QR así no funciona en otros celulares.',
  'con-extras': 'La dirección pública configurada (VITE_PUBLIC_URL) tiene que ser solo el dominio, sin carpetas, parámetros ni usuario.',
  slug: 'El nombre en la dirección de este local no es válido.',
}

// Sin punto (localhost, nombres de red interna), dominios reservados para redes internas o una IP.
function esDireccionInterna(host) {
  const sinPuntoFinal = host.replace(/\.$/, '')
  return (
    !sinPuntoFinal.includes('.') ||
    /\.(localhost|local|internal|lan|home\.arpa)$/.test(sinPuntoFinal) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(sinPuntoFinal) ||
    sinPuntoFinal.startsWith('[')
  )
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * La dirección pública del menú: VITE_PUBLIC_URL + "/" + slug, sin parámetros extra.
 * Devuelve { url, problema: null } o { url: null, problema: <clave de PROBLEMAS_DE_URL> }.
 */
export function urlDelMenu(urlPublica, slug) {
  const mal = (problema) => ({ url: null, problema })
  const texto = String(urlPublica ?? '').trim()
  if (!texto) return mal('falta')
  if (!/^https?:\/\/[^/]/i.test(texto)) return mal('invalida')
  let base
  try {
    base = new URL(texto)
  } catch {
    return mal('invalida')
  }
  if (esDireccionInterna(base.hostname)) return mal('local')
  if (base.protocol !== 'https:') return mal('sin-https')
  // "?" y "#" sueltos no aparecen en search ni en hash: se miran en el texto.
  if (!/^\/*$/.test(base.pathname) || /[?#]/.test(texto) || base.username || base.password) return mal('con-extras')
  if (typeof slug !== 'string' || slug.length > 60 || !SLUG.test(slug)) return mal('slug')
  return { url: `${base.origin}/${slug}`, problema: null }
}

/**
 * Qué muestra la pantalla para ese local: { url, problema, inactivo }.
 * Un local inactivo igual puede tener su QR (se imprime antes de publicar).
 */
export const estadoDelQR = (urlPublica, local) => ({ ...urlDelMenu(urlPublica, local?.slug), inactivo: local?.activo !== true })
