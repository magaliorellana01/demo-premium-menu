// Genera los acabados de marca de un local a partir de sus logos de brand/:
//   favicon.svg y favicon-32.png        pestaña del navegador
//   apple-touch-icon.png (180)          pantalla de inicio de iPhone/iPad
//   icon-192.png, icon-512.png          ícono del manifiesto (web app)
//   icon-maskable-512.png               ícono "maskable" de Android (con margen de seguridad)
//   og-image.png (1200 x 630)           vista previa al compartir (WhatsApp, redes)
//
// El símbolo de cuatro puntos se mide sobre los píxeles del logo y se redibuja en
// vectores, así queda nítido a cualquier tamaño. La frase se escribe con la
// tipografía de la marca (Liberation Serif Italic, ver scripts/fuentes/).
//
// Uso (desde la raíz del proyecto):
//   npm run marca -- brand public --frase "menos prisa, más aroma."
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { leerLogo, LOGO_FONDO_CLARO, LOGO_FONDO_OSCURO, medirSimbolo, simboloSvg } from './lib/logo.mjs'

const COLORES = { espresso: '#251e1a', porcelana: '#f4eee5', cobre: '#b6784f' }
const FUENTE = resolve('scripts/fuentes/LiberationSerif-Italic-latin.ttf')
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { frase: { type: 'string', default: '' } },
})
const [origen, destino] = positionals
if (!origen || !destino) {
  console.error('Uso: npm run marca -- <carpeta-brand> <carpeta-public> [--frase "texto"]')
  process.exit(1)
}
await mkdir(destino, { recursive: true })

async function guardar(nombre, buffer) {
  await writeFile(join(destino, nombre), buffer)
  console.log(`${nombre.padEnd(24)} ${kb(buffer.length).padStart(8)}`)
}

// Ícono cuadrado: fondo espresso y el símbolo centrado. `ancho` es la proporción del lado que ocupa.
function icono(lado, simbolo, ancho, { radio = 0 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
    <rect width="${lado}" height="${lado}" rx="${radio}" fill="${COLORES.espresso}"/>
    ${simboloSvg(simbolo, lado / 2, lado / 2, lado * ancho, { cobre: COLORES.cobre, centro: COLORES.porcelana })}
  </svg>`
  return Buffer.from(svg)
}

const logoOscuro = await leerLogo(origen, LOGO_FONDO_CLARO)
const simbolo = medirSimbolo(logoOscuro.pixeles)
console.log(`Símbolo medido en el logo: ${simbolo.ancho} px de ancho, puntos de ${simbolo.diametro} px\n`)

// ── Íconos ──────────────────────────────────────────────────────
await guardar('favicon.svg', icono(32, simbolo, 0.66, { radio: 7 }))
await guardar('favicon-32.png', await sharp(icono(256, simbolo, 0.66, { radio: 56 })).resize(32, 32).png({ compressionLevel: 9 }).toBuffer())
await guardar('apple-touch-icon.png', await sharp(icono(180, simbolo, 0.5)).png({ compressionLevel: 9 }).toBuffer())
await guardar('icon-192.png', await sharp(icono(192, simbolo, 0.5)).png({ compressionLevel: 9 }).toBuffer())
await guardar('icon-512.png', await sharp(icono(512, simbolo, 0.5)).png({ compressionLevel: 9 }).toBuffer())
// Maskable: Android recorta los bordes; el símbolo queda dentro del 80 % central.
await guardar('icon-maskable-512.png', await sharp(icono(512, simbolo, 0.42)).png({ compressionLevel: 9 }).toBuffer())

// ── Imagen para redes (Open Graph / Twitter) ────────────────────
const ANCHO = 1200
const ALTO = 630
const logoClaro = await leerLogo(origen, LOGO_FONDO_OSCURO)
const anchoLogo = 620
const logo = await sharp(logoClaro.ruta).extract(logoClaro.wordmark).resize({ width: anchoLogo, kernel: 'lanczos3' }).png().toBuffer({ resolveWithObject: true })

const capas = [{ input: logo.data, left: Math.round((ANCHO - logo.info.width) / 2), top: 0 }]
let altoBloque = logo.info.height
let frase = null
if (values.frase) {
  frase = await sharp({
    text: {
      text: `<span foreground="${COLORES.cobre}">${values.frase}</span>`,
      font: 'Liberation Serif Italic 52',
      fontfile: FUENTE,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })
  altoBloque += 56 + frase.info.height
}
const arriba = Math.round((ALTO - altoBloque) / 2)
capas[0].top = arriba
if (frase) capas.push({ input: frase.data, left: Math.round((ANCHO - frase.info.width) / 2), top: arriba + logo.info.height + 56 })

await guardar(
  'og-image.png',
  await sharp({ create: { width: ANCHO, height: ALTO, channels: 3, background: COLORES.espresso } })
    .composite(capas)
    .png({ compressionLevel: 9, palette: true })
    .toBuffer(),
)
