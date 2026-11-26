import Portada from '../components/Portada'
import TarjetaProducto from '../components/TarjetaProducto'
import { normalizarHorarios } from '../lib/horarios'
import { variablesDeTema } from '../lib/tema'

const DE_EJEMPLO = {
  nombre: 'Producto de ejemplo',
  descripcion: 'Así se ven los productos en tu carta.',
  precio: 4500,
  disponible: true,
  etiquetas: ['nuevo'],
}

// Encabezado, aviso, "Abierto ahora" y una tarjeta, con LOS MISMOS componentes del menú
// público y lo que está escrito sin guardar. Es solo para mirar: `inert` la saca del teclado
// y de los lectores de pantalla.
export default function VistaPrevia({ local, producto, logoVista }) {
  const horarios = normalizarHorarios(local.horarios)
  // Un "slug" propio: cerrar el aviso en el menú público no lo oculta acá.
  const paraPortada = { ...local, slug: 'vista-previa' }

  return (
    <div className="aj-vista__marco" style={variablesDeTema(local.tema)} inert>
      <Portada local={paraPortada} horarios={horarios} destino={null} logoVista={logoVista} />
      <ul className="aj-vista__carta" role="list">
        <TarjetaProducto producto={producto ?? DE_EJEMPLO} prioridad />
      </ul>
    </div>
  )
}
