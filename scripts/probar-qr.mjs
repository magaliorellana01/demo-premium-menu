// Pruebas del código QR (sin red): node scripts/probar-qr.mjs
//
// Lo importante: el QR se DECODIFICA con jsqr, un lector independiente de la librería que lo
// genera (jsqr es solo devDependency: no llega al sitio). Se lee de los mismos píxeles que van
// al PNG y del archivo SVG dibujado por sharp.
import jsQR from 'jsqr'
import sharp from 'sharp'
import { COLOR_FONDO, COLOR_MODULO, formatoDe, FORMATOS, FRASE_TARJETA, LADO_PNG, MARGEN, matrizQR, nombreDeArchivo, pixelesDelQR, svgDelQR, trazoDelQR, urlParaTipear } from '../src/admin/qr.js'
import { AVISO_DOMINIO, AVISO_INACTIVO, estadoDelQR, PROBLEMAS_DE_URL, urlDelMenu } from '../src/admin/qrDireccion.js'
import { leerQrListo, marcarQrListo } from '../src/admin/qrListo.js'
import { primerosPasos } from '../src/admin/pasos.js'
import { contraste } from '../src/lib/tema.js'

let total = 0
let fallos = 0
function caso(nombre, obtenido, esperado) {
  total++
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLÓ'} ${nombre}${ok ? '' : `\n        esperado: ${JSON.stringify(esperado)}\n        obtenido: ${JSON.stringify(obtenido)}`}`)
}
const si = (nombre, condicion) => caso(nombre, Boolean(condicion), true)

const BASE = 'https://menu-premium.oestack.com'

