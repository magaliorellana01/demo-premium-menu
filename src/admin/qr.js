// El código QR del menú: cómo se genera y se dibuja (SVG y píxeles del PNG).
// Sin red, React ni DOM: se prueba con scripts/probar-qr.mjs, que además lo decodifica.
//
// Solo lo importa GeneradorQR.jsx, que se carga aparte: la librería "uqr" no viaja en el menú
// público ni en el resto del panel. No importa nada del panel (ver GeneradorQR.jsx).
import { encode } from 'uqr'

export const FRASE_TARJETA = 'Escaneá para ver el menú'

// Negro sobre blanco (21:1), siempre: los colores del local no se usan. Un lector necesita
// módulos oscuros sobre fondo claro, y un tema propio podría invertirlos o dejar poco contraste.
export const COLOR_MODULO = '#000000'
export const COLOR_FONDO = '#ffffff'
/** Zona de silencio, en módulos: la norma del QR pide 4 por lado. */
export const MARGEN = 4
/** Corrección de errores mínima: M (recupera ~15 %). boostEcc la sube si entra sin agrandarlo. */
export const CORRECCION = 'M'
/** Lado mínimo del PNG, en píxeles. */
export const LADO_PNG = 2048

/** La dirección como se escribe a mano: sin "https://". */
export const urlParaTipear = (url) => url.replace(/^https:\/\//, '')

/** Los módulos del QR, con la zona de silencio incluida. true = oscuro. */
export function matrizQR(texto) {
  if (!texto) throw new Error('No hay nada para codificar.')
  const { data, size, version } = encode(texto, { ecc: CORRECCION, boostEcc: true, border: MARGEN })
  return { modulos: data, lado: size, version }
}

/** Los módulos oscuros como un solo trazo, uniendo los que están seguidos en cada fila. */
export function trazoDelQR({ modulos }) {
  let trazo = ''
  modulos.forEach((fila, y) => {
    for (let x = 0; x < fila.length; x++) {
      if (!fila[x]) continue
      let fin = x
      while (fila[fin + 1]) fin++
      trazo += `M${x} ${y}h${fin - x + 1}v1h${x - fin - 1}z`
      x = fin
    }
  })
  return trazo
}

const escaparXml = (texto) => String(texto).replace(/[&<>"']/g, (c) => `&#${c.codePointAt(0)};`)

/** El archivo SVG (vectorial, para imprenta). El título es la dirección. */
export function svgDelQR(matriz, titulo) {
  const { lado } = matriz
  // Múltiplo entero del lado: si alguien lo abre como imagen, los módulos quedan nítidos.
  const medida = lado * Math.ceil(1024 / lado)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${medida}" height="${medida}" shape-rendering="crispEdges">`,
    `<title>${escaparXml(titulo)}</title>`,
    `<rect width="${lado}" height="${lado}" fill="${COLOR_FONDO}"/>`,
    `<path fill="${COLOR_MODULO}" d="${trazoDelQR(matriz)}"/>`,
    '</svg>',
    '',
  ].join('\n')
}

const canales = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/**
 * Los píxeles del PNG (RGBA). Cada módulo mide un número ENTERO de píxeles, así no hay bordes
 * borrosos; el lado queda en el primer múltiplo que llega a `minimo`.
 */
export function pixelesDelQR({ modulos, lado }, minimo = LADO_PNG) {
  const escala = Math.ceil(minimo / lado)
  const ancho = lado * escala
  const datos = new Uint8ClampedArray(ancho * ancho * 4)
  const colores = [canales(COLOR_FONDO), canales(COLOR_MODULO)]
  for (let y = 0; y < ancho; y++) {
    const fila = modulos[Math.floor(y / escala)]
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = colores[fila[Math.floor(x / escala)] ? 1 : 0]
      datos.set([r, g, b, 255], (y * ancho + x) * 4)
    }
  }
  return { datos, ancho, escala }
}

/** "qr-mi-local.png". Todo lo que no sea letra, número o guion se descarta. */
export function nombreDeArchivo(slug, extension) {
  const limpio = String(slug ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '').slice(0, 60)
  return `qr-${limpio || 'menu'}.${extension === 'svg' ? 'svg' : 'png'}`
}

export const FORMATOS = [
  { clave: 'a6', nombre: 'A6: una tarjeta por hoja', copias: 1, pagina: '105mm 148mm' },
  { clave: 'a4', nombre: 'A4: cuatro tarjetas por hoja', copias: 4, pagina: 'A4 portrait' },
]

export const formatoDe = (clave) => FORMATOS.find((f) => f.clave === clave) ?? FORMATOS[0]
