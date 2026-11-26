import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// Sin useSearchParams a propósito: nadie más lo usa y agrandaría el JS del menú público.
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ESTADOS,
  fechaDeCambio,
  filtrarClientes,
  filtrosAParams,
  leerFiltrosDeClientes,
  mensajeDeErrorClientes,
  textoDeCantidad,
} from './clientes'
import { cambiarActivo, listarClientes } from './datosClientes'
import Encabezado from './Encabezado'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import Confirmacion from './ui/Confirmacion'
import Tarjeta from './ui/Tarjeta'
import { useAcceso } from './useAcceso'

function Cliente({ cliente, onCambio }) {
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')
  const [estado, setEstado] = useState('')
  const botonRef = useRef(null)
  const volverElFoco = useRef(false)

  useEffect(() => {
    if (!confirmando && volverElFoco.current) {
      volverElFoco.current = false
      botonRef.current?.focus()
    }
  }, [confirmando])

  const cerrar = () => {
    volverElFoco.current = true
    setConfirmando(false)
  }

  const cambiar = async () => {
    setGuardando(true)
    setFallo('')
    setEstado('')
    try {
      const nuevo = await cambiarActivo(cliente.id, !cliente.activo)
      setEstado(nuevo.activo ? 'Guardado: el menú quedó publicado.' : 'Guardado: el menú quedó oculto.')
      onCambio(cliente.id, nuevo)
    } catch (error) {
      setFallo(mensajeDeErrorClientes(error))
    }
    setGuardando(false)
    cerrar()
  }

  const idTitulo = `cliente-${cliente.slug}`
  return (
    <Tarjeta como="article" className="cli" aria-labelledby={idTitulo} data-slug={cliente.slug}>
      <div className="cli__cabecera">
        <h2 id={idTitulo} className="cli__nombre">
          {cliente.nombre}
        </h2>
        <span className={`ui-chip adm-estado ${cliente.activo ? 'ui-chip--salvia' : 'ui-chip--cobre'}`}>{cliente.activo ? 'Activo' : 'Inactivo'}</span>
      </div>
      <p className="cli__slug">/{cliente.slug}</p>

      <dl className="cli__datos">
        <div>
          <dt>Categorías</dt>
          <dd data-dato="categorias">{cliente.categorias}</dd>
        </div>
        <div>
          <dt>Productos</dt>
          <dd data-dato="productos">{cliente.productos}</dd>
        </div>
        <div className="cli__fecha">
          <dt>Datos del local modificados</dt>
          <dd data-dato="modificado">{fechaDeCambio(cliente.modificado)}</dd>
        </div>
      </dl>

      {confirmando ? (
        <Confirmacion
          pregunta={cliente.activo ? `¿Desactivar ${cliente.nombre}?` : `¿Activar ${cliente.nombre}?`}
          detalle={cliente.activo ? 'El menú público deja de verse y los códigos QR muestran que no existe.' : 'El menú público queda visible para cualquiera.'}
          textoConfirmar={cliente.activo ? 'Sí, desactivar' : 'Sí, activar'}
          textoCargando="Guardando…"
          cargando={guardando}
          onConfirmar={cambiar}
          onCancelar={cerrar}
        />
      ) : (
        <div className="ui-acciones">
          <Boton to={`/admin/${cliente.slug}`} aria-label={`Abrir el panel de ${cliente.nombre}`}>
            Abrir panel
          </Boton>
          {cliente.activo && (
            <Boton variante="fantasma" href={`/${cliente.slug}`} target="_blank" rel="noopener">
              Ver menú<span className="solo-lectores"> de {cliente.nombre} (se abre en otra pestaña)</span>
            </Boton>
          )}
          <Boton
            ref={botonRef}
            variante="fantasma"
            aria-label={`${cliente.activo ? 'Desactivar' : 'Activar'} ${cliente.nombre}`}
            onClick={() => {
              setFallo('')
              setEstado('')
              setConfirmando(true)
            }}
          >
            {cliente.activo ? 'Desactivar' : 'Activar'}
          </Boton>
        </div>
      )}
      {fallo && (
        <Alerta tipo="error" role="alert">
          {fallo}
        </Alerta>
      )}
      <p className="cli__estado" role="status">
        {estado}
      </p>
    </Tarjeta>
  )
}

