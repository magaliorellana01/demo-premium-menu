import { useEffect, useState } from 'react'

// Qué categoría se está leyendo: la que cruza una línea fina a ~35 % de la
// altura de la pantalla (justo debajo de la barra fija). Devuelve
// [idActiva, setIdActiva]; setIdActiva sirve para marcarla al tocar un enlace.
//
// ids: ids de las secciones, en el orden en que aparecen en la página.
export function useCategoriaActiva(ids) {
  const [activa, setActiva] = useState(null)
  // La clave detecta cambios reales de la lista (el array cambia de identidad en cada render).
  const clave = ids.join('|')

  useEffect(() => {
    const ids = clave.split('|') // los ids no llevan "|": se reconstruyen desde la clave
    const secciones = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (secciones.length === 0 || !('IntersectionObserver' in window)) return

    const cruzando = new Set()
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const { target, isIntersecting } of entradas) {
          if (isIntersecting) cruzando.add(target.id)
          else cruzando.delete(target.id)
        }
        // Si hay varias, gana la más baja: es la que acaba de llegar a la línea.
        const ultima = [...ids].reverse().find((id) => cruzando.has(id))
        if (ultima) setActiva(ultima)
        // Arriba de todo (en los destacados) no hay ninguna activa.
        else if (secciones[0].getBoundingClientRect().top > window.innerHeight * 0.35) setActiva(null)
      },
      { rootMargin: '-35% 0px -64% 0px' },
    )
    secciones.forEach((seccion) => observador.observe(seccion))

    // Al final de la página la última categoría puede ser corta y no llegar a la línea.
    const alFinal = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActiva(ids[ids.length - 1])
      }
    }
    window.addEventListener('scroll', alFinal, { passive: true })

    return () => {
      observador.disconnect()
      window.removeEventListener('scroll', alFinal)
    }
  }, [clave])

  return [activa, setActiva]
}
