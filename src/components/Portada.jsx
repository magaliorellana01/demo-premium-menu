import { useState } from 'react'
import { logoDePortada } from '../lib/imagenes'
import { portadaClara } from '../lib/tema'
import { usePausarFueraDePantalla } from '../lib/usePausarFueraDePantalla'
import Aviso from './Aviso'
import EstadoLocal from './EstadoLocal'
import Granos from './Granos'

// Portada tipográfica sobre espresso, antes de la carta. `destino` es el id de la
// primera sección (destacados o la primera categoría): el botón baja hasta ahí.
// `horarios` (ya normalizados, o null) alimenta la línea "Abierto ahora".
// El contenido entra de a poco (CSS) y los granos de café se pausan al salir de pantalla.
// `logoVista` ({ src, ancho, alto }) lo usa la vista previa del panel para un logo sin subir.
export default function Portada({ local, horarios, destino, logoVista = null }) {
  const ref = usePausarFueraDePantalla()
  const logo = logoVista ?? logoDePortada(local.logo_url, portadaClara(local.tema))
  const [logoRoto, setLogoRoto] = useState(null) // si la imagen no carga, queda el nombre
  const frase = local.tema?.frase

  return (
    <header ref={ref} className="portada">
      <Granos />
      <Aviso local={local} />

      <div className="portada__contenido">
        <h1 className="portada__titulo portada__entra">
          {logo && logo.src !== logoRoto ? (
            <img className="portada__logo" src={logo.src} alt={local.nombre} width={logo.ancho} height={logo.alto} fetchPriority="high" onError={() => setLogoRoto(logo.src)} />
          ) : (
            local.nombre
          )}
        </h1>

        {frase && (
          <p className="portada__frase portada__entra" style={{ '--retraso': '0.12s' }}>
            {frase}
          </p>
        )}
        {local.descripcion && (
          <p className="portada__descripcion portada__entra" style={{ '--retraso': '0.24s' }}>
            {local.descripcion}
          </p>
        )}
        {horarios && (
          <div className="portada__entra" style={{ '--retraso': '0.3s' }}>
            <EstadoLocal horarios={horarios} />
          </div>
        )}

        {destino && (
          <a className="boton boton--acento portada__entra" href={`#${destino}`} style={{ '--retraso': '0.42s' }}>
            Ver la carta
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>
    </header>
  )
}
