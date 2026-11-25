import { useEffect, useMemo, useRef, useState } from 'react'
import { ETIQUETAS } from '../lib/etiquetas'
import { apiDeProductos } from './datosProductos'
import { nombreDeArchivo, SIN_CAMBIOS } from './fotos'
import { eliminarProductoConFoto, guardarProductoConFoto } from './guardarProducto'
import { nuevoId } from './procesarFoto'
import {
  formularioDesdeProducto,
  LARGO_MAX_DESCRIPCION,
  LARGO_MAX_NOMBRE_PRODUCTO,
  LARGO_MAX_NOMBRE_VARIANTE,
  MAX_VARIANTES,
  mensajeDeErrorProducto,
  ordenAlGuardar,
  precioMasBajo,
  precioParaEditar,
  validarProducto,
} from './productos'
import SelectorFoto from './SelectorFoto'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import Confirmacion from './ui/Confirmacion'
import Interruptor from './ui/Interruptor'
import Tarjeta from './ui/Tarjeta'

const idDeCampo = (clave) => `producto-${clave}`

// Alta y edición de un producto, en pantalla propia. Si guardar falla, no se pierde nada de lo
// escrito ni la foto preparada: "Reintentar" vuelve a mandar lo mismo.
//   original: el producto (null = alta) · onListo({ mensaje, huerfanos, foco }) · onSalir()
export default function FormularioProducto({ local, categorias, productos, original, categoriaInicial, onListo, onSalir }) {
  const [inicial] = useState(() => formularioDesdeProducto(original, categoriaInicial))
  const [formulario, setFormulario] = useState(inicial)
  const [foto, setFoto] = useState(SIN_CAMBIOS)
  const [preparando, setPreparando] = useState(false)
  const [errores, setErrores] = useState({})
  const [paso, setPaso] = useState('') // texto de progreso mientras se guarda
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(null) // { mensaje, huerfanos, enDuda }
  const [confirmando, setConfirmando] = useState(null) // null | 'eliminar' | 'descartar'
  const [eliminando, setEliminando] = useState(false)
  // El id de un producto nuevo se decide una sola vez: reintentar no lo carga dos veces.
  const [id] = useState(() => original?.id ?? nuevoId())
  const api = useMemo(() => apiDeProductos(local.id), [local.id])
  const pendientes = useRef(new Set()) // fotos subidas en intentos que quedaron en duda
  const siguienteClave = useRef(inicial.variantes.length)
  const montado = useRef(true)
  const focoPendiente = useRef(null)
  const eliminarRef = useRef(null)
  const cancelarRef = useRef(null)
  const agregarRef = useRef(null)

  const sucio = foto.tipo !== 'igual' || JSON.stringify(formulario) !== JSON.stringify(inicial)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // Aviso del navegador al recargar o cerrar con cambios sin guardar.
  useEffect(() => {
    if (!sucio && !guardando) return undefined
    const avisar = (evento) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio, guardando])

  // Mueve el foco después de que React dibuje (errores, filas nuevas, confirmaciones cerradas).
  useEffect(() => {
    const destino = focoPendiente.current
    if (!destino) return
    focoPendiente.current = null
    const nodo = typeof destino === 'string' ? document.getElementById(destino) : destino.current
    nodo?.focus()
  })

  const poner = (campo, valor) => {
    setFormulario((f) => ({ ...f, [campo]: valor }))
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e))
  }

  const ponerVariante = (indice, campo, valor) => {
    setFormulario((f) => ({ ...f, variantes: f.variantes.map((v, i) => (i === indice ? { ...v, [campo]: valor } : v)) }))
    setErrores((e) => ({ ...e, [`variante-${indice}-${campo}`]: undefined }))
  }

  const agregarVariante = () => {
    const clave = `n${siguienteClave.current++}`
    const indice = formulario.variantes.length
    // La primera opción arranca con el precio que ya estaba escrito.
    setFormulario((f) => ({ ...f, variantes: [...f.variantes, { clave, nombre: '', precio: f.variantes.length ? '' : f.precio }] }))
    focoPendiente.current = idDeCampo(`variante-${indice}-nombre`)
  }

  const quitarVariante = (indice) => {
    setFormulario((f) => {
      const variantes = f.variantes.filter((_, i) => i !== indice)
      // Al quitar la última, el precio principal queda con el que se venía mostrando.
      const minimo = precioMasBajo(f.variantes)
      return { ...f, variantes, precio: variantes.length === 0 && minimo !== null ? precioParaEditar(minimo) : f.precio }
    })
    setErrores((e) => Object.fromEntries(Object.entries(e).filter(([clave]) => !clave.startsWith('variante'))))
    focoPendiente.current = agregarRef
  }

  const alternarEtiqueta = (clave, marcada) => poner('etiquetas', marcada ? [...formulario.etiquetas, clave] : formulario.etiquetas.filter((e) => e !== clave))

  const alGuardar = async (evento) => {
    evento.preventDefault()
    if (guardando || preparando || eliminando) return
    const revision = validarProducto(formulario, { categorias, original })
    setErrores(revision.errores)
    if (!revision.ok) {
      focoPendiente.current = revision.primerError === 'variantes' ? agregarRef : idDeCampo(revision.primerError)
      return
    }

    setFallo(null)
    setConfirmando(null)
    setGuardando(true)
    const fila = { ...revision.datos }
    // El orden solo se manda si es nuevo o cambió de categoría (así no pisa un reordenamiento).
    if (!original || original.categoriaId !== fila.categoria_id) fila.orden = ordenAlGuardar(productos, original, fila.categoria_id)

    try {
      const { huerfanos } = await guardarProductoConFoto({
        api,
        localId: local.id,
        id,
        esNuevo: !original,
        fila,
        original,
        // Nombre único en cada intento: nunca se pisa un archivo ni se sirve uno viejo de la caché.
        foto: foto.tipo === 'nueva' ? { ...foto, nombre: nombreDeArchivo(fila.nombre, `${foto.id}${Date.now().toString(36)}`) } : foto,
        pendientes: [...pendientes.current],
        alPaso: (texto) => montado.current && setPaso(texto),
      })
      if (huerfanos.length) console.warn('Archivos sin borrar en Storage:', huerfanos)
      // Si mientras tanto la persona se fue a otra sección, no se la trae de vuelta.
      if (montado.current) onListo({ mensaje: `Guardado. ${original ? 'Actualizaste' : 'Cargaste'} “${fila.nombre}”.`, huerfanos, foco: `${id}:editar` })
    } catch (error) {
      if (error.urlEnDuda) pendientes.current.add(error.urlEnDuda)
      if (error.huerfanos?.length) console.warn('Archivos sin borrar en Storage:', error.huerfanos)
      if (!montado.current) return
      setFallo({ mensaje: mensajeDeErrorProducto(error), huerfanos: error.huerfanos ?? [], enDuda: Boolean(error.urlEnDuda) })
      setGuardando(false)
      setPaso('')
      focoPendiente.current = 'producto-fallo'
    }
  }

  const eliminar = async () => {
    setEliminando(true)
    setFallo(null)
    try {
      const { huerfanos } = await eliminarProductoConFoto({ api, localId: local.id, producto: original })
      if (huerfanos.length) console.warn('Archivos sin borrar en Storage:', huerfanos)
      if (montado.current) onListo({ mensaje: `Guardado. Eliminaste “${original.nombre}”.`, huerfanos, foco: 'titulo' })
    } catch (error) {
      if (!montado.current) return
      setEliminando(false)
      setConfirmando(null)
      setFallo({ mensaje: mensajeDeErrorProducto(error), huerfanos: [], enDuda: false, alEliminar: true })
      focoPendiente.current = 'producto-fallo'
    }
  }

  const conVariantes = formulario.variantes.length > 0
  const minimo = precioMasBajo(formulario.variantes)
  const ocupado = guardando || eliminando

  return (
    <form className="prod-form" onSubmit={alGuardar} noValidate>
      <Tarjeta className="prod-form__bloque">
        <SelectorFoto foto={foto} urlActual={original?.imagenUrl ?? null} bloqueado={ocupado} onCambiar={setFoto} onPreparando={setPreparando} />
      </Tarjeta>

      <Tarjeta className="prod-form__bloque">
        <Campo
          id={idDeCampo('nombre')}
          etiqueta="Nombre"
          name="nombre"
          value={formulario.nombre}
          onChange={(e) => poner('nombre', e.target.value)}
          maxLength={LARGO_MAX_NOMBRE_PRODUCTO + 20}
          ayuda={`Obligatorio. Hasta ${LARGO_MAX_NOMBRE_PRODUCTO} caracteres.`}
          error={errores.nombre}
          required
          autoComplete="off"
        />
        <Campo
          id={idDeCampo('descripcion')}
          etiqueta="Descripción (opcional)"
          name="descripcion"
          multilinea
          rows={3}
          value={formulario.descripcion}
          onChange={(e) => poner('descripcion', e.target.value)}
          ayuda={`${formulario.descripcion.length} de ${LARGO_MAX_DESCRIPCION} caracteres.`}
          error={errores.descripcion}
        />
        <Campo id={idDeCampo('categoriaId')} etiqueta="Categoría" lista name="categoria" value={formulario.categoriaId} onChange={(e) => poner('categoriaId', e.target.value)} error={errores.categoriaId}>
          {!categorias.some((c) => c.id === formulario.categoriaId) && <option value={formulario.categoriaId}>Elegí una categoría</option>}
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.activa ? '' : ' (oculta)'}
            </option>
          ))}
        </Campo>
        <Campo
          id={idDeCampo('precio')}
          etiqueta="Precio en pesos"
          name="precio"
          inputMode="decimal"
          value={conVariantes ? (minimo === null ? '' : precioParaEditar(minimo)) : formulario.precio}
          readOnly={conVariantes}
          onChange={(e) => poner('precio', e.target.value)}
          ayuda={conVariantes ? 'Se completa solo con el precio de la opción más barata.' : 'Por ejemplo 1.500 o 1500,50.'}
          error={conVariantes ? undefined : errores.precio}
          autoComplete="off"
        />
      </Tarjeta>

      <Tarjeta className="prod-form__bloque">
        <div className="prod__estados">
          <Interruptor marcado={formulario.disponible} etiqueta="Producto disponible" textoSi="Disponible" textoNo="Agotado" onCambiar={(valor) => poner('disponible', valor)} />
          <Interruptor marcado={formulario.destacado} etiqueta="Producto destacado" textoSi="Destacado" textoNo="Sin destacar" onCambiar={(valor) => poner('destacado', valor)} />
        </div>
        <fieldset className="prod-form__grupo">
          <legend className="ui-campo__etiqueta">Etiquetas</legend>
          <div className="prod-form__etiquetas">
            {ETIQUETAS.map((etiqueta) => (
              <label key={etiqueta.clave} className="prod-casilla" title={etiqueta.descripcion}>
                <input type="checkbox" checked={formulario.etiquetas.includes(etiqueta.clave)} onChange={(e) => alternarEtiqueta(etiqueta.clave, e.target.checked)} />
                <span>{etiqueta.nombre}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Tarjeta>

      <Tarjeta className="prod-form__bloque">
        <fieldset className="prod-form__grupo">
          <legend className="ui-campo__etiqueta">Opciones con precio (opcional)</legend>
          <p className="ui-campo__ayuda">Por ejemplo Chico y Grande. Hasta {MAX_VARIANTES}.</p>
          {formulario.variantes.map((variante, i) => (
            <div key={variante.clave} className="prod-variante" role="group" aria-label={`Opción ${i + 1}`}>
              <Campo
                id={idDeCampo(`variante-${i}-nombre`)}
                etiqueta={`Nombre de la opción ${i + 1}`}
                value={variante.nombre}
                onChange={(e) => ponerVariante(i, 'nombre', e.target.value)}
                maxLength={LARGO_MAX_NOMBRE_VARIANTE + 20}
                error={errores[`variante-${i}-nombre`]}
                autoComplete="off"
              />
              <Campo
                id={idDeCampo(`variante-${i}-precio`)}
                etiqueta={`Precio de la opción ${i + 1}`}
                inputMode="decimal"
                value={variante.precio}
                onChange={(e) => ponerVariante(i, 'precio', e.target.value)}
                error={errores[`variante-${i}-precio`]}
                autoComplete="off"
              />
              <Boton variante="fantasma" chico className="prod-variante__quitar" aria-label={`Quitar la opción ${i + 1}`} onClick={() => quitarVariante(i)}>
                Quitar
              </Boton>
            </div>
          ))}
          {errores.variantes && <p className="ui-campo__error">{errores.variantes}</p>}
          {formulario.variantes.length < MAX_VARIANTES ? (
            <Boton ref={agregarRef} onClick={agregarVariante}>
              Agregar opción
            </Boton>
          ) : (
            <p className="ui-campo__ayuda">Llegaste al máximo de {MAX_VARIANTES} opciones.</p>
          )}
        </fieldset>
      </Tarjeta>

      {fallo && (
        <div id="producto-fallo" tabIndex={-1} className="prod-form__fallo">
          <Alerta
            tipo="error"
            role="alert"
            titulo={fallo.mensaje}
            acciones={
              fallo.alEliminar ? null : (
                <Boton variante="primario" type="submit">
                  Reintentar
                </Boton>
              )
            }
          >
            {fallo.alEliminar ? 'El producto no se eliminó.' : 'Lo que escribiste sigue acá.'}
            {fallo.enDuda && ' No pudimos confirmar si el cambio llegó a guardarse: no borramos ninguna foto.'}
            {fallo.huerfanos.length > 0 && (
              <>
                {' '}
                Estos archivos pueden haber quedado sin usar (si reintentás y sale bien, se limpian los que se pueda; si no, avisale a OESTACK):
                <ul className="prod-archivos">
                  {fallo.huerfanos.map((ruta) => (
                    <li key={ruta}>{ruta}</li>
                  ))}
                </ul>
              </>
            )}
          </Alerta>
        </div>
      )}

      <div className="prod-form__progreso">
        <p role="status">{paso || (preparando ? 'Esperá a que la foto esté lista para guardar.' : '')}</p>
        {guardando && <progress aria-label="Guardando el producto" />}
      </div>

      <div className="ui-acciones">
        <Boton variante="primario" type="submit" cargando={guardando} textoCargando="Guardando…" deshabilitado={preparando || eliminando}>
          {original ? 'Guardar cambios' : 'Crear producto'}
        </Boton>
        <Boton ref={cancelarRef} deshabilitado={ocupado} onClick={() => (sucio ? setConfirmando('descartar') : onSalir())}>
          Cancelar
        </Boton>
      </div>

      {confirmando === 'descartar' && (
        <Confirmacion
          pregunta="¿Descartar los cambios?"
          detalle="Lo que escribiste y la foto que elegiste no se guardan."
          textoConfirmar="Sí, descartar"
          onConfirmar={onSalir}
          onCancelar={() => {
            setConfirmando(null)
            focoPendiente.current = cancelarRef
          }}
        />
      )}

      {original && (
        <div className="prod-form__eliminar">
          {confirmando === 'eliminar' ? (
            <Confirmacion
              pregunta={`¿Seguro que querés eliminar “${original.nombre}”?`}
              detalle="Se borra del menú junto con su foto. No se puede deshacer."
              textoConfirmar="Sí, eliminar"
              cargando={eliminando}
              onConfirmar={eliminar}
              onCancelar={() => {
                setConfirmando(null)
                focoPendiente.current = eliminarRef
              }}
            />
          ) : (
            <Boton ref={eliminarRef} variante="fantasma" className="cat__eliminar" deshabilitado={ocupado || preparando} onClick={() => setConfirmando('eliminar')}>
              Eliminar producto
            </Boton>
          )}
        </div>
      )}
    </form>
  )
}
