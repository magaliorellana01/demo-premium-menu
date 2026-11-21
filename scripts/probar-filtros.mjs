// Pruebas de src/lib/etiquetas.js y src/lib/filtros.js (sin dependencias): node scripts/probar-filtros.mjs
import { claveEtiqueta, etiquetasDeProducto, ETIQUETAS, infoEtiqueta } from '../src/lib/etiquetas.js'
import {
  etiquetasDelLocal,
  filtrarCategorias,
  filtrosAURL,
  filtrosDesdeURL,
  hayFiltros,
  normalizarTexto,
  productoCoincide,
  terminosDeBusqueda,
} from '../src/lib/filtros.js'

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

// Un menú chico con el mismo espíritu que el de Aroma.
const p = (id, nombre, descripcion, etiquetas = [], disponible = true) => ({ id, nombre, descripcion, etiquetas, disponible })
const menu = [
  {
    id: 'c1',
    nombre: 'Cafés',
    productos: [
      p('espresso', 'Espresso', 'Café de origen único, corto e intenso.', ['vegano', 'sin-tacc', 'sin-lactosa']),
      p('capuchino', 'Capuchino', 'Espresso doble con leche texturizada.', ['vegetariano', 'sin-tacc']),
      p('frio', 'Café frío con leche', 'Café de filtro helado con leche y hielo.', ['vegetariano', 'nuevo']),
    ],
  },
  {
    id: 'c2',
    nombre: 'Postres',
    productos: [
      p('croissant', 'Croissant', 'De manteca, horneado todos los días.', ['vegetariano']),
      p('tarta', 'Tartaleta de frutas', 'Masa sablée, crema pastelera y frutas frescas.', ['vegetariano'], false),
    ],
  },
  {
    id: 'c3',
    nombre: 'Jugos y licuados',
    productos: [
      p('limonada', 'Limonada con menta', 'Limón exprimido, menta fresca y hielo.', ['vegano', 'sin-tacc', 'sin-lactosa']),
      p('mango', 'Mango y maracuyá', 'Pulpa de fruta, hielo y un toque de menta.', ['vegano', 'Sin TACC', 'nuevo']),
      p('verde', 'Licuado verde', 'Manzana, pepino y espinaca.', ['de la casa']),
    ],
  },
]
const ids = (resultado) => resultado.categorias.flatMap((c) => c.productos.map((x) => x.id))
const cats = (resultado) => resultado.categorias.map((c) => c.id)

console.log('— Normalización —')
caso('sin tildes ni mayúsculas', normalizarTexto('  Café   FRÍO '), 'cafe frio')
caso('ñ y diéresis', normalizarTexto('Pingüino ÑOQUI'), 'pinguino noqui')
caso('vacío, null y undefined', [normalizarTexto(''), normalizarTexto(null), normalizarTexto(undefined)], ['', '', ''])
caso('palabras de la búsqueda', terminosDeBusqueda('  Licuado  VERDE '), ['licuado', 'verde'])

console.log('\n— Búsqueda —')
caso('"cafe" encuentra "Café frío" y los de la descripción (sin tildes)', ids(filtrarCategorias(menu, { consulta: 'cafe' })), ['espresso', 'frio'])
caso('"CAFÉ" con mayúsculas y tilde da lo mismo', ids(filtrarCategorias(menu, { consulta: 'CAFÉ' })), ['espresso', 'frio'])
caso('busca en la descripción ("manteca")', ids(filtrarCategorias(menu, { consulta: 'manteca' })), ['croissant'])
caso('busca en el nombre ("capuchino")', ids(filtrarCategorias(menu, { consulta: 'capuchino' })), ['capuchino'])
caso('"sable" encuentra "sablée" (tilde en los datos)', ids(filtrarCategorias(menu, { consulta: 'sable' })), ['tarta'])
caso('busca en las etiquetas por su nombre ("sin lactosa")', ids(filtrarCategorias(menu, { consulta: 'sin lactosa' })), ['espresso', 'limonada'])
caso('busca en etiquetas ajenas ("de la casa")', ids(filtrarCategorias(menu, { consulta: 'de la casa' })), ['verde'])
caso('varias palabras: todas, en cualquier orden', ids(filtrarCategorias(menu, { consulta: 'verde licuado' })), ['verde'])
caso('espacios de sobra no cambian nada', ids(filtrarCategorias(menu, { consulta: '   cafe    frio  ' })), ['frio'])
caso('el producto no disponible también se encuentra', ids(filtrarCategorias(menu, { consulta: 'tartaleta' })), ['tarta'])
caso('el producto no disponible conserva su dato', filtrarCategorias(menu, { consulta: 'tartaleta' }).categorias[0].productos[0].disponible, false)

