// La "copia guardada" de la demo: cómo se tiene que ver Aroma. Puro, sin red
// (scripts/probar-demo.mjs): armar la copia, validarla y comparar con lo que hay.

export const SLUG_DEMO = 'aroma' // la única que estos scripts pueden tocar
export const DEMO_EMAIL = 'demo@oestack.com' // no tiene buzón: no se le manda ningún mail
export const VERSION = 1

// No son parte de "cómo se ve": identifican la fila o los pone la base.
const FUERA_DEL_LOCAL = ['id', 'slug', 'updated_at']
const FUERA_DE_FILAS = ['local_id', 'created_at', 'updated_at']

const sin = (fila, claves) => Object.fromEntries(Object.entries(fila).filter(([c]) => !claves.includes(c)))

/** JSON con las claves ordenadas: jsonb no conserva el orden. */
export const canon = (valor) =>
  JSON.stringify(valor, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((c) => [c, v[c]])) : v))
export const iguales = (a, b) => canon(a) === canon(b)

const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre), 'es') || String(a.id).localeCompare(String(b.id))

function ordenarFilas(categorias, productos) {
  const cats = categorias.map((c) => sin(c, FUERA_DE_FILAS)).sort(porOrden)
  const posicion = new Map(cats.map((c, i) => [c.id, i]))
  const prods = productos.map((p) => sin(p, FUERA_DE_FILAS)).sort((a, b) => (posicion.get(a.categoria_id) ?? 1e9) - (posicion.get(b.categoria_id) ?? 1e9) || porOrden(a, b))
  return { categorias: cats, productos: prods }
}

/** `archivos` son las rutas de Storage RELATIVAS a la carpeta del local. */
export function armarCopia({ local, categorias, productos, archivos }) {
  return {
    version: VERSION,
    slug: local.slug,
    local: sin(local, FUERA_DEL_LOCAL),
    ...ordenarFilas(categorias, productos),
    archivos: [...archivos].sort(),
  }
}

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const repetidos = (lista) => lista.length !== new Set(lista).size

/** Problemas de una copia leída del archivo. Una copia rota NO se puede aplicar: vaciaría el menú. */
export function problemasDeCopia(copia) {
  if (!copia || typeof copia !== 'object') return ['El archivo no contiene una copia.']
  const problemas = []
  if (copia.version !== VERSION) problemas.push(`Versión desconocida (${copia.version}).`)
  if (copia.slug !== SLUG_DEMO) problemas.push(`La copia es de "${copia.slug}", y estos comandos solo trabajan con "${SLUG_DEMO}".`)
  if (!copia.local || typeof copia.local.nombre !== 'string' || !copia.local.nombre.trim()) problemas.push('Faltan los datos del local.')
  else if (copia.local.activo !== true) problemas.push('En la copia el local está inactivo: la demo dejaría de verse.')
  if (copia.local && FUERA_DEL_LOCAL.some((c) => c in copia.local)) problemas.push('La copia no puede fijar id, slug ni updated_at del local.')
  for (const clave of ['categorias', 'productos']) {
    const filas = copia[clave]
    if (!Array.isArray(filas) || filas.length === 0) problemas.push(`La copia no tiene ${clave}.`)
    else {
      if (filas.some((f) => !UUID.test(String(f?.id)) || typeof f.nombre !== 'string' || !f.nombre.trim())) problemas.push(`Hay ${clave} sin id o sin nombre.`)
      if (repetidos(filas.map((f) => f?.id))) problemas.push(`Hay ${clave} con el id repetido.`)
      if (filas.some((f) => 'local_id' in f)) problemas.push(`Las ${clave} no pueden indicar local_id.`)
    }
  }
  if (Array.isArray(copia.categorias) && Array.isArray(copia.productos)) {
    const ids = new Set(copia.categorias.map((c) => c?.id))
    if (copia.productos.some((p) => !ids.has(p?.categoria_id))) problemas.push('Hay productos de una categoría que no está en la copia.')
  }
  if (!Array.isArray(copia.archivos) || copia.archivos.some((a) => typeof a !== 'string' || !a || a.startsWith('/') || a.split('/').includes('..'))) {
    problemas.push('La lista de archivos no es válida.')
  } else if (repetidos(copia.archivos)) problemas.push('Hay archivos repetidos.')
  return problemas
}

