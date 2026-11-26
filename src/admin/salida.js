// Protección contra salir con cambios sin guardar: las decisiones, sin React ni DOM
// (scripts/probar-ajustes.mjs). Quien escucha los eventos es GuardaDeSalida.jsx.

/**
 * ¿Este clic en un enlace se va de la pantalla actual? Devuelve la ruta de destino a frenar,
 * o null si no hay que meterse (otra pestaña, descarga, otro sitio —lo cubre el aviso del
 * navegador—, o la misma pantalla, como "Saltar al contenido").
 *   clic:   { button, metaKey, ctrlKey, shiftKey, altKey, defaultPrevented }
 *   enlace: { href (absoluto), target, download } o null
 *   actual: { origin, pathname }
 */
export function destinoDeClic(clic, enlace, actual) {
  if (!enlace || clic.defaultPrevented || clic.button !== 0) return null
  if (clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return null
  if (enlace.download || (enlace.target && enlace.target !== '_self')) return null
  let url
  try {
    url = new URL(enlace.href)
  } catch {
    return null
  }
  if (url.origin !== actual.origin || url.pathname === actual.pathname) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * "Atrás" o "adelante" del navegador. Con cambios sin guardar, y si lleva a OTRA pantalla de
 * la app, devuelve cuánto hay que moverse para volver adonde estaba (history.go); si no, 0.
 * React Router guarda en history.state.idx la posición de cada entrada.
 */
export function pasoDeRegreso({ sucio, rutaAntes, rutaAhora, idxAntes, idxAhora }) {
  if (!sucio || rutaAntes === rutaAhora) return 0
  if (!Number.isInteger(idxAntes) || !Number.isInteger(idxAhora)) return 0
  return idxAntes - idxAhora
}
