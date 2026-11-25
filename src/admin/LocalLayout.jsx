import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import Encabezado from './Encabezado'
import SinAcceso from './SinAcceso'
import { useAcceso, usePermisos } from './useAcceso'
import { useFocoSinTapar } from './useFocoSinTapar'

const SECCIONES = [
  { ruta: '', nombre: 'Inicio', fin: true },
  { ruta: 'categorias', nombre: 'Categorías' },
  { ruta: 'productos', nombre: 'Productos' },
  { ruta: 'ajustes', nombre: 'Ajustes' },
]

// /admin/:slug: encabezado (local, quién ingresó y su rol, salir), navegación y la página elegida.
// En el celular la navegación es una barra abajo (a mano del pulgar); desde tablet, arriba.
// Sin permiso sobre ese local muestra "No tenés acceso" (no dice si el local existe).
export default function LocalLayout() {
  const { slug } = useParams()
  const permisos = usePermisos(slug)
  const { acceso } = useAcceso()
  const ubicacion = useLocation()
  const principalRef = useRef(null)
  const primeraVez = useRef(true)
  const barraRef = useRef(null)
  useFocoSinTapar(barraRef)

  // Al cambiar de sección el foco pasa al contenido (el lector de pantalla se entera del cambio).
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    principalRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
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

      <Encabezado rol={rol}>
        <div className="adm-local">
          <p className="adm-local__nombre">{local.nombre}</p>
          {!local.activo && <span className="ui-chip ui-chip--cobre adm-estado">Inactivo</span>}
          {puedeCambiar && (
            <Link className="adm-cambiar" to="/admin">
              Cambiar de local
            </Link>
          )}
        </div>
      </Encabezado>

      <nav className="adm-pestanas" aria-label="Secciones del panel" ref={barraRef}>
        <ul className="adm-pestanas__lista" role="list">
          {SECCIONES.map((seccion) => (
            <li key={seccion.nombre}>
              <NavLink className="adm-pestana" to={seccion.ruta ? `/admin/${local.slug}/${seccion.ruta}` : `/admin/${local.slug}`} end={seccion.fin}>
                {seccion.nombre}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="adm-contenido" id="contenido" ref={principalRef} tabIndex={-1}>
        <Outlet context={{ local, rol, permisos }} />
      </main>
    </div>
  )
}
