import { useEffect, useRef, useState } from 'react'
import { ACEPTA, pesoLegible, SIN_CAMBIOS } from './fotos'
import { esErrorDeFoto, hexAleatorio, procesarFoto } from './procesarFoto'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'

// Foto del producto con vista previa 4:5 ANTES de guardar. Acá solo se prepara en el
// navegador: se sube recién al tocar "Guardar".
//   foto:       { tipo: 'igual' } | { tipo: 'quitar' } | { tipo: 'nueva', blobs, extension, vistaUrl, chica, id }
//   urlActual:  la que el producto tiene guardada (o null)
export default function SelectorFoto({ foto, urlActual, bloqueado, onCambiar, onPreparando }) {
  const entradaRef = useRef(null)
  const elegirRef = useRef(null)
  const turno = useRef(0)
  const [preparando, setPreparando] = useState(false)
  const [error, setError] = useState('')

  // La dirección temporal de la vista previa se libera al cambiarla o al salir.
  useEffect(() => {
    const url = foto.vistaUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [foto.vistaUrl])

  // Si se sale de la pantalla mientras se prepara, el resultado se descarta.
  useEffect(
    () => () => {
      turno.current += 1
    },
    [],
  )

  const alElegir = async (evento) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    const esteTurno = ++turno.current
    setError('')
    setPreparando(true)
    onPreparando(true)
    try {
      const { blobs, extension, chica } = await procesarFoto(archivo)
      if (esteTurno !== turno.current) return
      onCambiar({ tipo: 'nueva', blobs, extension, chica, vistaUrl: URL.createObjectURL(blobs[0]), id: hexAleatorio() })
    } catch (e) {
      if (esteTurno !== turno.current) return
      setError(esErrorDeFoto(e) ? e.message : 'No pudimos preparar esa foto. Probá con otra.')
    }
    setPreparando(false)
    onPreparando(false)
  }

  const vista = foto.tipo === 'nueva' ? foto.vistaUrl : foto.tipo === 'igual' ? urlActual : null
  let estado = ''
  if (preparando) estado = 'Preparando la foto…'
  else if (foto.tipo === 'nueva') estado = `Foto lista (${pesoLegible(foto.blobs[0].size)}). Se sube cuando tocás “Guardar”.`
  else if (foto.tipo === 'quitar') estado = 'La foto se quita cuando tocás “Guardar”.'

  return (
    <fieldset className="foto">
      <legend className="ui-campo__etiqueta">Foto (opcional)</legend>
      <div className="foto__vista">
        {vista ? <img src={vista} alt="Vista previa de la foto, recortada como en el menú" width="480" height="600" /> : <span className="foto__vacia">Sin foto</span>}
      </div>
      <div className="foto__lado">
        <p className="ui-campo__ayuda">JPG, PNG o WebP de hasta 10 MB. Se recorta al centro, como en las tarjetas del menú.</p>
        <input ref={entradaRef} className="foto__entrada" type="file" accept={ACEPTA} onChange={alElegir} tabIndex={-1} aria-hidden="true" />
        <div className="ui-acciones">
          <Boton ref={elegirRef} cargando={preparando} textoCargando="Preparando…" deshabilitado={bloqueado} onClick={() => entradaRef.current?.click()}>
            {vista ? 'Elegir otra foto' : 'Elegir foto'}
          </Boton>
          {vista && (
            <Boton
              variante="fantasma"
              deshabilitado={bloqueado || preparando}
              onClick={() => {
                setError('')
                // Una foto sin guardar sobre un producto sin foto: quitarla es no cambiar nada.
                onCambiar(urlActual ? { tipo: 'quitar' } : SIN_CAMBIOS)
                elegirRef.current?.focus()
              }}
            >
              Quitar foto
            </Boton>
          )}
          {foto.tipo !== 'igual' && urlActual && (
            <Boton
              variante="fantasma"
              deshabilitado={bloqueado || preparando}
              onClick={() => {
                onCambiar(SIN_CAMBIOS)
                elegirRef.current?.focus()
              }}
            >
              Volver a la foto actual
            </Boton>
          )}
        </div>
        <p className="foto__estado" role="status">
          {estado}
        </p>
        {foto.tipo === 'nueva' && foto.chica && <p className="ui-campo__ayuda">La foto original es chica: puede verse poco nítida.</p>}
        {error && (
          <Alerta tipo="error" role="alert">
            {error}
          </Alerta>
        )}
      </div>
    </fieldset>
  )
}
