// Acceso a datos de los ajustes del local (panel). Todo pasa por el RLS (solo owner y admin
// escriben), por los permisos por columna y por el trigger de supabase/11-admin-ajustes.sql.
import { COLUMNAS_LECTURA, guardarSinPisar } from './ajustes'
import { supabase } from './datos'

export async function leerLocal(id) {
  const { data, error } = await supabase.from('locales').select(COLUMNAS_LECTURA).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** Guarda `cambios` (columnas) sin pisar lo que haya cambiado otro equipo. Devuelve la fila. */
export function guardarLocal(base, cambios) {
  return guardarSinPisar({
    base,
    cambios,
    leer: () => leerLocal(base.id),
    async actualizar(columnas, version) {
      const { data, error } = await supabase.from('locales').update(columnas).eq('id', base.id).eq('updated_at', version).select(COLUMNAS_LECTURA)
      if (error) throw error
      return data[0] ?? null
    },
  })
}

/** Un producto real para la vista previa (el primero disponible), o null. */
export async function productoDeMuestra(localId) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('local_id', localId)
    .eq('disponible', true)
    .order('destacado', { ascending: false })
    .order('orden')
    .limit(1)
  if (error) throw error
  return data[0] ?? null
}
