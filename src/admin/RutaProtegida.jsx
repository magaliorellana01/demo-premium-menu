import { Navigate, Outlet, useLocation } from 'react-router-dom'
import AccesoProvider from './AccesoProvider'
import PantallaCarga from './PantallaCarga'
import { useSesion } from './useSesion'

// Sin sesión, al login (recordando a dónde quería ir). Con sesión, carga el acceso y muestra la ruta.
// OJO: esto es comodidad, no seguridad. Lo que protege los datos es el RLS de la base.
export default function RutaProtegida() {
  const { cargando, usuario } = useSesion()
  const ubicacion = useLocation()

  if (cargando) return <PantallaCarga />
  if (!usuario) return <Navigate to="/admin/login" replace state={{ volver: ubicacion.pathname }} />

  return (
    <AccesoProvider usuario={usuario}>
      <Outlet />
    </AccesoProvider>
  )
}
