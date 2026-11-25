// "Jugos y licuados" -> "jugos-y-licuados" (para ids y enlaces internos)
export function slugificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// id HTML de la sección de una categoría. La navegación (Tarea 3) apunta a estos ids.
export function idCategoria(categoria) {
  return `categoria-${slugificar(categoria.nombre)}`
}
