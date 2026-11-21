import { etiquetasDeProducto } from '../lib/etiquetas'
import { formatearPrecio } from '../lib/formato'
import { imagenProducto, PROPORCION_PRODUCTO } from '../lib/imagenes'
import { useAparecer } from '../lib/useAparecer'

// Ancho real de la imagen según la pantalla (debe coincidir con menu.css), para
// que el navegador elija la de 240 o la de 480 px: la más chica que alcance.
const TAMANOS = '(min-width: 1024px) 8rem, (min-width: 768px) 7.5rem, 6.5rem'
const TAMANOS_COMPACTA = '(min-width: 768px) 11rem, 8rem'

// Contenido estático (no es un botón ni un enlace).
// compacta: versión vertical para la fila de destacados (imagen, nombre y precio).
// prioridad: la imagen se ve apenas abre la página, así que no se difiere su carga.
export default function TarjetaProducto({ producto, compacta = false, prioridad = false }) {
  const ref = useAparecer()
  const imagen = imagenProducto(producto.imagen_url)
  const etiquetas = etiquetasDeProducto(producto)

  const clases = ['tarjeta']
  if (compacta) clases.push('tarjeta--compacta')
  else clases.push('aparece') // las compactas aparecen junto con su sección
  if (!producto.disponible) clases.push('tarjeta--no-disponible')

  return (
    <li ref={ref} className={clases.join(' ')}>
      {imagen && (
        <div className="tarjeta__imagen">
          <img
            src={imagen.src}
            srcSet={imagen.srcSet}
            sizes={imagen.srcSet ? (compacta ? TAMANOS_COMPACTA : TAMANOS) : undefined}
            alt={producto.nombre}
            width={PROPORCION_PRODUCTO.ancho}
            height={PROPORCION_PRODUCTO.alto}
            loading={prioridad ? 'eager' : 'lazy'}
            fetchPriority={prioridad ? 'high' : 'low'}
            decoding="async"
          />
        </div>
      )}

      <div className="tarjeta__cuerpo">
        <div className="tarjeta__cabecera">
          <h3 className="tarjeta__nombre">{producto.nombre}</h3>
          <p className="tarjeta__precio">{formatearPrecio(producto.precio)}</p>
        </div>

        {!producto.disponible && <p className="tarjeta__aviso">No disponible</p>}

        {!compacta && producto.descripcion && <p className="tarjeta__descripcion">{producto.descripcion}</p>}

        {!compacta && etiquetas.length > 0 && (
          <ul className="etiquetas" aria-label="Etiquetas" role="list">
            {etiquetas.map((etiqueta) => (
              <li key={etiqueta.clave} className={`etiqueta etiqueta--${etiqueta.tono}`}>
                {etiqueta.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
