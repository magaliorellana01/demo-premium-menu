import { Link } from 'react-router-dom'
import PantallaMensaje from '../components/PantallaMensaje'
import { useIdioma } from '../i18n/useIdioma'
import { MARCA_DEMO } from '../lib/demo'

export default function NoEncontrado() {
  const { t } = useIdioma()
  return (
    <PantallaMensaje titulo={t('noEncontradoTitulo')}>
      <p className="pantalla__texto">{t('noEncontradoTexto')}</p>
      <Link className="boton boton--oscuro" to={`/${MARCA_DEMO.slug}`}>
        {t('irAlMenuDe')} {MARCA_DEMO.nombre}
      </Link>
    </PantallaMensaje>
  )
}
