import { COLORES_ORIGINALES, esColor } from '../lib/tema'
import { CAMPOS_COLOR, coloresOriginales, LIMITES, revisarContraste, idDeAjuste } from './ajustes'
import Boton from './ui/Boton'
import Campo from './ui/Campo'

const NIVELES = { bien: 'Se lee bien', aviso: 'Cuesta verlo', ilegible: 'Ilegible: no se puede guardar' }

export default function CamposApariencia({ valor, onCambiar, errores, limpiarError }) {
  const { filas, bloquea } = revisarContraste(valor)
  const flojos = filas.filter((f) => f.nivel !== 'bien')
  const originales = CAMPOS_COLOR.every(({ clave }) => valor[clave].trim().toLowerCase() === COLORES_ORIGINALES[clave])
  const resumen = filas.length === 0
    ? 'Completá los cuatro colores para revisar el contraste.'
    : bloquea
      ? 'Con estos colores el texto no se lee: no se pueden guardar.'
      : flojos.length
        ? 'Atención: hay combinaciones que cuestan de ver.'
        : 'Todos los textos se leen bien.'

  const poner = (clave, color) => {
    onCambiar({ ...valor, [clave]: color })
    limpiarError(clave, 'texto')
  }

  return (
    <>
      <Campo
        id={idDeAjuste('apariencia', 'frase')}
        etiqueta="Frase de la portada (opcional)"
        name="frase"
        maxLength={LIMITES.frase + 20}
        autoComplete="off"
        value={valor.frase}
        error={errores.frase}
        ayuda={`${valor.frase.length} de ${LIMITES.frase} caracteres.`}
        onChange={(e) => {
          onCambiar({ ...valor, frase: e.target.value })
          limpiarError('frase')
        }}
      />

      <div className="aj-colores">
        {CAMPOS_COLOR.map(({ clave, nombre, ayuda }) => {
          const id = idDeAjuste('apariencia', clave)
          const color = valor[clave].trim().toLowerCase()
          return (
            <div key={clave} className="aj-color">
              <input
                type="color"
                className="aj-color__selector"
                aria-label={`Elegir el color de ${nombre.toLowerCase()}`}
                value={esColor(color) ? color : COLORES_ORIGINALES[clave]}
                onChange={(e) => poner(clave, e.target.value)}
              />
              <Campo
                id={id}
                etiqueta={`${nombre} (#RRGGBB)`}
                name={clave}
                maxLength={7}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck="false"
                value={valor[clave]}
                ayuda={ayuda}
                error={errores[clave]}
                onChange={(e) => poner(clave, e.target.value.trim())}
              />
            </div>
          )
        })}
      </div>

      <Boton
        className="aj-form__corto"
        deshabilitado={originales}
        onClick={() => {
          onCambiar(coloresOriginales(valor))
          limpiarError(...CAMPOS_COLOR.map((c) => c.clave))
        }}
      >
        Restaurar colores originales
      </Boton>

      <div className={`aj-contraste${bloquea ? ' aj-contraste--ilegible' : flojos.length ? ' aj-contraste--aviso' : ''}`}>
        <h3 className="aj-contraste__titulo">Contraste</h3>
        <p role="status">{resumen}</p>
        <ul role="list">
          {filas.map((f) => (
            <li key={f.clave} data-contraste={f.clave} data-nivel={f.nivel}>
              <span>
                {f.nombre}: <strong>{f.texto}</strong> (mínimo {String(f.minimo).replace('.', ',')}:1). {NIVELES[f.nivel]}.
              </span>
              {f.nota && <span className="ui-campo__ayuda"> {f.nota}</span>}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
