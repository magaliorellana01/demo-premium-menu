import { traducirEtiqueta } from '../i18n/traducciones'
import { useIdioma } from '../i18n/useIdioma'
import { useTextoTraducido } from '../i18n/useTextoTraducido'
import { etiquetasDeProducto } from '../lib/etiquetas'
import { imagenProducto, PROPORCION_PRODUCTO } from '../lib/imagenes'
import { resumenPrecio } from '../lib/precios'
import { useAparecer } from '../lib/useAparecer'
import Precio from './Precio'

const TAMANOS = '(min-width: 1024px) 8rem, (min-width: 768px) 7.5rem, 6.5rem'
const TAMANOS_COMPACTA = '(min-width: 768px) 11rem, 8rem'

function VarianteItem({ variante }) {
  const nombre = useTextoTraducido(variante.nombre)
  return (
    <li className="variante">
      <span className="variante__nombre">{nombre}</span>
      <span className="variante__precio">
        <span className="solo-lectores">, </span>
        <Precio valor={variante.precio} />
      </span>
    </li>
  )
}

export default function TarjetaProducto({ producto, compacta = false, prioridad = false }) {
  const ref = useAparecer()
  const { idioma, t } = useIdioma()
  const nombre = useTextoTraducido(producto.nombre)
  const descripcion = useTextoTraducido(producto.descripcion)
  const imagen = imagenProducto(producto.imagen_url)
  const etiquetas = etiquetasDeProducto(producto)
  const { variantes, desde, hayRango } = resumenPrecio(producto)
  const listaDeVariantes = !compacta && variantes.length > 0

  const clases = ['tarjeta']
  if (compacta) clases.push('tarjeta--compacta')
  else clases.push('aparece')
  if (!producto.disponible) clases.push('tarjeta--no-disponible')

  return (
    <li ref={ref} className={clases.join(' ')}>
      {imagen && (
        <div className="tarjeta__imagen">
          <img src={imagen.src} srcSet={imagen.srcSet} sizes={imagen.srcSet ? (compacta ? TAMANOS_COMPACTA : TAMANOS) : undefined} alt={nombre} width={PROPORCION_PRODUCTO.ancho} height={PROPORCION_PRODUCTO.alto} loading={prioridad ? 'eager' : 'lazy'} fetchPriority={prioridad ? 'high' : 'low'} decoding="async" />
        </div>
      )}
      <div className="tarjeta__cuerpo">
        <div className="tarjeta__cabecera">
          <h3 className="tarjeta__nombre">{nombre}</h3>
          {!listaDeVariantes && desde !== null && <p className="tarjeta__precio"><Precio valor={desde} desde={compacta && hayRango} /></p>}
        </div>
        {!producto.disponible && <p className="tarjeta__aviso">{t('noDisponible')}</p>}
        {listaDeVariantes && (
          <ul className="variantes" role="list" aria-label={t('opcionesYPrecios')}>
            {variantes.map((variante, indice) => <VarianteItem key={`${indice}-${variante.nombre}`} variante={variante} />)}
          </ul>
        )}
        {!compacta && descripcion && <p className="tarjeta__descripcion">{descripcion}</p>}
        {!compacta && etiquetas.length > 0 && (
          <ul className="etiquetas" aria-label={t('etiquetas')} role="list">
            {etiquetas.map((etiqueta) => (
              <li key={etiqueta.clave} className={`etiqueta etiqueta--${etiqueta.tono}`}>{traducirEtiqueta(etiqueta, idioma)}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
