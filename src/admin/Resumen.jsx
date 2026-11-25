import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { cargarResumen } from './datos'
import { descripcionDeRol, nombreDeRol } from './permisos'

// Inicio del local: estado, cantidad de categorías y de productos, y enlaces útiles.
export default function Resumen() {
  const { local, rol } = useOutletContext()
  const [resultado, setResultado] = useState(null) // { clave, datos, error } de la última carga terminada
  const [intento, setIntento] = useState(0)
  const clave = `${local.id}:${intento}`

  useEffect(() => {
    let activo = true
    const esta = `${local.id}:${intento}`
    cargarResumen(local.id).then(
      (datos) => activo && setResultado({ clave: esta, datos, error: false }),
      () => activo && setResultado({ clave: esta, datos: null, error: true }),
    )
    return () => {
      activo = false
    }
  }, [local.id, intento])

  // "Cargando" se deduce: todavía no terminó la carga de ESTE local e intento.
  const estado = resultado?.clave === clave ? { cargando: false, error: resultado.error, datos: resultado.datos } : { cargando: true, error: false, datos: null }

  const valor = (campo) => (estado.cargando ? <span className="adm-esqueleto" aria-hidden="true" /> : estado.datos ? estado.datos[campo] : '–')

  return (
    <>
      <h1 className="adm-titulo">Inicio</h1>

      <section aria-labelledby="titulo-resumen" aria-busy={estado.cargando}>
        <h2 id="titulo-resumen" className="adm-subtitulo">
          Resumen del local
        </h2>
        <dl className="adm-datos">
          <div className="adm-dato">
            <dt>Estado</dt>
            <dd>
              <span className={`adm-estado ${local.activo ? 'adm-estado--activo' : 'adm-estado--inactivo'}`}>{local.activo ? 'Activo' : 'Inactivo'}</span>
            </dd>
          </div>
          <div className="adm-dato">
            <dt>Categorías</dt>
            <dd className="adm-dato__numero">{valor('categorias')}</dd>
          </div>
          <div className="adm-dato">
            <dt>Productos</dt>
            <dd className="adm-dato__numero">{valor('productos')}</dd>
          </div>
        </dl>
        {estado.error && (
          <p className="adm-error-bloque" role="alert">
            No pudimos cargar el resumen.{' '}
            <button type="button" className="adm-enlace adm-enlace--boton" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </button>
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-rol">
        <h2 id="titulo-rol" className="adm-subtitulo">
          Tu rol
        </h2>
        <p className="adm-texto">
          <strong>{nombreDeRol(rol)}</strong>. {descripcionDeRol(rol)}
        </p>
      </section>

      <section aria-labelledby="titulo-enlaces">
        <h2 id="titulo-enlaces" className="adm-subtitulo">
          Enlaces
        </h2>
        <ul className="adm-enlaces" role="list">
          <li>
            {local.activo ? (
              <a className="adm-boton" href={`/${local.slug}`} target="_blank" rel="noopener noreferrer">
                Ver el menú público
                <span className="solo-lectores"> (se abre en otra pestaña)</span>
              </a>
            ) : (
              <p className="adm-texto adm-texto--suave">El menú público no se muestra mientras el local esté inactivo.</p>
            )}
          </li>
          <li>
            <p className="adm-texto adm-texto--suave">
              <strong>Página del QR:</strong> próximamente.
            </p>
          </li>
        </ul>
      </section>
    </>
  )
}
