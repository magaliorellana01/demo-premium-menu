import { useEffect, useMemo, useRef, useState } from 'react'
import { resumenSemana, normalizarHorarios } from '../lib/horarios'
import { COLORES_ORIGINALES, coloresDelTema } from '../lib/tema'
import {
  CAMPOS_COLOR,
  CAMPOS_INFO,
  formularioApariencia,
  formularioAviso,
  formularioHorarios,
  formularioInfo,
  huella,
  idDeAjuste,
  LIMITES,
  localParaVistaPrevia,
  rebasar,
  validarApariencia,
  validarAviso,
  validarHorarios,
  validarInfo,
} from './ajustes'
import CamposApariencia from './CamposApariencia'
import CamposHorarios from './CamposHorarios'
import CamposInfo from './CamposInfo'
import { logoOriginal } from './logo'
import SeccionAjustes from './SeccionAjustes'
import SeccionDatos from './SeccionDatos'
import SeccionLogo from './SeccionLogo'
import Campo from './ui/Campo'
import Interruptor from './ui/Interruptor'
import { useAcceso } from './useAcceso'
import { useCambiosSinGuardar } from './useSalida'
import VistaPrevia from './VistaPrevia'

const FORMULARIOS = { info: formularioInfo, horarios: (f) => formularioHorarios(f.horarios), aviso: formularioAviso, apariencia: formularioApariencia }
const SIN_BORRADORES = { info: null, horarios: null, aviso: null, apariencia: null }
const ETIQUETAS_INFO = { nombre: 'Nombre', descripcion: 'Descripción', direccion: 'Dirección', whatsapp: 'WhatsApp', instagram: 'Instagram' }

function Lectura({ pares }) {
  return (
    <dl className="aj-lectura">
      {pares.map(([nombre, valor]) => (
        <div key={nombre}>
          <dt>{nombre}</dt>
          <dd>{valor || 'Sin cargar'}</dd>
        </div>
      ))}
    </dl>
  )
}