console.log('\n— Filtros por etiqueta —')
caso('una etiqueta', ids(filtrarCategorias(menu, { etiquetas: ['vegano'] })), ['espresso', 'limonada', 'mango'])
caso('dos etiquetas: deben cumplirse las dos', ids(filtrarCategorias(menu, { etiquetas: ['vegano', 'sin-lactosa'] })), ['espresso', 'limonada'])
caso('tres etiquetas', ids(filtrarCategorias(menu, { etiquetas: ['vegano', 'sin-tacc', 'nuevo'] })), ['mango'])
caso('"Sin TACC" escrito distinto en los datos cuenta igual', ids(filtrarCategorias(menu, { etiquetas: ['sin-tacc'] })), ['espresso', 'capuchino', 'limonada', 'mango'])
caso('la clave del filtro también se normaliza', ids(filtrarCategorias(menu, { etiquetas: ['Sin TACC'] })), ['espresso', 'capuchino', 'limonada', 'mango'])
caso('etiquetas que no se pueden cumplir juntas: sin resultados', ids(filtrarCategorias(menu, { etiquetas: ['vegano', 'vegetariano'] })), [])
caso('búsqueda y etiqueta juntas', ids(filtrarCategorias(menu, { consulta: 'menta', etiquetas: ['nuevo'] })), ['mango'])

console.log('\n— Categorías que quedan vacías —')
caso('"croissant": solo queda Postres', cats(filtrarCategorias(menu, { consulta: 'croissant' })), ['c2'])
caso('"vegano": desaparece Postres', cats(filtrarCategorias(menu, { etiquetas: ['vegano'] })), ['c1', 'c3'])
caso('"nuevo": Cafés y Jugos', cats(filtrarCategorias(menu, { etiquetas: ['nuevo'] })), ['c1', 'c3'])
caso('cada categoría conserva solo sus productos', filtrarCategorias(menu, { etiquetas: ['vegano'] }).categorias.map((c) => c.productos.length), [1, 2])
caso('no modifica las categorías originales', menu.map((c) => c.productos.length), [3, 2, 3])

console.log('\n— Ninguna coincidencia —')
const nada = filtrarCategorias(menu, { consulta: 'hamburguesa' })
caso('sin categorías', nada.categorias, [])
caso('total en cero', nada.total, 0)
caso('etiqueta que ningún producto tiene', filtrarCategorias(menu, { etiquetas: ['picante'] }).total, 0)

console.log('\n— Totales y sin filtros —')
caso('sin filtros: todo, con el mismo arreglo', filtrarCategorias(menu, {}).categorias === menu, true)
caso('sin filtros: 8 productos', filtrarCategorias(menu, {}).total, 8)
caso('búsqueda en blanco cuenta como sin filtros', filtrarCategorias(menu, { consulta: '   ' }).total, 8)
caso('total con filtros', filtrarCategorias(menu, { etiquetas: ['vegano'] }).total, 3)
caso('hayFiltros: nada', hayFiltros({ consulta: '  ', etiquetas: [] }), false)
caso('hayFiltros: texto', hayFiltros({ consulta: 'a', etiquetas: [] }), true)
caso('hayFiltros: etiqueta', hayFiltros({ consulta: '', etiquetas: ['vegano'] }), true)
caso('productoCoincide con producto sin etiquetas ni descripción', productoCoincide({ nombre: 'Agua' }, ['agua'], []), true)
caso('productoCoincide con etiquetas en null', productoCoincide({ nombre: 'Agua', etiquetas: null }, [], ['vegano']), false)

