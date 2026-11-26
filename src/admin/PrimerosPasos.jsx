import { Link } from 'react-router-dom'
import { resumenDePasos } from './pasos'
import Tarjeta from './ui/Tarjeta'

const ESTADOS = { true: 'Listo', false: 'Pendiente', null: 'Revisando…' }

function Lista({ pasos }) {
  return (
    <ol className="pasos__lista" role="list">
      {pasos.map((paso) => (
        <li key={paso.clave} className="pasos__item" data-paso={paso.clave} data-hecho={String(paso.hecho)}>
          <span className="pasos__marca" aria-hidden="true">
            {paso.hecho ? '✓' : ''}
          </span>
          <div className="pasos__texto">
            <h3 className="pasos__titulo">{paso.titulo}</h3>
            <p className="pasos__ayuda">{paso.ayuda}</p>
            <p className="pasos__pie">
              <span className="pasos__estado">{ESTADOS[paso.hecho]}</span>
              {paso.enlace && (
                <Link className="pasos__enlace" to={paso.enlace.a}>
                  {paso.enlace.texto}
                </Link>
              )}
              {paso.nota && <span className="pasos__nota">{paso.nota}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * La lista de primeros pasos. Abierta (menú sin publicar) o plegada (ya publicado). Con todo
 * cumplido no se muestra. Mientras carga, la abierta ocupa lo mismo que cargada: no hay saltos.
 */
export default function PrimerosPasos({ pasos, plegada = false }) {
  const { hechos, total, faltan, cargando, completo } = resumenDePasos(pasos)
  if (completo || (plegada && cargando)) return null

  if (plegada) {
    return (
      <Tarjeta como="section" className="adm-bloque pasos" aria-label="Primeros pasos">
        <details>
          <summary className="pasos__resumen">{faltan === 1 ? 'Te falta 1 paso para completar tu menú' : `Te faltan ${faltan} pasos para completar tu menú`}</summary>
          <Lista pasos={pasos} />
        </details>
      </Tarjeta>
    )
  }
  return (
    <Tarjeta como="section" className="adm-bloque pasos" aria-labelledby="titulo-pasos" aria-busy={cargando}>
      <h2 id="titulo-pasos" className="adm-subtitulo">
        Primeros pasos
      </h2>
      <p className="adm-texto--suave pasos__avance">{cargando ? 'Revisando tu menú…' : `${hechos} de ${total} listos`}</p>
      <Lista pasos={pasos} />
    </Tarjeta>
  )
}
