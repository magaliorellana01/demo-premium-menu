// Prepara en el navegador el logo que se va a subir: recorta los bordes transparentes, lo
// achica para que entre en la caja (sin deformarlo ni agrandarlo) y conserva la transparencia.
//
// Formato: WebP. Si el navegador no sabe GENERAR WebP (Safari devuelve un PNG sin avisar), se
// sube PNG: el JPEG de respaldo de las fotos no sirve acá porque no tiene transparencia.
import { analizarLogo, medidasDeLogo, PESO_IDEAL_LOGO, recortarTransparente, revisarArchivoLogo } from './logo'
import { CALIDADES, comprimirHastaPeso, MAX_BYTES_BUCKET } from './fotos'
import { abrirImagen, ErrorDeFoto } from './procesarFoto'

const LADO_DE_TRABAJO = 1600

function lienzo(ancho, alto) {
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const contexto = canvas.getContext('2d', { willReadFrequently: true })
  if (!contexto) throw new ErrorDeFoto('Tu navegador no pudo preparar la imagen. Cerrá otras pestañas y probá de nuevo.')
  contexto.imageSmoothingQuality = 'high'
  return { canvas, contexto }
}

const aBlob = (canvas, tipo, calidad) =>
  new Promise((resolver, rechazar) => {
    canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new ErrorDeFoto('No pudimos convertir el logo. Probá con otro archivo.'))), tipo, calidad)
  })

/** Devuelve { blob, extension, ancho, alto, pixeles, transparente } o lanza un error para mostrar. */
export async function procesarLogo(archivo) {
  const revision = revisarArchivoLogo(archivo)
  if (!revision.ok) throw new ErrorDeFoto(revision.error)

  const imagen = await abrirImagen(archivo)
  try {
    const escala = Math.min(1, LADO_DE_TRABAJO / Math.max(imagen.ancho, imagen.alto))
    const trabajo = lienzo(Math.max(1, Math.round(imagen.ancho * escala)), Math.max(1, Math.round(imagen.alto * escala)))
    trabajo.contexto.drawImage(imagen.fuente, 0, 0, trabajo.canvas.width, trabajo.canvas.height)
    const { data } = trabajo.contexto.getImageData(0, 0, trabajo.canvas.width, trabajo.canvas.height)
    const caja = recortarTransparente(data, trabajo.canvas.width, trabajo.canvas.height)
    if (!caja) throw new ErrorDeFoto('Esa imagen es completamente transparente. Elegí otra.')

    const medidas = medidasDeLogo(caja.ancho, caja.alto)
    let actual = lienzo(caja.ancho, caja.alto)
    actual.contexto.drawImage(trabajo.canvas, caja.x, caja.y, caja.ancho, caja.alto, 0, 0, caja.ancho, caja.alto)
    // De a mitades: mejor definición que un solo salto grande.
    while (actual.canvas.width / 2 >= medidas.ancho && actual.canvas.height / 2 >= medidas.alto) {
      const mitad = lienzo(Math.round(actual.canvas.width / 2), Math.round(actual.canvas.height / 2))
      mitad.contexto.drawImage(actual.canvas, 0, 0, mitad.canvas.width, mitad.canvas.height)
      actual = mitad
    }
    const final = lienzo(medidas.ancho, medidas.alto)
    final.contexto.drawImage(actual.canvas, 0, 0, medidas.ancho, medidas.alto)

    let blob = await aBlob(final.canvas, 'image/webp', 0.9)
    let extension = 'webp'
    if (blob.type !== 'image/webp') {
      blob = await aBlob(final.canvas, 'image/png')
      extension = 'png'
    } else if (blob.size > PESO_IDEAL_LOGO) {
      blob = (await comprimirHastaPeso((calidad) => aBlob(final.canvas, 'image/webp', calidad), PESO_IDEAL_LOGO, CALIDADES)).blob
    }
    if (blob.type !== `image/${extension}` || blob.size > MAX_BYTES_BUCKET) throw new ErrorDeFoto('No pudimos convertir el logo. Probá con otro archivo.')

    const pixeles = final.contexto.getImageData(0, 0, medidas.ancho, medidas.alto).data
    return { blob, extension, ...medidas, pixeles, transparente: analizarLogo(pixeles, '#000000').transparente }
  } finally {
    imagen.cerrar()
  }
}
