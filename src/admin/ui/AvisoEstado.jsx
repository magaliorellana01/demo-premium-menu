// Aviso flotante de "Guardado" o de error. La región aria-live está SIEMPRE en la página (así
// el lector de pantalla anuncia lo que aparece) y no mueve el contenido (sin saltos).
export default function AvisoEstado({ aviso, onCerrar }) {
  return (
    <div className="ui-aviso" aria-live="polite" aria-atomic="true">
      {aviso && (
        // key: cada aviso es un nodo nuevo, así se vuelve a anunciar aunque el texto se repita
        <div key={aviso.id} className={`ui-aviso__caja ui-aviso__caja--${aviso.tipo}`}>
          <span>{aviso.texto}</span>
          {aviso.tipo === 'error' && (
            <button type="button" className="ui-aviso__cerrar" onClick={onCerrar}>
              Cerrar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
