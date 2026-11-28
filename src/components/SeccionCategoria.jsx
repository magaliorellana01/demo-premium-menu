import { useIdioma } from '../i18n/useIdioma'
import { useTextoTraducido } from '../i18n/useTextoTraducido'
import { idCategoria } from '../lib/formato'
import { adicionalesDe } from '../lib/precios'
import { useAparecer } from '../lib/useAparecer'
import Precio from './Precio'
import TarjetaProducto from './TarjetaProducto'

function AdicionalItem({ adicional }) {
  const nombre = useTextoTraducido(adicional.nombre)
  return (
    <li className="adicional">
      {nombre}
      <span className="solo-lectores">, </span>{' '}
      <span className="adicional__precio"><Precio valor={adicional.precio} mas /></span>
    </li>
  )
}

export default function SeccionCategoria({ categoria, imagenesPrioritarias = 0 }) {
  const tituloRef = useAparecer()
  const { t } = useIdioma()
  const nombreCategoria = useTextoTraducido(categoria.nombre)
  if (categoria.productos.length === 0) return null

  const id = idCategoria(categoria)
  const adicionales = adicionalesDe(categoria)
  return (
    <section id={id} className="seccion" aria-labelledby={`titulo-${id}`}>
      <h2 id={`titulo-${id}`} ref={tituloRef} className="seccion__titulo aparece">
        {nombreCategoria}
      </h2>
      {adicionales.length > 0 && (
        <div className="adicionales">
          <p className="adicionales__rotulo">{t('podesSumar')}</p>
          <ul className="adicionales__lista" role="list">
            {adicionales.map((adicional, indice) => (
              <AdicionalItem key={`${indice}-${adicional.nombre}`} adicional={adicional} />
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
