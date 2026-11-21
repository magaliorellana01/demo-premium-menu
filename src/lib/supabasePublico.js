import { PostgrestClient } from '@supabase/postgrest-js'

// Cliente LIVIANO para el menú público: solo habla con la API REST de Supabase
// (lecturas con la anon key). No trae login, Storage ni tiempo real, que el menú
// no usa; así el JavaScript de la página pública pesa bastante menos.
//
// El panel (/admin, Tarea 4) va a usar el cliente completo (@supabase/supabase-js)
// en un archivo aparte y cargado solo en esa ruta (import dinámico), para que no
// engorde el menú.
//
// Solo se usan claves públicas: la URL y la anon key. La seguridad la dan las
// políticas RLS de la base. Nunca usar acá la clave service_role.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && anonKey)

// Si faltan las variables no se crea el cliente: así la app puede mostrar un
// mensaje claro en vez de romperse al cargar.
export const clientePublico = supabaseConfigurado
  ? new PostgrestClient(`${url}/rest/v1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
  : null
