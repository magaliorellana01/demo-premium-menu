import { nombreDeRol } from './permisos'
import { useSesion } from './useSesion'

// Quién está logueado, su rol (si corresponde) y el botón de salir. Se usa en el panel de un
// local y en las pantallas previas (elegir local, sin acceso...).
export default function BarraUsuario({ rol = null }) {
  const { usuario, cerrarSesion } = useSesion()
  return (
    <div className="adm-usuario">
      <p className="adm-usuario__datos">
        <span className="adm-usuario__email">{usuario?.email}</span>
        {rol && (
          <span className="adm-rol" data-rol={rol}>
            {nombreDeRol(rol)}
          </span>
        )}
      </p>
      <button type="button" className="adm-boton adm-boton--chico" onClick={cerrarSesion}>
        Salir
      </button>
    </div>
  )
}
