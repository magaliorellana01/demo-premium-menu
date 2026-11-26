// "Atrás" y "adelante" del navegador, ANTES de que se entere el router.
//
// Sobre window, los "popstate" corren en el orden en que se registraron (pedir la fase de
// captura no alcanza), y React redibuja en el acto con el del router: quien se registre después
// llega tarde y la pantalla ya se desmontó. Por eso este se registra al importarlo desde
// main.jsx, antes de montar la app. Lo usa el panel para no perder cambios sin guardar
// (admin/GuardaDeSalida.jsx); el menú público no pone ninguna guardia.
let guardia = null

window.addEventListener('popstate', (evento) => guardia?.(evento))

/** Pone la función que ve cada "popstate" primero. Devuelve cómo sacarla. */
export function ponerGuardiaDeAtras(funcion) {
  guardia = funcion
  return () => {
    if (guardia === funcion) guardia = null
  }
}
