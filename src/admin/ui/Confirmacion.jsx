import { useEffect, useId, useRef } from 'react'
import Boton from './Boton'

// Confirmación EN LÍNEA (sin modal) para acciones destructivas. Al aparecer, el foco va a
// "Cancelar" (la opción segura); Escape cancela. Quien la usa devuelve el foco al botón que
// la abrió.
export default function Confirmacion({ pregunta, detalle, textoConfirmar, textoCargando = 'Eliminando…', cargando = false, onConfirmar, onCancelar }) {
  const idPregunta = useId()
  const cancelarRef = useRef(null)

  useEffect(() => {
    cancelarRef.current?.focus()
  }, [])

  return (
    <div
      className="ui-confirmacion"
      role="group"
      aria-labelledby={idPregunta}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') {
          evento.stopPropagation()
          onCancelar()
        }
      }}
    >
      <p id={idPregunta} className="ui-confirmacion__pregunta">
        {pregunta}
      </p>
      {detalle && <p>{detalle}</p>}
      <div className="ui-acciones">
        <Boton ref={cancelarRef} onClick={onCancelar} deshabilitado={cargando}>
          Cancelar
        </Boton>
        <Boton variante="peligro" cargando={cargando} textoCargando={textoCargando} onClick={onConfirmar}>
          {textoConfirmar}
        </Boton>
      </div>
    </div>
  )
}
