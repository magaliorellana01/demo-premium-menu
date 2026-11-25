import { useEffect, useId, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import PantallaCarga from './PantallaCarga'
import { iniciarSesion } from './datos'
import { mensajeErrorLogin, validarLogin } from './login'
import { destinoTrasLogin } from './permisos'
import { useSesion } from './useSesion'

function Ojo({ tachado }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
      {tachado && <path d="M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />}
    </svg>
  )
}

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

  const idEmail = `${id}-email`
  const idPassword = `${id}-password`
  const idError = `${id}-error`

  return (
    <main className="adm-centro">
      <div className="adm-tarjeta adm-login">
        <p className="adm-marca">
          OESTACK <span>Panel</span>
        </p>
        <h1 className="adm-titulo">Ingresar al panel</h1>
        <p className="adm-texto adm-texto--suave">Usá el email y la contraseña que te dio OESTACK.</p>

        {vencida && (
          <p className="adm-aviso" role="status">
            Tu sesión venció. Ingresá de nuevo para seguir.
          </p>
        )}

        <form className="adm-formulario" onSubmit={alEnviar} noValidate>
          <div className="adm-campo">
            <label htmlFor={idEmail} className="adm-etiqueta">
              Email
            </label>
            <input
              ref={emailRef}
              id={idEmail}
              className="adm-entrada"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errores.email ? 'true' : undefined}
              aria-describedby={errores.email ? `${idEmail}-error` : undefined}
            />
            {errores.email && (
              <p id={`${idEmail}-error`} className="adm-error-campo">
                {errores.email}
              </p>
            )}
          </div>

          <div className="adm-campo">
            <label htmlFor={idPassword} className="adm-etiqueta">
              Contraseña
            </label>
            <div className="adm-entrada-con-boton">
              <input
                ref={passwordRef}
                id={idPassword}
                className="adm-entrada"
                type={verPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errores.password ? 'true' : undefined}
                aria-describedby={errores.password ? `${idPassword}-error` : undefined}
              />
              <button
                type="button"
                className="adm-ojo"
                onClick={() => setVerPassword((v) => !v)}
                aria-pressed={verPassword}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ojo tachado={verPassword} />
              </button>
            </div>
            {errores.password && (
              <p id={`${idPassword}-error`} className="adm-error-campo">
                {errores.password}
              </p>
            )}
          </div>

          {/* Siempre está en la página, así el lector de pantalla anuncia el texto cuando aparece. */}
          <p id={idError} className="adm-error" aria-live="polite" aria-atomic="true">
            {errorGeneral}
          </p>

          <button type="submit" className="adm-boton adm-boton--primario adm-boton--ancho" aria-disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  )
}
