import { useCallback, useEffect, useState } from 'react'
import { leerLocal, productoDeMuestra } from './datosAjustes'

/**
 * La fila del local (y un producto para la vista previa).
 *   { cargando, error, fila, producto, ponerFila(fila), reintentar() }
 */
export function useAjustes(localId) {
  const [resultado, setResultado] = useState(null) // { clave, fila, producto, error }
  const [intento, setIntento] = useState(0)
  const clave = `${localId}:${intento}`

  useEffect(() => {
    let activo = true
    const esta = `${localId}:${intento}`
    // Sin producto de muestra la vista previa usa uno de ejemplo: no es motivo de error.
    Promise.all([leerLocal(localId), productoDeMuestra(localId).catch(() => null)]).then(
      ([fila, producto]) => activo && setResultado({ clave: esta, fila, producto, error: fila ? null : { code: 'SIN_FILAS' } }),
      (error) => activo && setResultado({ clave: esta, fila: null, producto: null, error }),
    )
    return () => {
      activo = false
    }
  }, [localId, intento])

  const cargando = resultado?.clave !== clave
  const ponerFila = useCallback((fila) => setResultado((r) => r && { ...r, fila }), [])
  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  return {
    cargando,
    error: cargando ? null : resultado.error,
    fila: cargando ? null : resultado.fila,
    producto: cargando ? null : resultado.producto,
    ponerFila,
    reintentar,
  }
}
