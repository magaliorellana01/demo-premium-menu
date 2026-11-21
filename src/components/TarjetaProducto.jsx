import { formatearPrecio } from '../lib/formato'
import { imagenProducto, PROPORCION_PRODUCTO } from '../lib/imagenes'

// Qué ancho ocupa la imagen según la pantalla, para que el navegador elija
// entre la de 480 y la de 800 px. La tarjeta normal es horizontal en celular
// (miniatura de 7 rem); la destacada es vertical en todos los tamaños.
const TAMANOS_NORMAL = '(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 7rem'
const TAMANOS_DESTACADA = '(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 100vw'

// prioridad: la imagen se ve apenas abre la página, así que no se difiere su carga.
export default function TarjetaProducto({ producto, destacada = false, prioridad = false }) {
  const imagen = imagenProducto(producto.imagen_url)
  const etiquetas = producto.etiquetas ?? []

  const clases = ['tarjeta']
  if (destacada) clases.push('tarjeta--destacada')
  if (!producto.disponible) clases.push('tarjeta--no-disponible')

  return (
    <li className={clases.join(' ')}>
      {imagen && (
        <div className="tarjeta__imagen">
          <img
            src={imagen.src}
            srcSet={imagen.srcSet}
            sizes={imagen.srcSet ? (destacada ? TAMANOS_DESTACADA : TAMANOS_NORMAL) : undefined}
            alt={producto.nombre}
            width={PROPORCION_PRODUCTO.ancho}
            height={PROPORCION_PRODUCTO.alto}
            loading={prioridad ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
      )}

      <div className="tarjeta__cuerpo">
        <h3 className="tarjeta__nombre">{producto.nombre}</h3>
        {producto.descripcion && <p className="tarjeta__descripcion">{producto.descripcion}</p>}

        {etiquetas.length > 0 && (
          <ul className="etiquetas" aria-label="Etiquetas">
            {etiquetas.map((etiqueta) => (
              <li key={etiqueta} className="etiqueta">
                {etiqueta}
              </li>
            ))}
          </ul>
        )}

        <p className="tarjeta__pie">
          <span className="tarjeta__precio">{formatearPrecio(producto.precio)}</span>
          {!producto.disponible && <span className="tarjeta__aviso">No disponible</span>}
        </p>
      </div>
    </li>
  )
}
