import { useLayoutEffect } from 'react'
import { variablesDeTema } from './tema'

/**
 * Aplica los colores propios del local a toda la página mientras el menú está en pantalla.
 * Sin colores propios no hace nada. Layout effect: se aplican antes del primer pintado.
 */
export function useTema(tema) {
  useLayoutEffect(() => {
    const variables = Object.entries(variablesDeTema(tema))
    if (variables.length === 0) return undefined
    const { style } = document.documentElement
    for (const [nombre, valor] of variables) style.setProperty(nombre, valor)
    const meta = document.querySelector('meta[name="theme-color"]')
    const anterior = meta?.getAttribute('content')
    meta?.setAttribute('content', Object.fromEntries(variables)['--color-superficie-oscura'])
    return () => {
      for (const [nombre] of variables) style.removeProperty(nombre)
      if (anterior) meta.setAttribute('content', anterior)
    }
  }, [tema])
}
