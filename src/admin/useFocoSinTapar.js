import { useEffect } from 'react'

const AIRE = 8 // px entre el control enfocado y la barra

// La barra de navegación es fija abajo (celular) o pegada arriba (desde tablet) y puede quedar
// por encima del control que recibe el foco: el navegador no vuelve a desplazar algo que ya
// está "dentro de la pantalla" (WCAG 2.4.11, el foco no debe quedar tapado). Si pasa, se corre
// la página lo justo. Solo con foco VISIBLE (teclado y campos): un toque en un botón no mueve nada.
export function useFocoSinTapar(barraRef) {
  useEffect(() => {
    let cuadro = 0
    const alEnfocar = (evento) => {
      const control = evento.target
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => {
        const barra = barraRef.current
        if (!barra || barra.contains(control) || !control.matches?.(':focus-visible')) return
        const caja = control.getBoundingClientRect()
        const tapa = barra.getBoundingClientRect()
        if (caja.bottom <= tapa.top - AIRE || caja.top >= tapa.bottom + AIRE) return // no se pisan
        const barraAbajo = getComputedStyle(barra).position === 'fixed'
        const mover = barraAbajo ? caja.bottom - tapa.top + AIRE : caja.top - tapa.bottom - AIRE
        window.scrollBy({ top: mover, behavior: 'instant' })
      })
    }
    document.addEventListener('focusin', alEnfocar)
    return () => {
      cancelAnimationFrame(cuadro)
      document.removeEventListener('focusin', alEnfocar)
    }
  }, [barraRef])
}
