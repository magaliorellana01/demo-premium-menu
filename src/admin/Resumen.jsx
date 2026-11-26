import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { cargarResumen } from './datos'
import { leerLocal } from './datosAjustes'
import { descripcionDeRol, nombreDeRol } from './permisos'
import PrimerosPasos from './PrimerosPasos'
import { primerosPasos } from './pasos'
import { leerQrListo } from './qrListo'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'

// Inicio del local: primeros pasos, estado, cantidad de categorías y de productos, y enlaces.
export default function Resumen() {
  const { local, rol, permisos } = useOutletContext()
  const [resultado, setResultado] = useState(null) // { clave, datos, error } de la última carga terminada
  const [intento, setIntento] = useState(0)
  const clave = `${local.id}:${intento}`

  useEffect(() => {
    let activo = true
    const esta = `${local.id}:${intento}`
    Promise.all([cargarResumen(local.id), leerLocal(local.id)]).then(
      ([cantidades, fila]) => activo && setResultado({ clave: esta, datos: fila && { ...cantidades, fila }, error: !fila }),
      () => activo && setResultado({ clave: esta, datos: null, error: true }),
    )
    return () => {
      activo = false
    }
  }, [local.id, intento])

  // "Cargando" se deduce: todavía no terminó la carga de ESTE local e intento.
  const estado = resultado?.clave === clave ? { cargando: false, error: resultado.error, datos: resultado.datos } : { cargando: true, error: false, datos: null }

  const valor = (campo) => (estado.cargando ? <span className="adm-esqueleto" aria-hidden="true" /> : estado.datos ? estado.datos[campo] : '–')

  const pasos = primerosPasos(estado.datos, { slug: local.slug, activo: local.activo, puedeEditarLocal: permisos.puedeEditarLocal, esAdmin: permisos.esAdmin, qrListo: leerQrListo(local.id) })
  // Sin publicar, la lista va arriba (es lo que hay que hacer); publicado, plegada al final,
  // donde aparecer después de cargar no mueve nada.
  const mostrarPasos = !estado.error

  return (
    <>
      <h1 className="adm-titulo">Inicio</h1>

      {estado.error && (
        <Alerta tipo="error" role="alert" acciones={<Boton onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>}>
          No pudimos cargar el resumen. Revisá tu conexión.
        </Alerta>
      )}

      {mostrarPasos && !local.activo && <PrimerosPasos pasos={pasos} />}

      <section className="adm-bloque" aria-labelledby="titulo-resumen" aria-busy={estado.cargando}>
        <h2 id="titulo-resumen" className="adm-subtitulo">
          Resumen del local
        </h2>
        <dl className="adm-datos">
          <Tarjeta className="adm-dato">
            <dt>Estado</dt>
            <dd>
              <span className={`ui-chip adm-estado ${local.activo ? 'ui-chip--salvia' : 'ui-chip--cobre'}`}>{local.activo ? 'Activo' : 'Inactivo'}</span>
            </dd>
          </Tarjeta>
          <Tarjeta className="adm-dato">
            <dt>Categorías</dt>
            <dd className="adm-dato__numero">{valor('categorias')}</dd>
          </Tarjeta>
          <Tarjeta className="adm-dato">
            <dt>Productos</dt>
            <dd className="adm-dato__numero">{valor('productos')}</dd>
          </Tarjeta>
        </dl>
      </section>

      <Tarjeta como="section" className="adm-bloque" aria-labelledby="titulo-rol">
        <h2 id="titulo-rol" className="adm-subtitulo">
          Tu rol
        </h2>
        <p>
          <strong>{nombreDeRol(rol)}</strong>. {descripcionDeRol(rol)}
        </p>
      </Tarjeta>

      <section className="adm-bloque adm-enlaces" aria-labelledby="titulo-enlaces">
        <h2 id="titulo-enlaces" className="adm-subtitulo">
          Enlaces
        </h2>
        {local.activo ? (
          <div className="ui-acciones">
            <Boton variante="primario" href={`/${local.slug}`} target="_blank" rel="noopener noreferrer">
              Ver el menú público<span className="solo-lectores"> (se abre en otra pestaña)</span>
            </Boton>
          </div>
        ) : (
          <p className="adm-texto--suave">El menú público no se muestra mientras el local esté inactivo.</p>
        )}
        <div className="ui-acciones">
          <Boton to={`/admin/${local.slug}/qr`}>Código QR y tarjeta para imprimir</Boton>
        </div>
      </section>

      {mostrarPasos && local.activo && <PrimerosPasos pasos={pasos} plegada />}
    </>
  )
}
