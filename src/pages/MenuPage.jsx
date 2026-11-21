import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Carta from '../components/Carta'
import Esqueleto from '../components/Esqueleto'
import PantallaMensaje from '../components/PantallaMensaje'
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

  return <Carta local={local} />
}
