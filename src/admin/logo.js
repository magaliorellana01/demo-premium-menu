// Logo del local: lógica pura (qué se acepta, recorte, medidas, rutas y orden seguro entre
// Storage y la base). Lo que usa el navegador (canvas) está en procesarLogo.js.
//
// Referencia en la base (locales.logo_url):
//   * del demo:    "/locales/aroma/logo.webp"                                   (lo sirve la app)
//   * del panel:   "<SUPABASE_URL>/storage/v1/object/public/imagenes/<local_id>/logo/logo-<hex>-<ancho>x<alto>.webp"
// Las medidas van en el nombre para que el menú reserve el lugar antes de que la imagen cargue.
import { MARCA_DEMO } from '../lib/demo.js'
import { contraste } from '../lib/tema.js'
import { BUCKET, MAX_BYTES_ENTRADA } from './fotos.js'

export const ACEPTA_LOGO = 'image/png,image/webp,image/jpeg'
export const CAJA_LOGO = { ancho: 640, alto: 320 } // el logo se achica para entrar acá (nunca se agranda)
export const PESO_IDEAL_LOGO = 60 * 1024
const TIPOS = new Set(['image/png', 'image/webp', 'image/jpeg'])
const ALFA_VISIBLE = 8

export function revisarArchivoLogo(archivo) {
  const mal = (error) => ({ ok: false, error })
  if (!archivo) return mal('No elegiste ningún archivo.')
  const tipoValido = archivo.type ? TIPOS.has(archivo.type.toLowerCase()) : /\.(png|webp|jpe?g)$/i.test(archivo.name ?? '')
  if (!tipoValido) return mal('Ese archivo no sirve. Elegí un logo PNG, WebP o JPG (mejor con fondo transparente).')
  if (!archivo.size) return mal('Ese archivo está vacío. Elegí otro.')
  if (archivo.size > MAX_BYTES_ENTRADA) return mal('El archivo pesa más de 10 MB. Elegí uno más liviano.')
  return { ok: true, error: '' }
}

/** Rectángulo que encierra todo lo que no es transparente (data = RGBA). null si no hay nada. */
export function recortarTransparente(data, ancho, alto) {
  let izq = ancho
  let der = -1
  let arriba = alto
  let abajo = -1
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (data[(y * ancho + x) * 4 + 3] <= ALFA_VISIBLE) continue
      if (x < izq) izq = x
      if (x > der) der = x
      if (y < arriba) arriba = y
      abajo = y
    }
  }
  return der < 0 ? null : { x: izq, y: arriba, ancho: der - izq + 1, alto: abajo - arriba + 1 }
}

export function medidasDeLogo(ancho, alto) {
  const escala = Math.min(1, CAJA_LOGO.ancho / ancho, CAJA_LOGO.alto / alto)
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) }
}

const aHex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

/** { transparente, visible }: visible = parte (0 a 1) de lo opaco que se distingue sobre `fondo`. */
export function analizarLogo(data, fondo) {
  let opacos = 0
  let visibles = 0
  let huecos = 0
  const cache = new Map()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) huecos++
    if (data[i + 3] < 128) continue
    opacos++
    // Se agrupan los tonos parecidos para no calcular el contraste píxel por píxel.
    const clave = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
    let ok = cache.get(clave)
    if (ok === undefined) cache.set(clave, (ok = contraste(aHex(data[i], data[i + 1], data[i + 2]), fondo) >= 2))
    if (ok) visibles++
  }
  return { transparente: huecos > data.length / 4 / 100, visible: opacos ? visibles / opacos : 0 }
}

export const nombreDeLogo = (aleatorio, ancho, alto, extension) => `logo-${aleatorio}-${ancho}x${alto}.${extension}`
export const rutaDeLogo = (localId, nombre) => `${localId}/logo/${nombre}`

/** Ruta en Storage si logo_url es un logo subido EN LA CARPETA DE ESTE LOCAL; si no, null. */
export function rutaDeLogoDesdeUrl(logoUrl, supabaseUrl, localId) {
  if (typeof logoUrl !== 'string' || !supabaseUrl || !localId) return null
  const prefijo = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${localId}/logo/`
  if (!logoUrl.startsWith(prefijo)) return null
  const nombre = logoUrl.slice(prefijo.length)
  return /^[a-z0-9][a-z0-9_-]*\.(webp|png)$/i.test(nombre) ? rutaDeLogo(localId, nombre) : null
}

/** El logo que traía el local antes de subir uno propio (hoy solo la demo tiene uno). */
export const logoOriginal = (slug) => (slug === MARCA_DEMO.slug ? MARCA_DEMO.logo : null)

/**
 * Orden seguro: subir lo nuevo -> actualizar la base -> recién ahí borrar lo viejo. Ante la
 * duda (se cortó la conexión y no se sabe si guardó) no se borra nada y se informa.
 *   cambio:  { tipo: 'nuevo', blob, nombre } | { tipo: 'quitar', url: logo que queda (o null) }
 *   api:     { supabaseUrl, urlPublica, subir, borrar }  (como la de productos)
 *   guardar(logoUrl) -> fila guardada (lanza; con `code` si la base seguro que no guardó)
 *   leer() -> fila actual (lanza si no se puede consultar)
 *   pendientes: logos de intentos que quedaron en duda
 * Devuelve { fila, huerfanos }. Al fallar, el error lleva { paso, huerfanos, urlEnDuda? }.
 */
export async function guardarLogo({ api, localId, cambio, anteriorUrl, guardar, leer, pendientes = [], alPaso = () => {} }) {
  const conDatos = (error, extra) => Object.assign(error instanceof Error ? error : Object.assign(new Error(error?.message ?? 'Error'), error), extra)
  let ruta = null
  let urlNueva = cambio.url ?? null

  if (cambio.tipo === 'nuevo') {
    ruta = rutaDeLogo(localId, cambio.nombre)
    alPaso('Subiendo el logo…')
    try {
      await api.subir(ruta, cambio.blob)
    } catch (error) {
      throw conDatos(error, { paso: 'foto', huerfanos: await api.borrar([ruta]) })
    }
    urlNueva = api.urlPublica(ruta)
  }

  alPaso('Guardando…')
  let fila
  try {
    fila = await guardar(urlNueva)
  } catch (error) {
    if (!ruta) throw conDatos(error, { paso: 'datos', huerfanos: [] })
    if (error?.code) throw conDatos(error, { paso: 'datos', huerfanos: await api.borrar([ruta]) })
    let actual
    try {
      actual = await leer()
    } catch {
      throw conDatos(error, { paso: 'datos', huerfanos: [ruta], urlEnDuda: urlNueva })
    }
    if (actual?.logo_url !== urlNueva) throw conDatos(error, { paso: 'datos', huerfanos: await api.borrar([ruta]) })
    fila = actual // sí había guardado: solo se perdió la respuesta
  }

  const sobrantes = new Set([anteriorUrl, ...pendientes])
  sobrantes.delete(fila.logo_url)
  const rutas = [...sobrantes].map((url) => rutaDeLogoDesdeUrl(url, api.supabaseUrl, localId)).filter(Boolean)
  const huerfanos = rutas.length ? await api.borrar(rutas) : []
  return { fila, huerfanos }
}
