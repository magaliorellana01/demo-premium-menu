import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Destacados from '../components/Destacados'
import Encabezado from '../components/Encabezado'
import Esqueleto from '../components/Esqueleto'
import NavCategorias from '../components/NavCategorias'
import Pie from '../components/Pie'
import SeccionCategoria from '../components/SeccionCategoria'
import { useLocal } from '../lib/useLocal'
import NoEncontrado from './NoEncontrado'

export default function MenuPage() {
  const { slug } = useParams()
  const { cargando, local, error } = useLocal(slug)

  useEffect(() => {
    if (!local) return
    document.title = `${local.nombre} · Menú`
    document.querySelector('meta[name="description"]')?.setAttribute('content', local.descripcion || `Menú de ${local.nombre}.`)
  }, [local])

  if (cargando) return <Esqueleto />
  if (error) {
    return (
      <main className="contenedor estado">
        <h1>No pudimos cargar el menú</h1>
        <p>Probá recargar la página en unos minutos.</p>
      </main>
    )
  }
  if (!local) return <NoEncontrado />

  const categorias = local.categorias.filter((categoria) => categoria.productos.length > 0)
  const destacados = categorias.flatMap((categoria) => categoria.productos.filter((producto) => producto.destacado))

  return (
    <>
      <Encabezado local={local} />
      <NavCategorias categorias={categorias} />
      <main>
        <Destacados productos={destacados} />
        <div className="categorias">
          {categorias.map((categoria, indice) => (
            <SeccionCategoria
              key={categoria.id}
              categoria={categoria}
              // Sin destacados, las primeras imágenes de la primera categoría son las que se ven al abrir.
              imagenesPrioritarias={indice === 0 && destacados.length === 0 ? 2 : 0}
            />
          ))}
        </div>
      </main>
      <Pie />
    </>
  )
}
