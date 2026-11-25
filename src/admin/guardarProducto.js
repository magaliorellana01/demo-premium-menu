// Orden seguro entre Storage y la base. Reglas:
//   1. Reemplazar: subir lo nuevo -> actualizar la base -> recién ahí borrar lo viejo.
//   2. Un producto nunca queda apuntando a un archivo que no existe: ante la DUDA (se cortó la
//      conexión y no se puede saber si la base guardó) no se borra nada. Es preferible un
//      archivo huérfano, que se informa, a un producto sin imagen.
//   3. Todo archivo que no se haya podido borrar se devuelve en `huerfanos`.
//
// La red entra por `api` (ver datosProductos.js), así se prueba cada punto de falla sin red:
//   supabaseUrl
//   urlPublica(ruta) -> string
//   subir(ruta, blob) -> Promise (lanza si falla)
//   borrar(rutas) -> Promise<string[]>  las que NO se pudieron borrar (nunca lanza)
//   guardar(id, fila, esNuevo) -> Promise<producto> (lanza si falla; con `code` si la base la rechazó)
//   eliminar(id) -> Promise (igual)
//   leer(id) -> Promise<producto | null> (lanza si no se pudo consultar)
//   contarUsos(imagenUrl) -> Promise<number>
import { rutasDeStorage, rutasDesdeUrl } from './fotos.js'

/** La base contestó con un código: seguro que NO guardó. Sin código (red) no se sabe. */
const rechazadoPorLaBase = (error) => Boolean(error?.code)

function conDatos(error, extra) {
  const salida = error instanceof Error ? error : Object.assign(new Error(error?.message ?? 'Error'), error)
  return Object.assign(salida, extra)
}

/** Borra las dos versiones de una foto subida, solo si ningún producto la usa. Devuelve huérfanos. */
export async function borrarFotoSinUso(api, localId, imagenUrl) {
  const rutas = rutasDesdeUrl(imagenUrl, api.supabaseUrl, localId)
  if (!rutas) return [] // foto del demo, externa o de otro local: no es nuestra para borrarla
  try {
    if ((await api.contarUsos(imagenUrl)) > 0) return []
  } catch {
    return rutas // no se puede confirmar que esté sin uso: se conserva y se informa
  }
  return api.borrar(rutas)
}

/**
 * Crea o actualiza un producto, con o sin cambio de foto.
 *   fila:  columnas a guardar (sin imagen_url)
 *   foto:  { tipo: 'igual' } | { tipo: 'quitar' } | { tipo: 'nueva', blobs: [480, 240], extension, nombre }
 *   pendientes: URLs de intentos anteriores que quedaron en duda; se limpian si ya nadie las usa
 * Devuelve { producto, huerfanos }. Si falla lanza el error con { paso: 'foto'|'datos', huerfanos,
 * urlEnDuda? }.
 */
export async function guardarProductoConFoto({ api, localId, id, esNuevo, fila, original = null, foto = { tipo: 'igual' }, pendientes = [], alPaso = () => {} }) {
  let rutasNuevas = null
  let urlNueva = null
  const cambios = { ...fila }

  if (foto.tipo === 'nueva') {
    rutasNuevas = rutasDeStorage(localId, foto.nombre, foto.extension)
    const intentadas = []
    try {
      for (let i = 0; i < rutasNuevas.length; i++) {
        alPaso(`Subiendo la foto (${i + 1} de ${rutasNuevas.length})…`)
        intentadas.push(rutasNuevas[i]) // aunque falle: pudo llegar y perderse la respuesta
        await api.subir(rutasNuevas[i], foto.blobs[i])
      }
    } catch (error) {
      throw conDatos(error, { paso: 'foto', huerfanos: await api.borrar(intentadas) })
    }
    urlNueva = api.urlPublica(rutasNuevas[0])
    cambios.imagen_url = urlNueva
  } else if (foto.tipo === 'quitar') {
    cambios.imagen_url = null
  }

  alPaso('Guardando el producto…')
  let producto
  try {
    producto = await api.guardar(id, cambios, esNuevo)
  } catch (error) {
    if (!rutasNuevas) throw conDatos(error, { paso: 'datos', huerfanos: [] })
    if (rechazadoPorLaBase(error)) throw conDatos(error, { paso: 'datos', huerfanos: await api.borrar(rutasNuevas) })

    let actual
    try {
      actual = await api.leer(id)
    } catch {
      // No se sabe si guardó: no se borra nada.
      throw conDatos(error, { paso: 'datos', huerfanos: rutasNuevas, urlEnDuda: urlNueva })
    }
    if (actual?.imagenUrl !== urlNueva) throw conDatos(error, { paso: 'datos', huerfanos: await api.borrar(rutasNuevas) })
    producto = actual // sí había guardado: solo se perdió la respuesta
  }

  const sobrantes = new Set(pendientes)
  if (original?.imagenUrl) sobrantes.add(original.imagenUrl)
  sobrantes.delete(producto.imagenUrl)
  const huerfanos = []
  if (sobrantes.size) alPaso('Borrando la foto anterior…')
  for (const url of sobrantes) huerfanos.push(...(await borrarFotoSinUso(api, localId, url)))

  return { producto, huerfanos }
}

/** Primero la fila y después sus archivos. Devuelve { huerfanos }. */
export async function eliminarProductoConFoto({ api, localId, producto }) {
  try {
    await api.eliminar(producto.id)
  } catch (error) {
    // ¿Ya no está? (se perdió la respuesta, o lo borraron desde otro equipo)
    if (rechazadoPorLaBase(error) && error.code !== 'SIN_FILAS') throw error
    let actual
    try {
      actual = await api.leer(producto.id)
    } catch {
      throw error
    }
    if (actual) throw error
  }
  return { huerfanos: await borrarFotoSinUso(api, localId, producto.imagenUrl) }
}
