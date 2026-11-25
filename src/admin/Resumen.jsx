import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { cargarResumen } from './datos'
import { descripcionDeRol, nombreDeRol } from './permisos'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'

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
        {estado.error && (
          <Alerta tipo="error" role="alert" acciones={<Boton onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>}>
            No pudimos cargar el resumen. Revisá tu conexión.
          </Alerta>
        )}
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
        <p className="adm-texto--suave">
          <strong>Página del QR:</strong> próximamente.
        </p>
      </section>
    </>
  )
}
