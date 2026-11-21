// Optimiza el material de origen de un local (logos y fotos de productos) para la web.
// Usa sharp (devDependency): no hace falta instalar nada más que `npm install`.
//
// Uso (desde la raíz del proyecto), con el script de package.json:
//
//   # Fotos de productos: recorte 4:5, WebP en dos anchos (240 y 480 px)
//   npm run imagenes -- productos brand public/locales/aroma/productos --config scripts/aroma-imagenes.json
//
//   # Logos: recorta el margen vacío y genera las variantes
//   npm run imagenes -- logo brand public/locales/aroma
//
// El archivo --config (JSON, opcional) tiene:
//   "renombres": { "nombre-original": "nombre-limpio" }   (sin extensión)
//   "encuadre":  { "nombre-limpio": [x, y] }               (0 a 1; por defecto [0.5, 0.5])
//   Si un recorte corta el producto, el encuadre decide qué parte se conserva.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'

const PROPORCION = 4 / 5 // ancho / alto de las fotos de productos
const ANCHOS = [240, 480] // miniaturas (pantalla normal) y pantallas de alta densidad
const PESO_MAX = 60 * 1024 // objetivo por imagen, en bytes
const CALIDAD_MIN = 62 // por debajo de esto se notan los artefactos en las texturas
const CALIDAD_MAX = { 240: 82, 480: 80 }
const EXTENSIONES = ['.webp', '.jpg', '.jpeg', '.png']

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

// Busca la mayor calidad WebP que no pase de PESO_MAX, sin bajar de CALIDAD_MIN
// (si no entra, se prefiere una imagen un poco más pesada antes que una degradada).
async function comprimirBajoPeso(imagen, calidadMax) {
  let mejor
  for (let calidad = calidadMax; calidad >= CALIDAD_MIN; calidad -= 3) {
    const buffer = await imagen.clone().webp({ quality: calidad, effort: 6 }).toBuffer()
    mejor = { calidad, buffer }
    if (buffer.length <= PESO_MAX) break
  }
  return mejor
}

// Zona a conservar para llegar a la proporción pedida. foco = [x, y] de 0 a 1.
function zonaDeRecorte({ width, height }, foco) {
  if (width / height > PROPORCION) {
    // demasiado ancha: se recortan los costados
    const nuevoAncho = Math.round(height * PROPORCION)
    return { left: Math.round((width - nuevoAncho) * foco[0]), top: 0, width: nuevoAncho, height }
  }
  // demasiado alta: se recortan arriba y abajo
  const nuevoAlto = Math.round(width / PROPORCION)
  return { left: 0, top: Math.round((height - nuevoAlto) * foco[1]), width, height: nuevoAlto }
}

async function productos(origen, destino, config) {
  const renombres = config.renombres ?? {}
  const encuadre = config.encuadre ?? {}
  await mkdir(destino, { recursive: true })

  const archivos = (await readdir(origen))
    .filter((f) => EXTENSIONES.includes(extname(f).toLowerCase()))
    .filter((f) => !basename(f, extname(f)).toLowerCase().startsWith('aroma_')) // los logos van por otro lado
    .sort()

  for (const archivo of archivos) {
    const original = basename(archivo, extname(archivo))
    const nombre = renombres[original] ?? original
    const foco = encuadre[nombre] ?? [0.5, 0.5]
    const ruta = join(origen, archivo)
    const zona = zonaDeRecorte(await sharp(ruta).metadata(), foco)

    // Borra versiones de otros anchos que hayan quedado de corridas anteriores
    for (const existente of await readdir(destino)) {
      if (!existente.startsWith(`${nombre}-`) || !existente.endsWith('.webp')) continue
      const ancho = existente.slice(nombre.length + 1, -'.webp'.length)
      if (/^[0-9]+$/.test(ancho) && !ANCHOS.includes(Number(ancho))) {
        await rm(join(destino, existente))
        console.log(`${existente.padEnd(34)} (ancho en desuso: borrada)`)
      }
    }

    for (const ancho of ANCHOS) {
      const alto = Math.round(ancho / PROPORCION)
      const imagen = sharp(ruta).extract(zona).resize(ancho, alto, { kernel: 'lanczos3' })
      const { calidad, buffer } = await comprimirBajoPeso(imagen, CALIDAD_MAX[ancho])
      const salida = `${nombre}-${ancho}.webp`
      await writeFile(join(destino, salida), buffer)
      const aviso = buffer.length <= PESO_MAX ? '' : '  <-- pasa el objetivo'
      console.log(`${salida.padEnd(34)} ${ancho}x${alto}  q${calidad}  ${kb(buffer.length).padStart(8)}${aviso}`)
    }
  }
}

