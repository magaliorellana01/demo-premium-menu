import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ponerGuardiaDeAtras } from '../lib/atras'
import { destinoDeClic, pasoDeRegreso } from './salida'
import Boton from './ui/Boton'
import { SalidaContexto } from './useSalida'

// Si hay cambios sin guardar, antes de irse pregunta con un aviso fijo abajo (no es un modal:
// la pantalla sigue usable). Cubre enlaces del panel, atrás/adelante, "Salir" (con
// pedirSalida) y recargar o cerrar la pestaña (aviso propio del navegador).
export default function GuardaDeSalida({ children }) {
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const sucios = useRef(new Set())
  const [haySucios, setHaySucios] = useState(false)
  const [pendiente, setPendiente] = useState(null) // la salida que espera confirmación: () => void
  const quedarseRef = useRef(null)
  const focoAnterior = useRef(null)
  const posicion = useRef({ ruta: ubicacion.pathname, idx: window.history.state?.idx })
  const volviendo = useRef(false) // el próximo popstate es el regreso que pedimos nosotros
  const dejarPasar = useRef(false) // el próximo popstate ya está confirmado

  useLayoutEffect(() => {
    posicion.current = { ruta: ubicacion.pathname, idx: window.history.state?.idx }
  }, [ubicacion])

  const anotar = useCallback((id, sucio) => {
    if (sucio) sucios.current.add(id)
    else sucios.current.delete(id)
    setHaySucios(sucios.current.size > 0)
    if (sucios.current.size === 0) setPendiente(null) // se guardó o descartó: ya no hay qué preguntar
  }, [])

  const preguntar = useCallback((accion) => {
    if (!quedarseRef.current) focoAnterior.current = document.activeElement
    setPendiente(() => accion)
  }, [])

  const pedirSalida = useCallback((accion) => (sucios.current.size ? preguntar(accion) : accion()), [preguntar])

  useEffect(() => {
    const alClic = (evento) => {
      if (!sucios.current.size) return
      const a = evento.target.closest?.('a[href]')
      const destino = destinoDeClic(
        evento,
        a && { href: a.href, target: a.target, download: a.hasAttribute('download') },
        window.location,
      )
      if (!destino) return
      evento.preventDefault()
      evento.stopPropagation() // el <Link> del router no llega a navegar
      preguntar(() => navegar(destino))
    }
    // Corre antes que el popstate del router (lib/atras.js) y puede frenarlo.
    const alRetroceder = (evento) => {
      if (volviendo.current) {
        volviendo.current = false
        evento.stopImmediatePropagation()
        return
      }
      if (dejarPasar.current) {
        dejarPasar.current = false
        return
      }
      const paso = pasoDeRegreso({
        sucio: sucios.current.size > 0,
        rutaAntes: posicion.current.ruta,
        rutaAhora: window.location.pathname,
        idxAntes: posicion.current.idx,
        idxAhora: evento.state?.idx,
      })
      if (!paso) return
      evento.stopImmediatePropagation()
      volviendo.current = true
      window.history.go(paso)
      preguntar(() => {
        dejarPasar.current = true
        window.history.go(-paso)
      })
    }
    document.addEventListener('click', alClic, true)
    const sacarGuardia = ponerGuardiaDeAtras(alRetroceder)
    return () => {
      document.removeEventListener('click', alClic, true)
      sacarGuardia()
    }
  }, [navegar, preguntar])

  // El aviso del navegador al recargar o cerrar (solo con cambios, para no frenar el caché).
  useEffect(() => {
    if (!haySucios) return undefined
    const avisar = (evento) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [haySucios])

  useEffect(() => {
    if (pendiente) quedarseRef.current?.focus()
  }, [pendiente])

  const quedarse = () => {
    setPendiente(null)
    const anterior = focoAnterior.current
    if (anterior?.isConnected) anterior.focus()
  }

  const salir = () => {
    const accion = pendiente
    sucios.current.clear() // ya está confirmado: no se vuelve a preguntar
    setHaySucios(false)
    setPendiente(null)
    accion()
  }

  const valor = useMemo(() => ({ anotar, pedirSalida }), [anotar, pedirSalida])

  return (
    <SalidaContexto value={valor}>
      {children}
      {pendiente && (
        <div
          className="adm-salida"
          role="alertdialog"
          aria-labelledby="salida-pregunta"
          aria-describedby="salida-detalle"
          onKeyDown={(e) => e.key === 'Escape' && quedarse()}
        >
          <div className="adm-salida__caja">
            <p id="salida-pregunta" className="adm-salida__pregunta">
              Tenés cambios sin guardar
            </p>
            <p id="salida-detalle">Si salís ahora, se pierden.</p>
            <div className="ui-acciones">
              <Boton ref={quedarseRef} variante="primario" onClick={quedarse}>
                Seguir editando
              </Boton>
              <Boton variante="peligro" onClick={salir}>
                Salir sin guardar
              </Boton>
            </div>
          </div>
        </div>
      )}
    </SalidaContexto>
  )
}
