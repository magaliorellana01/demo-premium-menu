import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import BarraUsuario from './BarraUsuario'
import SinAcceso from './SinAcceso'
import { useAcceso, usePermisos } from './useAcceso'

const SECCIONES = [
  { ruta: '', nombre: 'Inicio', fin: true },
  { ruta: 'categorias', nombre: 'Categorías' },
  { ruta: 'productos', nombre: 'Productos' },
  { ruta: 'ajustes', nombre: 'Ajustes' },
]

// /admin/:slug: encabezado (local, quién ingresó y su rol, salir), navegación y la página elegida.
// Sin permiso sobre ese local muestra "No tenés acceso" (no dice si el local existe).
export default function LocalLayout() {
  const { slug } = useParams()
  const permisos = usePermisos(slug)
  const { acceso } = useAcceso()
  const ubicacion = useLocation()
  const principalRef = useRef(null)
  const primeraVez = useRef(true)

  // Al cambiar de sección el foco pasa al contenido (el lector de pantalla se entera del cambio).
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    principalRef.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [ubicacion.pathname])

  const { local, rol } = permisos
  if (!local) return <SinAcceso />

  const seccionActual = SECCIONES.find((s) => s.ruta && ubicacion.pathname.endsWith(`/${s.ruta}`)) ?? SECCIONES[0]
  const puedeCambiar = acceso.esAdmin || acceso.locales.length > 1

  return (
    <div className="adm-pagina">
      <title>{`${seccionActual.nombre} · ${local.nombre} · Panel`}</title>
      <a className="adm-saltar" href="#contenido">
        Saltar al contenido
      </a>

      <header className="adm-cabecera">
        <div className="adm-cabecera__fila">
          <p className="adm-marca">
            OESTACK <span>Panel</span>
          </p>
          <BarraUsuario rol={rol} />
        </div>

        <div className="adm-local">
          <p className="adm-local__nombre">{local.nombre}</p>
          {!local.activo && <span className="adm-estado adm-estado--inactivo">Inactivo</span>}
          {puedeCambiar && (
            <Link className="adm-enlace" to="/admin">
              Cambiar de local
            </Link>
          )}
        </div>

        <nav className="adm-nav" aria-label="Secciones del panel">
          <ul className="adm-nav__lista" role="list">
            {SECCIONES.map((seccion) => (
              <li key={seccion.nombre}>
                <NavLink className="adm-nav__enlace" to={seccion.ruta ? `/admin/${local.slug}/${seccion.ruta}` : `/admin/${local.slug}`} end={seccion.fin}>
                  {seccion.nombre}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="adm-contenido" id="contenido" ref={principalRef} tabIndex={-1}>
        <Outlet context={{ local, rol, permisos }} />
      </main>
    </div>
  )
}
