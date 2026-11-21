import { useEffect, useRef } from 'react'

// Marca el elemento con data-activa="true" o "false" según esté o no a la vista,
// para que el CSS pause las animaciones decorativas cuando nadie las ve.
// Escribe el atributo directo en el DOM (sin re-render). Devuelve el ref a usar.
export function usePausarFueraDePantalla() {
  const ref = useRef(null)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento || !('IntersectionObserver' in window)) return

    const observador = new IntersectionObserver(([entrada]) => {
      elemento.dataset.activa = String(entrada.isIntersecting)
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  return ref
}
