import { useOutletContext } from 'react-router-dom'

// Páginas que se completan en las próximas tareas (categorías, productos y ajustes).
// `soloDueno`: la sección es de los datos del local, que solo edita un owner (o un admin de OESTACK).
export default function Proximamente({ titulo, soloDueno = false }) {
  const { permisos } = useOutletContext()

  return (
    <>
      <h1 className="adm-titulo">{titulo}</h1>
      <p className="adm-texto">Próximamente.</p>
      {soloDueno && !permisos.puedeEditarLocal && (
        <p className="adm-texto adm-texto--suave">Cuando esté lista, solo el dueño del local va a poder editar estos datos.</p>
      )}
    </>
  )
}
