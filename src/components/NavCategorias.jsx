import { useEffect, useRef } from 'react'
import { comportamientoScroll } from '../lib/movimiento'
import { useCategoriaActiva } from '../lib/useCategoriaActiva'

// Barra fija con un enlace por sección de la página (las categorías y, si existe,
// "Visitanos"): items = [{ id, nombre }]. Son enlaces normales a #id: funcionan
// aunque falle el JavaScript; el scroll suave y el scroll-margin-top los
// resuelve el CSS.
export default function NavCategorias({ items }) {
  const ids = items.map((item) => item.id)
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

  if (items.length < 2) return null

  return (
    <nav className="nav" aria-label="Secciones del menú">
      <ul className="nav__lista" ref={listaRef} role="list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              className="nav__enlace"
              href={`#${item.id}`}
              aria-current={activa === item.id ? 'true' : undefined}
              onClick={() => setActiva(item.id)}
            >
              {item.nombre}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
