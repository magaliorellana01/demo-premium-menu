// Pruebas de src/lib/precios.js (sin dependencias): node scripts/probar-precios.mjs
import {
  adicionalesDe,
  formatearPrecio,
  LARGO_MAX_NOMBRE,
  leerLista,
  MAX_ADICIONALES,
  MAX_VARIANTES,
  precioBase,
  precioDesde,
  precioParaLeer,
  resumenPrecio,
  variantesDe,
} from '../src/lib/precios.js'

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

const cm = { nombre: 'Chico', precio: 4800 }
const gr = { nombre: 'Grande', precio: 6000 }

console.log('— Constantes —')
caso('límites', [MAX_VARIANTES, MAX_ADICIONALES, LARGO_MAX_NOMBRE], [4, 8, 40])

console.log('\n— Formato ARS —')
caso('entero con punto de miles', formatearPrecio(4200), '$4.200')
caso('menos de mil', formatearPrecio(950), '$950')
caso('millones', formatearPrecio(1250000), '$1.250.000')
caso('cero', formatearPrecio(0), '$0')
caso('con centavos: coma y dos dígitos', formatearPrecio(4200.5), '$4.200,50')
caso('"4200.00" que llega como número 4200', formatearPrecio(4200.0), '$4.200')
caso('ruido de decimales (4200.499999)', formatearPrecio(4200.499999), '$4.200,50')
caso('centavos que redondean a entero (4199.999)', formatearPrecio(4199.999), '$4.200')
caso('para leer: miles', precioParaLeer(4200), '4.200 pesos')
caso('para leer: singular', precioParaLeer(1), '1 peso')
caso('para leer: centavos', precioParaLeer(4200.5), '4.200,50 pesos')
caso('para leer: cero', precioParaLeer(0), '0 pesos')

console.log('\n— Sin variantes —')
caso('producto simple: precio base', resumenPrecio({ precio: 4200 }), { variantes: [], desde: 4200, hayRango: false })
caso('variantes = [] (valor por defecto de la base)', resumenPrecio({ precio: 4200, variantes: [] }), { variantes: [], desde: 4200, hayRango: false })
caso('variantes ausentes o null', [resumenPrecio({ precio: 3 }).variantes, resumenPrecio({ precio: 3, variantes: null }).variantes], [[], []])
caso('precio que llega como texto numérico', precioBase({ precio: '4200.00' }), 4200)
caso('precio inválido y sin variantes: null (la tarjeta no muestra precio)', [precioBase({ precio: 'abc' }), precioBase({ precio: -5 }), precioBase({ precio: NaN }), precioBase({}), precioBase(null), precioBase({ precio: '' })], [null, null, null, null, null, null])
caso('precioDesde de un producto simple', precioDesde({ precio: 4200 }), 4200)

console.log('\n— Con variantes —')
caso('dos variantes: desde = la más baja y hay rango', resumenPrecio({ precio: 4800, variantes: [cm, gr] }), { variantes: [cm, gr], desde: 4800, hayRango: true })
caso('el "desde" sale de las variantes, no de la columna precio', precioDesde({ precio: 9999, variantes: [cm, gr] }), 4800)
caso('la más baja no tiene que ser la primera', precioDesde({ precio: 1, variantes: [gr, cm] }), 4800)
caso('conserva el orden recibido', variantesDe({ variantes: [gr, cm] }).map((v) => v.nombre), ['Grande', 'Chico'])
caso('todas al mismo precio: no hay rango (no se dice "desde")', resumenPrecio({ precio: 4800, variantes: [cm, { nombre: 'Grande', precio: 4800 }] }).hayRango, false)
caso('una sola variante: se muestra, sin rango', resumenPrecio({ precio: 4800, variantes: [cm] }), { variantes: [cm], desde: 4800, hayRango: false })
caso('precio base inválido pero con variantes: igual hay "desde"', precioDesde({ precio: 'x', variantes: [cm, gr] }), 4800)
caso('variante gratis (precio 0) es válida', variantesDe({ variantes: [{ nombre: 'Agua', precio: 0 }] }), [{ nombre: 'Agua', precio: 0 }])
caso('variantes como texto JSON', variantesDe({ variantes: JSON.stringify([cm, gr]) }), [cm, gr])

