import { useCallback, useEffect, useRef, useState } from 'react'
import { filtrosAURL, filtrosDesdeURL } from './filtros'

const ESPERA = 150 // ms entre la última letra y la búsqueda

// Estado de la búsqueda y de los filtros por etiqueta.
//
// - `texto` es lo que se ve en el campo (cambia en cada letra); `consulta` es lo que
//   realmente filtra y llega ~150 ms después de la última letra.
// - Se lee de la URL al abrir (?q=...&etiquetas=...) y se refleja con replaceState,
//   para poder compartir un enlace ya filtrado. No agrega entradas al historial.
//
// clavesValidas: claves de las etiquetas que existen en el local (el resto de la URL se ignora).
export function useFiltros(clavesValidas) {
  const [inicial] = useState(() => filtrosDesdeURL(window.location.search, clavesValidas))
  const [texto, setTexto] = useState(inicial.consulta)
  const [consulta, setConsulta] = useState(inicial.consulta)
  const [etiquetas, setEtiquetas] = useState(inicial.etiquetas)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  // Mantiene la URL al día con lo que se está filtrando.
  useEffect(() => {
    try {
      const search = filtrosAURL(window.location.search, { consulta, etiquetas })
      if (search === window.location.search) return
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`)
    } catch {
      // Sin acceso al historial (modo restringido): el filtro igual funciona.
    }
  }, [consulta, etiquetas])

  const escribir = useCallback((valor) => {
    setTexto(valor)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setConsulta(valor), ESPERA)
  }, [])

  const limpiarTexto = useCallback(() => {
    clearTimeout(temporizador.current)
    setTexto('')
    setConsulta('')
  }, [])

  const alternarEtiqueta = useCallback((clave) => {
    setEtiquetas((actuales) => (actuales.includes(clave) ? actuales.filter((c) => c !== clave) : [...actuales, clave]))
  }, [])

  const limpiarTodo = useCallback(() => {
    clearTimeout(temporizador.current)
    setTexto('')
    setConsulta('')
    setEtiquetas([])
  }, [])

  return { texto, consulta, etiquetas, escribir, limpiarTexto, alternarEtiqueta, limpiarTodo }
}
