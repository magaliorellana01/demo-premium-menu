import { useEffect } from 'react'
import { MARCA_DEMO } from '../lib/demo'
import Pie from './Pie'

// Pantalla completa con la marca para avisos ("local no encontrado", error de carga).
// children: el texto y las acciones (enlace o botón para volver a intentar).
export default function PantallaMensaje({ titulo, children }) {
  useEffect(() => {
    document.title = `${titulo} · ${MARCA_DEMO.nombre}`
  }, [titulo])

  return (
    <>
      <main className="pantalla">
        <img className="pantalla__logo" src={MARCA_DEMO.logo} alt={MARCA_DEMO.nombre} width="560" height="111" />
        <h1 className="pantalla__titulo">{titulo}</h1>
        {children}
      </main>
      <Pie />
    </>
  )
}
