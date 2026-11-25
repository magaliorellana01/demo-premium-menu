// Cliente COMPLETO de Supabase (supabase-js: Auth, Storage, etc.) y acceso a datos del panel.
//
// Este archivo solo se importa desde src/admin/, que se carga con React.lazy únicamente en las
// rutas /admin: el menú público sigue usando el cliente liviano (src/lib/supabasePublico.js) y
// su bundle no incluye nada de esto.
//
// Solo se usa la clave pública (anon): el panel actúa SIEMPRE como el usuario que inició sesión,
// y lo que puede leer o escribir lo decide el RLS de supabase/schema.sql. Nunca va acá la
// clave service_role.
import { createClient } from '@supabase/supabase-js'
import { armarAcceso } from './permisos'

const url = import.meta.env.VITE_SUPABASE_URL
const claveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY

export const adminConfigurado = Boolean(url && claveAnonima)

export const supabase = adminConfigurado
  ? createClient(url, claveAnonima, {
      auth: {
        persistSession: true, // la sesión sobrevive a recargar la página
        autoRefreshToken: true,
        detectSessionInUrl: false, // no hay enlaces mágicos ni recuperación de contraseña por ahora
        storageKey: 'oestack-panel-sesion', // no se mezcla con otras apps del mismo dominio
      },
    })
  : null

/** Inicia sesión con email y contraseña. Devuelve { error } (null si salió bien). */
export async function iniciarSesion(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error }
}

export function cerrarSesion() {
  return supabase.auth.signOut()
}

/**
 * Qué puede hacer este usuario: si es admin de OESTACK y a qué locales pertenece (con su rol).
 * El RLS ya limita todo: cada usuario solo lee sus propias filas de usuarios_locales y admins,
 * y de locales solo los suyos (o todos, si es admin). Lanza una excepción si algo falla.
 */
export async function cargarAcceso(usuarioId) {
  const [membresias, admin] = await Promise.all([
    supabase.from('usuarios_locales').select('rol, locales(id, slug, nombre, activo)').eq('user_id', usuarioId),
    supabase.from('admins').select('user_id').eq('user_id', usuarioId).maybeSingle(),
  ])
  if (membresias.error) throw membresias.error
  if (admin.error) throw admin.error

  const esAdmin = Boolean(admin.data)
  let todosLosLocales = []
  if (esAdmin) {
    const locales = await supabase.from('locales').select('id, slug, nombre, activo').order('nombre')
    if (locales.error) throw locales.error
    todosLosLocales = locales.data
  }
  return armarAcceso({ esAdmin, membresias: membresias.data, todosLosLocales })
}

/** Cantidad de categorías y de productos del local (cuenta todo, también lo inactivo). */
export async function cargarResumen(localId) {
  const [categorias, productos] = await Promise.all([
    supabase.from('categorias').select('*', { count: 'exact', head: true }).eq('local_id', localId),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('local_id', localId),
  ])
  if (categorias.error) throw categorias.error
  if (productos.error) throw productos.error
  return { categorias: categorias.count ?? 0, productos: productos.count ?? 0 }
}
