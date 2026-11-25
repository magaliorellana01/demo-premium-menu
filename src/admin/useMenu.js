import { useCallback, useEffect, useState } from 'react'
import { listarMenu } from './datosProductos'

const VACIO = { categorias: [], productos: [] }

/**
 * Categorías y productos de un local.
 *   { cargando, error, categorias, productos, cambiarProductos(fn), reintentar(), refrescar() }
 * reintentar() vuelve a cargar mostrando el esqueleto; refrescar() actualiza sin ocultar la lista.
 */
export function useMenu(localId) {
  const [resultado, setResultado] = useState(null) // { clave, menu, error } de la última carga terminada
  const [intento, setIntento] = useState(0)
  const clave = `${localId}:${intento}`

  useEffect(() => {
    let activo = true
    const esta = `${localId}:${intento}`
    listarMenu(localId).then(
      (menu) => activo && setResultado({ clave: esta, menu, error: false }),
      () => activo && setResultado({ clave: esta, menu: VACIO, error: true }),
    )
    return () => {
      activo = false
    }
  }, [localId, intento])

  const cargando = resultado?.clave !== clave
  const menu = cargando ? VACIO : resultado.menu

  const cambiarProductos = useCallback(
    (fn) => setResultado((actual) => actual && { ...actual, menu: { ...actual.menu, productos: fn(actual.menu.productos) } }),
    [],
  )
  const reintentar = useCallback(() => setIntento((n) => n + 1), [])
  const refrescar = useCallback(async () => {
    try {
      const nuevo = await listarMenu(localId)
      setResultado((actual) => actual && { ...actual, menu: nuevo, error: false })
    } catch {
      // Si no se puede refrescar, queda lo que había; el aviso de error ya se mostró.
    }
  }, [localId])

  return {
    cargando,
    error: !cargando && resultado.error,
    categorias: menu.categorias,
    productos: menu.productos,
    cambiarProductos,
    reintentar,
    refrescar,
  }
}
