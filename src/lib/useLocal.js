import { useEffect, useState } from 'react'
import { getLocal } from './locales'

// Carga el local del slug indicado. Devuelve { cargando, local, error }:
// local es null si el slug no existe; error es true si falló la carga.
export function useLocal(slug) {
  // Guardamos el slug junto con el resultado para saber si corresponde al actual.
  const [estado, setEstado] = useState({ slug: null, local: null, error: false })

  useEffect(() => {
    let vigente = true
    getLocal(slug)
      .then((local) => vigente && setEstado({ slug, local, error: false }))
      .catch((error) => {
        console.error(error)
        if (vigente) setEstado({ slug, local: null, error: true })
      })
    return () => {
      vigente = false
    }
  }, [slug])

  return { cargando: estado.slug !== slug, local: estado.local, error: estado.error }
}
