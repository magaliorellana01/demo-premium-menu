// ¿El dispositivo pidió reducir el movimiento? (prefers-reduced-motion)
export function reducirMovimiento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Comportamiento de scroll programático: suave, salvo que se pida reducir el movimiento.
export function comportamientoScroll() {
  return reducirMovimiento() ? 'auto' : 'smooth'
}
