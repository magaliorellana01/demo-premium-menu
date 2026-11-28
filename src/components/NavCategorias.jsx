import { useEffect, useRef } from 'react'
import { useIdioma } from '../i18n/useIdioma'
import { useTextoTraducido } from '../i18n/useTextoTraducido'
import { comportamientoScroll } from '../lib/movimiento'
import { useCategoriaActiva } from '../lib/useCategoriaActiva'

function NavItem({ item, activa, setActiva }) {
  const nombreTraducido = useTextoTraducido(item.esFijo ? '' : item.nombre)
  const etiqueta = item.esFijo ? item.nombre : nombreTraducido
  return (
    <li>
      <a
        className="nav__enlace"
        href={`#${item.id}`}
        aria-current={activa === item.id ? 'true' : undefined}
        onClick={() => setActiva(item.id)}
      >
        {etiqueta}
      </a>
    </li>
  )
}

export default function NavCategorias({ items, mantener = false }) {
  const { t } = useIdioma()
  const ids = items.map((item) => item.id)
  const [activa, setActiva] = useCategoriaActiva(ids)
  const listaRef = useRef(null)

  useEffect(() => {
    const lista = listaRef.current
    const enlace = lista?.querySelector('[aria-current="true"]')
    if (!enlace) return
    const izquierda = enlace.offsetLeft - (lista.clientWidth - enlace.offsetWidth) / 2
    lista.scrollTo({ left: izquierda, behavior: comportamientoScroll() })
  }, [activa])

  if (items.length < 2 && !mantener) return null

  return (
    <nav className="nav" aria-label={t('seccionesMenu')}>
      <ul className="nav__lista" ref={listaRef} role="list">
        {items.map((item) => (
          <NavItem key={item.id} item={item} activa={activa} setActiva={setActiva} />
        ))}
      </ul>
    </nav>
  )
}
