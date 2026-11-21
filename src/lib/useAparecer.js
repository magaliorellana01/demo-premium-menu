import { useLayoutEffect, useRef } from 'react'
import { reducirMovimiento } from './movimiento'

// Aparición suave al entrar en pantalla. Devuelve un ref para el elemento.
// El elemento solo queda oculto (ver .aparece en menu.css) mientras espera
// entrar en pantalla; lo que ya está a la vista al cargar se muestra directo,
// y sin IntersectionObserver o con movimiento reducido nunca se oculta.
let observador

function obtenerObservador() {
  observador ??= new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue
        entrada.target.dataset.visible = 'true'
        observador.unobserve(entrada.target)
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  )
  return observador
}

export function useAparecer() {
  const ref = useRef(null)

  // Layout effect: corre antes del primer pintado, así lo que ya está a la
  // vista no llega a dibujarse oculto.
  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const yaVisible =
      !('IntersectionObserver' in window) ||
      reducirMovimiento() ||
      elemento.getBoundingClientRect().top < window.innerHeight
    if (yaVisible) {
      elemento.dataset.visible = 'true'
      return
    }

    const io = obtenerObservador()
    io.observe(elemento)
    return () => io.unobserve(elemento)
  }, [])

  return ref
}
