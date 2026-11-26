import { useEffect, useRef, useState } from 'react'
import BotonVer from './BotonVer'
import { errorDeCambio, REQUISITOS, validarCambio } from './contrasena'
import { cambiarPassword, comprobarPassword } from './datos'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Campo from './ui/Campo'

const VACIO = { actual: '', nueva: '', repetida: '' }
const ID = { actual: 'cuenta-actual', nueva: 'cuenta-nueva', repetida: 'cuenta-repetida' }

// Cambiar la contraseña: primero se comprueba la actual (ingresando de nuevo con ella) y recién
// ahí se cambia. No depende de mails.
export default function FormularioPassword({ email }) {
  const [valores, setValores] = useState(VACIO)
  const [visible, setVisible] = useState(false)
  const [errores, setErrores] = useState({})
  const [fallo, setFallo] = useState('')
  const [listo, setListo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const focoPendiente = useRef(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    const id = focoPendiente.current
    if (!id) return
    focoPendiente.current = null
    document.getElementById(id)?.focus()
  })

  const campo = (clave) => ({
    id: ID[clave],
    name: clave,
    type: visible ? 'text' : 'password',
    autoCapitalize: 'none',
    autoCorrect: 'off',
    spellCheck: false,
    value: valores[clave],
    error: errores[clave],
    onChange: (e) => {
      setValores((v) => ({ ...v, [clave]: e.target.value }))
      setErrores((x) => ({ ...x, [clave]: undefined }))
      setListo(false)
    },
  })

  const mostrar = ({ campo: donde, mensaje }) => {
    if (donde) {
      setErrores({ [donde]: mensaje })
      focoPendiente.current = ID[donde]
    } else {
      setFallo(mensaje)
      focoPendiente.current = 'cuenta-fallo'
    }
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (enviando) return
    setFallo('')
    setListo(false)
    const revision = validarCambio(valores)
    setErrores(revision.errores)
    if (!revision.ok) {
      focoPendiente.current = ID[revision.primerError]
      return
    }

    setEnviando(true)
    let paso = 'verificar'
    let error = null
    try {
      ;({ error } = await comprobarPassword(email, valores.actual))
      if (!error) {
        paso = 'cambiar'
        ;({ error } = await cambiarPassword(valores.actual, valores.nueva))
      }
    } catch (inesperado) {
      error = inesperado
    }
    if (!montado.current) return
    setEnviando(false)
    if (error) {
      mostrar(errorDeCambio(error, paso))
      return
    }
    setValores(VACIO)
    setVisible(false)
    setListo(true)
    focoPendiente.current = 'cuenta-listo'
  }

  return (
    <form className="adm-formulario" onSubmit={enviar} noValidate>
      {/* Para que el gestor de contraseñas sepa de qué cuenta es. */}
      <input className="solo-lectores" type="text" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
      <Campo etiqueta="Contraseña actual" autoComplete="current-password" {...campo('actual')} accesorio={<BotonVer visible={visible} onCambiar={setVisible} que="contraseñas" />} />
      <Campo etiqueta="Contraseña nueva" autoComplete="new-password" {...campo('nueva')} />
      <ul className="cuenta-requisitos" aria-label="La contraseña nueva necesita">
        {REQUISITOS.map((r) => {
          const cumple = r.cumple(valores.nueva)
          return (
            <li key={r.clave} data-requisito={r.clave} data-cumple={cumple}>
              <span aria-hidden="true">{cumple ? '✓' : '·'}</span> {r.texto}
              <span className="solo-lectores">{cumple ? ': listo' : ': falta'}</span>
            </li>
          )
        })}
      </ul>
      <Campo etiqueta="Repetí la contraseña nueva" autoComplete="new-password" {...campo('repetida')} />

      {fallo && (
        <div id="cuenta-fallo" tabIndex={-1}>
          <Alerta tipo="error" role="alert">
            {fallo}
          </Alerta>
        </div>
      )}
      {listo && (
        <div id="cuenta-listo" tabIndex={-1}>
          <Alerta tipo="exito" role="status">
            Listo: cambiaste tu contraseña. La próxima vez ingresá con la nueva.
          </Alerta>
        </div>
      )}

      <Boton variante="primario" type="submit" cargando={enviando} textoCargando="Cambiando…">
        Cambiar contraseña
      </Boton>
    </form>
  )
}