console.log('\n— Vocabulario y etiquetas fuera del vocabulario —')
caso('vocabulario en orden', ETIQUETAS.map((e) => e.clave), ['vegano', 'vegetariano', 'sin-tacc', 'sin-lactosa', 'picante', 'nuevo'])
caso('claves distintas del mismo texto', ['Sin TACC', 'sin tacc', 'SIN-TACC', ' sin_tacc '].map(claveEtiqueta), ['sin-tacc', 'sin-tacc', 'sin-tacc', 'sin-tacc'])
caso('clave con tildes', claveEtiqueta('Sin Gluten ñandú'), 'sin-gluten-nandu')
caso('etiqueta conocida: nombre del vocabulario', infoEtiqueta('Sin TACC')?.nombre, 'Sin TACC')
caso('etiqueta conocida: tono', infoEtiqueta('vegano')?.tono, 'dietetica')
caso('etiqueta ajena: se muestra tal cual, con tono neutro', infoEtiqueta('  De la casa '), { clave: 'de-la-casa', nombre: 'De la casa', descripcion: '', tono: 'neutra', orden: 1000 })
caso('etiqueta ajena en minúsculas: primera letra en mayúscula', infoEtiqueta('de la casa')?.nombre, 'De la casa')
caso('valores que no sirven', [infoEtiqueta(''), infoEtiqueta('  '), infoEtiqueta(null), infoEtiqueta(5), infoEtiqueta('---')], [null, null, null, null, null])
caso('las de un producto: sin repetidas, vocabulario primero y ajenas al final', etiquetasDeProducto(p('x', 'X', '', ['de la casa', 'Nuevo', 'nuevo', 'vegano', ''])).map((e) => e.clave), ['vegano', 'nuevo', 'de-la-casa'])
caso('etiquetas que no es un arreglo', etiquetasDeProducto({ etiquetas: 'vegano' }), [])
caso('chips del local: solo las que existen, en el orden del vocabulario y las ajenas al final', etiquetasDelLocal(menu).map((e) => e.clave), ['vegano', 'vegetariano', 'sin-tacc', 'sin-lactosa', 'nuevo', 'de-la-casa'])
caso('chips del local: picante no aparece porque ningún producto lo tiene', etiquetasDelLocal(menu).some((e) => e.clave === 'picante'), false)
caso('chips del local sin productos', etiquetasDelLocal([{ id: 'v', nombre: 'V', productos: [] }]), [])
caso('ajenas ordenadas alfabéticamente', etiquetasDelLocal([{ productos: [p('a', 'A', '', ['zeta', 'alfa', 'Ñandú'])] }]).map((e) => e.clave), ['alfa', 'nandu', 'zeta'])
caso('filtrar por una etiqueta ajena', ids(filtrarCategorias(menu, { etiquetas: ['de-la-casa'] })), ['verde'])
caso('filtrar por una ajena escrita con otras mayúsculas', ids(filtrarCategorias(menu, { etiquetas: ['De La Casa'] })), ['verde'])

console.log('\n— Enlace compartible (?q=...&etiquetas=...) —')
const validas = etiquetasDelLocal(menu).map((e) => e.clave)
caso('lee búsqueda y etiquetas', filtrosDesdeURL('?q=caf%C3%A9&etiquetas=vegano,sin-tacc', validas), { consulta: 'café', etiquetas: ['vegano', 'sin-tacc'] })
caso('ignora etiquetas que el local no tiene', filtrosDesdeURL('?etiquetas=vegano,picante,inventada', validas).etiquetas, ['vegano'])
caso('acepta una etiqueta ajena que sí existe', filtrosDesdeURL('?etiquetas=de-la-casa', validas).etiquetas, ['de-la-casa'])
caso('sin parámetros', filtrosDesdeURL('', validas), { consulta: '', etiquetas: [] })
caso('etiquetas repetidas', filtrosDesdeURL('?etiquetas=vegano,vegano', validas).etiquetas, ['vegano'])
caso('búsqueda demasiado larga: se corta', filtrosDesdeURL(`?q=${'a'.repeat(500)}`, validas).consulta.length, 80)
caso('escribe búsqueda y etiquetas (con coma legible)', filtrosAURL('', { consulta: 'café', etiquetas: ['vegano', 'sin-tacc'] }), '?q=caf%C3%A9&etiquetas=vegano,sin-tacc')
caso('sin filtros: queda sin parámetros', filtrosAURL('?q=hola&etiquetas=vegano', { consulta: '  ', etiquetas: [] }), '')
caso('conserva otros parámetros', filtrosAURL('?utm_source=qr', { consulta: 'te', etiquetas: [] }), '?utm_source=qr&q=te')
caso('ida y vuelta', filtrosDesdeURL(filtrosAURL('', { consulta: 'licuado verde', etiquetas: ['vegano'] }), validas), { consulta: 'licuado verde', etiquetas: ['vegano'] })

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
