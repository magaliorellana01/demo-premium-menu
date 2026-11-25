import { useContext, useMemo } from 'react'
import { AccesoContexto } from './contextos'
import {
  localDeAcceso,
  puedeAsignarUsuarios,
  puedeCrearLocales,
  puedeEditarLocal,
  puedeGestionarMenu,
} from './permisos'

/** Acceso del usuario: { acceso, recargar }. Solo dentro de las rutas protegidas. */
export function useAcceso() {
  const valor = useContext(AccesoContexto)
  if (!valor) throw new Error('useAcceso se usa dentro de una ruta protegida.')
  return valor
}

/**
 * Permisos del usuario sobre un local (por slug), listos para usar en la interfaz.
 * Es solo comodidad: la seguridad real es el RLS de la base (ver permisos.js).
 *
 *   const permisos = usePermisos(slug)
 *   permisos.local                    // { id, slug, nombre, activo, rol } o null si no tiene acceso
 *   permisos.rol                      // 'admin' | 'owner' | 'editor' | null
 *   permisos.puedeGestionarMenu       // categorías y productos
 *   permisos.puedeEditarLocal         // datos del local (owner y admin)
 *   permisos.puedeCrearLocales        // solo admins de OESTACK
 *   permisos.puedeAsignarUsuarios     // solo admins de OESTACK
 */
export function usePermisos(slug) {
  const { acceso } = useAcceso()
  return useMemo(() => {
    const local = localDeAcceso(acceso, slug)
    const rol = local?.rol ?? null
    return {
      local,
      rol,
      esAdmin: acceso.esAdmin,
      puedeGestionarMenu: puedeGestionarMenu(rol),
      puedeEditarLocal: puedeEditarLocal(rol),
      puedeCrearLocales: puedeCrearLocales(acceso),
      puedeAsignarUsuarios: puedeAsignarUsuarios(acceso),
    }
  }, [acceso, slug])
}
