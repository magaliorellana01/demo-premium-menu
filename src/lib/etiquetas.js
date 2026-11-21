// Vocabulario estándar de etiquetas de producto, en el orden en que se muestran.
//
// `clave` es lo que se guarda en la columna productos.etiquetas (text[]): minúsculas,
// sin tildes y con guiones. `nombre` es el texto visible; `descripcion` es una aclaración
// corta (para tooltips y para el selector del panel de administración); `tono` decide
// el color del chip ('dietetica' = salvia, 'picante' y 'nuevo' = cobre).
//
// Este archivo no depende de React ni de nada más: lo va a reutilizar el panel.

export const ETIQUETAS = [
  { clave: 'vegano', nombre: 'Vegano', descripcion: 'Sin ingredientes de origen animal.', tono: 'dietetica' },
  { clave: 'vegetariano', nombre: 'Vegetariano', descripcion: 'Sin carne ni pescado.', tono: 'dietetica' },
  { clave: 'sin-tacc', nombre: 'Sin TACC', descripcion: 'Preparado sin trigo, avena, cebada ni centeno.', tono: 'dietetica' },
  { clave: 'sin-lactosa', nombre: 'Sin lactosa', descripcion: 'Preparado sin lactosa.', tono: 'dietetica' },
  { clave: 'picante', nombre: 'Picante', descripcion: 'Lleva ingredientes picantes.', tono: 'picante' },
  { clave: 'nuevo', nombre: 'Nuevo', descripcion: 'Se sumó hace poco a la carta.', tono: 'nuevo' },
]

// Las etiquetas fuera del vocabulario van después de las conocidas.
const ORDEN_AJENA = 1000

const POR_CLAVE = new Map(ETIQUETAS.map((etiqueta, indice) => [etiqueta.clave, { ...etiqueta, orden: indice }]))

/**
 * Convierte cualquier texto en una clave estable: "Sin TACC", "sin tacc" y "sin-tacc"
 * dan la misma ("sin-tacc"). Sin tildes, en minúsculas y con guiones.
 */
export function claveEtiqueta(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Datos para mostrar una etiqueta tal como viene en el producto.
 * Si está en el vocabulario, devuelve su nombre y tono; si no, la muestra como texto
 * simple (tono 'neutra') y con su propia clave, para que también se pueda filtrar.
 * Devuelve null si el valor no sirve (vacío o no es texto).
 */
export function infoEtiqueta(valor) {
  if (typeof valor !== 'string') return null
  const clave = claveEtiqueta(valor)
  if (!clave) return null
  const conocida = POR_CLAVE.get(clave)
  if (conocida) return { clave, nombre: conocida.nombre, descripcion: conocida.descripcion, tono: conocida.tono, orden: conocida.orden }
  const texto = valor.trim()
  // Fuera del vocabulario: el texto tal cual, solo con la primera letra en mayúscula.
  return { clave, nombre: texto.charAt(0).toUpperCase() + texto.slice(1), descripcion: '', tono: 'neutra', orden: ORDEN_AJENA }
}

/** Etiquetas de un producto, sin repetidas ni vacías, en el orden del vocabulario (las ajenas, al final). */
export function etiquetasDeProducto(producto) {
  const lista = Array.isArray(producto?.etiquetas) ? producto.etiquetas : []
  const vistas = new Map()
  for (const valor of lista) {
    const info = infoEtiqueta(valor)
    if (info && !vistas.has(info.clave)) vistas.set(info.clave, info)
  }
  return [...vistas.values()].sort((a, b) => a.orden - b.orden)
}
