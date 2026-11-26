import { useRef, useState, useEffect } from 'react'
import { cambiarModo, copiarATodos, cruzaMedianoche, DIAS_SEMANA, MAX_FRANJAS, nuevaFranja, todoCerrado, idDeAjuste } from './ajustes'
import Alerta from './ui/Alerta'
import Boton from './ui/Boton'

// Por día: abierto (con hasta 3 franjas), cerrado o las 24 horas.
export default function CamposHorarios({ valor, onCambiar, errores, limpiarError }) {
  const [anuncio, setAnuncio] = useState('')
  const focoPendiente = useRef(null)

  useEffect(() => {
    const id = focoPendiente.current
    if (!id) return
    focoPendiente.current = null
    document.getElementById(id)?.focus()
  })

  // Un cambio puede resolver la superposición señalada en otro día: se borran todos los errores.
  const aplicar = (nuevo) => {
    onCambiar(nuevo)
    limpiarError(...Object.keys(errores))
    setAnuncio('')
  }
  const ponerDia = (clave, dia) => aplicar({ ...valor, [clave]: dia })

  return (
    <>
      {DIAS_SEMANA.map(({ clave, nombre }) => {
        const dia = valor[clave]
        const idModo = idDeAjuste('horarios', clave)
        return (
          <fieldset key={clave} className="aj-dia" data-dia={clave}>
            <legend className="aj-dia__nombre">{nombre}</legend>
            <div className="aj-dia__cabecera">
              <select
                id={idModo}
                className="ui-entrada aj-dia__modo"
                aria-label={`${nombre}: estado`}
                aria-invalid={errores[clave] ? 'true' : undefined}
                aria-describedby={errores[clave] ? `${idModo}-error` : undefined}
                value={dia.modo}
                onChange={(e) => ponerDia(clave, cambiarModo(dia, e.target.value))}
              >
                <option value="abierto">Abierto</option>
                <option value="cerrado">Cerrado</option>
                <option value="24h">Las 24 horas</option>
              </select>
              <Boton
                variante="fantasma"
                chico
                aria-label={`Copiar el horario del ${nombre.toLowerCase()} a todos los días`}
                onClick={() => {
                  aplicar(copiarATodos(valor, clave))
                  setAnuncio(`Copiamos el horario del ${nombre.toLowerCase()} a todos los días. Falta guardar.`)
                }}
              >
                Copiar a todos los días
              </Boton>
            </div>
            {errores[clave] && (
              <p id={`${idModo}-error`} className="ui-campo__error">
                {errores[clave]}
              </p>
            )}

            {dia.modo === 'abierto' &&
              dia.franjas.map((franja, i) => {
                const campo = `${clave}-${i}`
                const id = idDeAjuste('horarios', campo)
                const poner = (parte, hora) => ponerDia(clave, { ...dia, franjas: dia.franjas.map((f, j) => (j === i ? { ...f, [parte]: hora } : f)) })
                const hora = (parte, texto) => (
                  <label className="aj-hora">
                    <span className="ui-campo__ayuda">{texto}</span>
                    <input
                      id={parte === 'desde' ? id : `${id}-hasta`}
                      type="time"
                      className="ui-entrada"
                      aria-label={`${nombre}, horario ${i + 1}: ${texto.toLowerCase()}`}
                      aria-invalid={errores[campo] ? 'true' : undefined}
                      aria-describedby={errores[campo] ? `${id}-error` : cruzaMedianoche(franja) ? `${id}-nota` : undefined}
                      value={franja[parte]}
                      onChange={(e) => poner(parte, e.target.value)}
                    />
                  </label>
                )
                return (
                  <div key={franja.clave} className="aj-franja">
                    {hora('desde', 'Abre')}
                    {hora('hasta', 'Cierra')}
                    {dia.franjas.length > 1 && (
                      <Boton
                        variante="fantasma"
                        chico
                        className="aj-franja__quitar"
                        aria-label={`Quitar el horario ${i + 1} del ${nombre.toLowerCase()}`}
                        onClick={() => {
                          ponerDia(clave, { ...dia, franjas: dia.franjas.filter((_, j) => j !== i) })
                          focoPendiente.current = idDeAjuste('horarios', `${clave}-agregar`)
                        }}
                      >
                        Quitar
                      </Boton>
                    )}
                    {cruzaMedianoche(franja) && !errores[campo] && (
                      <p id={`${id}-nota`} className="ui-campo__ayuda aj-franja__nota">
                        Cierra al día siguiente.
                      </p>
                    )}
                    {errores[campo] && (
                      <p id={`${id}-error`} className="ui-campo__error aj-franja__nota">
                        {errores[campo]}
                      </p>
                    )}
                  </div>
                )
              })}
            {dia.modo === 'abierto' && dia.franjas.length < MAX_FRANJAS && (
              <Boton
                id={idDeAjuste('horarios', `${clave}-agregar`)}
                chico
                className="aj-dia__agregar"
                aria-label={`Agregar otro horario el ${nombre.toLowerCase()}`}
                onClick={() => {
                  ponerDia(clave, { ...dia, franjas: [...dia.franjas, nuevaFranja('', '')] })
                  focoPendiente.current = idDeAjuste('horarios', `${clave}-${dia.franjas.length}`)
                }}
              >
                Agregar otro horario
              </Boton>
            )}
          </fieldset>
        )
      })}
      <p className="ui-campo__ayuda" role="status">
        {anuncio}
      </p>
      {todoCerrado(valor) && <Alerta tipo="info">Con todos los días cerrados, el menú no muestra horarios ni “Abierto ahora”.</Alerta>}
    </>
  )
}
