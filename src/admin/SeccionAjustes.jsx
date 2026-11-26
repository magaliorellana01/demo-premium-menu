import { useEffect, useRef, useState } from 'react'
import { cambiosReales, idDeAjuste, mensajeDeErrorAjustes } from './ajustes'
import { guardarLocal } from './datosAjustes'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'

/**
 * Una sección que se guarda sola: valida, guarda sin pisar cambios de otro equipo y muestra
 * "Guardando…", "Guardado" o el error. Si falla, lo escrito queda como estaba.
 *   validar() -> { ok, errores, primerError, cambios }
 *   children(errores, limpiarError)
 *   onGuardado(fila, enviado)  ·  onFilaNueva(fila) en un conflicto  ·  onDescartar()
 * En modo lectura (soloLectura) muestra `lectura`, sin controles.
 */
export default function SeccionAjustes({ nombre, titulo, descripcion, boton, fila, borrador, sucio, validar, onGuardado, onFilaNueva, onDescartar, soloLectura, lectura, children }) {
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(null) // { mensaje, conflicto }
  const [estado, setEstado] = useState('') // "Guardado." hasta que se vuelve a editar
  const focoPendiente = useRef(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    const id = focoPendiente.current
    if (!id) return
    focoPendiente.current = null
    document.getElementById(id)?.focus()
  })

  const limpiarError = (...claves) =>
    setErrores((e) => (claves.some((c) => e[c]) ? Object.fromEntries(Object.entries(e).filter(([c]) => !claves.includes(c))) : e))

  const descartar = () => {
    setErrores({})
    setFallo(null)
    setEstado('')
    onDescartar()
    focoPendiente.current = `titulo-${nombre}` // el botón desaparece
  }

  const guardar = async (evento) => {
    evento.preventDefault()
    if (guardando || !sucio) return
    const revision = validar()
    setErrores(revision.errores)
    setEstado('')
    if (!revision.ok) {
      setFallo(null)
      focoPendiente.current = idDeAjuste(nombre, revision.primerError)
      return
    }
    const cambios = cambiosReales(revision.cambios, fila)
    setFallo(null)
    if (Object.keys(cambios).length === 0) {
      onDescartar()
      setEstado('No había cambios para guardar.')
      return
    }
    const enviado = borrador
    setGuardando(true)
    try {
      const nueva = await guardarLocal(fila, cambios)
      // Aunque se haya cambiado de pantalla, la página tiene que enterarse (nombre del local).
      onGuardado(nueva, enviado)
      if (!montado.current) return
      setEstado('Guardado. Ya se ve en el menú.')
      focoPendiente.current = `titulo-${nombre}`
    } catch (error) {
      if (!montado.current) return
      const conflicto = error.code === 'CONFLICTO'
      if (conflicto) onFilaNueva(error.actual)
      setFallo({ mensaje: mensajeDeErrorAjustes(error), conflicto })
      focoPendiente.current = idDeAjuste(nombre, 'fallo')
    }
    setGuardando(false)
  }

  return (
    <Tarjeta como="section" className="aj-seccion" aria-labelledby={`titulo-${nombre}`} data-seccion={nombre}>
      <h2 id={`titulo-${nombre}`} className="adm-subtitulo aj-seccion__titulo" tabIndex={-1}>
        {titulo}
      </h2>
      {descripcion && <p className="adm-texto--suave aj-seccion__descripcion">{descripcion}</p>}

      {soloLectura ? (
        lectura
      ) : (
        <form className="aj-form" onSubmit={guardar} noValidate>
          {children(errores, limpiarError)}

          {fallo && (
            <div id={idDeAjuste(nombre, 'fallo')} tabIndex={-1} className="prod-form__fallo">
              <Alerta
                tipo="error"
                role="alert"
                titulo={fallo.mensaje}
                acciones={
                  fallo.conflicto ? (
                    <>
                      <Boton variante="primario" onClick={descartar}>
                        Usar los datos nuevos
                      </Boton>
                      <Boton type="submit">Guardar mi versión</Boton>
                    </>
                  ) : (
                    <Boton variante="primario" type="submit">
                      Reintentar
                    </Boton>
                  )
                }
              >
                {fallo.conflicto
                  ? 'Lo que escribiste sigue acá. Podés quedarte con lo que se guardó desde el otro equipo o reemplazarlo con tu versión.'
                  : 'Lo que escribiste sigue acá.'}
              </Alerta>
            </div>
          )}

          <div className="aj-pie">
            <div className="ui-acciones">
              <Boton variante="primario" type="submit" cargando={guardando} textoCargando="Guardando…" deshabilitado={!sucio}>
                {boton}
              </Boton>
              {sucio && (
                <Boton variante="fantasma" deshabilitado={guardando} onClick={descartar}>
                  Descartar cambios
                </Boton>
              )}
            </div>
            <p className="aj-estado" role="status">
              {guardando ? 'Guardando…' : sucio ? 'Hay cambios sin guardar.' : estado}
            </p>
          </div>
        </form>
      )}
    </Tarjeta>
  )
}
