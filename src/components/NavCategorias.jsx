import { useEffect, useRef } from 'react'
import { idCategoria } from '../lib/formato'
import { comportamientoScroll } from '../lib/movimiento'
import { useCategoriaActiva } from '../lib/useCategoriaActiva'

// Barra fija con un enlace por categoría. Son enlaces normales a #id: funcionan
// aunque falle el JavaScript; el scroll suave y el scroll-margin-top los
// resuelve el CSS.
export default function NavCategorias({ categorias }) {
  const ids = categorias.map(idCategoria)
  const [activa, setActiva] = useCategoriaActiva(ids)
  const listaRef = useRef(null)

  // En celular la barra se desplaza: mantiene el enlace activo a la vista.
  useEffect(() => {
    const lista = listaRef.current
    const enlace = lista?.querySelector('[aria-current="true"]')
    if (!enlace) return
    const izquierda = enlace.offsetLeft - (lista.clientWidth - enlace.offsetWidth) / 2
    lista.scrollTo({ left: izquierda, behavior: comportamientoScroll() })
  }, [activa])

  if (categorias.length < 2) return null

  return (
    <nav className="nav" aria-label="Categorías del menú">
      <ul className="nav__lista" ref={listaRef} role="list">
        {categorias.map((categoria, indice) => (
          <li key={categoria.id}>
            <a
              className="nav__enlace"
              href={`#${ids[indice]}`}
              aria-current={activa === ids[indice] ? 'true' : undefined}
              onClick={() => setActiva(ids[indice])}
            >
              {categoria.nombre}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
