// Lógica pura de la administración de productos: leer filas, validar el formulario, agrupar,
// filtrar, reordenar y traducir errores. Sin red ni React (scripts/probar-productos.mjs).
//
// La base impone sus propios límites (RLS, CHECKs y la clave foránea compuesta). Esto es para
// avisar antes y en español, no para reemplazarlos.
import { interpretarPrecio, limpiarNombre, moverCategoria, ordenarCategorias, precioParaEditar, renumerar, siguienteOrden } from './categorias.js'
import { claveEtiqueta, ETIQUETAS } from '../lib/etiquetas.js'
import { normalizarTexto, terminosDeBusqueda } from '../lib/filtros.js'
import { LARGO_MAX_NOMBRE, MAX_VARIANTES, precioBase, variantesDe } from '../lib/precios.js'
import { esCarpetaLlena, MENSAJE_CARPETA_LLENA } from './fotos.js'

export const LARGO_MAX_NOMBRE_PRODUCTO = 60
export const LARGO_MAX_DESCRIPCION = 200
export { interpretarPrecio, LARGO_MAX_NOMBRE as LARGO_MAX_NOMBRE_VARIANTE, MAX_VARIANTES, precioParaEditar, renumerar, siguienteOrden }

// El orden funciona igual que en las categorías (campo `orden` y, ante empates, el nombre).
export const ordenarProductos = ordenarCategorias
export const moverProducto = moverCategoria

/** Fila de la base -> la forma que usa el panel. */
export function productoDesdeFila(fila) {
  return {
    id: fila.id,
    categoriaId: fila.categoria_id,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? '',
    precio: precioBase(fila) ?? 0,
    imagenUrl: fila.imagen_url || null,
    destacado: fila.destacado === true,
    disponible: fila.disponible !== false,
    etiquetas: Array.isArray(fila.etiquetas) ? fila.etiquetas.filter((e) => typeof e === 'string') : [],
    variantes: variantesDe(fila), // lectura defensiva: lo inválido se ignora
    orden: Number(fila.orden) || 0,
  }
}

// ── Formulario ──────────────────────────────────────────────

const CLAVES_CONOCIDAS = new Set(ETIQUETAS.map((e) => e.clave))

/** Estado inicial del formulario (todo texto, como se escribe). `producto` null = alta. */
export function formularioDesdeProducto(producto = null, categoriaId = '') {
  return {
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    categoriaId: producto?.categoriaId ?? categoriaId,
    precio: producto ? precioParaEditar(producto.precio) : '',
    disponible: producto?.disponible ?? true,
    destacado: producto?.destacado ?? false,
    etiquetas: (producto?.etiquetas ?? []).map(claveEtiqueta).filter((c) => CLAVES_CONOCIDAS.has(c)),
    // `clave` es solo para React (identifica la fila aunque se quiten otras)
    variantes: (producto?.variantes ?? []).map((v, i) => ({ clave: `v${i}`, nombre: v.nombre, precio: precioParaEditar(v.precio) })),
  }
}

/** Precio más bajo de las variantes escritas que ya se entienden, o null. */
export function precioMasBajo(variantes) {
  const precios = variantes.map((v) => interpretarPrecio(v.precio)).filter((p) => p !== null)
  return precios.length ? Math.min(...precios) : null
}

function errorDePrecio(texto) {
  const limpio = String(texto ?? '').replace(/\s/g, '')
  if (!limpio) return 'Escribí el precio.'
  if (/^\$?-/.test(limpio)) return 'El precio no puede ser negativo.'
  if (interpretarPrecio(limpio) === null) return 'Escribí un precio válido (por ejemplo 1.500 o 1500,50).'
  return ''
}

/**
 * Etiquetas a guardar: las elegidas (en el orden del vocabulario) y, al final, las que el
 * producto ya tenía y no son del vocabulario (el formulario no las muestra, así que no las borra).
 */
export function etiquetasParaGuardar(elegidas, originales = []) {
  const marcadas = new Set(elegidas)
  const conocidas = ETIQUETAS.map((e) => e.clave).filter((c) => marcadas.has(c))
  return [...conocidas, ...originales.filter((e) => !CLAVES_CONOCIDAS.has(claveEtiqueta(e)))]
}