// Cada sección tiene su borrador (null = sin tocar) y se guarda por separado. Los borradores
// viven acá para que la vista previa muestre todo lo que todavía no se guardó.
export default function EditorAjustes({ fila, producto, ponerFila, soloLectura, esAdmin }) {
  const { actualizarLocal } = useAcceso()
  const [borradores, setBorradores] = useState(SIN_BORRADORES)
  const [logo, setLogo] = useState(null)
  // Se arman una vez por fila: las claves de las franjas no cambian en cada dibujo.
  const guardados = useMemo(() => Object.fromEntries(Object.entries(FORMULARIOS).map(([s, armar]) => [s, armar(fila)])), [fila])
  const filaRef = useRef(fila)
  useEffect(() => {
    filaRef.current = fila
  }, [fila])

  const valor = (s) => borradores[s] ?? guardados[s]
  const sucio = (s) => borradores[s] !== null && huella[s](borradores[s]) !== huella[s](guardados[s])
  const secciones = Object.keys(FORMULARIOS)
  useCambiosSinGuardar(!soloLectura && (secciones.some(sucio) || logo !== null))

  // "…/ajustes#titulo-horarios" (primeros pasos): recién ahora la sección existe en la página.
  useEffect(() => {
    if (!/^#titulo-(info|horarios|logo)$/.test(window.location.hash)) return
    const titulo = document.getElementById(window.location.hash.slice(1))
    titulo?.focus({ preventScroll: true })
    titulo?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])

  // La dirección temporal de la vista previa del logo se libera al cambiarla o al salir.
  useEffect(() => {
    const url = logo?.vistaUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [logo?.vistaUrl])

  const cambiar = (s) => (nuevo) => setBorradores((b) => ({ ...b, [s]: nuevo }))
  const descartar = (s) => () => cambiar(s)(null)

  // Llega una fila más nueva (un guardado o un conflicto): lo no tocado toma el valor nuevo.
  const recibirFila = (nueva, guardada = null, enviado = null) => {
    const anterior = filaRef.current
    filaRef.current = nueva
    setBorradores((b) =>
      Object.fromEntries(
        secciones.map((s) => {
          if (b[s] === null || (s === guardada && b[s] === enviado)) return [s, null]
          return [s, rebasar(b[s], FORMULARIOS[s](anterior), FORMULARIOS[s](nueva))]
        }),
      ),
    )
    ponerFila(nueva)
    actualizarLocal(nueva.id, { nombre: nueva.nombre, activo: nueva.activo })
  }

  const comunes = (s) => ({
    nombre: s,
    fila,
    borrador: borradores[s],
    sucio: sucio(s),
    soloLectura,
    onGuardado: (nueva, enviado) => recibirFila(nueva, s, enviado),
    onFilaNueva: (nueva) => recibirFila(nueva),
    onDescartar: descartar(s),
  })

  const vista = localParaVistaPrevia(fila, {
    info: borradores.info,
    horarios: borradores.horarios,
    aviso: borradores.aviso,
    apariencia: borradores.apariencia,
  })
  if (logo?.tipo === 'quitar') vista.logo_url = logoOriginal(fila.slug)
  const logoVista = logo?.tipo === 'nuevo' ? { src: logo.vistaUrl, ancho: logo.ancho, alto: logo.alto } : null

  const horarios = normalizarHorarios(fila.horarios)
  const colores = coloresDelTema(fila.tema)

  return (
    <div className="aj-rejilla">
      <section className="aj-vista" id="vista-previa" aria-labelledby="titulo-vista" tabIndex={-1}>
        <h2 id="titulo-vista" className="adm-subtitulo">
          Vista previa
        </h2>
        <p className="ui-campo__ayuda">Así se va a ver, con lo que todavía no guardaste. No se puede tocar.</p>
        <VistaPrevia local={vista} producto={producto} logoVista={logoVista} />
      </section>

      <div className="aj-secciones">
        <SeccionAjustes
          {...comunes('info')}
          titulo="Información y contacto"
          boton="Guardar información"
          validar={() => validarInfo(valor('info'), fila)}
          lectura={<Lectura pares={CAMPOS_INFO.map((c) => [ETIQUETAS_INFO[c], fila[c]])} />}
        >
          {(errores, limpiarError) => <CamposInfo valor={valor('info')} original={guardados.info} onCambiar={cambiar('info')} errores={errores} limpiarError={limpiarError} />}
        </SeccionAjustes>

        <SeccionAjustes
          {...comunes('horarios')}
          titulo="Horarios"
          descripcion="En hora de Buenos Aires. Para cerrar después de la medianoche, poné la hora de cierre tal cual (por ejemplo 02:00)."
          boton="Guardar horarios"
          validar={() => validarHorarios(valor('horarios'), fila)}
          lectura={horarios ? <Lectura pares={resumenSemana(horarios).map((d) => [d.nombre, d.texto])} /> : <p>Sin horarios cargados.</p>}
        >
          {(errores, limpiarError) => <CamposHorarios valor={valor('horarios')} onCambiar={cambiar('horarios')} errores={errores} limpiarError={limpiarError} />}
        </SeccionAjustes>

        <SeccionAjustes
          {...comunes('aviso')}
          titulo="Aviso"
          descripcion="Una franja corta arriba de la portada."
          boton="Guardar aviso"
          validar={() => validarAviso(valor('aviso'))}
          lectura={<Lectura pares={[['Estado', fila.aviso_activo ? 'Activo' : 'Apagado'], ['Texto', fila.aviso_texto]]} />}
        >
          {(errores, limpiarError) => (
            <>
              <Campo
                id={idDeAjuste('aviso', 'texto')}
                etiqueta="Texto del aviso"
                multilinea
                rows={3}
                value={valor('aviso').texto}
                ayuda={`${valor('aviso').texto.length} de ${LIMITES.aviso} caracteres.`}
                error={errores.texto}
                onChange={(e) => {
                  cambiar('aviso')({ ...valor('aviso'), texto: e.target.value })
                  limpiarError('texto')
                }}
              />
              <div>
                <Interruptor
                  marcado={valor('aviso').activo}
                  etiqueta="Mostrar el aviso en el menú"
                  textoSi="Aviso activo"
                  textoNo="Aviso apagado"
                  onCambiar={(activo) => {
                    cambiar('aviso')({ ...valor('aviso'), activo })
                    limpiarError('texto')
                  }}
                />
              </div>
            </>
          )}
        </SeccionAjustes>

        <SeccionAjustes
          {...comunes('apariencia')}
          titulo="Apariencia"
          descripcion="Elegís cuatro colores; el resto se calcula para que se lea. Mirá la vista previa antes de guardar."
          boton="Guardar apariencia"
          validar={() => validarApariencia(valor('apariencia'))}
          lectura={
            <Lectura
              pares={[
                ['Frase', fila.tema?.frase],
                ...CAMPOS_COLOR.map((c) => [c.nombre, `${colores[c.clave].toUpperCase()}${colores[c.clave] === COLORES_ORIGINALES[c.clave] ? ' (original)' : ''}`]),
              ]}
            />
          }
        >
          {(errores, limpiarError) => <CamposApariencia valor={valor('apariencia')} onCambiar={cambiar('apariencia')} errores={errores} limpiarError={limpiarError} />}
        </SeccionAjustes>

        <SeccionLogo
          fila={fila}
          tema={vista.tema}
          elegido={logo}
          onElegir={setLogo}
          onGuardado={(nueva) => recibirFila(nueva)}
          onFilaNueva={(nueva) => recibirFila(nueva)}
          soloLectura={soloLectura}
        />

        <SeccionDatos fila={fila} esAdmin={esAdmin} onGuardado={(nueva) => recibirFila(nueva)} onFilaNueva={(nueva) => recibirFila(nueva)} />

        <a className="aj-subir" href="#vista-previa">
          Volver a la vista previa
        </a>
      </div>
    </div>
  )
}
