import { createContext } from 'react'

// Sesión de Supabase Auth: { cargando, usuario, vencida, cerrarSesion, limpiarVencida }
export const SesionContexto = createContext(null)

// Qué puede hacer el usuario (ver permisos.js): { acceso, recargar }
export const AccesoContexto = createContext(null)
