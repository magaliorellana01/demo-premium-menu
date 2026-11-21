import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Pie from '../components/Pie'
import { formatearPrecio } from '../lib/formato'
import { useLocal } from '../lib/useLocal'
import NoEncontrado from './NoEncontrado'

// Tarea 1: vista provisoria, solo para verificar que los datos llegan bien.
// El diseño del menú viene en la Tarea 3.
export default function MenuPage() {
  const { slug } = useParams()
  const { cargando, local, error } = useLocal(slug)

  useEffect(() => {
    if (local) document.title = `${local.nombre} · Menú`
  }, [local])

  if (cargando) return <p className="contenedor" role="status">Cargando…</p>
  if (error) {
    return (
      <main className="contenedor">
        <h1>No pudimos cargar el menú</h1>
        <p>Probá recargar la página en unos minutos.</p>
      </main>
    )
  }
  if (!local) return <NoEncontrado />

  return (
    <>
      <main className="contenedor">
        <h1>{local.nombre}</h1>
        {local.descripcion && <p>{local.descripcion}</p>}

        {local.categorias.map((categoria) => (
          <section key={categoria.id} aria-labelledby={`cat-${categoria.id}`}>
            <h2 id={`cat-${categoria.id}`}>{categoria.nombre}</h2>
            <ul>
              {categoria.productos.map((producto) => (
                <li key={producto.id}>
                  <strong>{producto.nombre}</strong> · {formatearPrecio(producto.precio)}
                  {producto.destacado && ' · destacado'}
                  {!producto.disponible && ' · No disponible'}
                  {producto.descripcion && <div>{producto.descripcion}</div>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Pie />
    </>
  )
}
