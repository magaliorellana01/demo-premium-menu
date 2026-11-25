import { useId } from 'react'

// Etiqueta visible + input o textarea + ayuda + error, enlazados con aria-describedby y
// aria-invalid. `accesorio` es un botón que se ubica dentro del campo (ej. ver contraseña).
// El resto de las props van al control (incluido `ref`).
export default function Campo({ etiqueta, ayuda, error, multilinea = false, accesorio = null, id: idPropio, ...props }) {
  const idAutomatico = useId()
  const id = idPropio ?? idAutomatico
  const idAyuda = ayuda ? `${id}-ayuda` : null
  const idError = error ? `${id}-error` : null
  const descripciones = [idAyuda, idError].filter(Boolean).join(' ') || undefined
  const Control = multilinea ? 'textarea' : 'input'

  return (
    <div className="ui-campo">
      <label className="ui-campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className={accesorio ? 'ui-campo__caja ui-campo__caja--accesorio' : 'ui-campo__caja'}>
        <Control id={id} className="ui-entrada" aria-invalid={error ? 'true' : undefined} aria-describedby={descripciones} {...props} />
        {accesorio}
      </div>
      {ayuda && (
        <p id={idAyuda} className="ui-campo__ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="ui-campo__error">
          {error}
        </p>
      )}
    </div>
  )
}
