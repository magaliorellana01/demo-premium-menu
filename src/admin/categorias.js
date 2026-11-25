// Lógica pura de la administración de categorías: validar, ordenar, reordenar, contar y
// adicionales. Sin red ni React (se prueba con scripts/probar-categorias.mjs).
//
// La base ya impone sus propios límites (CHECK de nombre y de adicionales, RLS y la clave
// foránea que impide borrar una categoría con productos). Esto es para avisar antes y en
// español, no para reemplazarlos.
import { normalizarTexto } from '../lib/filtros.js'
import { slugificar } from '../lib/formato.js'
import { adicionalesDe, LARGO_MAX_NOMBRE, MAX_ADICIONALES, PRECIO_MAXIMO } from '../lib/precios.js'

export const LARGO_MAX_NOMBRE_CATEGORIA = 60
export { LARGO_MAX_NOMBRE as LARGO_MAX_NOMBRE_ADICIONAL, MAX_ADICIONALES }

/** Recorta los extremos y deja un solo espacio entre palabras. */
export function limpiarNombre(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Valida el nombre de una categoría. `categorias` son las del local y `idActual` la que se está
 * editando (para no compararla consigo misma). Devuelve { ok, nombre, error }.
 *
 * No se permiten dos nombres que den el mismo "ancla" (ej. "Cafés" y "cafes"): el menú público
 * usa el nombre para armar el enlace a cada sección y dos iguales romperían la barra.
 */
export function validarNombreCategoria(texto, categorias = [], idActual = null) {
  const nombre = limpiarNombre(texto)
  const mal = (error) => ({ ok: false, nombre, error })
  if (!nombre) return mal('Escribí un nombre para la categoría.')
  if (nombre.length > LARGO_MAX_NOMBRE_CATEGORIA) return mal(`El nombre puede tener hasta ${LARGO_MAX_NOMBRE_CATEGORIA} caracteres.`)
  const ancla = slugificar(nombre)
  if (!ancla) return mal('El nombre tiene que incluir al menos una letra o un número.')
  if (categorias.some((c) => c.id !== idActual && slugificar(limpiarNombre(c.nombre)) === ancla)) {
    return mal('Ya tenés una categoría con ese nombre.')
  }
  return { ok: true, nombre, error: '' }
}

// ── Orden ────────────────────────────────────────────────────

/** Copia ordenada por `orden` y, ante empates, por nombre (igual criterio siempre). */
export function ordenarCategorias(categorias) {
  return [...categorias].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre), 'es'))
}

/** El `orden` para una categoría nueva: queda al final. */
export function siguienteOrden(categorias) {
  return categorias.reduce((maximo, c) => Math.max(maximo, Number(c.orden) || 0), 0) + 1
}

/**
 * Mueve una categoría un lugar (direccion: -1 sube, +1 baja). Devuelve la lista nueva, o la
 * MISMA si no se puede (ya está en el extremo o no existe). No modifica la original.
 */
export function moverCategoria(categorias, id, direccion) {
  const desde = categorias.findIndex((c) => c.id === id)
  const hasta = desde + direccion
  if (desde < 0 || (direccion !== -1 && direccion !== 1) || hasta < 0 || hasta >= categorias.length) return categorias
  const copia = [...categorias]
  ;[copia[desde], copia[hasta]] = [copia[hasta], copia[desde]]
  return copia
}

/** Renumera 1, 2, 3... según la posición en la lista (lo mismo que hace la función de la base). */
export function renumerar(categorias) {
  return categorias.map((c, i) => ({ ...c, orden: i + 1 }))
}

/** Aviso para lectores de pantalla después de mover. */
export function anuncioDePosicion(categorias, id) {
  const indice = categorias.findIndex((c) => c.id === id)
  if (indice < 0) return ''
  return `${categorias[indice].nombre} pasó a la posición ${indice + 1} de ${categorias.length}.`
}

// ── Productos ────────────────────────────────────────────────

/** "Sin productos" · "1 producto" · "6 productos" */
export function textoProductos(cantidad) {
  if (!cantidad) return 'Sin productos'
  return `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`
}

/** Solo se puede borrar una categoría vacía (la base además lo impide). */
export function puedeEliminarCategoria(categoria) {
  return categoria?.cantidadProductos === 0
}

/**
 * Pasa una fila de la base ({ ..., productos: [{ count }] }) a la forma que usa el panel:
 * { id, nombre, orden, activa, adicionales, cantidadProductos }.
 */