function Lista() {
  const { sincronizarLocales } = useAcceso() // estable: no vuelve a disparar los efectos
  const [resultado, setResultado] = useState(null) // { intento, clientes, error }
  const [intento, setIntento] = useState(0)
  const { search, pathname } = useLocation()
  const navegar = useNavigate()
  // Los filtros viven en el estado (el campo responde al instante) y se copian a la URL, así
  // se conservan al recargar o al volver atrás. Igual que en Productos.
  const [filtros, setFiltros] = useState(() => leerFiltrosDeClientes(new URLSearchParams(search)))

  useEffect(() => {
    let activo = true
    listarClientes().then(
      (clientes) => activo && setResultado({ intento, clientes, error: null }),
      (error) => activo && setResultado({ intento, clientes: null, error }),
    )
    return () => {
      activo = false
    }
  }, [intento])

  const cargando = resultado?.intento !== intento
  const clientes = cargando ? null : resultado.clientes
  const visibles = useMemo(() => (clientes ? filtrarClientes(clientes, { texto: filtros.texto, estado: filtros.estado }) : []), [clientes, filtros.texto, filtros.estado])

  const alCambiar = useCallback((id, cambios) => {
    setResultado((r) => r?.clientes && { ...r, clientes: r.clientes.map((c) => (c.id === id ? { ...c, ...cambios } : c)) })
  }, [])
  // El resto del panel ve lo mismo: un local recién dado de alta se puede abrir sin volver a
  // ingresar, y el estado nuevo se refleja en todos lados.
  useEffect(() => {
    if (clientes) sincronizarLocales(clientes)
  }, [clientes, sincronizarLocales])

  const filtrar = (cambios) => {
    const nuevos = { ...filtros, ...cambios }
    setFiltros(nuevos)
    const params = filtrosAParams(nuevos)
    navegar({ pathname, search: params.size ? `?${params}` : '' }, { replace: true, preventScrollReset: true })
  }

  return (
    <>
      <p className="solo-lectores" role="status">
        {cargando ? 'Cargando los clientes…' : ''}
      </p>
      {cargando ? (
        <div className="cli-lista" aria-hidden="true">
          <div className="ui-tarjeta cli cli--esqueleto" />
          <div className="ui-tarjeta cli cli--esqueleto" />
        </div>
      ) : resultado.error ? (
        <Alerta
          tipo="error"
          role="alert"
          titulo="No pudimos cargar los clientes"
          acciones={
            <Boton variante="primario" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </Boton>
          }
        >
          {mensajeDeErrorClientes(resultado.error)}
        </Alerta>
      ) : clientes.length === 0 ? (
        <Tarjeta como="section" className="adm-bloque">
          <h2 className="adm-subtitulo">Todavía no hay locales</h2>
          <p>
            Creá el primero desde tu computadora con <code>npm run alta:cliente</code>.
          </p>
        </Tarjeta>
      ) : (
        <>
          <div className="cli-filtros" role="search">
            <Campo etiqueta="Buscar por nombre o dirección" type="search" autoComplete="off" value={filtros.texto} onChange={(e) => filtrar({ texto: e.target.value })} />
            <Campo etiqueta="Estado" lista value={filtros.estado} onChange={(e) => filtrar({ estado: e.target.value })}>
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.texto}
                </option>
              ))}
            </Campo>
          </div>
          <p className="adm-texto--suave cli-cantidad" role="status">
            {textoDeCantidad(visibles.length, clientes.length)}
          </p>
          {visibles.length === 0 ? (
            <Tarjeta como="section" className="adm-bloque">
              <p>Ningún local coincide con la búsqueda.</p>
              <div className="ui-acciones">
                <Boton onClick={() => filtrar({ texto: '', estado: 'todos' })}>Limpiar filtros</Boton>
              </div>
            </Tarjeta>
          ) : (
            <ul className="cli-lista" role="list">
              {visibles.map((c) => (
                <li key={c.id}>
                  <Cliente cliente={c} onCambio={alCambiar} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

// /admin/clientes: todos los locales, para el equipo de OESTACK. A quien no es admin no se le
// muestra ni se consulta nada (es comodidad: lo que protege los datos es la base).
export default function PaginaClientes() {
  const { acceso } = useAcceso()

  return (
    <div className="adm-pagina">
      <title>{acceso.esAdmin ? 'Clientes · Panel' : 'Panel · OESTACK'}</title>
      <a className="adm-saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Encabezado rol={acceso.esAdmin ? 'admin' : null} />
      <main className="adm-contenido adm-contenido--sin-pestanas adm-contenido--ancho" id="contenido" tabIndex={-1}>
        {acceso.esAdmin ? (
          <>
            <div className="cli-titulo">
              <h1 className="adm-titulo">Clientes</h1>
              <Link className="cli-volver" to="/admin">
                Volver al panel
              </Link>
            </div>
            <Lista />
          </>
        ) : (
          <Tarjeta como="section" className="adm-bloque">
            <h1 className="adm-titulo">No tenés acceso a esta pantalla</h1>
            <p>Es solo para el equipo de OESTACK.</p>
            <div className="ui-acciones">
              <Boton variante="primario" to="/admin">
                Volver al panel
              </Boton>
            </div>
          </Tarjeta>
        )}
      </main>
    </div>
  )
}
