// Datos de la vista de clientes. La pantalla es solo para admins; lo que cada uno puede ver o
// cambiar lo decide la base (RLS, permisos por columna y el trigger del SQL 11). Ojo: los
// locales ACTIVOS son públicos (el menú), así que ocultar la lista es cosa de la interfaz.
import { aCliente, ordenarClientes } from './clientes'
import { supabase } from './datos'

/** Todos los locales con sus cantidades, en una sola consulta (conteo agrupado). */
export async function listarClientes() {
  const { data, error } = await supabase.from('locales').select('id, slug, nombre, activo, updated_at, categorias(count), productos(count)')
  if (error) throw error
  return ordenarClientes(data.map(aCliente))
}

export async function cambiarActivo(id, activo) {
  const { data, error } = await supabase.from('locales').update({ activo }).eq('id', id).select('activo, updated_at')
  if (error) throw error
  if (!data.length) throw Object.assign(new Error('sin filas'), { code: 'SIN_FILAS' })
  return { activo: data[0].activo, modificado: data[0].updated_at }
}
