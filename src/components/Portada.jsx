import { useState } from 'react'
import { useIdioma } from '../i18n/useIdioma'
import { useTextoTraducido } from '../i18n/useTextoTraducido'
import { logoDePortada } from '../lib/imagenes'
import { portadaClara } from '../lib/tema'
import { usePausarFueraDePantalla } from '../lib/usePausarFueraDePantalla'
import Aviso from './Aviso'
import EstadoLocal from './EstadoLocal'
import Granos from './Granos'
import SelectorIdioma from './SelectorIdioma'

export default function Portada({ local, horarios, destino, logoVista = null }) {
  const ref = usePausarFueraDePantalla()
  const { t } = useIdioma()
  const logo = logoVista ?? logoDePortada(local.logo_url, portadaClara(local.tema))
  const [logoRoto, setLogoRoto] = useState(null)
  const frase = useTextoTraducido(local.tema?.frase)
  const descripcion = useTextoTraducido(local.descripcion)

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
        {frase && <p className="portada__frase portada__entra" style={{ '--retraso': '0.12s' }}>{frase}</p>}
        {descripcion && <p className="portada__descripcion portada__entra" style={{ '--retraso': '0.24s' }}>{descripcion}</p>}
        {horarios && <div className="portada__entra" style={{ '--retraso': '0.3s' }}><EstadoLocal horarios={horarios} /></div>}
        {destino && (
          <a className="boton boton--acento portada__entra" href={`#${destino}`} style={{ '--retraso': '0.42s' }}>
            {t('verCarta')}
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
        <div className="portada__idiomas portada__entra" style={{ '--retraso': '0.5s' }}>
          <SelectorIdioma />
        </div>
      </div>
    </header>
  )
}
