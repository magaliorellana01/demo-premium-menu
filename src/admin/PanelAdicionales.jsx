import { useEffect, useRef, useState } from 'react'
import { formatearPrecio } from '../lib/precios'
import {
  guardarAdicionalEnLista,
  LARGO_MAX_NOMBRE_ADICIONAL,
  MAX_ADICIONALES,
  precioParaEditar,
  puedeAgregarAdicional,
  quitarAdicionalDeLista,
  validarAdicional,
} from './categorias'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import Confirmacion from './ui/Confirmacion'

// Formulario de un adicional (alta o edición). Si guardar falla, lo escrito se conserva.
function FormularioAdicional({ adicionales, indice = null, onGuardar, onCancelar = null, enfocarAlAbrir = false }) {
  const actual = indice === null ? null : adicionales[indice]
  const [nombre, setNombre] = useState(actual?.nombre ?? '')
  const [precio, setPrecio] = useState(actual ? precioParaEditar(actual.precio) : '')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const nombreRef = useRef(null)
  const precioRef = useRef(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    if (enfocarAlAbrir) nombreRef.current?.focus()
    return () => {
      montado.current = false
    }
  }, [enfocarAlAbrir])

  const alEnviar = async (evento) => {
    evento.preventDefault()
    if (guardando) return
    const revision = validarAdicional({ nombre, precio }, adicionales, indice)
    setErrores(revision.errores)
    if (!revision.ok) {
      ;(revision.errores.nombre ? nombreRef : precioRef).current?.focus()
      return
    }
    setGuardando(true)
    const ok = await onGuardar(guardarAdicionalEnLista(adicionales, revision.adicional, indice), revision.adicional)
    if (!montado.current) return
    setGuardando(false)
    if (ok && indice === null) {
      setNombre('')
      setPrecio('')
      nombreRef.current?.focus() // para cargar el siguiente
    }
  }

  return (
    <form
      className="adic-form"
      onSubmit={alEnviar}
      noValidate
      aria-label={actual ? `Editar el adicional ${actual.nombre}` : 'Agregar un adicional'}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancelar && !guardando) {
          e.stopPropagation()
          onCancelar()
        }
      }}
    >
      <Campo
        ref={nombreRef}
        etiqueta={actual ? 'Nombre' : 'Nuevo adicional'}
        name="adicional-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={LARGO_MAX_NOMBRE_ADICIONAL + 10}
        error={errores.nombre}
        autoComplete="off"
        placeholder="Ej.: Leche vegetal"
      />
      <Campo
        ref={precioRef}
        etiqueta="Precio (pesos)"
        name="adicional-precio"
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
        error={errores.precio}
        inputMode="decimal"
        autoComplete="off"
        placeholder="600"
      />
      <div className="ui-acciones adic-form__acciones">
        <Boton variante={actual ? 'primario' : 'secundario'} type="submit" cargando={guardando} textoCargando="Guardando…">
          {actual ? 'Guardar' : 'Agregar'}
        </Boton>
        {onCancelar && (
          <Boton onClick={onCancelar} deshabilitado={guardando}>
            Cancelar
          </Boton>
        )}
      </div>
    </form>
  )
}

// Adicionales de una categoría. Cada alta, edición o baja se guarda en el momento.
//   onGuardar(listaNueva, mensaje) -> Promise<boolean>
export default function PanelAdicionales({ categoria, idPanel, onGuardar }) {
  const { adicionales } = categoria
  const [editando, setEditando] = useState(null)
  const [quitando, setQuitando] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const botones = useRef(new Map())
  const tituloRef = useRef(null)
  const volverFoco = useRef(null)

  // Devuelve el foco al botón que abrió la edición o la confirmación.
  useEffect(() => {
    if (!volverFoco.current) return
    const destino = botones.current.get(volverFoco.current)
    volverFoco.current = null
    ;(destino ?? tituloRef.current)?.focus()
  }, [editando, quitando, adicionales])

  const referencia = (clave) => (nodo) => {
    if (nodo) botones.current.set(clave, nodo)
    else botones.current.delete(clave)
  }
  const cerrar = (clave) => {
    volverFoco.current = clave
    setEditando(null)
    setQuitando(null)
  }

  const quitar = async (indice) => {
    setBorrando(true)
    const nombre = adicionales[indice].nombre
    const ok = await onGuardar(quitarAdicionalDeLista(adicionales, indice), `Guardado. Quitaste “${nombre}”.`)
    setBorrando(false)
    if (ok) cerrar('titulo')
  }

  return (
    <div className="adic" id={idPanel}>
      <h3 className="adic__titulo" ref={tituloRef} tabIndex={-1}>
        Adicionales de {categoria.nombre}
      </h3>
      <p className="adic__ayuda">En el menú aparecen debajo del título de la categoría (“Podés sumar…”). Hasta {MAX_ADICIONALES}.</p>

      {adicionales.length === 0 ? (
        <p className="adm-texto--suave">Todavía no cargaste adicionales.</p>
      ) : (
        <ul className="adic__lista" role="list">
          {adicionales.map((adicional, indice) => (
            <li key={`${indice}-${adicional.nombre}`} className="adic__item">
              {editando === indice ? (
                <FormularioAdicional
                  adicionales={adicionales}
                  indice={indice}
                  enfocarAlAbrir
                  onCancelar={() => cerrar(`editar-${indice}`)}
                  onGuardar={async (lista, guardado) => {
                    const ok = await onGuardar(lista, `Guardado. Actualizaste “${guardado.nombre}”.`)
                    if (ok) cerrar(`editar-${indice}`)
                    return ok
                  }}
                />
              ) : quitando === indice ? (
                <Confirmacion
                  pregunta={`¿Seguro que querés quitar “${adicional.nombre}”?`}
                  textoConfirmar="Sí, quitar"
                  textoCargando="Quitando…"
                  cargando={borrando}
                  onConfirmar={() => quitar(indice)}
                  onCancelar={() => cerrar(`quitar-${indice}`)}
                />
              ) : (
                <div className="adic__fila">
                  <p className="adic__datos">
                    <span className="adic__nombre">{adicional.nombre}</span>
                    <span className="adic__precio">+{formatearPrecio(adicional.precio)}</span>
                  </p>
                  <div className="adic__acciones">
                    <Boton
                      ref={referencia(`editar-${indice}`)}
                      variante="fantasma"
                      chico
                      aria-label={`Editar ${adicional.nombre}`}
                      onClick={() => {
                        setQuitando(null)
                        setEditando(indice)
                      }}
                    >
                      Editar
                    </Boton>
                    <Boton
                      ref={referencia(`quitar-${indice}`)}
                      variante="fantasma"
                      chico
                      aria-label={`Quitar ${adicional.nombre}`}
                      onClick={() => {
                        setEditando(null)
                        setQuitando(indice)
                      }}
                    >
                      Quitar
                    </Boton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeAgregarAdicional(adicionales) ? (
        <FormularioAdicional
          adicionales={adicionales}
          onGuardar={(lista, nuevo) => onGuardar(lista, `Guardado. Agregaste “${nuevo.nombre}”.`)}
        />
      ) : (
        <p className="adic__tope">Llegaste al máximo de {MAX_ADICIONALES} adicionales. Quitá uno para agregar otro.</p>
      )}
    </div>
  )
}
