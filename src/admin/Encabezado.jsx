import BarraUsuario from './BarraUsuario'

// Encabezado del panel (superficie espresso). `children` agrega la línea del local.
export default function Encabezado({ rol = null, children = null }) {
  return (
    <header className="adm-encabezado">
      <div className="adm-encabezado__interior">
        <div className="adm-encabezado__fila">
          <p className="adm-marca">OESTACK · Panel</p>
          <BarraUsuario rol={rol} />
        </div>
        {children}
      </div>
    </header>
  )
}
