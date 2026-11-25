import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SesionContexto } from './contextos'
import { cerrarSesion as salirDeSupabase, supabase } from './datos'

// Estado de la sesión con onAuthStateChange.
//   cargando: todavía no se sabe si hay sesión (evita mostrar el login un instante de más).
//   vencida:  la sesión terminó SIN que la persona apretara "Salir" (venció o fue revocada).
export default function SesionProvider({ children }) {
  const [estado, setEstado] = useState({ cargando: true, usuario: null })
  const [vencida, setVencida] = useState(false)
  const salidaVoluntaria = useRef(false)
  const habiaSesion = useRef(false)

  useEffect(() => {
    let activo = true

    // Sin await dentro del callback: Supabase puede quedarse esperando si se llama a la API desde ahí.
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (!activo) return
      if (evento === 'SIGNED_OUT') {
        if (habiaSesion.current && !salidaVoluntaria.current) setVencida(true)
        salidaVoluntaria.current = false
      }
      habiaSesion.current = Boolean(sesion)
      if (sesion) setVencida(false)
      setEstado({ cargando: false, usuario: sesion?.user ?? null })
    })

    // Respaldo por si la versión del cliente no emite INITIAL_SESSION.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return
      habiaSesion.current ||= Boolean(session)
      setEstado((actual) => (actual.cargando ? { cargando: false, usuario: session?.user ?? null } : actual))
    })

    return () => {
      activo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const cerrarSesion = useCallback(async () => {
    salidaVoluntaria.current = true
    const { error } = await salirDeSupabase()
    if (error) salidaVoluntaria.current = false
    return { error }
  }, [])

  const limpiarVencida = useCallback(() => setVencida(false), [])

  const valor = useMemo(
    () => ({ cargando: estado.cargando, usuario: estado.usuario, vencida, cerrarSesion, limpiarVencida }),
    [estado, vencida, cerrarSesion, limpiarVencida],
  )

  return <SesionContexto value={valor}>{children}</SesionContexto>
}
