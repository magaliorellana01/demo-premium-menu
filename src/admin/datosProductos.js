// Acceso a datos de productos y sus fotos (panel). Todo pasa por el RLS de las tablas y por
// la política de Storage: cada usuario solo escribe en sus locales y en sus carpetas.
import { ordenarCategorias, categoriaDesdeFila } from './categorias'
import { supabase } from './datos'
import { BUCKET, CACHE_SEGUNDOS } from './fotos'
import { productoDesdeFila } from './productos'

/** { categorias, productos } del local. */
export async function listarMenu(localId) {
  const [categorias, productos] = await Promise.all([
    supabase.from('categorias').select('id, nombre, orden, activa').eq('local_id', localId),
    supabase.from('productos').select('*').eq('local_id', localId),
  ])
  if (categorias.error) throw categorias.error
  if (productos.error) throw productos.error
  return { categorias: ordenarCategorias(categorias.data.map(categoriaDesdeFila)), productos: productos.data.map(productoDesdeFila) }
}

/** Una escritura que no afectó ninguna fila (RLS o fila borrada) es un error, no un "guardado". */
function unaFila({ data, error }) {
  if (error) throw error
  if (!data?.length) throw Object.assign(new Error('Ninguna fila afectada'), { code: 'SIN_FILAS' })
  return data[0]
}

/** cambios: columnas de la base ({ disponible } o { destacado }, desde la lista). */
export async function actualizarProducto(localId, id, cambios) {
  return productoDesdeFila(unaFila(await supabase.from('productos').update(cambios).eq('id', id).eq('local_id', localId).select('*')))
}

/** Guarda el orden de una categoría en UNA transacción (supabase/10-admin-productos.sql). */
export async function reordenarProductos(localId, categoriaId, ids) {
  const { error } = await supabase.rpc('reordenar_productos', { p_local_id: localId, p_categoria_id: categoriaId, p_ids: ids })
  if (error) throw error
}

/** La "api" que usan guardarProductoConFoto y eliminarProductoConFoto. */
export function apiDeProductos(localId) {
  const archivos = () => supabase.storage.from(BUCKET)

  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,

    urlPublica: (ruta) => archivos().getPublicUrl(ruta).data.publicUrl,

    async subir(ruta, blob) {
      const { error } = await archivos().upload(ruta, blob, { contentType: blob.type, cacheControl: String(CACHE_SEGUNDOS), upsert: false })
      if (error) throw error
    },

    /** Devuelve las rutas que NO se pudo confirmar que quedaran borradas. */
    async borrar(rutas) {
      try {
        const { data, error } = await archivos().remove(rutas)
        if (error) return rutas
        const borradas = new Set(data.map((o) => o.name))
        const dudosas = rutas.filter((r) => !borradas.has(r))
        const quedan = []
        // Que no figure como borrada puede ser porque nunca existió: se comprueba.
        for (const ruta of dudosas) {
          const corte = ruta.lastIndexOf('/')
          const nombre = ruta.slice(corte + 1)
          const lista = await archivos().list(ruta.slice(0, corte), { search: nombre })
          if (lista.error || lista.data.some((o) => o.name === nombre)) quedan.push(ruta)
        }
        return quedan
      } catch {
        return rutas
      }
    },

    // upsert por id: si se perdió la respuesta de un alta, reintentar no crea un producto repetido.
    async guardar(id, fila, esNuevo) {
      if (!esNuevo) return actualizarProducto(localId, id, fila)
      return productoDesdeFila(unaFila(await supabase.from('productos').upsert({ ...fila, id, local_id: localId }).select('*')))
    },

    async eliminar(id) {
      unaFila(await supabase.from('productos').delete().eq('id', id).eq('local_id', localId).select('id'))
    },

    async leer(id) {
      const { data, error } = await supabase.from('productos').select('*').eq('id', id).eq('local_id', localId).maybeSingle()
      if (error) throw error
      return data ? productoDesdeFila(data) : null
    },

    async contarUsos(imagenUrl) {
      const { count, error } = await supabase.from('productos').select('*', { count: 'exact', head: true }).eq('imagen_url', imagenUrl)
      if (error) throw error
      return count ?? 0
    },
  }
}
