import { useCallback, useEffect, useRef, useState } from 'react'

const DURACION_EXITO = 5000 // ms; los errores quedan hasta que se cierran o llega otro aviso

/** Estado para <AvisoEstado>: { aviso, exito(texto), error(texto), cerrar() }. */
export function useAviso() {
  const [aviso, setAviso] = useState(null)
  const contador = useRef(0)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const cerrar = useCallback(() => {
    clearTimeout(temporizador.current)
    setAviso(null)
  }, [])

  const mostrar = useCallback((tipo, texto) => {
    clearTimeout(temporizador.current)
    contador.current += 1
    setAviso({ id: contador.current, tipo, texto })
    if (tipo === 'exito') temporizador.current = setTimeout(() => setAviso(null), DURACION_EXITO)
  }, [])

  const exito = useCallback((texto) => mostrar('exito', texto), [mostrar])
  const error = useCallback((texto) => mostrar('error', texto), [mostrar])

  return { aviso, exito, error, cerrar }
}
