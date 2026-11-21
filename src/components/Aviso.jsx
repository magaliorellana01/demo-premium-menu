import { useState } from 'react'

// Franja fina arriba de todo con el aviso del local (aviso_texto), solo si aviso_activo.
// Va superpuesta al borde superior de la portada: al aparecer o cerrarse no mueve nada.
// El cierre se recuerda durante la sesión; si el local cambia el texto, vuelve a aparecer.
// Se guarda en sessionStorage con try/catch porque puede no estar disponible o fallar.
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
    // Sin almacenamiento: el aviso vuelve a mostrarse al recargar. No pasa nada.
  }
}

export default function Aviso({ local }) {
  const texto = local.aviso_activo ? (local.aviso_texto ?? '').trim() : ''
  const [cerrado, setCerrado] = useState(() => leerCierre(local.slug, texto))

  if (!texto || cerrado) return null

  const cerrar = () => {
    guardarCierre(local.slug, texto)
    setCerrado(true)
  }

  return (
    <div className="aviso" role="status">
      <p className="aviso__texto">{texto}</p>
      <button type="button" className="aviso__cerrar" aria-label="Cerrar aviso" onClick={cerrar}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
