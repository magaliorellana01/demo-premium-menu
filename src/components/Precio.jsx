import { formatearPrecio, precioParaLeer } from '../lib/precios'

// Un precio para la vista y para el lector de pantalla. En pantalla se ve "$4.200", "desde $4.200"
// o "+$600"; a los lectores se les da "4.200 pesos", "desde 4.200 pesos" o "más 600 pesos" en vez
// del signo $ (que no siempre leen bien) o del signo +.
//   valor: número de pesos · desde: antepone "desde" · mas: es un adicional (se suma)
export default function Precio({ valor, desde = false, mas = false }) {
  return (
    <>
      <span aria-hidden="true">
        {desde && <span className="precio__desde">desde </span>}
        {mas && '+'}
        {formatearPrecio(valor)}
      </span>
      <span className="solo-lectores">
        {mas ? 'más ' : ''}
        {desde ? 'desde ' : ''}
        {precioParaLeer(valor)}
      </span>
    </>
  )
}
