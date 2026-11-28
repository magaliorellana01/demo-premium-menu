import { useIdioma } from '../i18n/useIdioma'
import { formatearPrecio, precioParaLeer } from '../lib/precios'

export default function Precio({ valor, desde = false, mas = false }) {
  const { t } = useIdioma()
  return (
    <>
      <span aria-hidden="true">
        {desde && <span className="precio__desde">{t('desde')} </span>}
        {mas && '+'}
        {formatearPrecio(valor)}
      </span>
      <span className="solo-lectores">
        {mas ? `${t('mas')} ` : ''}
        {desde ? `${t('desde')} ` : ''}
        {precioParaLeer(valor)}
      </span>
    </>
  )
}
