// Pruebas de la lógica de productos y fotos (sin red ni dependencias): node scripts/probar-productos.mjs
import {
  CALIDADES,
  comprimirHastaPeso,
  extensionDeTipo,
  MAX_BYTES_ENTRADA,
  nombreDeArchivo,
  pasosDeReduccion,
  pesoLegible,
  recorte45,
  revisarArchivo,
  rutasDeStorage,
  rutasDesdeUrl,
  VERSIONES,
} from '../src/admin/fotos.js'
import { borrarFotoSinUso, eliminarProductoConFoto, guardarProductoConFoto } from '../src/admin/guardarProducto.js'
import {
  agruparPorCategoria,
  anuncioDeProducto,
  etiquetasParaGuardar,
  filtrarGrupos,
  formularioDesdeProducto,
  interpretarPrecio,
  LARGO_MAX_DESCRIPCION,
  LARGO_MAX_NOMBRE_PRODUCTO,
  mensajeDeErrorProducto,
  moverProducto,
  ocultaProductos,
  ordenAlGuardar,
  precioMasBajo,
  productoDesdeFila,
  renumerar,
  validarProducto,
} from '../src/admin/productos.js'
import { imagenProducto } from '../src/lib/imagenes.js'

let total = 0
let fallos = 0
function caso(nombre, real, esperado) {
  total++
  const a = JSON.stringify(real)
  const b = JSON.stringify(esperado)
  const ok = a === b
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${nombre}${ok ? '' : `\n         esperado: ${b}\n         obtenido: ${a}`}`)
}
const titulo = (t) => console.log(`\n— ${t} —`)

// ── Precio ─────────────────────────────────────────────────
titulo('Normalización de precio (formato argentino)')
for (const [texto, esperado] of [
  ['1500', 1500], ['1.500', 1500], ['1500,50', 1500.5], ['1.500,50', 1500.5], ['1500,5', 1500.5], ['1500.50', 1500.5],
  ['$ 4.200', 4200], [' 4 200 ', 4200], ['0', 0], ['1.234.567', 1234567], ['99999999,99', 99999999.99],
  ['-100', null], ['$-5', null], ['abc', null], ['', null], ['1,500', null], ['1.50.0', null], ['1500,505', null], ['100000000', null], ['1e3', null], ['NaN', null],
]) caso(`"${texto}" -> ${esperado}`, interpretarPrecio(texto), esperado)

// ── Validación ─────────────────────────────────────────────
titulo('Validación del producto')
const categorias = [{ id: 'c1', nombre: 'Cafés', orden: 1 }, { id: 'c2', nombre: 'Postres', orden: 2 }]
const base = { ...formularioDesdeProducto(null, 'c1'), nombre: '  Flat   white ', precio: '1.500,50' }
const v = (cambios, original) => validarProducto({ ...base, ...cambios }, { categorias, original })

caso('formulario nuevo: disponible, no destacado, sin etiquetas ni opciones', formularioDesdeProducto(null, 'c1'), { nombre: '', descripcion: '', categoriaId: 'c1', precio: '', disponible: true, destacado: false, etiquetas: [], variantes: [] })
caso('datos listos para la base (recorta, normaliza precio, descripción vacía = null)', v({}).datos, { nombre: 'Flat white', descripcion: null, categoria_id: 'c1', precio: 1500.5, disponible: true, destacado: false, etiquetas: [], variantes: [] })
caso('sin nombre', v({ nombre: '   ' }).errores, { nombre: 'Escribí el nombre del producto.' })
caso(`nombre de ${LARGO_MAX_NOMBRE_PRODUCTO} entra`, v({ nombre: 'a'.repeat(60) }).ok, true)
caso('nombre de 61 no entra', Object.keys(v({ nombre: 'a'.repeat(61) }).errores), ['nombre'])
caso('los espacios de los extremos no cuentan', v({ nombre: `  ${'a'.repeat(60)}  ` }).ok, true)
caso(`descripción de ${LARGO_MAX_DESCRIPCION} entra`, v({ descripcion: 'x'.repeat(200) }).ok, true)
caso('descripción de 201 no entra', Object.keys(v({ descripcion: 'x'.repeat(201) }).errores), ['descripcion'])
caso('categoría de otro local (no está en la lista)', Object.keys(v({ categoriaId: 'ajena' }).errores), ['categoriaId'])
caso('sin precio', v({ precio: '' }).errores.precio, 'Escribí el precio.')
caso('precio negativo', v({ precio: '-5' }).errores.precio, 'El precio no puede ser negativo.')
caso('precio que no se entiende', v({ precio: 'mil' }).errores.precio, 'Escribí un precio válido (por ejemplo 1.500 o 1500,50).')
caso('precio 0 vale', v({ precio: '0' }).datos.precio, 0)
caso('primer error: el primero en el orden de la pantalla', v({ nombre: '', precio: '', categoriaId: '' }).primerError, 'nombre')
caso('primer error sin el de nombre', v({ precio: '', categoriaId: '' }).primerError, 'categoriaId')
caso('con errores no hay datos', v({ nombre: '' }).datos, null)

titulo('Variantes')
const dos = [{ nombre: ' Grande ', precio: '6.000' }, { nombre: 'Chico', precio: '4800' }]
caso('el precio principal pasa a ser la opción más barata (aunque el campo diga otra cosa)', v({ variantes: dos, precio: '999999' }).datos.precio, 4800)
caso('con opciones no se exige el precio principal', v({ variantes: dos, precio: '' }).ok, true)
caso('se guardan en el orden escrito y limpias', v({ variantes: dos }).datos.variantes, [{ nombre: 'Grande', precio: 6000 }, { nombre: 'Chico', precio: 4800 }])
caso('precio más bajo ignora lo que todavía no se entiende', precioMasBajo([{ precio: 'x' }, { precio: '300' }]), 300)
caso('precio más bajo sin nada válido', precioMasBajo([{ precio: '' }]), null)
caso('opción sin nombre ni precio', Object.keys(v({ variantes: [{ nombre: '', precio: '' }] }).errores), ['variante-0-nombre', 'variante-0-precio'])
caso('opciones repetidas (sin importar tildes ni mayúsculas)', v({ variantes: [{ nombre: 'Café', precio: '1' }, { nombre: 'cafe', precio: '2' }] }).errores, { 'variante-1-nombre': 'Ya hay una opción con ese nombre.' })
caso('nombre de opción de 41 no entra (la base acepta 40)', Object.keys(v({ variantes: [{ nombre: 'a'.repeat(41), precio: '1' }] }).errores), ['variante-0-nombre'])
caso('opción con precio negativo', v({ variantes: [{ nombre: 'A', precio: '-1' }] }).errores['variante-0-precio'], 'El precio no puede ser negativo.')
const n = (k) => Array.from({ length: k }, (_, i) => ({ nombre: `Op ${i}`, precio: '1' }))
caso('4 opciones entran', v({ variantes: n(4) }).ok, true)
caso('5 opciones no', Object.keys(v({ variantes: n(5) }).errores), ['variantes'])

titulo('Etiquetas y lectura de filas')
caso('en el orden del vocabulario', etiquetasParaGuardar(['nuevo', 'vegano']), ['vegano', 'nuevo'])
caso('claves desconocidas elegidas no se guardan', etiquetasParaGuardar(['inventada']), [])
caso('las ajenas que ya tenía no se pierden', etiquetasParaGuardar(['vegano'], ['De autor', 'Sin TACC']), ['vegano', 'De autor'])
const fila = { id: 'p1', categoria_id: 'c1', nombre: 'Moca', descripcion: null, precio: '5600.00', imagen_url: '', destacado: false, disponible: true, etiquetas: ['Sin TACC'], variantes: [{ nombre: 'Chico', precio: 5600 }, { basura: 1 }], orden: 5 }
caso('fila -> producto (precio numérico, imagen vacía = null, variantes inválidas fuera)', productoDesdeFila(fila), { id: 'p1', categoriaId: 'c1', nombre: 'Moca', descripcion: '', precio: 5600, imagenUrl: null, destacado: false, disponible: true, etiquetas: ['Sin TACC'], variantes: [{ nombre: 'Chico', precio: 5600 }], orden: 5 })
caso('formulario de un producto existente marca las etiquetas aunque estén escritas distinto', formularioDesdeProducto(productoDesdeFila(fila)).etiquetas, ['sin-tacc'])
caso('y escribe el precio para editar', formularioDesdeProducto(productoDesdeFila({ ...fila, precio: 1500.5 })).precio, '1500,50')

// ── Lista y orden ──────────────────────────────────────────
titulo('Agrupar, filtrar y reordenar')
const P = (id, categoriaId, nombre, orden, disponible = true) => ({ id, categoriaId, nombre, orden, disponible })
const productos = [P('b', 'c1', 'Capuchino', 2), P('a', 'c1', 'Café frío', 1, false), P('x', 'c2', 'Carrot cake', 1)]
const grupos = agruparPorCategoria([categorias[1], categorias[0], { id: 'c3', nombre: 'Vacía', orden: 3 }], productos)
const ids = (gs) => gs.map((g) => [g.categoria.id, g.productos.map((p) => p.id)])
caso('categorías y productos en el orden del menú', ids(grupos), [['c1', ['a', 'b']], ['c2', ['x']], ['c3', []]])
caso('sin filtros se ven también las categorías vacías', filtrarGrupos(grupos).grupos.length, 3)
caso('búsqueda por nombre sin tildes ni mayúsculas', ids(filtrarGrupos(grupos, { consulta: 'CAFE frio' }).grupos), [['c1', ['a']]])
caso('filtro por categoría', ids(filtrarGrupos(grupos, { categoriaId: 'c2' }).grupos), [['c2', ['x']]])
caso('solo agotados', ids(filtrarGrupos(grupos, { estado: 'agotados' }).grupos), [['c1', ['a']]])
caso('disponibles + búsqueda', filtrarGrupos(grupos, { estado: 'disponibles', consulta: 'ca' }).total, 2)
caso('sin resultados', filtrarGrupos(grupos, { consulta: 'zzz' }), { grupos: [], total: 0 })
caso('con búsqueda o estado no se puede reordenar', [ocultaProductos({ consulta: 'a' }), ocultaProductos({ estado: 'agotados' }), ocultaProductos({ estado: 'todos', consulta: '  ' })], [true, true, false])
const lista = grupos[0].productos
caso('bajar', moverProducto(lista, 'a', 1).map((p) => p.id), ['b', 'a'])
caso('subir el primero no hace nada (misma lista)', moverProducto(lista, 'a', -1) === lista, true)
caso('no modifica la original', lista.map((p) => p.id), ['a', 'b'])
caso('renumera 1, 2', renumerar(moverProducto(lista, 'a', 1)).map((p) => [p.id, p.orden]), [['b', 1], ['a', 2]])
caso('anuncio para el lector de pantalla', anuncioDeProducto(moverProducto(lista, 'a', 1), 'a', 'Cafés'), 'Café frío pasó a la posición 2 de 2 en Cafés.')
caso('nuevo: al final de su categoría', ordenAlGuardar(productos, null, 'c1'), 3)
caso('nuevo en categoría vacía', ordenAlGuardar(productos, null, 'c3'), 1)
caso('al editar sin cambiar de categoría conserva el orden', ordenAlGuardar(productos, productos[0], 'c1'), 2)
caso('al cambiar de categoría va al final de la nueva', ordenAlGuardar(productos, productos[0], 'c2'), 2)

// ── Fotos ──────────────────────────────────────────────────
titulo('Qué archivos se aceptan')
const archivo = (type, size, name = 'foto') => ({ type, size, name })
for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) caso(`acepta ${t}`, revisarArchivo(archivo(t, 1000)).ok, true)
caso('sin tipo, por extensión (.JPG)', revisarArchivo(archivo('', 1000, 'IMG_1.JPG')).ok, true)
for (const t of ['image/gif', 'image/svg+xml', 'application/pdf', 'video/mp4', 'text/html']) caso(`rechaza ${t}`, revisarArchivo(archivo(t, 1000, 'x.jpg')).ok, false)
caso('justo 10 MB entra', revisarArchivo(archivo('image/jpeg', MAX_BYTES_ENTRADA)).ok, true)
caso('más de 10 MB: mensaje con el peso', revisarArchivo(archivo('image/jpeg', 12.5 * 1024 * 1024)).error, 'La foto pesa 12,5 MB y el máximo es 10 MB. Elegí una más liviana.')
caso('archivo vacío', revisarArchivo(archivo('image/jpeg', 0)).ok, false)

titulo('Recorte 4:5 y tamaños')
caso('horizontal 4000x3000: sobran los costados', recorte45(4000, 3000), { x: 800, y: 0, ancho: 2400, alto: 3000 })
caso('vertical 3000x4000: sobran los costados', recorte45(3000, 4000), { x: 0, y: 125, ancho: 3000, alto: 3750 })
caso('muy alta 1000x3000: sobra arriba y abajo', recorte45(1000, 3000), { x: 0, y: 875, ancho: 1000, alto: 1250 })
caso('ya es 4:5', recorte45(480, 600), { x: 0, y: 0, ancho: 480, alto: 600 })
caso('cuadrada', recorte45(1000, 1000), { x: 100, y: 0, ancho: 800, alto: 1000 })
caso('diminuta: nunca sale de la imagen', recorte45(1, 1), { x: 0, y: 0, ancho: 1, alto: 1 })
caso('medidas inválidas', recorte45(0, 100), null)
let dentro = true
for (let w = 1; w < 300; w += 7) for (let h = 1; h < 300; h += 11) {
  const r = recorte45(w, h)
  if (r.x < 0 || r.y < 0 || r.x + r.ancho > w || r.y + r.alto > h) dentro = false
}
caso('en muchas medidas el recorte queda dentro de la imagen', dentro, true)
caso('versiones: 480x600 y 240x300 (4:5)', VERSIONES.map((x) => [x.ancho, x.alto, x.ancho / x.alto]), [[480, 600, 0.8], [240, 300, 0.8]])
caso('reducción de a mitades desde una foto grande', pasosDeReduccion(2400, VERSIONES[0]).map((p) => p.ancho), [1920, 960, 480])
caso('foto chica: un solo paso', pasosDeReduccion(600, VERSIONES[0]).map((p) => p.ancho), [480])

titulo('Calidad y formato')
const codificador = (pesos) => {
  const usadas = []
  return { usadas, fn: async (q) => { usadas.push(q); return { size: pesos[usadas.length - 1] } } }
}
let c = codificador([50000])
caso('si entra a la primera, usa la mejor calidad', (await comprimirHastaPeso(c.fn, 80 * 1024)).calidad, CALIDADES[0])
c = codificador([200000, 100000, 70000])
caso('baja la calidad hasta entrar en el objetivo', [(await comprimirHastaPeso(c.fn, 80 * 1024)).calidad, c.usadas.length], [CALIDADES[2], 3])
c = codificador(Array(10).fill(999999))
caso('si nunca entra, queda la mínima (no degrada más)', [(await comprimirHastaPeso(c.fn, 80 * 1024)).calidad, c.usadas.length], [CALIDADES.at(-1), CALIDADES.length])
caso('extensiones: solo webp y jpg; PNG no', [extensionDeTipo('image/webp'), extensionDeTipo('image/jpeg'), extensionDeTipo('image/png')], ['webp', 'jpg', null])
caso('peso legible', pesoLegible(41234), '40 kB')

titulo('Rutas de Storage')
const SB = 'https://proyecto.supabase.co'
const LOCAL = 'local-1'
const pub = (ruta) => `${SB}/storage/v1/object/public/imagenes/${ruta}`
caso('nombre legible + parte única', nombreDeArchivo('Café frío (¡nuevo!)', 'ab12'), 'cafe-frio-nuevo-ab12')
caso('nombre sin letras', nombreDeArchivo('☕', 'ab12'), 'foto-ab12')
caso('nombre largo se corta en 40 sin guion colgando', nombreDeArchivo(`${'a'.repeat(39)} bbbb`, 'ff'), `${'a'.repeat(39)}-ff`)
const rutas = rutasDeStorage(LOCAL, 'moca-ab12', 'webp')
caso('<local_id>/productos/<nombre>-480 y -240', rutas, ['local-1/productos/moca-ab12-480.webp', 'local-1/productos/moca-ab12-240.webp'])
caso('desde la URL pública vuelven las dos rutas', rutasDesdeUrl(pub(rutas[0]), SB, LOCAL), rutas)
caso('también en JPEG', rutasDesdeUrl(pub('local-1/productos/a-480.jpg'), `${SB}/`, LOCAL), ['local-1/productos/a-480.jpg', 'local-1/productos/a-240.jpg'])
for (const [nombre, url] of [
  ['foto local del demo', '/locales/aroma/productos/moca-480.webp'],
  ['foto de otro local', pub('local-2/productos/a-480.webp')],
  ['otro proyecto', 'https://otro.supabase.co/storage/v1/object/public/imagenes/local-1/productos/a-480.webp'],
  ['subcarpeta o salida de carpeta', pub('local-1/productos/../../local-2/productos/a-480.webp')],
  ['con puntos dobles', pub('local-1/productos/a..-480.webp')],
  ['con parámetros', pub('local-1/productos/a-480.webp?x=1')],
  ['el logo', pub('local-1/logo.webp')],
  ['null', null],
]) caso(`no se toca: ${nombre}`, rutasDesdeUrl(url, SB, LOCAL), null)

titulo('srcset del menú público (los dos tipos)')
caso('foto local', imagenProducto('/locales/aroma/productos/moca-480.webp').srcSet, '/locales/aroma/productos/moca-240.webp 240w, /locales/aroma/productos/moca-480.webp 480w')
caso('foto de Storage en WebP', imagenProducto(pub(rutas[0])).srcSet, `${pub(rutas[1])} 240w, ${pub(rutas[0])} 480w`)
caso('foto de Storage en JPEG', imagenProducto(pub('l/productos/a-480.jpg')).srcSet, `${pub('l/productos/a-240.jpg')} 240w, ${pub('l/productos/a-480.jpg')} 480w`)
caso('otra imagen: sin srcset', imagenProducto('https://x.test/foto.png'), { src: 'https://x.test/foto.png' })
caso('sin imagen', imagenProducto(null), null)

// ── Orden seguro entre Storage y base ─────────────────────
titulo('Guardado con foto: orden seguro y fallas')

const VIEJA = pub('local-1/productos/vieja-480.webp')
const ARCHIVOS_VIEJOS = ['local-1/productos/vieja-480.webp', 'local-1/productos/vieja-240.webp']
const NUEVAS = rutasDeStorage(LOCAL, 'nueva', 'webp')
const FOTO = { tipo: 'nueva', blobs: [{}, {}], extension: 'webp', nombre: 'nueva' }
const RED = () => Object.assign(new Error('TypeError: Failed to fetch'), { code: '' })

// Base y Storage de mentira. `falla` indica dónde fallar:
//   subir: n (la enésima subida) · subirPeroLlega: true · guardar: 'red' | 'rechazo' | 'red-pero-guardo'
//   leer · borrar · contar · eliminar: 'red' | 'rechazo' | 'red-pero-borro' | 'sin-filas'
function mundo(falla = {}) {
  const archivos = new Set(ARCHIVOS_VIEJOS)
  const filas = new Map([['p1', { id: 'p1', nombre: 'Moca', imagenUrl: VIEJA }]])
  const registro = []
  let subidas = 0
  const api = {
    supabaseUrl: SB,
    urlPublica: pub,
    async subir(ruta) {
      registro.push(`subir ${ruta.split('/').pop()}`)
      subidas++
      if (falla.subir === subidas) {
        if (falla.subirPeroLlega) archivos.add(ruta)
        throw RED()
      }
      archivos.add(ruta)
    },
    async borrar(rutas) {
      registro.push(`borrar ${rutas.map((r) => r.split('/').pop()).join('+')}`)
      if (falla.borrar) return rutas
      rutas.forEach((r) => archivos.delete(r))
      return []
    },
    async guardar(id, cambios) {
      registro.push('guardar')
      if (falla.guardar === 'red') throw RED()
      if (falla.guardar === 'rechazo') throw Object.assign(new Error('check'), { code: '23514' })
      const filaNueva = { ...filas.get(id), id, nombre: cambios.nombre ?? filas.get(id)?.nombre, imagenUrl: 'imagen_url' in cambios ? cambios.imagen_url : (filas.get(id)?.imagenUrl ?? null) }
      filas.set(id, filaNueva)
      if (falla.guardar === 'red-pero-guardo') throw RED()
      return filaNueva
    },
    async eliminar(id) {
      registro.push('eliminar fila')
      if (falla.eliminar === 'red') throw RED()
      if (falla.eliminar === 'rechazo') throw Object.assign(new Error('rls'), { code: '42501' })
      if (falla.eliminar === 'sin-filas') throw Object.assign(new Error('0'), { code: 'SIN_FILAS' })
      filas.delete(id)
      if (falla.eliminar === 'red-pero-borro') throw RED()
    },
    async leer(id) {
      if (falla.leer) throw RED()
      return filas.get(id) ?? null
    },
    async contarUsos(url) {
      if (falla.contar) throw RED()
      return [...filas.values()].filter((f) => f.imagenUrl === url).length
    },
  }
  /** Ningún producto apunta a un archivo que no existe. */
  const sinRotas = () => [...filas.values()].every((f) => !f.imagenUrl || (rutasDesdeUrl(f.imagenUrl, SB, LOCAL) ?? []).every((r) => archivos.has(r)))
  const nombres = () => [...archivos].map((r) => r.split('/').pop()).sort()
  return { api, archivos, filas, registro, sinRotas, nombres }
}

async function guardar(falla, extra = {}) {
  const m = mundo(falla)
  const args = { api: m.api, localId: LOCAL, id: 'p1', esNuevo: false, fila: { nombre: 'Moca' }, original: { id: 'p1', imagenUrl: VIEJA }, foto: FOTO, ...extra }
  try {
    return { m, ok: await guardarProductoConFoto(args) }
  } catch (error) {
    return { m, error }
  }
}
const SOLO_VIEJAS = ['vieja-240.webp', 'vieja-480.webp']
const SOLO_NUEVAS = ['nueva-240.webp', 'nueva-480.webp']
const TODAS = [...SOLO_NUEVAS, ...SOLO_VIEJAS]

let r = await guardar({})
caso('reemplazar: orden subir → guardar → borrar lo viejo', r.m.registro, ['subir nueva-480.webp', 'subir nueva-240.webp', 'guardar', 'borrar vieja-480.webp+vieja-240.webp'])
caso('reemplazar: quedan solo las nuevas, sin huérfanos ni fotos rotas', [r.m.nombres(), r.ok.huerfanos, r.m.sinRotas()], [SOLO_NUEVAS, [], true])
r = await guardar({ subir: 1 })
caso('falla la 1ª subida: no toca la base y queda todo como estaba', [r.error.paso, r.m.registro.includes('guardar'), r.m.nombres(), r.error.huerfanos], ['foto', false, SOLO_VIEJAS, []])
r = await guardar({ subir: 2, subirPeroLlega: true })
caso('falla la 2ª (aunque llegó): borra las dos nuevas', [r.error.paso, r.m.nombres(), r.error.huerfanos, r.m.sinRotas()], ['foto', SOLO_VIEJAS, [], true])
r = await guardar({ subir: 2, borrar: true })
caso('si tampoco puede limpiar, informa los huérfanos', r.error.huerfanos, NUEVAS)
r = await guardar({ guardar: 'rechazo' })
caso('la base rechaza: borra lo nuevo y conserva lo viejo', [r.error.paso, r.m.nombres(), r.error.huerfanos, r.m.sinRotas()], ['datos', SOLO_VIEJAS, [], true])
r = await guardar({ guardar: 'red' })
caso('se corta antes de guardar: confirma que no guardó y limpia', [r.m.nombres(), r.error.huerfanos, r.m.sinRotas()], [SOLO_VIEJAS, [], true])
r = await guardar({ guardar: 'red-pero-guardo' })
caso('guardó pero se perdió la respuesta: se da por guardado y borra lo viejo', [r.ok?.producto.imagenUrl, r.m.nombres(), r.m.sinRotas()], [pub(NUEVAS[0]), SOLO_NUEVAS, true])
r = await guardar({ guardar: 'red-pero-guardo', leer: true })
caso('en la duda NO borra nada: no hay productos sin imagen', [r.m.nombres(), r.m.sinRotas(), r.error.huerfanos, r.error.urlEnDuda], [TODAS, true, NUEVAS, pub(NUEVAS[0])])
r = await guardar({ borrar: true })
caso('no se pudo borrar lo viejo: guardado + huérfanos informados', [r.ok.producto.imagenUrl, r.ok.huerfanos, r.m.sinRotas()], [pub(NUEVAS[0]), ARCHIVOS_VIEJOS, true])
r = await guardar({ contar: true })
caso('si no se puede saber si otro producto usa la vieja, no se borra', [r.ok.huerfanos, r.m.nombres()], [ARCHIVOS_VIEJOS, TODAS])
{
  const m = mundo()
  m.filas.set('p2', { id: 'p2', imagenUrl: VIEJA })
  const res = await guardarProductoConFoto({ api: m.api, localId: LOCAL, id: 'p1', esNuevo: false, fila: {}, original: { imagenUrl: VIEJA }, foto: FOTO })
  caso('si otro producto usa la vieja, se conserva', [res.huerfanos, m.nombres(), m.sinRotas()], [[], TODAS, true])
}
r = await guardar({}, { foto: { tipo: 'quitar' } })
caso('quitar foto: primero la base, después los archivos', [r.m.registro, r.m.filas.get('p1').imagenUrl, r.m.nombres()], [['guardar', 'borrar vieja-480.webp+vieja-240.webp'], null, []])
r = await guardar({ guardar: 'red' }, { foto: { tipo: 'quitar' } })
caso('quitar foto y falla: la foto sigue', [r.m.nombres(), r.m.sinRotas()], [SOLO_VIEJAS, true])
r = await guardar({}, { foto: { tipo: 'igual' } })
caso('sin cambiar la foto no toca Storage', [r.m.registro, r.m.nombres()], [['guardar'], SOLO_VIEJAS])
r = await guardar({}, { original: { imagenUrl: '/locales/aroma/productos/moca-480.webp' } })
caso('reemplazar una foto del demo no intenta borrarla', r.m.registro.some((x) => x.startsWith('borrar')), false)
{
  const m = mundo()
  const enDuda = pub('local-1/productos/intento-480.webp')
  rutasDesdeUrl(enDuda, SB, LOCAL).forEach((x) => m.archivos.add(x))
  await guardarProductoConFoto({ api: m.api, localId: LOCAL, id: 'p1', esNuevo: false, fila: {}, original: { imagenUrl: VIEJA }, foto: FOTO, pendientes: [enDuda] })
  caso('al reintentar con éxito limpia lo que había quedado en duda', m.nombres(), SOLO_NUEVAS)
}

titulo('Eliminar con foto')
async function eliminar(falla) {
  const m = mundo(falla)
  try {
    return { m, ok: await eliminarProductoConFoto({ api: m.api, localId: LOCAL, producto: { id: 'p1', imagenUrl: VIEJA } }) }
  } catch (error) {
    return { m, error }
  }
}
r = await eliminar({})
caso('primero la fila y después los archivos', [r.m.registro, r.m.nombres(), r.ok.huerfanos], [['eliminar fila', 'borrar vieja-480.webp+vieja-240.webp'], [], []])
r = await eliminar({ eliminar: 'rechazo' })
caso('la base rechaza: no se borra ningún archivo', [Boolean(r.error), r.m.nombres()], [true, SOLO_VIEJAS])
r = await eliminar({ eliminar: 'red' })
caso('se corta y la fila sigue: no se borra ningún archivo', [Boolean(r.error), r.m.nombres(), r.m.sinRotas()], [true, SOLO_VIEJAS, true])
r = await eliminar({ eliminar: 'red-pero-borro' })
caso('borró pero se perdió la respuesta: sigue y limpia', [r.ok?.huerfanos, r.m.nombres()], [[], []])
r = await eliminar({ eliminar: 'red', leer: true })
caso('en la duda no se borran archivos', [Boolean(r.error), r.m.nombres()], [true, SOLO_VIEJAS])
r = await eliminar({ eliminar: 'sin-filas' })
caso('0 filas y la fila sigue (sin permiso): es un error', [r.error?.code, r.m.nombres()], ['SIN_FILAS', SOLO_VIEJAS])
r = await eliminar({ borrar: true })
caso('fila borrada pero no los archivos: se informan', r.ok.huerfanos, ARCHIVOS_VIEJOS)
{
  const m = mundo()
  caso('borrarFotoSinUso ignora fotos que no son del panel', [await borrarFotoSinUso(m.api, LOCAL, '/locales/aroma/productos/x-480.webp'), m.registro], [[], []])
}

// ── Errores ────────────────────────────────────────────────
titulo('Mensajes de error (nunca técnicos)')
for (const [error, parte] of [
  [{ code: '23503' }, 'categoría ya no existe'], [{ code: '23514' }, 'rechazó esos datos'], [{ code: '42501' }, 'No tenés permiso'],
  [{ code: 'SIN_FILAS' }, 'ya no exista'], [{ code: 'PGRST202' }, '10-admin-productos.sql'], [{ code: '22023' }, 'lista de productos cambió'],
  [{ message: 'JWT expired' }, 'sesión venció'], [{ message: 'TypeError: Failed to fetch' }, 'conectarnos'], [{ code: 'XX', message: 'boom interno' }, 'No pudimos guardar'],
  [{ paso: 'foto', statusCode: '413' }, 'pesa demasiado'], [{ paso: 'foto', message: 'mime type text/plain is not supported' }, 'no está permitido'],
  [{ paso: 'foto', message: 'new row violates row-level security policy' }, 'permiso para subir'], [{ paso: 'foto', message: 'Failed to fetch' }, 'subir la foto'],
]) {
  const mensaje = mensajeDeErrorProducto(error)
  caso(`${error.code ?? error.message ?? error.statusCode} -> "${parte}"`, mensaje.includes(parte) && !/boom|JWT|TypeError|row-level/.test(mensaje), true)
}

console.log(`\n${total - fallos}/${total} pruebas OK`)
process.exit(fallos ? 1 : 0)
