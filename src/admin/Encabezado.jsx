import { NavLink } from 'react-router-dom'
import BarraUsuario from './BarraUsuario'
import { AVISO_DEMO } from './demo'
import { esSesionDemo } from './entornoDemo'
import { useAcceso } from './useAcceso'
import { useSesion } from './useSesion'

// Encabezado del panel (superficie espresso): quién ingresó, los accesos a "Mi cuenta" (y a
// "Clientes" para OESTACK). `children` agrega la línea del local.
export default function Encabezado({ rol = null, children = null }) {
  const { acceso } = useAcceso()
  const { usuario } = useSesion()
  return (
    <header className="adm-encabezado">
      {esSesionDemo(usuario) && (
        <p className="adm-demo" role="note">
          {AVISO_DEMO}
        </p>
      )}
      <div className="adm-encabezado__interior">
        <div className="adm-encabezado__fila">
          <p className="adm-marca">OESTACK · Panel</p>
          <BarraUsuario rol={rol} />
        </div>
        <nav className="adm-accesos" aria-label="Tu cuenta">
          {acceso.esAdmin && (
            <NavLink className="adm-acceso" to="/admin/clientes">
              Clientes
            </NavLink>
          )}
          <NavLink className="adm-acceso" to="/admin/cuenta">
            Mi cuenta
          </NavLink>
        </nav>
        {children}
      </div>
    </header>
  )
}
