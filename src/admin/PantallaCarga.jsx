// Pantalla neutra mientras se carga el panel o se averigua la sesión: ocupa toda la altura,
// así al pasar al contenido no hay saltos ni se ve un instante de login o de "sin acceso".
export default function PantallaCarga() {
  return (
    <div className="adm-carga" role="status">
      <span className="solo-lectores">Cargando…</span>
      <span className="adm-carga__punto" aria-hidden="true" />
    </div>
  )
}
