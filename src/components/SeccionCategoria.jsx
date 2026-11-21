import { idCategoria } from '../lib/formato'
import { useAparecer } from '../lib/useAparecer'
import TarjetaProducto from './TarjetaProducto'

// imagenesPrioritarias: cuántas imágenes del comienzo se cargan sin diferir
// (solo se usa en la primera categoría cuando no hay destacados arriba).
export default function SeccionCategoria({ categoria, imagenesPrioritarias = 0 }) {
  const tituloRef = useAparecer()
  if (categoria.productos.length === 0) return null

  const id = idCategoria(categoria)

  return (
    <section id={id} className="seccion" aria-labelledby={`titulo-${id}`}>
      <h2 id={`titulo-${id}`} ref={tituloRef} className="seccion__titulo aparece">
        {categoria.nombre}
      </h2>
      <ul className="grilla" role="list">
        {categoria.productos.map((producto, indice) => (
          <TarjetaProducto key={producto.id} producto={producto} prioridad={indice < imagenesPrioritarias} />
        ))}
      </ul>
    </section>
  )
}
