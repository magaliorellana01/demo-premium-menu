import { useOutletContext } from 'react-router-dom'
import EditorAjustes from './EditorAjustes'
import { usePermisos } from './useAcceso'
import { useAjustes } from './useAjustes'
import { mensajeDeErrorAjustes } from './ajustes'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'

// /admin/:slug/ajustes: datos, horarios, aviso, apariencia y logo del local. Dueño y admin
// editan; el editor lo ve en modo lectura. Es comodidad: lo que manda es la base.
export default function PaginaAjustes() {
  const { local } = useOutletContext()
  const { puedeEditarLocal, esAdmin } = usePermisos(local.slug)
  const { cargando, error, fila, producto, ponerFila, reintentar } = useAjustes(local.id)

  return (
    <div className="aj">
      <h1 className="adm-titulo">Ajustes</h1>
      {!puedeEditarLocal && <Alerta tipo="info">Estás en modo lectura: solo el dueño del local puede editar estos datos.</Alerta>}
      <p className="solo-lectores" role="status">
        {cargando ? 'Cargando los ajustes…' : ''}
      </p>

      {cargando ? (
        <div className="aj-rejilla" aria-hidden="true">
          <div className="aj-vista">
            <div className="ui-tarjeta aj-esqueleto aj-esqueleto--vista" />
          </div>
          <div className="aj-secciones">
            <div className="ui-tarjeta aj-esqueleto" />
            <div className="ui-tarjeta aj-esqueleto" />
          </div>
        </div>
      ) : error ? (
        <Alerta
          tipo="error"
          role="alert"
          titulo="No pudimos cargar los ajustes"
          acciones={
            <Boton variante="primario" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {mensajeDeErrorAjustes(error) === mensajeDeErrorAjustes(null) ? 'Revisá tu conexión y probá de nuevo.' : mensajeDeErrorAjustes(error)}
        </Alerta>
      ) : (
        <EditorAjustes key={fila.id} fila={fila} producto={producto} ponerFila={ponerFila} soloLectura={!puedeEditarLocal} esAdmin={esAdmin} />
      )}
    </div>
  )
}
