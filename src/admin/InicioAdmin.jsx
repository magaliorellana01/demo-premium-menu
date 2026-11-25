import { Link, Navigate } from 'react-router-dom'
import BarraUsuario from './BarraUsuario'
import { destinoInicial, nombreDeRol } from './permisos'
import { useAcceso } from './useAcceso'

// /admin: con un único local (y sin ser admin de OESTACK) va directo; si no, se elige.
export default function InicioAdmin() {
  const { acceso } = useAcceso()
  const destino = destinoInicial(acceso)

  if (destino.tipo === 'local') return <Navigate to={`/admin/${destino.slug}`} replace />

  return (
    <div className="adm-pagina">
      <title>Panel · OESTACK</title>
      <header className="adm-cabecera adm-cabecera--simple">
        <div className="adm-cabecera__fila">
          <p className="adm-marca">
            OESTACK <span>Panel</span>
          </p>
          <BarraUsuario rol={acceso.esAdmin ? 'admin' : null} />
        </div>
      </header>

      <main className="adm-contenido adm-contenido--angosto" id="contenido">
        {destino.tipo === 'sin-locales' ? (
          <section className="adm-tarjeta adm-tarjeta--aviso">
            <h1 className="adm-titulo">Todavía no tenés un local asignado</h1>
            <p className="adm-texto">Pedile a OESTACK que te dé acceso a tu local y volvé a ingresar.</p>
          </section>
        ) : (
          <section aria-labelledby="titulo-elegir">
            <h1 id="titulo-elegir" className="adm-titulo">
              Elegí un local
            </h1>
            <ul className="adm-lista" role="list">
              {acceso.locales.map((local) => (
                <li key={local.id}>
                  <Link className="adm-fila-local" to={`/admin/${local.slug}`}>
                    <span className="adm-fila-local__nombre">{local.nombre}</span>
                    <span className="adm-fila-local__meta">
                      {!local.activo && <span className="adm-estado adm-estado--inactivo">Inactivo</span>}
                      {!acceso.esAdmin && <span className="adm-rol" data-rol={local.rol}>{nombreDeRol(local.rol)}</span>}
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
