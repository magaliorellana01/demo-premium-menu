import { Link } from 'react-router-dom'
import PantallaMensaje from '../components/PantallaMensaje'
import { MARCA_DEMO } from '../lib/demo'

export default function NoEncontrado() {
  return (
    <PantallaMensaje titulo="No encontramos este menú">
      <p className="pantalla__texto">
        Puede que el link o el código QR estén incompletos. Revisá la dirección o volvé a escanear el código del local.
      </p>
      <Link className="boton boton--oscuro" to={`/${MARCA_DEMO.slug}`}>
        Ir al menú de {MARCA_DEMO.nombre}
      </Link>
    </PantallaMensaje>
  )
}
