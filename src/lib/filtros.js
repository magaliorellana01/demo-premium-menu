// Búsqueda y filtros por etiqueta del menú público: funciones puras, sin React.
//
// - La búsqueda ignora mayúsculas y tildes (NFD) y mira nombre, descripción y etiquetas.
//   Si el texto tiene varias palabras, el producto tiene que contener TODAS (en cualquier orden).
// - Los filtros por etiqueta se combinan con "y": el producto debe tener todas las elegidas.
// - Las categorías que quedan sin productos desaparecen del resultado.

import { claveEtiqueta, etiquetasDeProducto } from './etiquetas.js'

const LARGO_MAXIMO_BUSQUEDA = 80

/** id del campo de búsqueda: permite devolverle el foco cuando desaparece el botón que se apretó. */
export const ID_CAMPO_BUSQUEDA = 'buscar-en-el-menu'

/** Minúsculas, sin tildes ni diéresis y con espacios simples: "Café  Frío" -> "cafe frio". */
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palabras de la búsqueda, ya normalizadas ("  Café  frío " -> ["cafe", "frio"]). */
export function terminosDeBusqueda(consulta) {
  const texto = normalizarTexto(consulta)
  return texto ? texto.split(' ') : []
}

/** ¿Hay una búsqueda o algún filtro puesto? */
export function hayFiltros({ consulta = '', etiquetas = [] } = {}) {
  return terminosDeBusqueda(consulta).length > 0 || etiquetas.length > 0
}

/** ¿El producto cumple la búsqueda (terminos ya normalizados) y todas las etiquetas elegidas? */
export function productoCoincide(producto, terminos = [], clavesElegidas = []) {
  const propias = etiquetasDeProducto(producto)

  if (clavesElegidas.length > 0) {
    const claves = new Set(propias.map((etiqueta) => etiqueta.clave))
    if (!clavesElegidas.every((clave) => claves.has(clave))) return false
  }

  if (terminos.length > 0) {
    const texto = normalizarTexto([producto?.nombre, producto?.descripcion, ...propias.map((etiqueta) => etiqueta.nombre)].join(' '))
    if (!terminos.every((termino) => texto.includes(termino))) return false
  }

  return true
}

/**
 * Aplica búsqueda y filtros a las categorías del local.
 * Devuelve { categorias, total }: las categorías con al menos un producto que coincide
 * (con solo esos productos, en su orden original) y la cantidad de productos que quedaron.
 * Sin filtros devuelve las categorías tal cual.
 */
export function filtrarCategorias(categorias, { consulta = '', etiquetas = [] } = {}) {
  const terminos = terminosDeBusqueda(consulta)
  const claves = etiquetas.map(claveEtiqueta).filter(Boolean)

  if (terminos.length === 0 && claves.length === 0) {
    return { categorias, total: categorias.reduce((suma, categoria) => suma + categoria.productos.length, 0) }
  }

  let total = 0
  const resultado = []
  for (const categoria of categorias) {
    const productos = categoria.productos.filter((producto) => productoCoincide(producto, terminos, claves))
    if (productos.length === 0) continue
    total += productos.length
    resultado.push({ ...categoria, productos })
  }
  return { categorias: resultado, total }
}

/**
 * Etiquetas que existen en los productos del local, para armar los chips de filtro:
 * primero las del vocabulario (en su orden) y después las ajenas, por orden alfabético.
 */
export function etiquetasDelLocal(categorias) {
  const encontradas = new Map()
  for (const categoria of categorias) {
    for (const producto of categoria.productos) {
      for (const etiqueta of etiquetasDeProducto(producto)) {
        if (!encontradas.has(etiqueta.clave)) encontradas.set(etiqueta.clave, etiqueta)
      }
    }
  }
  return [...encontradas.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

// ── Enlace compartible: ?q=...&etiquetas=vegano,sin-tacc ─────────────

/**
 * Lee los filtros de la URL (location.search). Solo se aceptan etiquetas que existen en el
 * local (`clavesValidas`); el resto se ignora, igual que una búsqueda demasiado larga.
 */
export function filtrosDesdeURL(search, clavesValidas = []) {
  const params = new URLSearchParams(search)
  const validas = new Set(clavesValidas)
  const consulta = (params.get('q') ?? '').slice(0, LARGO_MAXIMO_BUSQUEDA)
  const etiquetas = []
  for (const valor of (params.get('etiquetas') ?? '').split(',')) {
    const clave = claveEtiqueta(valor)
    if (clave && validas.has(clave) && !etiquetas.includes(clave)) etiquetas.push(clave)
  }
  return { consulta, etiquetas }
}

/**
 * Devuelve el `search` nuevo con los filtros puestos (o quitados), sin tocar otros
 * parámetros. Es "" si no queda ninguno; si no, empieza con "?".
 */
export function filtrosAURL(search, { consulta = '', etiquetas = [] } = {}) {
  const params = new URLSearchParams(search)
  const texto = consulta.trim()
  if (texto) params.set('q', texto)
  else params.delete('q')
  if (etiquetas.length > 0) params.set('etiquetas', etiquetas.join(','))
  else params.delete('etiquetas')
  const nuevo = params.toString().replace(/%2C/g, ',')
  return nuevo ? `?${nuevo}` : ''
}