/**
 * Valida el formulario. Devuelve { ok, datos, errores, primerError }.
 *   errores:     { nombre?, descripcion?, categoriaId?, precio?, "variante-0-nombre"?, "variante-0-precio"?, variantes? }
 *   primerError: la primera clave con error en el orden en que se ven los campos (para el foco).
 *   datos:       columnas listas para la base (sin id, local_id, orden ni imagen_url).
 * Con variantes, el precio principal NO se lee del campo: es la variante más barata.
 */
export function validarProducto(formulario, { categorias = [], original = null } = {}) {
  const errores = {}
  const orden = []
  const poner = (campo, mensaje) => {
    errores[campo] = mensaje
    orden.push(campo)
  }

  const nombre = limpiarNombre(formulario.nombre)
  if (!nombre) poner('nombre', 'Escribí el nombre del producto.')
  else if (nombre.length > LARGO_MAX_NOMBRE_PRODUCTO) poner('nombre', `El nombre puede tener hasta ${LARGO_MAX_NOMBRE_PRODUCTO} caracteres.`)

  const descripcion = String(formulario.descripcion ?? '').replace(/\s+/g, ' ').trim()
  if (descripcion.length > LARGO_MAX_DESCRIPCION) {
    poner('descripcion', `La descripción puede tener hasta ${LARGO_MAX_DESCRIPCION} caracteres (tiene ${descripcion.length}).`)
  }

  if (!categorias.some((c) => c.id === formulario.categoriaId)) poner('categoriaId', 'Elegí una categoría.')

  const variantes = formulario.variantes ?? []
  if (variantes.length === 0) {
    const mensaje = errorDePrecio(formulario.precio)
    if (mensaje) poner('precio', mensaje)
  }
  const nombresVistos = new Set()
  variantes.forEach((variante, i) => {
    const suNombre = limpiarNombre(variante.nombre)
    if (!suNombre) poner(`variante-${i}-nombre`, 'Escribí el nombre de la opción.')
    else if (suNombre.length > LARGO_MAX_NOMBRE) poner(`variante-${i}-nombre`, `El nombre puede tener hasta ${LARGO_MAX_NOMBRE} caracteres.`)
    else if (nombresVistos.has(normalizarTexto(suNombre))) poner(`variante-${i}-nombre`, 'Ya hay una opción con ese nombre.')
    nombresVistos.add(normalizarTexto(suNombre))
    const mensaje = errorDePrecio(variante.precio)
    if (mensaje) poner(`variante-${i}-precio`, mensaje)
  })
  if (variantes.length > MAX_VARIANTES) poner('variantes', `Podés cargar hasta ${MAX_VARIANTES} opciones.`)

  const ok = orden.length === 0
  const datos = ok
    ? {
        nombre,
        descripcion: descripcion || null,
        categoria_id: formulario.categoriaId,
        precio: variantes.length ? precioMasBajo(variantes) : interpretarPrecio(formulario.precio),
        disponible: Boolean(formulario.disponible),
        destacado: Boolean(formulario.destacado),
        etiquetas: etiquetasParaGuardar(formulario.etiquetas, original?.etiquetas),
        variantes: variantes.map((v) => ({ nombre: limpiarNombre(v.nombre), precio: interpretarPrecio(v.precio) })),
      }
    : null
  return { ok, datos, errores, primerError: orden[0] ?? null }
}

// ── Lista ───────────────────────────────────────────────────

/** [{ categoria, productos }] en el orden del menú (categorías y, dentro, productos). */
export function agruparPorCategoria(categorias, productos) {
  return ordenarCategorias(categorias).map((categoria) => ({
    categoria,
    productos: ordenarProductos(productos.filter((p) => p.categoriaId === categoria.id)),
  }))
}

export const ESTADOS = ['todos', 'disponibles', 'agotados']

/** ¿Hay búsqueda o estado elegido? (Con eso puesto no se puede reordenar: se ven huecos.) */
export function ocultaProductos({ consulta = '', estado = 'todos' } = {}) {
  return terminosDeBusqueda(consulta).length > 0 || estado === 'disponibles' || estado === 'agotados'
}