export function categoriaDesdeFila(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    orden: Number(fila.orden) || 0,
    activa: fila.activa !== false,
    adicionales: adicionalesDe(fila), // lectura defensiva: lo inválido se ignora
    cantidadProductos: Number(fila.productos?.[0]?.count ?? 0),
  }
}

// ── Adicionales ──────────────────────────────────────────────

/**
 * Interpreta un precio escrito a mano, al estilo argentino: "600", "$ 1.200", "1.200,50", "600,5"
 * o "600.50". Devuelve el número (con hasta 2 decimales) o null si no se entiende o es negativo.
 */
export function interpretarPrecio(texto) {
  const limpio = String(texto ?? '').replace(/\s/g, '').replace(/^\$/, '')
  if (!limpio) return null
  let normalizado
  if (/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(limpio)) normalizado = limpio.replaceAll('.', '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) normalizado = limpio.replaceAll('.', '') // "1.200" son mil doscientos
  else if (/^\d+(\.\d{1,2})?$/.test(limpio)) normalizado = limpio
  else return null
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero >= 0 && numero <= PRECIO_MAXIMO ? numero : null
}

/** ¿Entra otro adicional? */
export function puedeAgregarAdicional(adicionales) {
  return adicionales.length < MAX_ADICIONALES
}

/**
 * Valida un adicional. `adicionales` es la lista actual y `indice` el que se edita (null si es nuevo).
 * Devuelve { ok, adicional: { nombre, precio }, errores: { nombre?, precio? } }.
 */
export function validarAdicional({ nombre, precio } = {}, adicionales = [], indice = null) {
  const limpio = limpiarNombre(nombre)
  const errores = {}
  if (!limpio) errores.nombre = 'Escribí el nombre del adicional.'
  else if (limpio.length > LARGO_MAX_NOMBRE) errores.nombre = `El nombre puede tener hasta ${LARGO_MAX_NOMBRE} caracteres.`
  else if (adicionales.some((a, i) => i !== indice && normalizarTexto(a.nombre) === normalizarTexto(limpio))) {
    errores.nombre = 'Ya hay un adicional con ese nombre.'
  }

  const numero = interpretarPrecio(precio)
  if (String(precio ?? '').trim() === '') errores.precio = 'Escribí el precio.'
  else if (numero === null) errores.precio = 'Escribí un precio válido, sin signo menos (por ejemplo 600 o 1.200,50).'

  if (indice === null && !puedeAgregarAdicional(adicionales)) errores.nombre = `Podés cargar hasta ${MAX_ADICIONALES} adicionales.`

  return { ok: Object.keys(errores).length === 0, adicional: { nombre: limpio, precio: numero }, errores }
}

/** Precio para mostrar dentro del campo al editar: 1200 -> "1200", 600.5 -> "600,50". */
export function precioParaEditar(precio) {
  return Number.isInteger(precio) ? String(precio) : precio.toFixed(2).replace('.', ',')
}

/** Nueva lista con el adicional agregado (indice null) o reemplazado. */
export function guardarAdicionalEnLista(adicionales, adicional, indice = null) {
  if (indice === null) return [...adicionales, adicional]
  return adicionales.map((a, i) => (i === indice ? adicional : a))
}

export function quitarAdicionalDeLista(adicionales, indice) {
  return adicionales.filter((_, i) => i !== indice)
}

// ── Errores de la base, en español ──────────────────────────

/** Traduce un error de Supabase al guardar. Nunca muestra el mensaje técnico. */
export function mensajeDeError(error) {
  const codigo = String(error?.code ?? '')
  const texto = String(error?.message ?? '')
  if (codigo === '23503') return 'No se puede eliminar: la categoría tiene productos. Podés ocultarla.'
  if (codigo === '23514') return 'La base rechazó esos datos: revisá el nombre, los precios y que no haya más de 8 adicionales.'
  if (codigo === '42501' || /row-level security|permission denied/i.test(texto)) return 'No tenés permiso para hacer ese cambio.'
  if (codigo === 'SIN_FILAS') return 'No se guardó: puede que la categoría ya no exista o que no tengas permiso. Recargá la lista.'
  if (codigo === 'PGRST202') return 'Falta una actualización en la base de datos (supabase/09-admin-categorias.sql). Avisale a OESTACK.'
  if (codigo === '22023') return 'La lista de categorías cambió mientras tanto. La actualicé: probá de nuevo.'
  if (codigo === 'PGRST301' || /jwt/i.test(texto)) return 'Tu sesión venció. Volvé a ingresar.'
  if (/failed to fetch|network|load failed/i.test(texto)) return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
  return 'No pudimos guardar el cambio. Probá de nuevo en unos instantes.'
}
