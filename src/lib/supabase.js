import { createClient } from '@supabase/supabase-js'

// Cliente único de Supabase. Solo usa la URL y la anon key (claves públicas):
// la seguridad la dan las políticas RLS de la base, no el secreto de la clave.
// Nunca usar acá la clave service_role.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && anonKey)

// Si faltan las variables no se crea el cliente: así la app puede mostrar un
// mensaje claro en vez de romperse al cargar.
export const supabase = supabaseConfigurado ? createClient(url, anonKey) : null
