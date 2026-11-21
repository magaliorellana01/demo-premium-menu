import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Destacados from '../components/Destacados'
import Esqueleto from '../components/Esqueleto'
import NavCategorias from '../components/NavCategorias'
import PantallaMensaje from '../components/PantallaMensaje'
import Pie from '../components/Pie'
import Portada from '../components/Portada'
import SeccionCategoria from '../components/SeccionCategoria'
import { idCategoria } from '../lib/formato'
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
      <PantallaMensaje titulo="No pudimos cargar el menú">
        <p className="pantalla__texto">Parece un problema de conexión. Probá de nuevo en unos instantes.</p>
        <button type="button" className="boton boton--oscuro" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </PantallaMensaje>
    )
  }
  if (!local) return <NoEncontrado />

  const categorias = local.categorias.filter((categoria) => categoria.productos.length > 0)
  const destacados = categorias.flatMap((categoria) => categoria.productos.filter((producto) => producto.destacado))

  // El botón de la portada baja a la primera sección: los destacados o, si no hay, la primera categoría.
  const destino = destacados.length > 0 ? 'destacados' : categorias[0] && idCategoria(categorias[0])

  return (
    <>
      <Portada local={local} destino={destino} />
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
