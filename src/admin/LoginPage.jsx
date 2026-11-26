import { useEffect, useId, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import BotonVer from './BotonVer'
import PantallaCarga from './PantallaCarga'
import { iniciarSesion } from './datos'
import { mensajeErrorLogin, validarLogin } from './login'
import { destinoTrasLogin } from './permisos'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import Tarjeta from './ui/Tarjeta'
import { useSesion } from './useSesion'

export default function LoginPage() {
  const { cargando, usuario, vencida } = useSesion()
  const ubicacion = useLocation()
  const id = useId()
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState({}) // { email?, password? } de la validación
  const [errorGeneral, setErrorGeneral] = useState('') // error al ingresar (se anuncia en la región aria-live)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  if (cargando) return <PantallaCarga />
  // Ya hay sesión (por ejemplo, recién ingresó): sigue a donde iba o al inicio del panel.
  if (usuario) return <Navigate to={destinoTrasLogin(ubicacion.state?.volver)} replace />

  const alEnviar = async (evento) => {
    evento.preventDefault()
    if (enviando) return
    setErrorGeneral('')

    const revision = validarLogin({ email, password })
    setErrores(revision.errores)
    if (!revision.ok) {
      // El foco va al primer campo con problema.
      ;(revision.errores.email ? emailRef : passwordRef).current?.focus()
      return
    }

    setEnviando(true)
    const { error } = await iniciarSesion(revision.email, password)
    if (!montado.current) return // salió bien: la pantalla ya está redirigiendo
    setEnviando(false)
    if (error) {
      setErrorGeneral(mensajeErrorLogin(error))
      setPassword('') // la contraseña se borra; el email queda para corregir
      passwordRef.current?.focus()
    }
  }

  const idError = `${id}-error`

  return (
    <main className="adm-centro">
      <title>Ingresar · Panel OESTACK</title>
      <Tarjeta className="adm-portada adm-login">
        <div className="adm-portada__franja">
          <p className="adm-marca">OESTACK · Panel</p>
          <h1>Ingresar al panel</h1>
          <p className="adm-portada__bajada">Usá el email y la contraseña que te dio OESTACK.</p>
        </div>

        <div className="adm-portada__cuerpo">
          {vencida && (
            <Alerta tipo="info" role="status" data-aviso="vencida">
              Tu sesión venció. Ingresá de nuevo para seguir.
            </Alerta>
          )}

          <form className="adm-formulario" onSubmit={alEnviar} noValidate>
            <Campo
              ref={emailRef}
              etiqueta="Email"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errores.email}
            />

            <Campo
              ref={passwordRef}
              etiqueta="Contraseña"
              type={verPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
              accesorio={<BotonVer visible={verPassword} onCambiar={setVerPassword} />}
            />

            {/* Siempre está en la página, así el lector de pantalla anuncia el texto cuando aparece. */}
            <p id={idError} className="adm-error" aria-live="polite" aria-atomic="true">
              {errorGeneral}
            </p>

            <Boton variante="primario" type="submit" ancho cargando={enviando} textoCargando="Ingresando…">
              Ingresar
            </Boton>
          </form>
        </div>
      </Tarjeta>
    </main>
  )
}