function compararFilas(guardadas, actuales) {
  const ahora = new Map(actuales.map((f) => [f.id, f]))
  const originales = new Set(guardadas.map((f) => f.id))
  return {
    // Respecto de la copia: lo que alguien agregó, borró o cambió.
    agregadas: actuales.filter((f) => !originales.has(f.id)),
    borradas: guardadas.filter((f) => !ahora.has(f.id)),
    modificadas: guardadas
      .filter((f) => ahora.has(f.id) && !iguales(f, ahora.get(f.id)))
      .map((f) => {
        const a = ahora.get(f.id)
        return { id: f.id, nombre: f.nombre, campos: [...new Set([...Object.keys(f), ...Object.keys(a)])].filter((c) => !iguales(f[c], a[c])).sort() }
      }),
  }
}

/** En qué difiere el estado `actual` (otra copia, recién armada) de la guardada. */
export function diferencias(guardada, actual) {
  const campos = [...new Set([...Object.keys(guardada.local), ...Object.keys(actual.local)])].filter((c) => !iguales(guardada.local[c], actual.local[c])).sort()
  const presentes = new Set(actual.archivos)
  const esperados = new Set(guardada.archivos)
  const resultado = {
    local: campos,
    categorias: compararFilas(guardada.categorias, actual.categorias),
    productos: compararFilas(guardada.productos, actual.productos),
    archivos: { sobrantes: actual.archivos.filter((a) => !esperados.has(a)), faltantes: guardada.archivos.filter((a) => !presentes.has(a)) },
  }
  const filas = (f) => f.agregadas.length + f.borradas.length + f.modificadas.length
  resultado.total = campos.length + filas(resultado.categorias) + filas(resultado.productos) + resultado.archivos.sobrantes.length + resultado.archivos.faltantes.length
  return resultado
}

const algunos = (lista, texto) => `${lista.slice(0, 5).map(texto).join(', ')}${lista.length > 5 ? ` y ${lista.length - 5} más` : ''}`

/** Renglones para mostrar. `verbos` cambia según se mire "qué cambió" o "qué se va a hacer". */
export function describirDiferencias(d, verbos = { agregadas: 'agregadas', borradas: 'borradas', modificadas: 'modificadas', sobrantes: 'sobran', faltantes: 'faltan' }) {
  const renglones = []
  if (d.local.length) renglones.push(`Datos del local ${verbos.modificadas}: ${d.local.join(', ')}`)
  for (const [clave, titulo] of [['categorias', 'Categorías'], ['productos', 'Productos']]) {
    for (const tipo of ['agregadas', 'borradas', 'modificadas']) {
      const lista = d[clave][tipo]
      if (lista.length) renglones.push(`${titulo} ${verbos[tipo]} (${lista.length}): ${algunos(lista, (f) => `"${String(f.nombre).slice(0, 40)}"${f.campos ? ` [${f.campos.join(', ')}]` : ''}`)}`)
    }
  }
  for (const tipo of ['sobrantes', 'faltantes']) {
    if (d.archivos[tipo].length) renglones.push(`Archivos de Storage que ${verbos[tipo]} (${d.archivos[tipo].length}): ${algunos(d.archivos[tipo], (a) => a)}`)
  }
  return renglones
}

const esDePrueba = (texto) => /^\s*zz[-\s]/i.test(String(texto ?? ''))

/**
 * Cosas para mirar antes de guardar el estado actual como "así se ve la demo".
 *   impiden: no se puede guardar · avisos: se puede, pero conviene saberlo
 */
export function revisarAntesDeGuardar(copia) {
  const impiden = problemasDeCopia(copia)
  const avisos = []
  const nombres = [copia.local?.nombre, ...(copia.categorias ?? []).map((c) => c.nombre), ...(copia.productos ?? []).map((p) => p.nombre)]
  if (nombres.some(esDePrueba) || (copia.archivos ?? []).some((a) => /zz-prueba/i.test(a))) {
    impiden.push('Hay datos de prueba (nombres que empiezan con "ZZ"): ¿se está corriendo una verificación o quedó algo sin limpiar?')
  }
  const externas = (copia.productos ?? []).filter((p) => p.imagen_url && !p.imagen_url.startsWith('/locales/') && !p.imagen_url.includes('/storage/v1/object/public/imagenes/'))
  if (externas.length) avisos.push(`${externas.length} producto(s) con una imagen de otro sitio: ${algunos(externas, (p) => `"${p.nombre}"`)}.`)
  if (copia.archivos?.length) {
    avisos.push(`La demo usa ${copia.archivos.length} archivo(s) subidos a Storage. La copia guarda sus nombres, no las imágenes: si alguien los borra, demo:reiniciar no puede recuperarlos. Conviene que la demo use las imágenes de la app (/locales/aroma/...).`)
  }
  return { impiden, avisos }
}
