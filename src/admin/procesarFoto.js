// Prepara en el navegador las dos versiones de una foto (480 y 240 px de ancho, recorte 4:5),
// sin dependencias. El original nunca se sube.
//
// Formato: WebP. Algunos navegadores (Safari) no saben GENERAR WebP desde un canvas y, en vez
// de fallar, devuelven un PNG pesado: por eso se mira el tipo real del resultado y, si no es
// WebP, las dos versiones se generan en JPEG.
import { comprimirHastaPeso, esHeic, extensionDeTipo, MAX_BYTES_BUCKET, pasosDeReduccion, recorte45, revisarArchivo, VERSIONES } from './fotos'

const FONDO = '#fffdf9' // porcelana de la marca: lo transparente de un PNG no queda negro en JPEG

class ErrorDeFoto extends Error {}
export const esErrorDeFoto = (error) => error instanceof ErrorDeFoto

/** Abre el archivo ya girado según su orientación EXIF (las fotos del celular vienen "acostadas"). */
async function abrirImagen(archivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
      return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height, cerrar: () => bitmap.close() }
    } catch {
      // Se intenta con <img>, que también respeta la orientación.
    }
  }
  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new ErrorDeFoto(
      esHeic(archivo)
        ? 'Este navegador no puede abrir fotos HEIC. En el iPhone, poné la cámara en “Más compatible” o elegí una foto JPG.'
        : 'No pudimos abrir esa foto: puede estar dañada. Elegí otra.',
    )
  }
}

function lienzo(ancho, alto) {
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new ErrorDeFoto('Tu navegador no pudo preparar la foto. Cerrá otras pestañas y probá de nuevo.')
  contexto.imageSmoothingEnabled = true
  contexto.imageSmoothingQuality = 'high'
  contexto.fillStyle = FONDO
  contexto.fillRect(0, 0, ancho, alto)
  return { canvas, contexto }
}

function dibujarVersion(imagen, recorte, destino) {
  const [primero, ...resto] = pasosDeReduccion(recorte.ancho, destino)
  let actual = lienzo(primero.ancho, primero.alto)
  actual.contexto.drawImage(imagen.fuente, recorte.x, recorte.y, recorte.ancho, recorte.alto, 0, 0, primero.ancho, primero.alto)
  for (const paso of resto) {
    const siguiente = lienzo(paso.ancho, paso.alto)
    siguiente.contexto.drawImage(actual.canvas, 0, 0, paso.ancho, paso.alto)
    actual = siguiente
  }
  return actual.canvas
}

function aBlob(canvas, tipo, calidad) {
  return new Promise((resolver, rechazar) => {
    canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new ErrorDeFoto('No pudimos convertir la foto. Probá con otra.'))), tipo, calidad)
  })
}

/**
 * Devuelve { blobs: [480, 240], extension, chica } o lanza un error con un mensaje para mostrar.
 * `chica` avisa que la foto original era más angosta que 480 px (se va a ver menos nítida).
 */
export async function procesarFoto(archivo) {
  const revision = revisarArchivo(archivo)
  if (!revision.ok) throw new ErrorDeFoto(revision.error)

  const imagen = await abrirImagen(archivo)
  try {
    const recorte = recorte45(imagen.ancho, imagen.alto)
    if (!recorte) throw new ErrorDeFoto('No pudimos abrir esa foto: puede estar dañada. Elegí otra.')
    const lienzos = VERSIONES.map((version) => dibujarVersion(imagen, recorte, version))

    const prueba = await aBlob(lienzos[0], 'image/webp', 0.8)
    const tipo = prueba.type === 'image/webp' ? 'image/webp' : 'image/jpeg'

    const blobs = []
    for (let i = 0; i < VERSIONES.length; i++) {
      const { blob } = await comprimirHastaPeso((calidad) => aBlob(lienzos[i], tipo, calidad), VERSIONES[i].objetivo)
      if (blob.type !== tipo || blob.size > MAX_BYTES_BUCKET) throw new ErrorDeFoto('No pudimos convertir la foto. Probá con otra.')
      blobs.push(blob)
    }
    return { blobs, extension: extensionDeTipo(tipo), chica: recorte.ancho < VERSIONES[0].ancho }
  } finally {
    imagen.cerrar()
  }
}

/** Parte única del nombre. getRandomValues funciona también sin HTTPS (probar desde el celular por la red local). */
export function hexAleatorio(bytes = 6) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** UUID v4 para el id de un producto nuevo: reintentar el guardado no lo duplica. */
export function nuevoId() {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
