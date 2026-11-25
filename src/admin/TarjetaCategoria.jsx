import { useEffect, useId, useRef, useState } from 'react'
import { puedeEliminarCategoria, textoProductos } from './categorias'
import FormularioCategoria from './FormularioCategoria'
import PanelAdicionales from './PanelAdicionales'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Confirmacion from './ui/Confirmacion'
import Interruptor from './ui/Interruptor'
import Tarjeta from './ui/Tarjeta'

function Flecha({ arriba }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={arriba ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Una categoría en el panel: orden, visibilidad, edición, adicionales y borrado.
// Las acciones (props `acciones`) devuelven true si se guardó.
export default function TarjetaCategoria({ categoria, categorias, posicion, puedeEditar, ocupada, ordenando, acciones, registrarBoton }) {
  const [panel, setPanel] = useState(null) // null | 'editar' | 'eliminar'
  const [verAdicionales, setVerAdicionales] = useState(false)
  const [revisando, setRevisando] = useState(false) // contando productos antes de eliminar
  const [eliminando, setEliminando] = useState(false)
  const editarRef = useRef(null)
  const eliminarRef = useRef(null)
  const bloqueoRef = useRef(null)
  const volverA = useRef(null)
  const idAdicionales = useId()
  const idTitulo = useId()
  const { id, nombre, activa, cantidadProductos, adicionales } = categoria
  const esPrimera = posicion === 0
  const esUltima = posicion === categorias.length - 1
  const vacia = puedeEliminarCategoria(categoria)

  // Devuelve el foco al botón que abrió el panel; si se bloquea el borrado, va a la explicación.
  useEffect(() => {
    if (panel === null && volverA.current) {
      volverA.current.current?.focus()
      volverA.current = null
    }
    if (panel === 'eliminar' && !vacia) bloqueoRef.current?.focus()
  }, [panel, vacia])

  const cerrarPanel = (ref) => {
    volverA.current = ref
    setPanel(null)
  }

  const pedirEliminar = async () => {
    setRevisando(true)
    const ok = await acciones.recontar(id) // cantidad actual, no la de cuando se cargó la lista
    setRevisando(false)
    if (ok) setPanel('eliminar')
  }

  const confirmarEliminar = async () => {
    setEliminando(true)
    const ok = await acciones.eliminar(categoria)
    if (!ok) setEliminando(false) // si salió bien, la tarjeta desaparece
  }

  return (
    <Tarjeta como="li" className={`cat${activa ? '' : ' cat--oculta'}`} aria-labelledby={idTitulo} data-categoria={id}>
      <div className="cat__cabecera">
        <div className="cat__texto">
          <h2 className="cat__nombre" id={idTitulo}>
            {nombre}
          </h2>
          <p className="cat__meta">
            <span className="cat__cantidad">{textoProductos(cantidadProductos)}</span>
            <span aria-hidden="true"> · </span>
            <span>{adicionales.length === 1 ? '1 adicional' : `${adicionales.length} adicionales`}</span>
          </p>
        </div>
        {/* Con controles, "Visible" ya lo dice el interruptor: el chip solo destaca las ocultas. */}
        {(!activa || !puedeEditar) && <span className={`ui-chip cat__estado ${activa ? 'ui-chip--salvia' : ''}`}>{activa ? 'Visible' : 'Oculta'}</span>}
      </div>

      {cantidadProductos === 0 && <p className="cat__nota">Las categorías sin productos todavía no aparecen en el menú.</p>}

      {puedeEditar && panel !== 'editar' && (
        <div className="cat__controles">
          <div className="cat__orden" role="group" aria-label={`Orden de ${nombre}`}>
            <Boton ref={(n) => registrarBoton(`${id}:subir`, n)} icono aria-label={`Subir ${nombre}`} deshabilitado={esPrimera || ordenando} onClick={() => acciones.mover(id, -1)}>
              <Flecha arriba />
            </Boton>
            <Boton ref={(n) => registrarBoton(`${id}:bajar`, n)} icono aria-label={`Bajar ${nombre}`} deshabilitado={esUltima || ordenando} onClick={() => acciones.mover(id, 1)}>
              <Flecha />
            </Boton>
          </div>
          <Interruptor marcado={activa} cargando={ocupada} etiqueta={`Mostrar ${nombre} en el menú`} onCambiar={(valor) => acciones.visibilidad(categoria, valor)} />
        </div>
      )}

      {puedeEditar && panel === 'editar' && (
        <FormularioCategoria
          categorias={categorias}
          categoria={categoria}
          textoGuardar="Guardar"
          onCancelar={() => cerrarPanel(editarRef)}
          onGuardar={async (nuevoNombre) => {
            const ok = await acciones.renombrar(categoria, nuevoNombre)
            if (ok) cerrarPanel(editarRef)
            return ok
          }}
        />
      )}

      <div className="cat__botones">
        {puedeEditar && panel !== 'editar' && (
          <Boton ref={editarRef} variante="fantasma" chico aria-label={`Editar ${nombre}`} onClick={() => setPanel('editar')}>
            Editar
          </Boton>
        )}
        <Boton variante="fantasma" chico aria-expanded={verAdicionales} aria-controls={verAdicionales ? idAdicionales : undefined} aria-label={`Adicionales de ${nombre} (${adicionales.length})`} onClick={() => setVerAdicionales((v) => !v)}>
          Adicionales ({adicionales.length})
        </Boton>
        {puedeEditar && panel !== 'editar' && (
          <Boton ref={eliminarRef} variante="fantasma" chico className="cat__eliminar" aria-label={`Eliminar ${nombre}`} cargando={revisando} textoCargando="Revisando…" onClick={pedirEliminar}>
            Eliminar
          </Boton>
        )}
      </div>

      {panel === 'eliminar' && vacia && (
        <Confirmacion
          pregunta={`¿Seguro que querés eliminar “${nombre}”?`}
          detalle="No tiene productos. Esta acción no se puede deshacer."
          textoConfirmar="Sí, eliminar"
          cargando={eliminando}
          onConfirmar={confirmarEliminar}
          onCancelar={() => cerrarPanel(eliminarRef)}
        />
      )}

      {panel === 'eliminar' && !vacia && (
        <div
          ref={bloqueoRef}
          tabIndex={-1}
          className="cat__bloqueo"
          onKeyDown={(e) => e.key === 'Escape' && cerrarPanel(eliminarRef)}
        >
          <Alerta
            tipo="info"
            titulo={`No se puede eliminar: tiene ${textoProductos(cantidadProductos).toLowerCase()}.`}
            acciones={
              <>
                {activa && (
                  <Boton
                    variante="primario"
                    cargando={ocupada}
                    textoCargando="Ocultando…"
                    onClick={async () => {
                      if (await acciones.visibilidad(categoria, false)) cerrarPanel(eliminarRef)
                    }}
                  >
                    Ocultar categoría
                  </Boton>
                )}
                <Boton onClick={() => cerrarPanel(eliminarRef)}>Cerrar</Boton>
              </>
            }
          >
            {activa ? 'Si la ocultás, deja de verse en el menú y no perdés los productos.' : 'Ya está oculta: no se ve en el menú.'}
          </Alerta>
        </div>
      )}

      {verAdicionales &&
        (puedeEditar ? (
          <PanelAdicionales categoria={categoria} idPanel={idAdicionales} onGuardar={(lista, mensaje) => acciones.adicionales(categoria, lista, mensaje)} />
        ) : (
          <ul className="adic adic__lista" id={idAdicionales} role="list">
            {adicionales.map((a) => (
              <li key={a.nombre}>{a.nombre}</li>
            ))}
          </ul>
        ))}
    </Tarjeta>
  )
}
