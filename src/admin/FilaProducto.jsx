import { useId } from 'react'
import { etiquetasDeProducto } from '../lib/etiquetas'
import { imagenProducto } from '../lib/imagenes'
import { formatearPrecio, precioParaLeer, resumenPrecio } from '../lib/precios'
import Boton from './ui/Boton'
import Interruptor from './ui/Interruptor'
import Tarjeta from './ui/Tarjeta'

function Flecha({ arriba }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={arriba ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Miniatura({ url }) {
  const imagen = imagenProducto(url)
  if (!imagen) {
    return (
      <span className="prod__foto prod__foto--vacia" aria-hidden="true">
        Sin foto
      </span>
    )
  }
  // Decorativa: el nombre del producto está al lado. Con srcset, el navegador baja la de 240 px.
  return <img className="prod__foto" src={imagen.src} srcSet={imagen.srcSet} sizes={imagen.srcSet ? '4rem' : undefined} alt="" width="64" height="80" loading="lazy" decoding="async" />
}

// Un producto en la lista: datos, acciones rápidas (disponible y destacado), orden y editar.
export default function FilaProducto({ producto, posicion, cantidad, puedeEditar, puedeOrdenar, ocupadas, ordenando, rutaEditar, estadoEditar, acciones, registrar }) {
  const idTitulo = useId()
  const { id, nombre, disponible, destacado } = producto
  const { desde, hayRango } = resumenPrecio(producto)
  const etiquetas = etiquetasDeProducto(producto)

  return (
    <Tarjeta como="li" className={`prod${disponible ? '' : ' prod--agotado'}`} aria-labelledby={idTitulo} data-producto={id}>
      <div className="prod__cabecera">
        <Miniatura url={producto.imagenUrl} />
        <div className="prod__texto">
          <h3 className="prod__nombre" id={idTitulo}>
            {nombre}
          </h3>
          {desde !== null && (
            <p className="prod__precio">
              <span aria-hidden="true">
                {hayRango && 'desde '}
                {formatearPrecio(desde)}
              </span>
              <span className="solo-lectores">
                {hayRango && 'desde '}
                {precioParaLeer(desde)}
              </span>
            </p>
          )}
          {(etiquetas.length > 0 || !puedeEditar) && (
            <ul className="prod__etiquetas" aria-label="Etiquetas y estado" role="list">
              {!puedeEditar && <li className={`ui-chip ${disponible ? 'ui-chip--salvia' : 'ui-chip--cobre'}`}>{disponible ? 'Disponible' : 'Agotado'}</li>}
              {!puedeEditar && destacado && <li className="ui-chip ui-chip--cobre">Destacado</li>}
              {etiquetas.map((etiqueta) => (
                <li key={etiqueta.clave} className="ui-chip">
                  {etiqueta.nombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {puedeEditar && (
        <>
          <div className="prod__estados">
            <Interruptor
              marcado={disponible}
              cargando={ocupadas.has(`${id}:disponible`)}
              etiqueta={`${nombre}: disponible`}
              textoSi="Disponible"
              textoNo="Agotado"
              onCambiar={(valor) => acciones.cambiar(producto, 'disponible', valor)}
            />
            <Interruptor
              marcado={destacado}
              cargando={ocupadas.has(`${id}:destacado`)}
              etiqueta={`${nombre}: destacado`}
              textoSi="Destacado"
              textoNo="Sin destacar"
              onCambiar={(valor) => acciones.cambiar(producto, 'destacado', valor)}
            />
          </div>

          <div className="prod__botones">
            {puedeOrdenar && (
              <div className="prod__orden" role="group" aria-label={`Orden de ${nombre}`}>
                <Boton ref={(n) => registrar(`${id}:subir`, n)} variante="fantasma" icono aria-label={`Subir ${nombre}`} deshabilitado={posicion === 0 || ordenando} onClick={() => acciones.mover(producto, -1)}>
                  <Flecha arriba />
                </Boton>
                <Boton ref={(n) => registrar(`${id}:bajar`, n)} variante="fantasma" icono aria-label={`Bajar ${nombre}`} deshabilitado={posicion === cantidad - 1 || ordenando} onClick={() => acciones.mover(producto, 1)}>
                  <Flecha />
                </Boton>
              </div>
            )}
            <Boton ref={(n) => registrar(`${id}:editar`, n)} className="prod__editar" chico to={rutaEditar} state={estadoEditar} aria-label={`Editar ${nombre}`}>
              Editar
            </Boton>
          </div>
        </>
      )}
    </Tarjeta>
  )
}
