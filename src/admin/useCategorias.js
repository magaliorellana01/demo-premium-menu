import { useCallback, useEffect, useState } from 'react'
import { listarCategorias } from './datosCategorias'

/**
 * Lista de categorías de un local.
 *   { cargando, error, categorias, cambiar(fn), reintentar(), refrescar() }
 * reintentar() vuelve a cargar mostrando el esqueleto; refrescar() actualiza sin ocultar la lista.
 */
export function useCategorias(localId) {
  const [resultado, setResultado] = useState(null) // { clave, categorias, error } de la última carga terminada
  const [intento, setIntento] = useState(0)
  const clave = `${localId}:${intento}`

  useEffect(() => {
    let activo = true
    const esta = `${localId}:${intento}`
    listarCategorias(localId).then(
      (categorias) => activo && setResultado({ clave: esta, categorias, error: false }),
      () => activo && setResultado({ clave: esta, categorias: [], error: true }),
    )
    return () => {
      activo = false
    }
  }, [localId, intento])

  const cargando = resultado?.clave !== clave

  const cambiar = useCallback((fn) => setResultado((actual) => actual && { ...actual, categorias: fn(actual.categorias) }), [])
  const reintentar = useCallback(() => setIntento((n) => n + 1), [])
  const refrescar = useCallback(async () => {
    try {
      const categorias = await listarCategorias(localId)
      setResultado((actual) => actual && { ...actual, categorias, error: false })
    } catch {
      // Si no se puede refrescar, queda lo que había; el aviso de error ya se mostró.
    }
  }, [localId])

  return {
    cargando,
    error: !cargando && resultado.error,
    categorias: cargando ? [] : resultado.categorias,
    cambiar,
    reintentar,
    refrescar,
  }
}
