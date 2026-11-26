// Botón para ver u ocultar una contraseña (va como `accesorio` de <Campo>).
export default function BotonVer({ visible, onCambiar, que = 'contraseña' }) {
  return (
    <button type="button" className="ui-campo__accesorio" onClick={() => onCambiar(!visible)} aria-pressed={visible} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${que}`}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
        {visible && <path d="M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />}
      </svg>
    </button>
  )
}