console.log('\n— JSON inválido o mal formado —')
caso('texto que no es JSON', variantesDe({ precio: 1, variantes: '{no es json' }), [])
caso('objeto en vez de arreglo', variantesDe({ variantes: { nombre: 'Chico', precio: 1 } }), [])
caso('número, booleano o texto suelto', [variantesDe({ variantes: 5 }), variantesDe({ variantes: true }), variantesDe({ variantes: 'hola' })], [[], [], []])
caso('arreglo con basura: queda solo lo válido', variantesDe({ variantes: [null, 5, 'x', [], undefined, cm, { precio: 10 }, { nombre: 'Sin precio' }] }), [cm])
caso('precio como texto: se ignora', variantesDe({ variantes: [{ nombre: 'Chico', precio: '4800' }, gr] }), [gr])
caso('precio negativo, infinito o NaN: se ignora', variantesDe({ variantes: [{ nombre: 'A', precio: -1 }, { nombre: 'B', precio: Infinity }, { nombre: 'C', precio: NaN }, gr] }), [gr])
caso('precio por encima del máximo: se ignora', variantesDe({ variantes: [{ nombre: 'Enorme', precio: 1e9 }, gr] }), [gr])
caso('todo inválido: se cae al precio base', resumenPrecio({ precio: 4200, variantes: [null, { nombre: '', precio: 5 }] }), { variantes: [], desde: 4200, hayRango: false })
caso('nombre que no es texto: se ignora', variantesDe({ variantes: [{ nombre: 7, precio: 100 }, gr] }), [gr])
caso('producto null o undefined', [variantesDe(null), variantesDe(undefined), resumenPrecio(null).desde], [[], [], null])

console.log('\n— Precios con decimales —')
caso('variante con centavos', variantesDe({ variantes: [{ nombre: 'Chico', precio: 4800.5 }] }), [{ nombre: 'Chico', precio: 4800.5 }])
caso('se redondea a centavos', variantesDe({ variantes: [{ nombre: 'Chico', precio: 4800.123456 }] })[0].precio, 4800.12)
caso('"desde" con decimales', precioDesde({ variantes: [{ nombre: 'A', precio: 100.75 }, { nombre: 'B', precio: 100.5 }] }), 100.5)

console.log('\n— Nombres —')
caso('nombre vacío o solo espacios: se ignora', variantesDe({ variantes: [{ nombre: '', precio: 1 }, { nombre: '   ', precio: 2 }, gr] }), [gr])
caso('se recortan los espacios de los extremos', variantesDe({ variantes: [{ nombre: '  Chico  ', precio: 1 }] })[0].nombre, 'Chico')
caso('nombre más largo que el máximo: se corta', variantesDe({ variantes: [{ nombre: 'x'.repeat(100), precio: 1 }] })[0].nombre.length, LARGO_MAX_NOMBRE)
caso('nombre justo en el máximo: queda igual', variantesDe({ variantes: [{ nombre: 'y'.repeat(LARGO_MAX_NOMBRE), precio: 1 }] })[0].nombre.length, LARGO_MAX_NOMBRE)
caso('al cortar no queda un espacio al final', variantesDe({ variantes: [{ nombre: `${'z'.repeat(LARGO_MAX_NOMBRE - 1)} resto`, precio: 1 }] })[0].nombre.endsWith(' '), false)
caso('nombres con tildes y ñ', variantesDe({ variantes: [{ nombre: 'Jarra añeja', precio: 1 }] })[0].nombre, 'Jarra añeja')

console.log('\n— Más elementos que el máximo —')
const muchas = Array.from({ length: 10 }, (_, i) => ({ nombre: `V${i + 1}`, precio: 100 * (i + 1) }))
caso('variantes: quedan las primeras 4', variantesDe({ variantes: muchas }).map((v) => v.nombre), ['V1', 'V2', 'V3', 'V4'])
caso('adicionales: quedan los primeros 8', adicionalesDe({ adicionales: muchas }).map((v) => v.nombre), ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'])
caso('el máximo cuenta solo los válidos (los inválidos del medio no ocupan lugar)', variantesDe({ variantes: [null, ...muchas.slice(0, 2), 5, ...muchas.slice(2)] }).map((v) => v.nombre), ['V1', 'V2', 'V3', 'V4'])
caso('"desde" con más de 4: solo cuentan las 4 primeras', precioDesde({ precio: 1, variantes: [{ nombre: 'A', precio: 500 }, { nombre: 'B', precio: 600 }, { nombre: 'C', precio: 700 }, { nombre: 'D', precio: 800 }, { nombre: 'E', precio: 50 }] }), 500)
caso('leerLista con otro máximo', leerLista(muchas, 2).length, 2)

console.log('\n— Adicionales —')
caso('lista normal', adicionalesDe({ adicionales: [{ nombre: 'Leche vegetal', precio: 600 }, { nombre: 'Shot extra', precio: 800 }] }), [{ nombre: 'Leche vegetal', precio: 600 }, { nombre: 'Shot extra', precio: 800 }])
caso('vacía, ausente o null: nada', [adicionalesDe({ adicionales: [] }), adicionalesDe({}), adicionalesDe(null), adicionalesDe({ adicionales: null })], [[], [], [], []])
caso('mal formada: se ignora lo inválido', adicionalesDe({ adicionales: [{ nombre: 'Leche', precio: 'caro' }, { nombre: 'Shot', precio: 800 }, 7] }), [{ nombre: 'Shot', precio: 800 }])
caso('JSON roto', adicionalesDe({ adicionales: '[{' }), [])

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
