import Alerta from './ui/Alerta'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'

// Debajo del ingreso, solo en el despliegue de la demo. El email y la contraseña son públicos.
export default function TarjetaDemo({ credenciales, entrando, error, onEntrar }) {
  return (
    <Tarjeta como="section" className="adm-demo-tarjeta" aria-labelledby="titulo-demo">
      <h2 id="titulo-demo">Probá el panel con una cuenta de demostración</h2>
      <dl>
        <div>
          <dt>Email</dt>
          <dd data-demo="email">{credenciales.email}</dd>
        </div>
        <div>
          <dt>Contraseña</dt>
          <dd data-demo="password">{credenciales.password}</dd>
        </div>
      </dl>
      {error && (
        <Alerta tipo="error" role="alert">
          {error}
        </Alerta>
      )}
      <Boton ancho cargando={entrando} textoCargando="Entrando…" onClick={onEntrar}>
        Entrar a la demo
      </Boton>
    </Tarjeta>
  )
}
