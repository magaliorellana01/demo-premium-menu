import { useRef } from 'react'
import { traducirEtiqueta } from '../i18n/traducciones'
import { useIdioma } from '../i18n/useIdioma'
import { ID_CAMPO_BUSQUEDA } from '../lib/filtros'

function Lupa() {
  return (
    <svg className="busqueda__lupa" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function Cruz() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export default function Busqueda({ filtros, disponibles, total, activos }) {
  const campoRef = useRef(null)
  const { idioma, t } = useIdioma()
  const { texto, etiquetas, escribir, limpiarTexto, alternarEtiqueta, limpiarTodo } = filtros

  const alTeclear = (evento) => {
    if (evento.key === 'Escape' && texto) {
      evento.preventDefault()
      limpiarTexto()
    }
  }

  const borrar = () => {
    limpiarTexto()
    campoRef.current?.focus()
  }

  const limpiar = () => {
    limpiarTodo()
    campoRef.current?.focus()
  }

  const recuento = total === 0 ? t('sinResultados') : `${total} ${total === 1 ? t('producto') : t('productos')}`

  return (
    <section className="busqueda" aria-label={t('buscarYFiltrar')}>
      <div className="busqueda__interior">
        <div className="busqueda__campo" role="search">
          <label htmlFor={ID_CAMPO_BUSQUEDA} className="solo-lectores">
            {t('buscarPlaceholder')}
          </label>
          <Lupa />
          <input
            ref={campoRef}
            id={ID_CAMPO_BUSQUEDA}
            className="busqueda__entrada"
            type="search"
            value={texto}
            onChange={(evento) => escribir(evento.target.value)}
            onKeyDown={alTeclear}
            placeholder={t('buscarPlaceholder')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={80}
          />
          {texto && (
            <button type="button" className="busqueda__borrar" onClick={borrar} aria-label={t('limpiarBusqueda')}>
              <Cruz />
            </button>
          )}
        </div>

        {disponibles.length > 0 && (
          <div className="filtros" role="group" aria-label={t('filtrarPorEtiqueta')}>
            {disponibles.map((etiqueta) => (
              <button
                key={etiqueta.clave}
                type="button"
                className="filtro"
                aria-pressed={etiquetas.includes(etiqueta.clave)}
                title={etiqueta.descripcion || undefined}
                onClick={() => alternarEtiqueta(etiqueta.clave)}
              >
                {traducirEtiqueta(etiqueta, idioma)}
              </button>
            ))}
          </div>
        )}

        <div className="busqueda__estado">
          <p className="busqueda__recuento" aria-live="polite" aria-atomic="true">
            {recuento}
          </p>
          {activos && total > 0 && (
            <button type="button" className="busqueda__limpiar" onClick={limpiar}>
              {t('limpiarFiltros')}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
