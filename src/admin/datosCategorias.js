// Acceso a datos de categorías (panel). Todo pasa por el RLS: cada usuario solo puede leer y
// escribir las categorías de sus locales. Los filtros por local_id son además un cinturón extra.
// Cada función lanza el error de Supabase si algo falla (mensajeDeError lo traduce).
import { categoriaDesdeFila, ordenarCategorias } from './categorias'
import { supabase } from './datos'

const CAMPOS = 'id, nombre, orden, activa, adicionales, productos(count)'

/** Una escritura que no afectó ninguna fila (RLS o fila borrada) es un error, no un "guardado". */
function unaFila({ data, error }) {
  if (error) throw error
  if (!data?.length) throw Object.assign(new Error('Ninguna fila afectada'), { code: 'SIN_FILAS' })
  return data[0]
}

export async function listarCategorias(localId) {
  const { data, error } = await supabase.from('categorias').select(CAMPOS).eq('local_id', localId)
  if (error) throw error
  return ordenarCategorias(data.map(categoriaDesdeFila))
}

export async function crearCategoria(localId, { nombre, orden }) {
  return categoriaDesdeFila(unaFila(await supabase.from('categorias').insert({ local_id: localId, nombre, orden }).select(CAMPOS)))
}

/** cambios: { nombre } · { activa } · { adicionales } */
export async function actualizarCategoria(localId, id, cambios) {
  return categoriaDesdeFila(unaFila(await supabase.from('categorias').update(cambios).eq('id', id).eq('local_id', localId).select(CAMPOS)))
}

export async function contarProductos(categoriaId) {
  const { count, error } = await supabase.from('productos').select('*', { count: 'exact', head: true }).eq('categoria_id', categoriaId)
  if (error) throw error
  return count ?? 0
}

export async function eliminarCategoria(localId, id) {
  unaFila(await supabase.from('categorias').delete().eq('id', id).eq('local_id', localId).select('id'))
}

/** Guarda el orden completo en UNA transacción (supabase/09-admin-categorias.sql). */
export async function reordenarCategorias(localId, ids) {
  const { error } = await supabase.rpc('reordenar_categorias', { p_local_id: localId, p_ids: ids })
  if (error) throw error
}
