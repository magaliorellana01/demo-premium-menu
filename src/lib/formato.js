const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

// 4200 -> "$ 4.200" (el espacio es el que usa Intl para es-AR)
export function formatearPrecio(valor) {
  return formatoPesos.format(valor)
}
