import { useCallback, useEffect, useRef, useState } from 'react'
import { comportamientoScroll } from '../lib/movimiento'
import { useAparecer } from '../lib/useAparecer'
import TarjetaProducto from './TarjetaProducto'

const MARGEN = 4 // px de tolerancia al medir los extremos de la fila

function Flecha({ direccion }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d={direccion === 'anterior' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Productos destacados en una fila horizontal que se desliza (con el dedo, el
// trackpad, el teclado o, en pantallas grandes, con los botones). Sin destacados
// no se muestra.
export default function Destacados({ productos }) {
  const seccionRef = useAparecer()
  const filaRef = useRef(null)
  const [estado, setEstado] = useState({ desborda: false, anterior: false, siguiente: false })

  const medir = useCallback(() => {
    const fila = filaRef.current
    if (!fila) return
    const maximo = fila.scrollWidth - fila.clientWidth
    const nuevo = {
      desborda: maximo > MARGEN,
      anterior: fila.scrollLeft > MARGEN,
      siguiente: fila.scrollLeft < maximo - MARGEN,
    }
    setEstado((actual) =>
      actual.desborda === nuevo.desborda && actual.anterior === nuevo.anterior && actual.siguiente === nuevo.siguiente
        ? actual
        : nuevo,
    )
  }, [])

  useEffect(() => {
    const fila = filaRef.current
    if (!fila) return
    medir()
    fila.addEventListener('scroll', medir, { passive: true })
    const observador = new ResizeObserver(medir)
    observador.observe(fila)
    return () => {
      fila.removeEventListener('scroll', medir)
      observador.disconnect()
    }
  }, [medir, productos.length])

  if (productos.length === 0) return null

  const desplazar = (sentido) => {
    const fila = filaRef.current
    fila.scrollBy({ left: sentido * fila.clientWidth * 0.8, behavior: comportamientoScroll() })
  }

  // aria-disabled (y no disabled) para que el foco no se pierda al llegar a un extremo.
  const boton = (sentido, nombre, etiqueta, activo) => (
    <button
      type="button"
      className="destacados__flecha"
      aria-label={etiqueta}
      aria-disabled={!activo}
      onClick={() => activo && desplazar(sentido)}
    >
      <Flecha direccion={nombre} />
    </button>
  )

  return (
    <section id="destacados" ref={seccionRef} className="destacados aparece" aria-labelledby="titulo-destacados">
      <div className="destacados__interior">
        <div className="destacados__cabecera">
          <h2 id="titulo-destacados" className="destacados__titulo">
            Destacados
          </h2>
          {estado.desborda && (
            <div className="destacados__flechas">
              {boton(-1, 'anterior', 'Ver destacados anteriores', estado.anterior)}
              {boton(1, 'siguiente', 'Ver más destacados', estado.siguiente)}
            </div>
          )}
        </div>

        {/* tabIndex: al no haber controles dentro de las tarjetas, la fila misma se enfoca y se mueve con las flechas del teclado */}
        <ul className="destacados__fila" ref={filaRef} role="list" tabIndex={0} aria-label="Productos destacados">
          {productos.map((producto, indice) => (
            <TarjetaProducto key={producto.id} producto={producto} compacta prioridad={indice < 3} />
          ))}
        </ul>
      </div>
    </section>
  )
}
