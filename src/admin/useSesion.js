import { useContext } from 'react'
import { SesionContexto } from './contextos'

/** Estado de la sesión: { cargando, usuario, vencida, cerrarSesion, limpiarVencida }. Solo dentro de <SesionProvider>. */
export function useSesion() {
  const valor = useContext(SesionContexto)
  if (!valor) throw new Error('useSesion se usa dentro de <SesionProvider>.')
  return valor
}
