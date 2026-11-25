import { nombreDeRol } from './permisos'
import Boton from './ui/Boton'
import { useSesion } from './useSesion'

// Quién está logueado, su rol (si corresponde) y el botón de salir.
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
      <Boton chico onClick={cerrarSesion}>
        Salir
      </Boton>
    </div>
  )
}
