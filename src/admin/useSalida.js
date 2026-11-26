import { createContext, useContext, useEffect, useId } from 'react'

// Sin proveedor (pantallas sin formularios) salir no pide nada.
export const SalidaContexto = createContext({ anotar: () => {}, pedirSalida: (accion) => accion() })

/** pedirSalida(accion): la ejecuta ya, o primero pregunta si hay cambios sin guardar. */
export const useSalida = () => useContext(SalidaContexto)

/** Avisa que esta pantalla tiene cambios sin guardar mientras `sucio` sea true. */
export function useCambiosSinGuardar(sucio) {
  const { anotar } = useSalida()
  const id = useId()
  useEffect(() => {
    if (!sucio) return undefined
    anotar(id, true)
    return () => anotar(id, false)
  }, [sucio, id, anotar])
}