console.log('— Armado de la dirección —')
caso('base + "/" + slug', urlDelMenu(BASE, 'aroma'), { url: `${BASE}/aroma`, problema: null })
caso('con barra final no duplica', urlDelMenu(`${BASE}///`, 'aroma').url, `${BASE}/aroma`)
caso('con espacios alrededor', urlDelMenu(`  ${BASE}  `, 'cafe-del-puerto').url, `${BASE}/cafe-del-puerto`)
caso('el dominio queda en minúsculas', urlDelMenu('HTTPS://Menu.Ejemplo.COM', 'aroma').url, 'https://menu.ejemplo.com/aroma')
caso('el puerto por defecto se saca', urlDelMenu('https://menu.ejemplo.com:443', 'aroma').url, 'https://menu.ejemplo.com/aroma')
si('sin parámetros ni ancla', !/[?#]/.test(urlDelMenu(BASE, 'aroma').url))
caso('para tipear: sin https://', urlParaTipear(`${BASE}/aroma`), 'menu-premium.oestack.com/aroma')

console.log('\n— Sin VITE_PUBLIC_URL o con una que no sirve —')
for (const vacia of [undefined, null, '', '   ']) caso(`sin definir (${JSON.stringify(vacia) ?? 'undefined'}): no hay QR`, urlDelMenu(vacia, 'aroma'), { url: null, problema: 'falta' })
for (const [valor, problema] of [
  ['http://localhost:5173', 'local'], ['https://localhost', 'local'], ['https://127.0.0.1', 'local'], ['https://192.168.0.10:4173', 'local'],
  ['https://8.8.8.8', 'local'], ['https://[::1]', 'local'], ['https://mi-pc', 'local'], ['https://menu.local', 'local'], ['https://app.localhost', 'local'], ['https://localhost.', 'local'],
  ['http://menu.ejemplo.com', 'sin-https'],
  ['menu.ejemplo.com', 'invalida'], ['ftp://menu.ejemplo.com', 'invalida'], ['javascript:alert(1)', 'invalida'], ['https://', 'invalida'], ['https:// espacio', 'invalida'],
  ['https://ejemplo.com/menu', 'con-extras'], ['https://ejemplo.com/?a=1', 'con-extras'], ['https://ejemplo.com?', 'con-extras'], ['https://ejemplo.com/#x', 'con-extras'], ['https://u:p@ejemplo.com', 'con-extras'],
]) {
  caso(`${valor}  →  ${problema}`, urlDelMenu(valor, 'aroma'), { url: null, problema })
}
si('cada problema tiene su mensaje', ['falta', 'invalida', 'sin-https', 'local', 'con-extras', 'slug'].every((p) => PROBLEMAS_DE_URL[p]?.length > 30))
si('el mensaje de "falta" nombra la variable', PROBLEMAS_DE_URL.falta.includes('VITE_PUBLIC_URL'))
for (const slug of [undefined, '', 'Aroma', 'a b', 'a/b', '../x', 'aroma?x=1', '<svg>', '-a', 'a-', 'a'.repeat(61)]) caso(`slug no válido: ${JSON.stringify(slug)?.slice(0, 20)}`, urlDelMenu(BASE, slug).problema, 'slug')

console.log('\n— Estados de la pantalla —')
caso('local activo', estadoDelQR(BASE, { slug: 'aroma', activo: true }), { url: `${BASE}/aroma`, problema: null, inactivo: false })
caso('local inactivo: igual hay QR, con aviso', estadoDelQR(BASE, { slug: 'mi-cafe', activo: false }), { url: `${BASE}/mi-cafe`, problema: null, inactivo: true })
caso('inactivo y sin VITE_PUBLIC_URL: las dos cosas', estadoDelQR(undefined, { slug: 'mi-cafe', activo: false }), { url: null, problema: 'falta', inactivo: true })
si('el aviso de inactivo explica que el menú no se ve', AVISO_INACTIVO.includes('no se ve hasta que se active'))
caso('aviso de dominio', AVISO_DOMINIO, 'Si cambiás de dominio, los QR impresos dejan de funcionar.')
caso('frase de la tarjeta', FRASE_TARJETA, 'Escaneá para ver el menú')

console.log('\n— Legibilidad —')
caso('negro sobre blanco', [COLOR_MODULO, COLOR_FONDO], ['#000000', '#ffffff'])
caso('contraste 21:1', Math.round(contraste(COLOR_MODULO, COLOR_FONDO)), 21)
const aroma = matrizQR(`${BASE}/aroma`)
caso('zona de silencio de 4 módulos', MARGEN, 4)
const margenVacio = ({ modulos, lado }) => modulos.every((fila, y) => fila.every((oscuro, x) => !(oscuro && (x < MARGEN || y < MARGEN || x >= lado - MARGEN || y >= lado - MARGEN))))
si('los 4 módulos del borde están vacíos', margenVacio(aroma))
si('y el código empieza justo después', aroma.modulos[MARGEN][MARGEN] === true && aroma.modulos.length === aroma.lado)
caso('la dirección de aroma entra en la versión 3 (29 módulos + margen)', [aroma.version, aroma.lado], [3, 37])

// Nivel de corrección escrito en el propio código (los 15 bits de formato junto al patrón de
// arriba a la izquierda, con la máscara 0x5412). En la norma: 01 = L, 00 = M, 11 = Q, 10 = H.
function nivelDeCorreccion({ modulos }) {
  const bit = (x, y) => (modulos[y + MARGEN][x + MARGEN] ? 1 : 0)
  const lugares = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]
  const bits = lugares.reduce((n, [x, y], i) => n | (bit(x, y) << i), 0) ^ 0x5412
  return ['M', 'L', 'H', 'Q'][bits >> 13]
}

const DIRECCIONES = [`${BASE}/aroma`, `${BASE}/local-prueba`, `${BASE}/a-1`, `${BASE}/${'cafe-'.repeat(7)}largo`, `${BASE}/${'x'.repeat(60)}`, 'https://xn--caf-dma.ejemplo.com.ar/bar-2']
for (const url of DIRECCIONES) si(`corrección M o superior (${url.length} caracteres)`, ['M', 'Q', 'H'].includes(nivelDeCorreccion(matrizQR(url))))

console.log('\n— Decodificación (jsqr) —')
const leer = (datos, ancho, alto = ancho) => jsQR(new Uint8ClampedArray(datos), ancho, alto, { inversionAttempts: 'dontInvert' })?.data ?? null
const aPixeles = async (imagen) => {
  const { data, info } = await imagen.flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return leer(data, info.width, info.height)
}
for (const url of DIRECCIONES) {
  const matriz = matrizQR(url)
  const png = pixelesDelQR(matriz)
  caso(`píxeles del PNG: ${url.slice(0, 60)}`, leer(png.datos, png.ancho), url)
  caso('  y el SVG dibujado por sharp', await aPixeles(sharp(Buffer.from(svgDelQR(matriz, url)))), url)
}

const URL_AROMA = `${BASE}/aroma`
const png = pixelesDelQR(aroma)
const crudo = () => sharp(Buffer.from(png.datos.buffer), { raw: { width: png.ancho, height: png.ancho, channels: 4 } })
si(`el PNG mide al menos 1024 px (${png.ancho})`, png.ancho >= 1024 && png.ancho >= LADO_PNG)
caso('cada módulo mide una cantidad entera de píxeles', png.ancho, png.escala * aroma.lado)
si('solo negro y blanco, opacos', png.datos.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0 || v === 255)))
caso('como archivo PNG real (comprimido y vuelto a abrir)', await aPixeles(sharp(await crudo().png().toBuffer())), URL_AROMA)
for (const lado of [148, 222, 370]) caso(`chico, a ${lado} px (como de lejos)`, await aPixeles(sharp(await crudo().resize(lado, lado).png().toBuffer())), URL_AROMA)
for (const grados of [12, 45, 90, 180]) caso(`girado ${grados}°`, await aPixeles(sharp(await sharp(await crudo().resize(600, 600).png().toBuffer()).rotate(grados, { background: '#ffffff' }).png().toBuffer())), URL_AROMA)
caso('algo borroso', await aPixeles(sharp(await crudo().resize(444, 444).png().toBuffer()).blur(1.5)), URL_AROMA)
// Una mancha tapa parte del centro (lo que recupera la corrección de errores).
const mancha = await sharp({ create: { width: png.escala * 6, height: png.escala * 6, channels: 3, background: '#808080' } }).png().toBuffer()
caso('con una mancha de 6 × 6 módulos en los datos', await aPixeles(sharp(await crudo().composite([{ input: mancha, left: png.escala * 18, top: png.escala * 18 }]).png().toBuffer())), URL_AROMA)

