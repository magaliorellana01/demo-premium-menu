// "Descargá tu QR" en Primeros pasos. No hay tabla para esto: se anota en este navegador
// cuando alguien descarga o manda a imprimir el QR. En otro equipo figura como pendiente.
// Si el navegador no deja guardar (modo privado), no pasa nada.
const claveDe = (localId) => `oestack-qr-listo:${localId}`

export function leerQrListo(localId) {
  try {
    return globalThis.localStorage.getItem(claveDe(localId)) === '1'
  } catch {
    return false
  }
}

export function marcarQrListo(localId) {
  try {
    globalThis.localStorage.setItem(claveDe(localId), '1')
  } catch {
    // Sin almacenamiento: el paso queda pendiente.
  }
}
