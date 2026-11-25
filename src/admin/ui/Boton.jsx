import { Link } from 'react-router-dom'

// Botón del panel (o enlace con aspecto de botón con `to` / `href`).
//   variante: 'primario' | 'secundario' | 'fantasma' | 'peligro'
//   cargando: muestra el indicador, ignora clics y mantiene el foco (aria-busy)
//   deshabilitado: usa aria-disabled (no `disabled`), así el foco no se pierde
export default function Boton({
  variante = 'secundario',
  chico = false,
  ancho = false,
  icono = false,
  cargando = false,
  textoCargando,
  deshabilitado = false,
  to,
  href,
  type = 'button',
  className = '',
  onClick,
  children,
  ...props
}) {
  const clases = ['ui-boton', `ui-boton--${variante}`, chico && 'ui-boton--chico', ancho && 'ui-boton--ancho', icono && 'ui-boton--icono', className]
    .filter(Boolean)
    .join(' ')

  if (to) {
    return (
      <Link className={clases} to={to} {...props}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a className={clases} href={href} {...props}>
        {children}
      </a>
    )
  }

  const inactivo = cargando || deshabilitado
  return (
    <button
      type={type}
      className={clases}
      aria-disabled={inactivo || undefined}
      aria-busy={cargando || undefined}
      onClick={(evento) => {
        if (inactivo) {
          evento.preventDefault() // también evita enviar el formulario
          return
        }
        onClick?.(evento)
      }}
      {...props}
    >
      {cargando && <span className="ui-giro" aria-hidden="true" />}
      {cargando && textoCargando ? textoCargando : children}
    </button>
  )
}
