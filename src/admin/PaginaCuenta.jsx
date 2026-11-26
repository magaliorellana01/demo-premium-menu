import { Link } from 'react-router-dom'
import { SIN_CAMBIO_DE_PASSWORD } from './demo'
import Encabezado from './Encabezado'
import { esSesionDemo } from './entornoDemo'
import FormularioPassword from './FormularioPassword'
import { nombreDeRol } from './permisos'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import { useAcceso } from './useAcceso'
import { useSesion } from './useSesion'

/** "Dueño de Aroma", o el rol de admin (que vale para todos los locales). */
function rolesDe(acceso) {
  if (acceso.esAdmin) return [nombreDeRol('admin')]
  return acceso.locales.map((l) => `${nombreDeRol(l.rol)} de ${l.nombre}`)
}

// /admin/cuenta: quién sos, cambiar la contraseña y salir.
export default function PaginaCuenta() {
  const { acceso } = useAcceso()
  const { usuario, cerrarSesion } = useSesion()
  const roles = rolesDe(acceso)
  // Solo la interfaz: la API de Supabase no deja impedir el cambio (demo:reiniciar la repone).
  const esDemo = esSesionDemo(usuario)

  return (
    <div className="adm-pagina">
      <title>Mi cuenta · Panel</title>
      <a className="adm-saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Encabezado rol={acceso.esAdmin ? 'admin' : null} />
      <main className="adm-contenido adm-contenido--sin-pestanas" id="contenido" tabIndex={-1}>
        <div className="cli-titulo">
          <h1 className="adm-titulo">Mi cuenta</h1>
          <Link className="cli-volver" to="/admin">
            Volver al panel
          </Link>
        </div>

        <Tarjeta como="section" className="adm-bloque" aria-labelledby="titulo-tus-datos">
          <h2 id="titulo-tus-datos" className="adm-subtitulo">
            Tus datos
          </h2>
          <dl className="cuenta-datos">
            <div>
              <dt>Email</dt>
              <dd data-dato="email">{usuario?.email}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd data-dato="rol">{roles.length ? roles.map((r) => <span key={r}>{r}</span>) : 'Sin locales asignados'}</dd>
            </div>
          </dl>
          <div className="ui-acciones">
            <Boton onClick={cerrarSesion}>Salir de la cuenta</Boton>
          </div>
        </Tarjeta>

        <Tarjeta como="section" className="adm-bloque" aria-labelledby="titulo-password">
          <h2 id="titulo-password" className="adm-subtitulo">
            {esDemo ? 'Contraseña' : 'Cambiar contraseña'}
          </h2>
          {esDemo ? <p data-aviso="sin-cambio">{SIN_CAMBIO_DE_PASSWORD}</p> : <FormularioPassword email={usuario?.email ?? ''} />}
        </Tarjeta>
      </main>
    </div>
  )
}
