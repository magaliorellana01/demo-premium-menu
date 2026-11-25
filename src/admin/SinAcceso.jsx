import { Link } from 'react-router-dom'
import BarraUsuario from './BarraUsuario'
import { useAcceso } from './useAcceso'

// "No tenés acceso a este local". A propósito no dice si el local existe: para alguien que no es
// admin, un local ajeno y uno inexistente se ven igual. Un admin de OESTACK ve todos los locales,
// así que para él un slug que no aparece sí es "no existe".
export default function SinAcceso() {
  const { acceso } = useAcceso()
  const titulo = acceso.esAdmin ? 'No encontramos ese local' : 'No tenés acceso a este local'

  return (
    <div className="adm-pagina">
      <title>Panel · OESTACK</title>
      <header className="adm-cabecera adm-cabecera--simple">
        <div className="adm-cabecera__fila">
          <p className="adm-marca">
            OESTACK <span>Panel</span>
          </p>
          <BarraUsuario rol={acceso.esAdmin ? 'admin' : null} />
        </div>
      </header>
      <main className="adm-contenido adm-contenido--angosto" id="contenido">
        <section className="adm-tarjeta adm-tarjeta--aviso">
          <h1 className="adm-titulo">{titulo}</h1>
          {!acceso.esAdmin && <p className="adm-texto">Si creés que es un error, pedile ayuda a OESTACK.</p>}
          <div className="adm-acciones">
            <Link className="adm-boton adm-boton--primario" to="/admin">
              Volver al panel
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
