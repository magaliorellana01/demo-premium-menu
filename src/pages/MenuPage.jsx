import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Carta from '../components/Carta'
import Esqueleto from '../components/Esqueleto'
import PantallaMensaje from '../components/PantallaMensaje'
import { useIdioma } from '../i18n/useIdioma'
import { useLocal } from '../lib/useLocal'
import NoEncontrado from './NoEncontrado'

export default function MenuPage() {
  const { slug } = useParams()
  const { cargando, local, error } = useLocal(slug)
  const { t } = useIdioma()

  useEffect(() => {
    if (!local) return
    document.title = `${local.nombre} \u00b7 ${t('menu')}`
    document.querySelector('meta[name="description"]')?.setAttribute('content', local.descripcion || `${t('menuDe')} ${local.nombre}.`)
  }, [local, t])

  if (cargando) return <Esqueleto />
  if (error) {
    return (
      <PantallaMensaje titulo={t('errorCargarTitulo')}>
        <p className="pantalla__texto">{t('errorCargarTexto')}</p>
        <button type="button" className="boton boton--oscuro" onClick={() => window.location.reload()}>
          {t('reintentar')}
        </button>
      </PantallaMensaje>
    )
  }
  if (!local) return <NoEncontrado />

  return <Carta local={local} />
}
