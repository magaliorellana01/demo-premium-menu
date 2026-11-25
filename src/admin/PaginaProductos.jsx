import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { actualizarProducto, reordenarProductos } from './datosProductos'
import FilaProducto from './FilaProducto'
import { agruparPorCategoria, anuncioDeProducto, ESTADOS, filtrarGrupos, mensajeDeErrorProducto, moverProducto, ocultaProductos, renumerar } from './productos'
import Alerta from './ui/Alerta'
import AvisoEstado from './ui/AvisoEstado'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import Tarjeta from './ui/Tarjeta'
import { useAviso } from './ui/useAviso'
import { usePermisos } from './useAcceso'
import { useMenu } from './useMenu'

const NOMBRES_DE_ESTADO = { todos: 'Todos', disponibles: 'Disponibles', agotados: 'Agotados' }

function Esqueleto() {
  return (
    <ul className="adm-lista" role="presentation" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="ui-tarjeta prod prod-esqueleto">
          <span className="cat-esqueleto__barra cat-esqueleto__barra--titulo" />
          <span className="cat-esqueleto__barra cat-esqueleto__barra--meta" />
          <span className="cat-esqueleto__barra cat-esqueleto__barra--controles" />
        </li>
      ))}
    </ul>
  )
}

function mensajeAlCambiar(nombre, campo, valor) {
  if (campo === 'disponible') return `Guardado. “${nombre}” figura como ${valor ? 'disponible' : 'agotado'}.`
  return `Guardado. “${nombre}” ${valor ? 'ahora está' : 'ya no está'} en destacados.`
}

