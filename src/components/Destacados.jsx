import TarjetaProducto from './TarjetaProducto'

// Productos marcados como destacados, al inicio del menú. Sin destacados, no se muestra.
export default function Destacados({ productos }) {
  if (productos.length === 0) return null

  return (
    <section id="destacados" className="seccion" aria-labelledby="titulo-destacados">
      <h2 id="titulo-destacados" className="seccion__titulo">
        Destacados
      </h2>
      <ul className="grilla">
        {productos.map((producto, indice) => (
          <TarjetaProducto key={producto.id} producto={producto} destacada prioridad={indice < 2} />
        ))}
      </ul>
    </section>
  )
}
