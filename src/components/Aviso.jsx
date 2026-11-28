import { useState } from 'react'
import { useIdioma } from '../i18n/useIdioma'
import { useTextoTraducido } from '../i18n/useTextoTraducido'

const clave = (slug) => `aviso-cerrado:${slug}`

function leerCierre(slug, texto) {
  try {
    return window.sessionStorage.getItem(clave(slug)) === texto
  } catch {
    return false
  }
}

function guardarCierre(slug, texto) {
  try {
    window.sessionStorage.setItem(clave(slug), texto)
  } catch {
    // Sin almacenamiento
  }
}

export default function Aviso({ local }) {
  const { t } = useIdioma()
  const texto = local.aviso_activo ? (local.aviso_texto ?? '').trim() : ''
  const textoTraducido = useTextoTraducido(texto)
  const [cerrado, setCerrado] = useState(() => leerCierre(local.slug, texto))

  if (!texto || cerrado) return null

  const cerrar = () => {
    guardarCierre(local.slug, texto)
    setCerrado(true)
  }

  return (
    <div className="aviso" role="status">
      <p className="aviso__texto">{textoTraducido}</p>
      <button type="button" className="aviso__cerrar" aria-label={t('cerrarAviso')} onClick={cerrar}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
