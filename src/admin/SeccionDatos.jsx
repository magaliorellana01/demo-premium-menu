import { useRef, useState } from 'react'
import { mensajeDeErrorAjustes } from './ajustes'
import { guardarLocal } from './datosAjustes'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import Confirmacion from './ui/Confirmacion'
import Tarjeta from './ui/Tarjeta'

// Datos que no se editan: la dirección del menú (está impresa en los códigos QR) y el estado,
// que solo cambia un admin de OESTACK (la base lo exige con un trigger).
export default function SeccionDatos({ fila, esAdmin, onGuardado, onFilaNueva }) {
  const enlace = `${window.location.origin}/${fila.slug}`
  const enlaceRef = useRef(null)
  const botonRef = useRef(null)
  const [copiado, setCopiado] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')
  const [estado, setEstado] = useState('')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado('Enlace copiado.')
    } catch {
      // Sin permiso o sin HTTPS: queda seleccionado para copiarlo a mano.
      enlaceRef.current?.focus()
      enlaceRef.current?.select()
      setCopiado('No pudimos copiarlo solo. Quedó seleccionado: copialo con el menú del teléfono o Ctrl+C.')
    }
  }

  const cambiarEstado = async () => {
    setGuardando(true)
    setFallo('')
    try {
      onGuardado(await guardarLocal(fila, { activo: !fila.activo }))
      setEstado(fila.activo ? 'Guardado. El local quedó inactivo.' : 'Guardado. El local quedó activo.')
    } catch (error) {
      if (error.code === 'CONFLICTO') onFilaNueva(error.actual)
      setFallo(mensajeDeErrorAjustes(error))
    }
    setGuardando(false)
    setConfirmando(false)
    botonRef.current?.focus()
  }

  return (
    <Tarjeta como="section" className="aj-seccion" aria-labelledby="titulo-datos" data-seccion="datos">
      <h2 id="titulo-datos" className="adm-subtitulo aj-seccion__titulo">
        Tu enlace y estado
      </h2>
      <div className="aj-form">
        <Campo ref={enlaceRef} etiqueta="Enlace del menú" value={enlace} readOnly onFocus={(e) => e.target.select()} />
        <div className="ui-acciones">
          <Boton onClick={copiar}>Copiar enlace</Boton>
          <Boton variante="fantasma" href={`/${fila.slug}`} target="_blank" rel="noopener">
            Ver el menú<span className="solo-lectores"> (se abre en otra pestaña)</span>
          </Boton>
        </div>
        <p className="aj-estado" role="status">
          {copiado}
        </p>
        <Campo etiqueta="Nombre en la dirección (slug)" value={fila.slug} readOnly ayuda="No se puede cambiar desde el panel: los códigos QR impresos dejarían de funcionar." />

        <p>
          Estado: <span className={`ui-chip adm-estado ${fila.activo ? 'ui-chip--salvia' : 'ui-chip--cobre'}`}>{fila.activo ? 'Activo' : 'Inactivo'}</span>
        </p>
        <p className="ui-campo__ayuda">
          {fila.activo ? 'El menú está publicado.' : 'El menú no se muestra mientras el local esté inactivo.'}
          {!esAdmin && ' Solo OESTACK puede cambiarlo.'}
        </p>

        {esAdmin &&
          (confirmando ? (
            <Confirmacion
              pregunta={fila.activo ? '¿Desactivar el local?' : '¿Activar el local?'}
              detalle={fila.activo ? 'El menú público deja de verse y los códigos QR muestran que no existe.' : 'El menú público queda visible para cualquiera.'}
              textoConfirmar={fila.activo ? 'Sí, desactivar' : 'Sí, activar'}
              textoCargando="Guardando…"
              cargando={guardando}
              onConfirmar={cambiarEstado}
              onCancelar={() => {
                setConfirmando(false)
                requestAnimationFrame(() => botonRef.current?.focus())
              }}
            />
          ) : (
            <Boton ref={botonRef} className="aj-form__corto" onClick={() => setConfirmando(true)}>
              {fila.activo ? 'Desactivar local' : 'Activar local'}
            </Boton>
          ))}
        {fallo && (
          <Alerta tipo="error" role="alert">
            {fallo}
          </Alerta>
        )}
        {esAdmin && (
          <p className="aj-estado" role="status">
            {estado}
          </p>
        )}
      </div>
    </Tarjeta>
  )
}
