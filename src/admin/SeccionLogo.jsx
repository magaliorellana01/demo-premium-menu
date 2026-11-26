import { useEffect, useMemo, useRef, useState } from 'react'
import { logoDePortada } from '../lib/imagenes'
import { coloresDelTema, portadaClara } from '../lib/tema'
import { mensajeDeErrorAjustes } from './ajustes'
import { guardarLocal, leerLocal } from './datosAjustes'
import { apiDeProductos } from './datosProductos'
import { pesoLegible } from './fotos'
import { ACEPTA_LOGO, analizarLogo, guardarLogo, logoOriginal, nombreDeLogo, rutaDeLogoDesdeUrl } from './logo'
import { esErrorDeFoto, hexAleatorio } from './procesarFoto'
import { procesarLogo } from './procesarLogo'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'

// Logo del local. Se prepara en el navegador (recorte de bordes transparentes y tamaño) y se
// sube recién al tocar "Guardar logo". `elegido` vive en la página para la vista previa.
//   elegido: null | { tipo: 'nuevo', blob, extension, ancho, alto, pixeles, transparente, vistaUrl }
//                 | { tipo: 'quitar' }
export default function SeccionLogo({ fila, tema, elegido, onElegir, onGuardado, onFilaNueva, soloLectura }) {
  const entradaRef = useRef(null)
  const elegirRef = useRef(null)
  const turno = useRef(0)
  const montado = useRef(true)
  const pendientes = useRef(new Set())
  const focoPendiente = useRef(null)
  const [preparando, setPreparando] = useState(false)
  const [paso, setPaso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('') // al preparar el archivo
  const [fallo, setFallo] = useState(null) // al guardar: { mensaje, huerfanos, enDuda }
  const [estado, setEstado] = useState('')
  const api = useMemo(() => apiDeProductos(fila.id), [fila.id]) // se usa su parte de Storage

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      turno.current += 1
    }
  }, [])

  useEffect(() => {
    const id = focoPendiente.current
    if (!id) return
    focoPendiente.current = null
    document.getElementById(id)?.focus()
  })

  const colorPortada = coloresDelTema(tema).portada
  const propio = rutaDeLogoDesdeUrl(fila.logo_url, api.supabaseUrl, fila.id) !== null
  const original = logoOriginal(fila.slug)
  const guardado = logoDePortada(fila.logo_url, portadaClara(tema))
  const aQuitar = elegido?.tipo === 'quitar' ? logoDePortada(original, portadaClara(tema)) : null
  const vista = elegido?.tipo === 'nuevo' ? { src: elegido.vistaUrl, ancho: elegido.ancho, alto: elegido.alto } : elegido ? aQuitar : guardado

  const pocoVisible = useMemo(
    () => (elegido?.tipo === 'nuevo' ? analizarLogo(elegido.pixeles, colorPortada).visible < 0.4 : false),
    [elegido, colorPortada],
  )

  const alElegir = async (evento) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    const este = ++turno.current
    setError('')
    setFallo(null)
    setEstado('')
    setPreparando(true)
    try {
      const listo = await procesarLogo(archivo)
      if (este !== turno.current) return
      onElegir({ tipo: 'nuevo', ...listo, vistaUrl: URL.createObjectURL(listo.blob) })
    } catch (e) {
      if (este !== turno.current) return
      setError(esErrorDeFoto(e) ? e.message : 'No pudimos preparar ese archivo. Probá con otro.')
    }
    setPreparando(false)
  }

  const guardar = async () => {
    if (!elegido || guardando || preparando) return
    setFallo(null)
    setEstado('')
    setGuardando(true)
    const cambio =
      elegido.tipo === 'nuevo'
        ? // Nombre único en cada intento: nunca se pisa un archivo ni se sirve uno viejo de la caché.
          { tipo: 'nuevo', blob: elegido.blob, nombre: nombreDeLogo(`${hexAleatorio()}${Date.now().toString(36)}`, elegido.ancho, elegido.alto, elegido.extension) }
        : { tipo: 'quitar', url: original }
    try {
      const { fila: nueva, huerfanos } = await guardarLogo({
        api,
        localId: fila.id,
        cambio,
        anteriorUrl: fila.logo_url,
        guardar: (logo_url) => guardarLocal(fila, { logo_url }),
        leer: () => leerLocal(fila.id),
        pendientes: [...pendientes.current],
        alPaso: (texto) => montado.current && setPaso(texto),
      })
      pendientes.current.clear()
      if (huerfanos.length) console.warn('Archivos sin borrar en Storage:', huerfanos)
      onGuardado(nueva)
      if (!montado.current) return
      onElegir(null)
      setEstado(huerfanos.length ? 'Guardado. El logo anterior no se pudo borrar: avisale a OESTACK.' : 'Guardado. Ya se ve en el menú.')
      focoPendiente.current = 'titulo-logo'
    } catch (e) {
      if (e.urlEnDuda) pendientes.current.add(e.urlEnDuda)
      if (e.huerfanos?.length) console.warn('Archivos sin borrar en Storage:', e.huerfanos)
      if (!montado.current) return
      if (e.code === 'CONFLICTO') onFilaNueva(e.actual)
      setFallo({ mensaje: mensajeDeErrorAjustes(e), huerfanos: e.huerfanos ?? [], enDuda: Boolean(e.urlEnDuda) })
      focoPendiente.current = 'ajuste-logo-fallo'
    }
    setGuardando(false)
    setPaso('')
  }

  const descartar = () => {
    onElegir(null)
    setError('')
    setFallo(null)
    elegirRef.current?.focus()
  }

  const mensaje = paso || (preparando ? 'Preparando el logo…' : '') ||
    (elegido?.tipo === 'nuevo' ? `Logo listo (${elegido.ancho} × ${elegido.alto}, ${pesoLegible(elegido.blob.size)}). Hay cambios sin guardar.` : '') ||
    (elegido?.tipo === 'quitar' ? 'Hay cambios sin guardar.' : '') || estado

  return (
    <Tarjeta como="section" className="aj-seccion" aria-labelledby="titulo-logo" data-seccion="logo">
      <h2 id="titulo-logo" className="adm-subtitulo aj-seccion__titulo" tabIndex={-1}>
        Logo
      </h2>
      <div className="aj-form">
        <div className="aj-logo__vista" style={{ background: colorPortada }}>
          {vista ? (
            <img src={vista.src} alt={elegido ? 'Vista previa del logo sobre la portada' : 'Logo actual sobre la portada'} width={vista.ancho} height={vista.alto} />
          ) : (
            <span className="aj-logo__sin">Sin logo: el menú muestra el nombre del local.</span>
          )}
        </div>

        {!soloLectura && (
          <>
            <p className="ui-campo__ayuda">
              PNG, WebP o JPG de hasta 10 MB. Mejor con fondo transparente y en un color que contraste con la portada. Recortamos los bordes vacíos sin deformarlo.
            </p>
            <input ref={entradaRef} className="foto__entrada" type="file" accept={ACEPTA_LOGO} onChange={alElegir} tabIndex={-1} aria-hidden="true" data-entrada="logo" />
            <div className="ui-acciones">
              <Boton ref={elegirRef} cargando={preparando} textoCargando="Preparando…" deshabilitado={guardando} onClick={() => entradaRef.current?.click()}>
                {elegido?.tipo === 'nuevo' ? 'Elegir otro archivo' : 'Elegir logo'}
              </Boton>
              {propio && !elegido && (
                <Boton
                  variante="fantasma"
                  deshabilitado={guardando || preparando}
                  onClick={() => {
                    setEstado('')
                    onElegir({ tipo: 'quitar' })
                    focoPendiente.current = 'ajuste-logo-guardar'
                  }}
                >
                  {original ? 'Volver al logo original' : 'Quitar logo'}
                </Boton>
              )}
            </div>

            {elegido?.tipo === 'nuevo' && !elegido.transparente && (
              <Alerta tipo="info">Este archivo no tiene fondo transparente: se va a ver como un rectángulo sobre la portada.</Alerta>
            )}
            {pocoVisible && <Alerta tipo="info">Casi no se distingue sobre el color de tu portada. Probá con una versión del logo en otro color.</Alerta>}
            {error && (
              <Alerta tipo="error" role="alert">
                {error}
              </Alerta>
            )}
            {fallo && (
              <div id="ajuste-logo-fallo" tabIndex={-1} className="prod-form__fallo">
                <Alerta
                  tipo="error"
                  role="alert"
                  titulo={fallo.mensaje}
                  acciones={
                    <Boton variante="primario" onClick={guardar}>
                      Reintentar
                    </Boton>
                  }
                >
                  El logo que elegiste sigue acá.
                  {fallo.enDuda && ' No pudimos confirmar si el cambio llegó a guardarse: no borramos ningún archivo.'}
                  {fallo.huerfanos.length > 0 && (
                    <>
                      {' '}
                      Estos archivos pueden haber quedado sin usar:
                      <ul className="prod-archivos">
                        {fallo.huerfanos.map((ruta) => (
                          <li key={ruta}>{ruta}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </Alerta>
              </div>
            )}

            <div className="aj-pie">
              <div className="ui-acciones">
                <Boton id="ajuste-logo-guardar" variante="primario" cargando={guardando} textoCargando="Guardando…" deshabilitado={!elegido || preparando} onClick={guardar}>
                  Guardar logo
                </Boton>
                {elegido && (
                  <Boton variante="fantasma" deshabilitado={guardando} onClick={descartar}>
                    Descartar cambios
                  </Boton>
                )}
              </div>
              <p className="aj-estado" role="status">
                {mensaje}
              </p>
              {guardando && <progress className="aj-progreso" aria-label="Guardando el logo" />}
            </div>
          </>
        )}
      </div>
    </Tarjeta>
  )
}
