// Interruptor accesible (role="switch"). `etiqueta` es el nombre accesible, con contexto
// ("Mostrar Cafés en el menú"); en pantalla se lee además el estado en texto, no solo color.
export default function Interruptor({ marcado, onCambiar, etiqueta, textoSi = 'Visible', textoNo = 'Oculta', cargando = false }) {
  return (
    <button
      type="button"
      role="switch"
      className="ui-interruptor"
      aria-checked={marcado}
      aria-label={etiqueta}
      aria-disabled={cargando || undefined}
      onClick={() => !cargando && onCambiar(!marcado)}
    >
      <span className="ui-interruptor__pista" aria-hidden="true">
        <span className="ui-interruptor__perilla" />
      </span>
      <span className="ui-interruptor__texto" aria-hidden="true">
        {marcado ? textoSi : textoNo}
      </span>
    </button>
  )
}