console.log('\n— Archivo SVG —')
const svg = svgDelQR(aroma, URL_AROMA)
si('es vectorial: sin imágenes incrustadas', !/<image|data:|base64/.test(svg))
si('sin scripts, enlaces ni referencias externas', !/<script|href=|<foreignObject| on\w+=|url\(/i.test(svg))
si('viewBox en módulos', svg.includes('viewBox="0 0 37 37"'))
si('mide al menos 1024 si se abre como imagen', Number(/ width="(\d+)"/.exec(svg)[1]) >= 1024)
si('el título es la dirección', svg.includes(`<title>${URL_AROMA}</title>`))
si('el título se escapa', svgDelQR(aroma, '<script>"&\'').includes('<title>&#60;script&#62;&#34;&#38;&#39;</title>'))
si('el trazo solo tiene comandos y números', /^[Mhvz0-9 -]+$/.test(trazoDelQR(aroma)))
caso('el trazo cubre exactamente los módulos oscuros', [...trazoDelQR(aroma).matchAll(/h(\d+)v1/g)].reduce((n, m) => n + Number(m[1]), 0), aroma.modulos.flat().filter(Boolean).length)
let vacio = ''
try {
  matrizQR('')
} catch (error) {
  vacio = error.message
}
si('sin texto no genera nada', vacio)

console.log('\n— Nombres de las descargas —')
caso('PNG', nombreDeArchivo('aroma', 'png'), 'qr-aroma.png')
caso('SVG', nombreDeArchivo('cafe-del-puerto', 'svg'), 'qr-cafe-del-puerto.svg')
caso('nada raro en el nombre', nombreDeArchivo('../../Mi Café<>:"|?*', 'svg'), 'qr-micaf.svg')
caso('sin slug', nombreDeArchivo('', 'png'), 'qr-menu.png')
caso('una extensión desconocida cae en png', nombreDeArchivo('aroma', 'exe'), 'qr-aroma.png')
si('largo acotado', nombreDeArchivo('a'.repeat(200), 'png').length <= 67)

console.log('\n— Formatos de impresión —')
caso('A6 (una) y A4 (cuatro)', FORMATOS.map((f) => [f.clave, f.copias, f.pagina]), [['a6', 1, '105mm 148mm'], ['a4', 4, 'A4 portrait']])
caso('por defecto A6', formatoDe('otro').clave, 'a6')

console.log('\n— Primeros pasos: el QR —')
const contexto = { slug: 'aroma', activo: true, puedeEditarLocal: true, esAdmin: false }
const pasoQr = (extra) => primerosPasos(null, { ...contexto, ...extra }).find((p) => p.clave === 'qr')
caso('pendiente', pasoQr({}).hecho, false)
caso('hecho', pasoQr({ qrListo: true }).hecho, true)
caso('enlaza a la pantalla del QR', pasoQr({}).enlace.a, '/admin/aroma/qr')
caso('sin almacenamiento del navegador: pendiente y sin romper', [leerQrListo('x'), (marcarQrListo('x'), leerQrListo('x'))], [false, false])
const guardado = new Map()
globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, v) }
marcarQrListo('local-1')
caso('se anota por local', [leerQrListo('local-1'), leerQrListo('local-2')], [true, false])

console.log(`\n${total - fallos}/${total} pruebas OK`)
process.exit(fallos ? 1 : 0)
