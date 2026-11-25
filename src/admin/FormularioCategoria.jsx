import { useEffect, useRef, useState } from 'react'
import { LARGO_MAX_NOMBRE_CATEGORIA, validarNombreCategoria } from './categorias'
import Boton from './ui/Boton'
import Campo from './ui/Campo'

// Alta o edición del nombre de una categoría. Si guardar falla, lo escrito queda como estaba.
//   onGuardar(nombre) -> Promise<boolean> (true si se guardó)
export default function FormularioCategoria({ categorias, categoria = null, textoGuardar, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const entradaRef = useRef(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    entradaRef.current?.focus()
    return () => {
      montado.current = false
    }
  }, [])

  const alEnviar = async (evento) => {
    evento.preventDefault()
    if (guardando) return
    const revision = validarNombreCategoria(nombre, categorias, categoria?.id ?? null)
    if (!revision.ok) {
      setError(revision.error)
      entradaRef.current?.focus()
      return
    }
    setError('')
    setGuardando(true)
    const ok = await onGuardar(revision.nombre)
    if (!montado.current) return
    setGuardando(false)
    if (!ok) entradaRef.current?.focus()
  }

  return (
    <form
      className="cat-form"
      onSubmit={alEnviar}
      noValidate
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !guardando) {
          e.stopPropagation()
          onCancelar()
        }
      }}
    >
      <Campo
        ref={entradaRef}
        etiqueta="Nombre de la categoría"
        name="nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={LARGO_MAX_NOMBRE_CATEGORIA + 20}
        ayuda={`Hasta ${LARGO_MAX_NOMBRE_CATEGORIA} caracteres.`}
        error={error}
        autoComplete="off"
        enterKeyHint="done"
      />
      <div className="ui-acciones">
        <Boton variante="primario" type="submit" cargando={guardando} textoCargando="Guardando…">
          {textoGuardar}
        </Boton>
        <Boton onClick={onCancelar} deshabilitado={guardando}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}
