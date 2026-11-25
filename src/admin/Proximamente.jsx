import { useOutletContext } from 'react-router-dom'
import Tarjeta from './ui/Tarjeta'

// Páginas que se completan en las próximas tareas (productos y ajustes).
// `soloDueno`: la sección es de los datos del local, que solo edita un owner (o un admin de OESTACK).
export default function Proximamente({ titulo, soloDueno = false }) {
  const { permisos } = useOutletContext()

  return (
    <>
      <h1 className="adm-titulo">{titulo}</h1>
      <Tarjeta className="adm-bloque">
        <p>Próximamente.</p>
        {soloDueno && !permisos.puedeEditarLocal && (
          <p className="adm-texto--suave">Cuando esté lista, solo el dueño del local va a poder editar estos datos.</p>
        )}
      </Tarjeta>
    </>
  )
}
