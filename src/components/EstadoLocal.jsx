import { describirEstado } from '../lib/horarios'
import { useAhora } from '../lib/useAhora'

// "Abierto ahora · hasta las 20:00". El estado se dice con palabras (el punto es solo un
// refuerzo visual: lleno = abierto, lleno cobre = cierra pronto, hueco = cerrado) y se
// recalcula solo cada minuto. No es una región "viva": no interrumpe a los lectores de pantalla.
export default function EstadoLocal({ horarios }) {
  const ahora = useAhora()
  const { texto, tono } = describirEstado(horarios, ahora)

  return (
    <p className={`estado-local estado-local--${tono}`}>
      <span className="estado-local__punto" aria-hidden="true" />
      {texto}
    </p>
  )
}
