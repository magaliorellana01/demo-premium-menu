import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { anuncioDePosicion, mensajeDeError, moverCategoria, renumerar, siguienteOrden } from './categorias'
import { actualizarCategoria, contarProductos, crearCategoria, eliminarCategoria, reordenarCategorias } from './datosCategorias'
import FormularioCategoria from './FormularioCategoria'
import TarjetaCategoria from './TarjetaCategoria'
import Alerta from './ui/Alerta'
import AvisoEstado from './ui/AvisoEstado'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import { useAviso } from './ui/useAviso'
import { usePermisos } from './useAcceso'
import { useCategorias } from './useCategorias'

function Esqueleto() {
  return (
    <ul className="adm-lista" role="presentation" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="ui-tarjeta cat cat-esqueleto">
          <span className="cat-esqueleto__barra cat-esqueleto__barra--titulo" />
          <span className="cat-esqueleto__barra cat-esqueleto__barra--meta" />
          <span className="cat-esqueleto__barra cat-esqueleto__barra--controles" />
        </li>
      ))}
    </ul>
  )
}

// /admin/:slug/categorias
export default function PaginaCategorias() {
  const { local } = useOutletContext()
  const { puedeGestionarMenu } = usePermisos(local.slug)
  const { cargando, error, categorias, cambiar, reintentar, refrescar } = useCategorias(local.id)
  const { aviso, exito, error: avisarError, cerrar } = useAviso()
  const [creando, setCreando] = useState(false)
  const [ocupada, setOcupada] = useState(null) // id de la categoría que está guardando
  const [ordenando, setOrdenando] = useState(false)
  const botones = useRef(new Map())
  const focoPendiente = useRef(null)
  const tituloRef = useRef(null)
  const nuevaRef = useRef(null)

  const registrarBoton = (clave, nodo) => {
    if (nodo) botones.current.set(clave, nodo)
    else botones.current.delete(clave)
  }

  // Al reordenar, React mueve el nodo y el navegador pierde el foco: se lo devuelve.
  useEffect(() => {
    if (!focoPendiente.current || ordenando) return
    const destino = focoPendiente.current === 'titulo' ? tituloRef.current : focoPendiente.current === 'nueva' ? nuevaRef.current : botones.current.get(focoPendiente.current)
    focoPendiente.current = null
    destino?.focus()
  }, [categorias, ordenando, creando])

  const reemplazar = (categoria) => cambiar((lista) => lista.map((c) => (c.id === categoria.id ? categoria : c)))

  // Ejecuta un guardado: avisa el resultado y devuelve true/false (el formulario no pierde nada si falla).
  const guardar = async (tarea, mensaje) => {
    cerrar()
    try {
      await tarea()
      if (mensaje) exito(mensaje)
      return true
    } catch (e) {
      avisarError(mensajeDeError(e))
      if (['22023', '23503', 'SIN_FILAS'].includes(e?.code)) refrescar() // la lista quedó vieja
      return false
    }
  }

  const conOcupada = async (id, tarea, mensaje) => {
    setOcupada(id)
    const ok = await guardar(tarea, mensaje)
    setOcupada(null)
    return ok
  }

  const acciones = {
    renombrar: (categoria, nombre) =>
      guardar(async () => reemplazar(await actualizarCategoria(local.id, categoria.id, { nombre })), `Guardado. La categoría ahora se llama “${nombre}”.`),

    visibilidad: (categoria, activa) =>
      conOcupada(
        categoria.id,
        async () => reemplazar(await actualizarCategoria(local.id, categoria.id, { activa })),
        `Guardado. “${categoria.nombre}” ahora está ${activa ? 'visible' : 'oculta'} en el menú.`,
      ),

    adicionales: (categoria, adicionales, mensaje) =>
      guardar(async () => reemplazar(await actualizarCategoria(local.id, categoria.id, { adicionales })), mensaje),

    mover: async (id, direccion) => {
      if (ordenando) return
      const nueva = moverCategoria(categorias, id, direccion)
      if (nueva === categorias) return
      setOrdenando(true)
      const ok = await guardar(async () => {
        await reordenarCategorias(local.id, nueva.map((c) => c.id))
        cambiar(() => renumerar(nueva))
      }, `Guardado. ${anuncioDePosicion(nueva, id)}`)
      focoPendiente.current = `${id}:${direccion < 0 ? 'subir' : 'bajar'}`
      setOrdenando(false)
      return ok
    },

    recontar: (id) =>
      guardar(async () => {
        const cantidadProductos = await contarProductos(id)
        cambiar((lista) => lista.map((c) => (c.id === id ? { ...c, cantidadProductos } : c)))
      }),

    eliminar: (categoria) =>
      guardar(async () => {
        await eliminarCategoria(local.id, categoria.id)
        focoPendiente.current = 'titulo'
        cambiar((lista) => lista.filter((c) => c.id !== categoria.id))
      }, `Guardado. Eliminaste “${categoria.nombre}”.`),
  }

  const crear = async (nombre) => {
    const ok = await guardar(async () => {
      const nueva = await crearCategoria(local.id, { nombre, orden: siguienteOrden(categorias) })
      cambiar((lista) => [...lista, nueva])
    }, `Guardado. Creaste “${nombre}”.`)
    if (ok) {
      focoPendiente.current = 'nueva'
      setCreando(false)
    }
    return ok
  }

  const cerrarAlta = () => {
    focoPendiente.current = 'nueva'
    setCreando(false)
  }

  const vacio = !cargando && !error && categorias.length === 0

  return (
    <>
      <div className="cat-encabezado">
        <h1 className="adm-titulo" ref={tituloRef} tabIndex={-1}>
          Categorías
        </h1>
        {puedeGestionarMenu && !vacio && !creando && (
          <Boton ref={nuevaRef} variante="primario" deshabilitado={cargando || Boolean(error)} onClick={() => setCreando(true)}>
            Nueva categoría
          </Boton>
        )}
      </div>

      {creando && (
        <Tarjeta>
          <FormularioCategoria categorias={categorias} textoGuardar="Crear categoría" onGuardar={crear} onCancelar={cerrarAlta} />
        </Tarjeta>
      )}

      <p className="solo-lectores" role="status">
        {cargando ? 'Cargando las categorías…' : ''}
      </p>

      {cargando && <Esqueleto />}

      {error && (
        <Alerta
          tipo="error"
          role="alert"
          titulo="No pudimos cargar las categorías"
          acciones={
            <Boton variante="primario" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          Revisá tu conexión y probá de nuevo.
        </Alerta>
      )}

      {vacio && !creando && (
        <Tarjeta className="cat-vacio">
          <h2 className="adm-subtitulo">Todavía no hay categorías</h2>
          <p className="adm-texto--suave">Las categorías ordenan tu menú: por ejemplo Cafés, Postres o Bebidas.</p>
          {puedeGestionarMenu && (
            <Boton ref={nuevaRef} variante="primario" onClick={() => setCreando(true)}>
              Crear la primera categoría
            </Boton>
          )}
        </Tarjeta>
      )}

      {!cargando && !error && categorias.length > 0 && (
        <ol className="adm-lista" aria-label="Categorías, en el orden del menú">
          {categorias.map((categoria, posicion) => (
            <TarjetaCategoria
              key={categoria.id}
              categoria={categoria}
              categorias={categorias}
              posicion={posicion}
              puedeEditar={puedeGestionarMenu}
              ocupada={ocupada === categoria.id}
              ordenando={ordenando}
              acciones={acciones}
              registrarBoton={registrarBoton}
            />
          ))}
        </ol>
      )}

      <AvisoEstado aviso={aviso} onCerrar={cerrar} />
    </>
  )
}
