import { Link, Navigate } from 'react-router-dom'
import Encabezado from './Encabezado'
import { destinoInicial, nombreDeRol } from './permisos'
import Tarjeta from './ui/Tarjeta'
import { useAcceso } from './useAcceso'

// /admin: con un único local (y sin ser admin de OESTACK) va directo; si no, se elige.
export default function InicioAdmin() {
  const { acceso } = useAcceso()
  const destino = destinoInicial(acceso)

  if (destino.tipo === 'local') return <Navigate to={`/admin/${destino.slug}`} replace />

  return (
    <div className="adm-pagina">
      <title>Panel · OESTACK</title>
      <Encabezado rol={acceso.esAdmin ? 'admin' : null} />

      <main className="adm-contenido adm-contenido--sin-pestanas" id="contenido">
        {destino.tipo === 'sin-locales' ? (
          <Tarjeta como="section" className="adm-bloque">
            <h1 className="adm-titulo">Todavía no tenés un local asignado</h1>
            <p>Pedile a OESTACK que te dé acceso a tu local y volvé a ingresar.</p>
          </Tarjeta>
        ) : (
          <section className="adm-bloque" aria-labelledby="titulo-elegir">
            <h1 id="titulo-elegir" className="adm-titulo">
              Elegí un local
            </h1>
            <ul className="adm-lista" role="list">
              {acceso.locales.map((local) => (
                <li key={local.id}>
                  <Link className="ui-tarjeta adm-fila-local" to={`/admin/${local.slug}`}>
                    <span className="adm-fila-local__nombre">{local.nombre}</span>
                    <span className="adm-fila-local__meta">
                      {!local.activo && <span className="ui-chip ui-chip--cobre adm-estado">Inactivo</span>}
                      {!acceso.esAdmin && (
                        <span className="ui-chip adm-rol-chip" data-rol={local.rol}>
                          {nombreDeRol(local.rol)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
