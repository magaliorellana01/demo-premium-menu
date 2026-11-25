import { idCategoria } from '../lib/formato'
import { adicionalesDe } from '../lib/precios'
import { useAparecer } from '../lib/useAparecer'
import Precio from './Precio'
import TarjetaProducto from './TarjetaProducto'

// imagenesPrioritarias: cuántas imágenes del comienzo se cargan sin diferir
// (solo se usa en la primera categoría cuando no hay destacados arriba).
export default function SeccionCategoria({ categoria, imagenesPrioritarias = 0 }) {
  const tituloRef = useAparecer()
  if (categoria.productos.length === 0) return null

  const id = idCategoria(categoria)
  const adicionales = adicionalesDe(categoria)

  return (
    <section id={id} className="seccion" aria-labelledby={`titulo-${id}`}>
      <h2 id={`titulo-${id}`} ref={tituloRef} className="seccion__titulo aparece">
        {categoria.nombre}
      </h2>
      {adicionales.length > 0 && (
        <div className="adicionales">
          <p className="adicionales__rotulo">Podés sumar:</p>
          <ul className="adicionales__lista" role="list">
            {adicionales.map((adicional, indice) => (
              <li key={`${indice}-${adicional.nombre}`} className="adicional">
                {adicional.nombre}
                <span className="solo-lectores">, </span> <span className="adicional__precio"><Precio valor={adicional.precio} mas /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="grilla" role="list">
        {categoria.productos.map((producto, indice) => (
          <TarjetaProducto key={producto.id} producto={producto} prioridad={indice < imagenesPrioritarias} />
        ))}
      </ul>
    </section>
  )
}
