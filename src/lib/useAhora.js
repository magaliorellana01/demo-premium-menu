import { useEffect, useState } from 'react'

// La hora actual, recalculada cada minuto (justo al empezar cada minuto, para que el
// cambio de "abierto" a "cerrado" no se retrase) y al volver a la pestaña o a la ventana,
// donde los temporizadores pudieron haberse frenado.
export function useAhora() {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    const actualizar = () => setAhora(new Date())
    let intervalo
    const arranque = setTimeout(() => {
      actualizar()
      intervalo = setInterval(actualizar, 60_000)
    }, 60_000 - (Date.now() % 60_000))

    const alVolver = () => document.visibilityState === 'visible' && actualizar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', actualizar)

    return () => {
      clearTimeout(arranque)
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', actualizar)
    }
  }, [])

  return ahora
}
