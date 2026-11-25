import Encabezado from './Encabezado'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
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
      <Encabezado rol={acceso.esAdmin ? 'admin' : null} />
      <main className="adm-contenido adm-contenido--sin-pestanas" id="contenido">
        <Tarjeta como="section" className="adm-bloque">
          <h1 className="adm-titulo">{titulo}</h1>
          {!acceso.esAdmin && <p>Si creés que es un error, pedile ayuda a OESTACK.</p>}
          <div className="ui-acciones">
            <Boton variante="primario" to="/admin">
              Volver al panel
            </Boton>
          </div>
        </Tarjeta>
      </main>
    </div>
  )
}