// /admin/:slug/productos
export default function PaginaProductos() {
  const { local } = useOutletContext()
  const { puedeGestionarMenu } = usePermisos(local.slug)
  const { cargando, error, categorias, productos, cambiarProductos, reintentar, refrescar } = useMenu(local.id)
  const { aviso, exito, error: avisarError, cerrar } = useAviso()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  // Los filtros viven en el estado (el campo responde al instante) y se copian a la URL, así
  // se conservan al ir al formulario y volver. (Sin useSearchParams: sumaría código al archivo
  // principal, el que descarga el menú público.)
  const [filtros, setFiltros] = useState(() => {
    const url = new URLSearchParams(ubicacion.search)
    return {
      consulta: url.get('q') ?? '',
      categoriaId: url.get('categoria') ?? '',
      estado: ESTADOS.includes(url.get('estado')) ? url.get('estado') : 'todos',
    }
  })
  const [ocupadas, setOcupadas] = useState(() => new Set()) // "id:campo" guardando
  const [ordenando, setOrdenando] = useState(false)
  const [llegada] = useState(() => ubicacion.state) // lo que manda el formulario al volver
  const [huerfanos, setHuerfanos] = useState(() => llegada?.huerfanos ?? [])
  const elementos = useRef(new Map())
  const focoPendiente = useRef(llegada?.foco ?? null)
  const tituloRef = useRef(null)
  const anunciado = useRef(false)

  const registrar = (clave, nodo) => {
    if (nodo) elementos.current.set(clave, nodo)
    else elementos.current.delete(clave)
  }

  // El aviso de lo que pasó en el formulario se muestra una vez (recargar no lo repite).
  useEffect(() => {
    if (anunciado.current || !llegada?.mensaje) return
    anunciado.current = true
    exito(llegada.mensaje)
    navegar({ pathname: ubicacion.pathname, search: ubicacion.search }, { replace: true, state: null })
  }, [llegada, exito, navegar, ubicacion.pathname, ubicacion.search])

  // Devuelve el foco después de reordenar, filtrar o volver del formulario.
  useEffect(() => {
    if (!focoPendiente.current || cargando || ordenando) return
    const destino = focoPendiente.current === 'titulo' ? tituloRef.current : (elementos.current.get(focoPendiente.current) ?? tituloRef.current)
    focoPendiente.current = null
    destino?.focus()
  }, [cargando, ordenando, productos])

  const copiarALaUrl = (search) => navegar({ pathname: ubicacion.pathname, search }, { replace: true, preventScrollReset: true })

  const cambiarFiltro = (campo, valor) => {
    const nuevos = { ...filtros, [campo]: valor }
    setFiltros(nuevos)
    const url = new URLSearchParams()
    if (nuevos.consulta.trim()) url.set('q', nuevos.consulta)
    if (nuevos.categoriaId) url.set('categoria', nuevos.categoriaId)
    if (nuevos.estado !== 'todos') url.set('estado', nuevos.estado)
    copiarALaUrl(url.size ? `?${url}` : '')
  }

  const guardar = async (tarea, mensaje) => {
    cerrar()
    try {
      await tarea()
      if (mensaje) exito(mensaje)
      return true
    } catch (e) {
      avisarError(mensajeDeErrorProducto(e))
      if (['22023', '23503', 'SIN_FILAS'].includes(e?.code)) refrescar() // la lista quedó vieja
      return false
    }
  }

  const grupos = agruparPorCategoria(categorias, productos)
  const visibles = filtrarGrupos(grupos, filtros)
  const reordenable = !ocultaProductos(filtros)

  const marcarOcupada = (clave, ocupada) =>
    setOcupadas((actual) => {
      const nuevo = new Set(actual)
      if (ocupada) nuevo.add(clave)
      else nuevo.delete(clave)
      return nuevo
    })

  const acciones = {
    cambiar: async (producto, campo, valor) => {
      const clave = `${producto.id}:${campo}`
      marcarOcupada(clave, true)
      await guardar(async () => {
        const guardado = await actualizarProducto(local.id, producto.id, { [campo]: valor })
        // Si con el filtro de estado la fila deja de verse, el foco no puede quedar en el aire.
        if (campo === 'disponible' && filtros.estado !== 'todos') focoPendiente.current = 'titulo'
        // Solo el campo cambiado: dos cambios seguidos en la misma fila no se pisan.
        cambiarProductos((lista) => lista.map((p) => (p.id === producto.id ? { ...p, [campo]: guardado[campo] } : p)))
      }, mensajeAlCambiar(producto.nombre, campo, valor))
      marcarOcupada(clave, false)
    },

    mover: async (producto, direccion) => {
      if (ordenando) return
      const grupo = grupos.find((g) => g.categoria.id === producto.categoriaId)
      const nueva = moverProducto(grupo.productos, producto.id, direccion)
      if (nueva === grupo.productos) return
      setOrdenando(true)
      await guardar(
        async () => {
          await reordenarProductos(local.id, grupo.categoria.id, nueva.map((p) => p.id))
          const ordenes = new Map(renumerar(nueva).map((p) => [p.id, p.orden]))
          cambiarProductos((lista) => lista.map((p) => (ordenes.has(p.id) ? { ...p, orden: ordenes.get(p.id) } : p)))
        },
        `Guardado. ${anuncioDeProducto(nueva, producto.id, grupo.categoria.nombre)}`,
      )
      focoPendiente.current = `${producto.id}:${direccion < 0 ? 'subir' : 'bajar'}`
      setOrdenando(false)
    },
  }

  const listo = !cargando && !error
  const sinCategorias = listo && categorias.length === 0
  const sinProductos = listo && categorias.length > 0 && productos.length === 0
  const hayLista = listo && productos.length > 0
  const rutaBase = `/admin/${local.slug}/productos`
  const estadoNavegacion = { volver: ubicacion.search }

  return (
    <>
      <div className="cat-encabezado">
        <h1 className="adm-titulo" ref={tituloRef} tabIndex={-1}>
          Productos
        </h1>
        {puedeGestionarMenu && hayLista && (
          <Boton ref={(n) => registrar('nuevo', n)} variante="primario" to={`${rutaBase}/nuevo`} state={estadoNavegacion}>
            Nuevo producto
          </Boton>
        )}
      </div>

      {huerfanos.length > 0 && (
        <Alerta tipo="info" role="status" titulo="Quedaron fotos viejas sin borrar" acciones={<Boton onClick={() => setHuerfanos([])}>Entendido</Boton>}>
          El cambio se guardó y el menú no se ve afectado, pero estos archivos siguen ocupando espacio. Avisale a OESTACK:
          <ul className="prod-archivos">
            {huerfanos.map((ruta) => (
              <li key={ruta}>{ruta}</li>
            ))}
          </ul>
        </Alerta>
      )}

      <p className="solo-lectores" role="status">
        {cargando ? 'Cargando los productos…' : ''}
      </p>

      {cargando && (
        <>
          <div className="prod-filtros prod-filtros--esqueleto" aria-hidden="true">
            <span className="cat-esqueleto__barra" />
            <span className="cat-esqueleto__barra" />
            <span className="cat-esqueleto__barra" />
          </div>
          <Esqueleto />
        </>
      )}

      {error && (
        <Alerta
          tipo="error"
          role="alert"
          titulo="No pudimos cargar los productos"
          acciones={
            <Boton variante="primario" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          Revisá tu conexión y probá de nuevo.
        </Alerta>
      )}

      {sinCategorias && (
        <Tarjeta className="cat-vacio">
          <h2 className="adm-subtitulo">Primero creá una categoría</h2>
          <p className="adm-texto--suave">Cada producto va dentro de una categoría (por ejemplo Cafés o Postres).</p>
          {puedeGestionarMenu && (
            <Boton variante="primario" to={`/admin/${local.slug}/categorias`}>
              Ir a Categorías
            </Boton>
          )}
        </Tarjeta>
      )}

      {sinProductos && (
        <Tarjeta className="cat-vacio">
          <h2 className="adm-subtitulo">Todavía no hay productos</h2>
          <p className="adm-texto--suave">Cargá el primero con su precio y, si querés, una foto.</p>
          {puedeGestionarMenu && (
            <Boton variante="primario" to={`${rutaBase}/nuevo`} state={estadoNavegacion}>
              Cargar el primer producto
            </Boton>
          )}
        </Tarjeta>
      )}

      {hayLista && (
        <>
          <form className="prod-filtros" role="search" aria-label="Filtrar productos" onSubmit={(e) => e.preventDefault()}>
            <Campo etiqueta="Buscar por nombre" type="search" value={filtros.consulta} onChange={(e) => cambiarFiltro('consulta', e.target.value)} maxLength={80} autoComplete="off" enterKeyHint="search" />
            <Campo etiqueta="Categoría" lista value={filtros.categoriaId} onChange={(e) => cambiarFiltro('categoriaId', e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Campo>
            <Campo etiqueta="Estado" lista value={filtros.estado} onChange={(e) => cambiarFiltro('estado', e.target.value)}>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {NOMBRES_DE_ESTADO[estado]}
                </option>
              ))}
            </Campo>
          </form>

          <p className="prod-cuenta" role="status">
            {visibles.total === productos.length ? `${productos.length === 1 ? '1 producto' : `${productos.length} productos`}` : `${visibles.total} de ${productos.length} productos`}
          </p>
          {!reordenable && puedeGestionarMenu && <p className="cat__nota">Para cambiar el orden, borrá la búsqueda y elegí el estado “Todos”.</p>}

          {visibles.grupos.length === 0 && (
            <Tarjeta className="cat-vacio">
              <p>No hay productos que coincidan.</p>
              <Boton
                onClick={() => {
                  setFiltros({ consulta: '', categoriaId: '', estado: 'todos' })
                  copiarALaUrl('')
                  tituloRef.current?.focus()
                }}
              >
                Quitar filtros
              </Boton>
            </Tarjeta>
          )}

          {visibles.grupos.map((grupo) => (
            <section key={grupo.categoria.id} className="prod-grupo" aria-labelledby={`grupo-${grupo.categoria.id}`}>
              <div className="prod-grupo__cabecera">
                <h2 className="adm-subtitulo" id={`grupo-${grupo.categoria.id}`}>
                  {grupo.categoria.nombre}
                </h2>
                {!grupo.categoria.activa && <span className="ui-chip">Categoría oculta</span>}
              </div>
              {grupo.productos.length === 0 ? (
                <p className="adm-texto--suave">Sin productos en esta categoría.</p>
              ) : (
                <ol className="adm-lista" aria-label={`Productos de ${grupo.categoria.nombre}, en el orden del menú`}>
                  {grupo.productos.map((producto, posicion) => (
                    <FilaProducto
                      key={producto.id}
                      producto={producto}
                      posicion={posicion}
                      cantidad={grupo.productos.length}
                      puedeEditar={puedeGestionarMenu}
                      puedeOrdenar={reordenable}
                      ocupadas={ocupadas}
                      ordenando={ordenando}
                      rutaEditar={`${rutaBase}/${producto.id}`}
                      estadoEditar={estadoNavegacion}
                      acciones={acciones}
                      registrar={registrar}
                    />
                  ))}
                </ol>
              )}
            </section>
          ))}
        </>
      )}

      <AvisoEstado aviso={aviso} onCerrar={cerrar} />
    </>
  )
}
