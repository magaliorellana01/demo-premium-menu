import { useCallback, useEffect, useMemo, useState } from 'react'
import PantallaCarga from './PantallaCarga'
import { AccesoContexto } from './contextos'
import { cargarAcceso } from './datos'
import { useSesion } from './useSesion'

// Carga qué locales puede ver el usuario y con qué rol, y recién entonces muestra el panel
// (mientras tanto, una pantalla de carga neutra: sin parpadeos de "sin acceso").
export default function AccesoProvider({ usuario, children }) {
  const { cerrarSesion } = useSesion()
  const [resultado, setResultado] = useState(null) // { clave, acceso, error } de la última carga terminada
  const [intento, setIntento] = useState(0)
  const usuarioId = usuario.id
  const clave = `${usuarioId}:${intento}`

  useEffect(() => {
    let activo = true
    cargarAcceso(usuarioId).then(
      (acceso) => activo && setResultado({ clave: `${usuarioId}:${intento}`, acceso, error: false }),
      () => activo && setResultado({ clave: `${usuarioId}:${intento}`, acceso: null, error: true }),
    )
    return () => {
      activo = false
    }
  }, [usuarioId, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  const acceso = resultado?.acceso ?? null
  const valor = useMemo(() => ({ acceso, recargar }), [acceso, recargar])

  // "Cargando" se deduce: todavía no terminó la carga de ESTE usuario e intento.
  if (resultado?.clave !== clave) return <PantallaCarga />
  if (resultado.error) {
    return (
      <main className="adm-centro">
        <div className="adm-tarjeta adm-tarjeta--aviso">
          <h1 className="adm-titulo">No pudimos cargar tu acceso</h1>
          <p className="adm-texto">Parece un problema de conexión. Probá de nuevo en unos instantes.</p>
          <div className="adm-acciones">
            <button type="button" className="adm-boton adm-boton--primario" onClick={recargar}>
              Reintentar
            </button>
            <button type="button" className="adm-boton" onClick={cerrarSesion}>
              Salir
            </button>
          </div>
        </div>
      </main>
    )
  }

  return <AccesoContexto value={valor}>{children}</AccesoContexto>
}