/**
 * Aplica búsqueda (solo por nombre, sin importar mayúsculas ni tildes), categoría y estado.
 * Devuelve { grupos, total }. Sin búsqueda ni estado se mantienen las categorías vacías.
 */
export function filtrarGrupos(grupos, { consulta = '', categoriaId = '', estado = 'todos' } = {}) {
  const terminos = terminosDeBusqueda(consulta)
  const recorta = ocultaProductos({ consulta, estado })
  const resultado = []
  let total = 0
  for (const grupo of grupos) {
    if (categoriaId && grupo.categoria.id !== categoriaId) continue
    const productos = grupo.productos.filter((p) => {
      if (estado === 'disponibles' && !p.disponible) return false
      if (estado === 'agotados' && p.disponible) return false
      const nombre = normalizarTexto(p.nombre)
      return terminos.every((t) => nombre.includes(t))
    })
    if (recorta && productos.length === 0) continue
    total += productos.length
    resultado.push({ categoria: grupo.categoria, productos })
  }
  return { grupos: resultado, total }
}

/** Aviso para lectores de pantalla después de mover un producto dentro de su categoría. */
export function anuncioDeProducto(productos, id, nombreCategoria) {
  const indice = productos.findIndex((p) => p.id === id)
  if (indice < 0) return ''
  return `${productos[indice].nombre} pasó a la posición ${indice + 1} de ${productos.length} en ${nombreCategoria}.`
}

/**
 * El `orden` que le toca a un producto al guardarlo: los nuevos (y los que cambian de
 * categoría) van al final de su categoría; el resto conserva el suyo.
 */
export function ordenAlGuardar(productos, original, categoriaId) {
  if (original && original.categoriaId === categoriaId) return original.orden
  return siguienteOrden(productos.filter((p) => p.categoriaId === categoriaId && p.id !== original?.id))
}

// ── Errores de la base, en español ──────────────────────────

/** Traduce un error de Supabase al guardar. Nunca muestra el mensaje técnico. */
export function mensajeDeErrorProducto(error) {
  const codigo = String(error?.code ?? '')
  const texto = String(error?.message ?? '')
  const estado = String(error?.statusCode ?? error?.status ?? '')
  if (error?.paso === 'foto') {
    if (esCarpetaLlena(error)) return MENSAJE_CARPETA_LLENA
    if (estado === '413' || /exceeded the maximum allowed size/i.test(texto)) return 'No se pudo subir la foto: pesa demasiado.'
    if (estado === '415' || /mime type/i.test(texto)) return 'No se pudo subir la foto: ese tipo de archivo no está permitido.'
    if (estado === '403' || /row-level security|unauthorized/i.test(texto)) return 'No tenés permiso para subir fotos a este local.'
    if (/jwt/i.test(texto)) return 'Tu sesión venció. Volvé a ingresar.'
    return 'No pudimos subir la foto. Revisá tu conexión y probá de nuevo.'
  }
  if (codigo === '23503') return 'Esa categoría ya no existe. Recargá la página y elegí otra.'
  if (codigo === '23514') return 'La base rechazó esos datos: revisá el nombre, los precios y que no haya más de 4 opciones.'
  if (codigo === '42501' || /row-level security|permission denied/i.test(texto)) return 'No tenés permiso para hacer ese cambio.'
  if (codigo === 'SIN_FILAS') return 'No se guardó: puede que el producto ya no exista o que no tengas permiso. Recargá la lista.'
  if (codigo === 'PGRST202') return 'Falta una actualización en la base de datos (supabase/10-admin-productos.sql). Avisale a OESTACK.'
  if (codigo === '22023') return 'La lista de productos cambió mientras tanto. La actualicé: probá de nuevo.'
  if (codigo === 'PGRST301' || /jwt/i.test(texto)) return 'Tu sesión venció. Volvé a ingresar.'
  if (/failed to fetch|network|load failed/i.test(texto)) return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
  return 'No pudimos guardar el cambio. Probá de nuevo en unos instantes.'
}
