import { useNavigate, useOutletContext, useParams, useLocation } from 'react-router-dom'
import FormularioProducto from './FormularioProducto'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import { usePermisos } from './useAcceso'
import { useMenu } from './useMenu'

// /admin/:slug/productos/nuevo y /admin/:slug/productos/:productoId
export default function PaginaProducto() {
  const { local } = useOutletContext()
  const { productoId } = useParams()
  const { puedeGestionarMenu } = usePermisos(local.slug)
  const { cargando, error, categorias, productos, reintentar } = useMenu(local.id)
  const navegar = useNavigate()
  const ubicacion = useLocation()

  // Los filtros de la lista, para volver a verla como estaba.
  const volver = typeof ubicacion.state?.volver === 'string' && ubicacion.state.volver.startsWith('?') ? ubicacion.state.volver : ''
  const rutaLista = `/admin/${local.slug}/productos`
  const irALaLista = (estado) => navegar({ pathname: rutaLista, search: volver }, { state: estado })

  const original = productoId ? (productos.find((p) => p.id === productoId) ?? null) : null
  const filtrada = new URLSearchParams(volver).get('categoria')
  const categoriaInicial = categorias.find((c) => c.id === filtrada)?.id ?? categorias[0]?.id ?? ''

  let contenido
  if (!puedeGestionarMenu) {
    contenido = <Alerta tipo="info">No tenés permiso para cargar ni editar productos de este local.</Alerta>
  } else if (cargando) {
    contenido = (
      <div className="prod-form" aria-hidden="true">
        <div className="ui-tarjeta prod-form-esqueleto prod-form-esqueleto--foto" />
        <div className="ui-tarjeta prod-form-esqueleto" />
      </div>
    )
  } else if (error) {
    contenido = (
      <Alerta
        tipo="error"
        role="alert"
        titulo="No pudimos cargar el formulario"
        acciones={
          <Boton variante="primario" onClick={reintentar}>
            Reintentar
          </Boton>
        }
      >
        Revisá tu conexión y probá de nuevo.
      </Alerta>
    )
  } else if (productoId && !original) {
    contenido = (
      <Tarjeta className="cat-vacio">
        <p>No encontramos ese producto. Puede que ya lo hayan eliminado.</p>
        <Boton variante="primario" to={rutaLista}>
          Volver a Productos
        </Boton>
      </Tarjeta>
    )
  } else if (categorias.length === 0) {
    contenido = (
      <Tarjeta className="cat-vacio">
        <h2 className="adm-subtitulo">Primero creá una categoría</h2>
        <p className="adm-texto--suave">Cada producto va dentro de una categoría.</p>
        <Boton variante="primario" to={`/admin/${local.slug}/categorias`}>
          Ir a Categorías
        </Boton>
      </Tarjeta>
    )
  } else {
    contenido = (
      <FormularioProducto
        key={original?.id ?? 'nuevo'}
        local={local}
        categorias={categorias}
        productos={productos}
        original={original}
        categoriaInicial={categoriaInicial}
        onListo={irALaLista}
        onSalir={() => irALaLista({ foco: original ? `${original.id}:editar` : 'nuevo' })}
      />
    )
  }

  return (
    <>
      <Boton variante="fantasma" chico className="prod-volver" to={`${rutaLista}${volver}`}>
        <span aria-hidden="true">‹</span> Productos
      </Boton>
      <h1 className="adm-titulo">{productoId ? 'Editar producto' : 'Nuevo producto'}</h1>
      <p className="solo-lectores" role="status">
        {cargando && puedeGestionarMenu ? 'Cargando el formulario…' : ''}
      </p>
      {contenido}
    </>
  )
}