// Caja (izquierda, arriba, derecha, abajo) de lo que no es transparente, entre dos alturas.
function cajaDeContenido({ data, info }, desde = 0, hasta = info.height) {
  let izq = info.width, arriba = hasta, der = 0, abajo = desde
  for (let y = desde; y < hasta; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] !== 0) {
        if (x < izq) izq = x
        if (x + 1 > der) der = x + 1
        if (y < arriba) arriba = y
        if (y + 1 > abajo) abajo = y + 1
      }
    }
  }
  return { izq, arriba, der, abajo }
}

function conMargen(caja, margen, { width, height }) {
  const izq = Math.max(caja.izq - margen, 0)
  const arriba = Math.max(caja.arriba - margen, 0)
  const der = Math.min(caja.der + margen, width)
  const abajo = Math.min(caja.abajo + margen, height)
  return { left: izq, top: arriba, width: der - izq, height: abajo - arriba }
}

async function logo(origen, destino) {
  await mkdir(destino, { recursive: true })
  const variantes = [
    ['Aroma_Logo_Premium_Transparente.png', ''], // letras oscuras: para fondo claro
    ['Aroma_Logo_Premium_Claro.png', '-claro'], // letras claras: para fondo oscuro
  ]

  for (const [archivo, sufijo] of variantes) {
    const ruta = join(origen, archivo)
    const pixeles = await sharp(ruta).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const tamano = pixeles.info
    const total = cajaDeContenido(pixeles)
    // El wordmark ocupa la parte de arriba; la bajada, la de abajo (hay un hueco entre las dos).
    const corte = total.arriba + Math.round((total.abajo - total.arriba) * 0.45)
    const wordmark = conMargen(cajaDeContenido(pixeles, 0, corte), 6, tamano)
    const completo = conMargen(total, 6, tamano)

    // wordmark (encabezado): ambas variantes. Logo completo con bajada: solo para fondo claro.
    const salidas = [[`logo${sufijo}`, wordmark, 560]]
    if (!sufijo) salidas.push(['logo-completo', completo, 1200])

    for (const [nombre, zona, ancho] of salidas) {
      const imagen = sharp(ruta).extract(zona).resize({ width: ancho, kernel: 'lanczos3' })
      const buffer = await imagen.webp({ quality: 88, alphaQuality: 100, effort: 6 }).toBuffer({ resolveWithObject: true })
      await writeFile(join(destino, `${nombre}.webp`), buffer.data)
      console.log(`${`${nombre}.webp`.padEnd(24)} ${buffer.info.width}x${buffer.info.height}  ${kb(buffer.data.length).padStart(8)}`)
    }
  }
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { config: { type: 'string' } },
})
const [tipo, origen, destino] = positionals

if (!['productos', 'logo'].includes(tipo) || !origen || !destino) {
  console.error('Uso: npm run imagenes -- <productos|logo> <carpeta-origen> <carpeta-destino> [--config archivo.json]')
  process.exit(1)
}

const config = values.config ? JSON.parse(await readFile(values.config, 'utf-8')) : {}
if (tipo === 'productos') await productos(origen, destino, config)
else await logo(origen, destino)
