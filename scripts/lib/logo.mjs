// Lectura y recorte de los logos de la marca (PNG con fondo transparente).
// Lo usan scripts/optimizar-imagenes.mjs (logos web) y scripts/generar-marca.mjs
// (íconos e imagen para redes).
import { join } from 'node:path'
import sharp from 'sharp'

export const LOGO_FONDO_CLARO = 'Aroma_Logo_Premium_Transparente.png' // letras oscuras
export const LOGO_FONDO_OSCURO = 'Aroma_Logo_Premium_Claro.png' // letras claras

// Caja (izquierda, arriba, derecha, abajo) de lo que no es transparente, entre dos alturas.
export function cajaDeContenido({ data, info }, desde = 0, hasta = info.height) {
  let izq = info.width
  let arriba = hasta
  let der = 0
  let abajo = desde
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

// Zona de recorte (para sharp.extract) con un margen, sin salirse de la imagen.
export function conMargen(caja, margen, { width, height }) {
  const izq = Math.max(caja.izq - margen, 0)
  const arriba = Math.max(caja.arriba - margen, 0)
  const der = Math.min(caja.der + margen, width)
  const abajo = Math.min(caja.abajo + margen, height)
  return { left: izq, top: arriba, width: der - izq, height: abajo - arriba }
}

// Lee un logo y devuelve su ruta, sus píxeles y las zonas de recorte:
//   wordmark: solo "aroma" con su símbolo; completo: con la bajada.
export async function leerLogo(origen, archivo) {
  const ruta = join(origen, archivo)
  const pixeles = await sharp(ruta).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const tamano = pixeles.info
  const total = cajaDeContenido(pixeles)
  // El wordmark ocupa la parte de arriba; la bajada, la de abajo (hay un hueco entre las dos).
  const corte = total.arriba + Math.round((total.abajo - total.arriba) * 0.45)
  return {
    ruta,
    pixeles,
    wordmark: conMargen(cajaDeContenido(pixeles, 0, corte), 6, tamano),
    completo: conMargen(total, 6, tamano),
  }
}

// Geometría del símbolo de cuatro puntos cobre, medida sobre los píxeles del logo
// (así los íconos se dibujan en vectores, nítidos a cualquier tamaño, y respetan el original).
// Devuelve { ancho, diametro }: ancho total del símbolo y diámetro de cada punto.
const COBRE = [182, 120, 79] // #b6784f
const TOLERANCIA = 36

export function medirSimbolo({ data, info }) {
  const esCobre = (x, y) => {
    const i = (y * info.width + x) * info.channels
    return (
      data[i + 3] > 200 &&
      Math.abs(data[i] - COBRE[0]) <= TOLERANCIA &&
      Math.abs(data[i + 1] - COBRE[1]) <= TOLERANCIA &&
      Math.abs(data[i + 2] - COBRE[2]) <= TOLERANCIA
    )
  }

  let izq = info.width
  let der = 0
  let arriba = info.height
  let abajo = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (!esCobre(x, y)) continue
      if (x < izq) izq = x
      if (x + 1 > der) der = x + 1
      if (y < arriba) arriba = y
      if (y + 1 > abajo) abajo = y + 1
    }
  }
  if (der === 0) throw new Error('No encontré el símbolo cobre en el logo.')

  // Diámetro de un punto: tramo continuo de cobre sobre la fila central, desde el borde izquierdo.
  const filaCentral = Math.round((arriba + abajo) / 2)
  let diametro = 0
  while (izq + diametro < der && esCobre(izq + diametro, filaCentral)) diametro++

  return { ancho: der - izq, alto: abajo - arriba, diametro }
}

// Dibuja el símbolo (SVG, sin <svg> exterior) centrado en (cx, cy) con el ancho pedido.
export function simboloSvg({ ancho, diametro }, cx, cy, anchoFinal, { cobre, centro }) {
  const escala = anchoFinal / ancho
  const r = (diametro / 2) * escala
  const d = anchoFinal / 2 - r // distancia del centro del símbolo al centro de cada punto
  const puntos = [
    [cx, cy - d],
    [cx, cy + d],
    [cx - d, cy],
    [cx + d, cy],
  ]
  return [
    ...puntos.map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${cobre}"/>`),
    `<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(2)}" fill="${centro}"/>`,
  ].join('')
}
