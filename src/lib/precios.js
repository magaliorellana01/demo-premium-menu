// Precios del menú: formato ARS, variantes de producto y adicionales de categoría.
// Funciones puras, sin dependencias (las usa el menú público y las va a usar el panel).
//
// Estructura en la base (jsonb):
//   productos.variantes     [{ "nombre": "Chico", "precio": 4800 }, { "nombre": "Grande", "precio": 6000 }]   (hasta 4)
//   categorias.adicionales  [{ "nombre": "Leche vegetal", "precio": 600 }]                                  (hasta 8)
//
// Regla del precio base: si hay variantes, productos.precio (obligatorio) debe valer igual que la
// variante MÁS BAJA. El menú igual toma el "desde" de las propias variantes, no de esa columna.
//
// Los datos de la base los edita cada local: todo se lee de forma defensiva. Lo inválido se
// ignora (nunca rompe la página) y, sin variantes válidas, se muestra el precio base.

/** Límites (los mismos que las restricciones de supabase/07-variantes-adicionales.sql). */
export const MAX_VARIANTES = 4
export const MAX_ADICIONALES = 8
export const LARGO_MAX_NOMBRE = 40
export const PRECIO_MAXIMO = 99999999.99

// ── Formato ARS ───────────────────────────────────────────────────

const enteros = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const conCentavos = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Número de pesos redondeado a centavos (evita 4200.499999). */
function aCentavos(valor) {
  return Math.round(Number(valor) * 100) / 100
}

/** 4200 -> "4.200"; 4200.5 -> "4.200,50". Sin el signo $. */
function numeroArs(valor) {
  const pesos = aCentavos(valor)
  return Number.isInteger(pesos) ? enteros.format(pesos) : conCentavos.format(pesos)
}

/** 4200 -> "$4.200"; 4200.5 -> "$4.200,50" (los centavos solo si los hay). */
export function formatearPrecio(valor) {
  return `$${numeroArs(valor)}`
}

/**
 * Cómo se lee en voz alta: 4200 -> "4.200 pesos", 1 -> "1 peso", 4200.5 -> "4.200,50 pesos".
 * Los lectores de pantalla no siempre leen bien el signo "$": se les da este texto aparte.
 */
export function precioParaLeer(valor) {
  const pesos = aCentavos(valor)
  return `${numeroArs(pesos)} ${pesos === 1 ? 'peso' : 'pesos'}`
}

// ── Lectura defensiva ─────────────────────────────────────────────

function esPrecioValido(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= PRECIO_MAXIMO
}

/**
 * Lee una lista de { nombre, precio } venga como venga: ignora lo que no es un arreglo,
 * los elementos que no son objetos, los de nombre vacío o que no es texto y los de precio
 * que no es un número entre 0 y PRECIO_MAXIMO. Los nombres se recortan (espacios) y se cortan
 * en LARGO_MAX_NOMBRE caracteres. Si hay más de `maximo` elementos válidos, quedan los primeros.
 */
export function leerLista(crudo, maximo) {
  let lista = crudo
  if (typeof lista === 'string') {
    try {
      lista = JSON.parse(lista)
    } catch {
      return []
    }
  }
  if (!Array.isArray(lista)) return []

  const resultado = []
  for (const elemento of lista) {
    if (resultado.length >= maximo) break
    if (!elemento || typeof elemento !== 'object' || Array.isArray(elemento)) continue
    if (typeof elemento.nombre !== 'string' || !esPrecioValido(elemento.precio)) continue
    const nombre = elemento.nombre.trim().slice(0, LARGO_MAX_NOMBRE).trimEnd()
    if (!nombre) continue
    resultado.push({ nombre, precio: aCentavos(elemento.precio) })
  }
  return resultado
}

/** Variantes válidas del producto (hasta MAX_VARIANTES), o []. */
export function variantesDe(producto) {
  return leerLista(producto?.variantes, MAX_VARIANTES)
}

/** Adicionales válidos de la categoría (hasta MAX_ADICIONALES), o []. */
export function adicionalesDe(categoria) {
  return leerLista(categoria?.adicionales, MAX_ADICIONALES)
}

/**
 * Precio base de la columna `precio` (número o texto numérico), o null si no sirve.
 * No se usa para mostrar cuando hay variantes: ver precioDesde.
 */
export function precioBase(producto) {
  const valor = typeof producto?.precio === 'string' && producto.precio.trim() !== '' ? Number(producto.precio) : producto?.precio
  return esPrecioValido(valor) ? aCentavos(valor) : null
}

/**
 * Lo que hay que mostrar del precio de un producto:
 *   { variantes, desde, hayRango }
 *   - variantes: las válidas (hasta 4), en el orden en que vienen.
 *   - desde:     el precio más bajo de las variantes; sin variantes, el precio base; o null si no hay ninguno válido.
 *   - hayRango:  hay al menos dos variantes con precios distintos (solo entonces tiene sentido decir "desde").
 */
export function resumenPrecio(producto) {
  const variantes = variantesDe(producto)
  if (variantes.length === 0) return { variantes, desde: precioBase(producto), hayRango: false }
  const precios = variantes.map((variante) => variante.precio)
  const desde = Math.min(...precios)
  return { variantes, desde, hayRango: Math.max(...precios) > desde }
}

/** Precio "desde" del producto (el más bajo de sus variantes o su precio base), o null. */
export function precioDesde(producto) {
  return resumenPrecio(producto).desde
}
