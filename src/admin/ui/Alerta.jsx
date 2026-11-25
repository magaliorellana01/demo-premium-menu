// Mensaje destacado dentro de la página. tipo: 'info' | 'exito' | 'error'. `acciones` son botones.
// Para anunciar cambios al lector de pantalla se usa <AvisoEstado>; si esta alerta aparece
// sola por un error, pasale role="alert".
export default function Alerta({ tipo = 'info', titulo, acciones = null, children, ...props }) {
  return (
    <div className={`ui-alerta ui-alerta--${tipo}`} {...props}>
      {titulo && <p className="ui-alerta__titulo">{titulo}</p>}
      {children && <div>{children}</div>}
      {acciones && <div className="ui-alerta__acciones ui-acciones">{acciones}</div>}
    </div>
  )
}
