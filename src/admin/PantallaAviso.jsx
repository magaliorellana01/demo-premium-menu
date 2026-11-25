import Tarjeta from './ui/Tarjeta'

// Pantalla centrada con la franja de marca: errores y avisos que ocupan toda la vista.
export default function PantallaAviso({ titulo, children, acciones }) {
  return (
    <main className="adm-centro">
      <Tarjeta className="adm-portada">
        <div className="adm-portada__franja">
          <p className="adm-marca">OESTACK · Panel</p>
          <h1>{titulo}</h1>
        </div>
        <div className="adm-portada__cuerpo">
          {children}
          {acciones && <div className="ui-acciones">{acciones}</div>}
        </div>
      </Tarjeta>
    </main>
  )
}
