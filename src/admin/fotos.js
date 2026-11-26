// Fotos de productos: lógica pura (qué se acepta, recorte 4:5, tamaños, calidad y rutas de
// Storage). Lo que usa el navegador (canvas) está en procesarFoto.js.
//
// Referencia en la base (productos.imagen_url), siempre la versión de 480 px:
//   * fotos del demo:     "/locales/aroma/productos/espresso-480.webp"          (las sirve la app)
//   * fotos del panel:    "<SUPABASE_URL>/storage/v1/object/public/imagenes/<local_id>/productos/<nombre>-480.webp"
// La de 240 px se deduce por el nombre (src/lib/imagenes.js). Solo se borran de Storage las que
// tienen la segunda forma y están en la carpeta del propio local.
import { slugificar } from '../lib/formato.js'

export const BUCKET = 'imagenes'
/** Estado de la foto en el formulario cuando no se tocó. */
export const SIN_CAMBIOS = { tipo: 'igual' }
export const MAX_BYTES_ENTRADA = 10 * 1024 * 1024
export const MAX_BYTES_BUCKET = 2 * 1024 * 1024
export const CACHE_SEGUNDOS = 31536000 // un año: cada subida usa un nombre nuevo
export const ACEPTA = 'image/jpeg,image/png,image/webp'

// De mayor a menor. `objetivo` es el peso ideal: se usa la mayor calidad que entre.
export const VERSIONES = [
  { ancho: 480, alto: 600, objetivo: 80 * 1024 },
  { ancho: 240, alto: 300, objetivo: 30 * 1024 },
]
export const CALIDADES = [0.82, 0.76, 0.7, 0.64, 0.58, 0.5]

const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const EXTENSIONES = /\.(jpe?g|png|webp|heic|heif)$/i

/**
 * ¿Se puede intentar abrir este archivo? Devuelve { ok, error }. Las HEIC/HEIF del iPhone se
 * dejan pasar: el navegador que no sepa abrirlas falla después con un mensaje específico.
 */
export function revisarArchivo(archivo) {
  const mal = (error) => ({ ok: false, error })
  if (!archivo) return mal('No elegiste ninguna foto.')
  const tipoValido = archivo.type ? TIPOS.has(archivo.type.toLowerCase()) : EXTENSIONES.test(archivo.name ?? '')
  if (!tipoValido) return mal('Ese archivo no sirve. Elegí una foto JPG, PNG o WebP.')
  if (!archivo.size) return mal('Ese archivo está vacío. Elegí otra foto.')
  if (archivo.size > MAX_BYTES_ENTRADA) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1).replace('.', ',')
    return mal(`La foto pesa ${mb} MB y el máximo es 10 MB. Elegí una más liviana.`)
  }
  return { ok: true, error: '' }
}

export function esHeic(archivo) {
  return /^image\/hei[cf]$/i.test(archivo?.type ?? '') || /\.hei[cf]$/i.test(archivo?.name ?? '')
}

/** Rectángulo central 4:5 más grande que entra en una imagen de ancho x alto. */
export function recorte45(ancho, alto) {
  if (!(ancho > 0) || !(alto > 0)) return null
  if (ancho / alto > 4 / 5) {
    const w = Math.max(1, Math.round((alto * 4) / 5)) // sobran los costados
    return { x: Math.floor((ancho - w) / 2), y: 0, ancho: w, alto }
  }
  const h = Math.max(1, Math.round((ancho * 5) / 4)) // sobra arriba y abajo
  return { x: 0, y: Math.floor((alto - h) / 2), ancho, alto: Math.min(h, alto) }
}

/**
 * Tamaños por los que pasar al achicar (de a mitades: mejor definición que un salto grande).
 * El primero nunca supera el recorte ni 4 veces el destino (lienzos chicos para el celular).
 * El último es siempre el destino.
 */
export function pasosDeReduccion(anchoRecorte, destino) {
  const pasos = [{ ancho: destino.ancho, alto: destino.alto }]
  for (let factor = 2; factor <= 4 && destino.ancho * factor <= anchoRecorte; factor *= 2) {
    pasos.unshift({ ancho: destino.ancho * factor, alto: destino.alto * factor })
  }
  return pasos
}

/**
 * Comprime probando calidades de mayor a menor hasta entrar en `objetivo` bytes. Si ninguna
 * entra, queda la de menor calidad (la más liviana): no se degrada más que eso.
 *   codificar(calidad) -> Promise<{ size }>
 */
export async function comprimirHastaPeso(codificar, objetivo, calidades = CALIDADES) {
  let elegida = null
  for (const calidad of calidades) {
    const blob = await codificar(calidad)
    elegida = { blob, calidad }
    if (blob.size <= objetivo) break
  }
  return elegida
}

/** Extensión según el tipo REAL que generó el navegador, o null si no sirve (ej. PNG). */
export function extensionDeTipo(tipo) {
  if (tipo === 'image/webp') return 'webp'
  if (tipo === 'image/jpeg') return 'jpg'
  return null
}

/** Nombre legible + parte única: "cafe-frio-3f9a0c1b2d4e". `aleatorio` es hexadecimal. */
export function nombreDeArchivo(nombreProducto, aleatorio) {
  const base = slugificar(String(nombreProducto ?? '')).slice(0, 40).replace(/-+$/, '') || 'foto'
  return `${base}-${aleatorio}`
}

/** [ruta480, ruta240] dentro del bucket. */
export function rutasDeStorage(localId, nombre, extension) {
  return VERSIONES.map((v) => `${localId}/productos/${nombre}-${v.ancho}.${extension}`)
}

/**
 * Si imagen_url apunta a una foto subida por el panel EN LA CARPETA DE ESTE LOCAL, devuelve
 * sus dos rutas [480, 240]; en cualquier otro caso (foto local del demo, otra web, otro local,
 * rutas raras) devuelve null y no se borra nada.
 */
export function rutasDesdeUrl(imagenUrl, supabaseUrl, localId) {
  if (typeof imagenUrl !== 'string' || !supabaseUrl || !localId) return null
  const prefijo = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${localId}/productos/`
  if (!imagenUrl.startsWith(prefijo)) return null
  const partes = /^([a-z0-9][a-z0-9._-]*)-480\.(webp|jpg)$/i.exec(imagenUrl.slice(prefijo.length))
  if (!partes || partes[1].includes('..')) return null
  return rutasDeStorage(localId, partes[1], partes[2])
}

/** 41234 -> "40 kB" */
export function pesoLegible(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} kB`
}

/**
 * ¿La base rechazó la subida por el tope de archivos de la carpeta (supabase/12b-tope-demo.sql,
 * solo la de la demo)? Storage no deja pasar el mensaje: llega "database error, code: 23514".
 */
export const esCarpetaLlena = (error) => /database error, code: 23514/i.test(String(error?.message ?? ''))
export const MENSAJE_CARPETA_LLENA = 'Se llegó al máximo de archivos de la demo. Borrá una foto que hayas subido o esperá al próximo reinicio.'

