import { NavLink } from 'react-router-dom'
import BarraUsuario from './BarraUsuario'
import { useAcceso } from './useAcceso'

// Encabezado del panel (superficie espresso): quién ingresó, los accesos a "Mi cuenta" (y a
// "Clientes" para OESTACK). `children` agrega la línea del local.
export default function Encabezado({ rol = null, children = null }) {
  const { acceso } = useAcceso()
  return (
    <header className="adm-encabezado">
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
