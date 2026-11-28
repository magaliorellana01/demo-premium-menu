import { traducirEstadoLocal } from '../i18n/traducciones'
import { useIdioma } from '../i18n/useIdioma'
import { describirEstado } from '../lib/horarios'
import { useAhora } from '../lib/useAhora'

export default function EstadoLocal({ horarios }) {
  const ahora = useAhora()
  const { idioma } = useIdioma()
  const { texto, tono } = describirEstado(horarios, ahora)

  return (
    <p className={`estado-local estado-local--${tono}`}>
      <span className="estado-local__punto" aria-hidden="true" />
      {traducirEstadoLocal(texto, idioma)}
    </p>
  )
}
