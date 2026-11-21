// Única puerta de acceso a los datos del menú público.
// Los componentes llaman a getLocal(slug) y no conocen Supabase.
import { supabase, supabaseConfigurado } from './supabase'

/**
 * Devuelve el local con sus categorías y productos ordenados:
 *   { ...local, categorias: [{ ...categoria, productos: [...] }] }
 * o null si no existe (o no está activo: la política RLS lo oculta).
 * Si hay un error de red o de configuración, lanza una excepción.
 */
export async function getLocal(slug) {
  if (!supabaseConfigurado) {
    throw new Error('Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).')
  }

  // Una sola consulta con relaciones anidadas. RLS ya filtra lo que no es público:
  // categorías inactivas y todo lo de un local inactivo.
  const { data, error } = await supabase
    .from('locales')
    .select('*, categorias(*, productos(*))')
    .eq('slug', slug.toLowerCase())
    .order('orden', { referencedTable: 'categorias' })
    .order('orden', { referencedTable: 'categorias.productos' })
    .maybeSingle()

  if (error) throw error
  return data
}
