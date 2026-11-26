// Colores propios de un local (locales.tema). Funciones puras: las usan el menú público y la
// vista previa del panel.
//
// El local elige solo CUATRO colores (fondo, texto, acento y portada), en formato #RRGGBB.
// Todo lo demás (texto suave, enlaces, bordes, texto sobre botones y sobre la portada) se
// CALCULA para que se lea. Sin colores propios no se toca nada: valen los de tokens.css.
//
// Estos valores terminan escritos en variables de CSS, así que se aceptan únicamente
// hexadecimales de 6 dígitos (la base exige lo mismo, ver supabase/11-admin-ajustes.sql).

export const CLAVES_COLOR = ['fondo', 'texto', 'acento', 'portada']

// Los de tokens.css (porcelana, espresso, cobre, espresso).
export const COLORES_ORIGINALES = { fondo: '#f4eee5', texto: '#251e1a', acento: '#b6784f', portada: '#251e1a' }
const COBRE_TEXTO = '#905d3c'
const ARENA = '#b6a38c'

const HEX = /^#[0-9a-f]{6}$/i
export const esColor = (valor) => typeof valor === 'string' && HEX.test(valor)

/** Los cuatro colores efectivos (lo que falte o sea inválido toma el original). */
export function coloresDelTema(tema) {
  return Object.fromEntries(CLAVES_COLOR.map((c) => [c, esColor(tema?.[c]) ? tema[c].toLowerCase() : COLORES_ORIGINALES[c]]))
}

const canales = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** Como color-mix(in srgb, a <parte>, b). */
export function mezclar(a, b, parte) {
  const cb = canales(b)
  return `#${canales(a)
    .map((v, i) => Math.round(v * parte + cb[i] * (1 - parte)).toString(16).padStart(2, '0'))
    .join('')}`
}

export function luminancia(hex) {
  const [r, g, b] = canales(hex).map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste WCAG entre dos colores: de 1 a 21. */
export function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

const peorContraste = (color, fondos) => Math.min(...fondos.map((f) => contraste(color, f)))

/** El primer color de la mezcla `desde` -> `hacia` que llega a `minimo` sobre todos los fondos. */
function acercar(desde, hacia, fondos, minimo) {
  for (let paso = 0; paso < 20; paso++) {
    const color = mezclar(hacia, desde, paso / 20)
    if (peorContraste(color, fondos) >= minimo) return color
  }
  return hacia
}

/**
 * Texto legible sobre `fondo`: el mejor de los preferidos si llega a 4,5:1; si no, blanco o
 * negro (uno de los dos siempre llega, sea cual sea el fondo).
 */
function textoSobre(fondo, preferidos) {
  const mejor = (lista) => lista.reduce((a, b) => (contraste(b, fondo) > contraste(a, fondo) ? b : a))
  const propio = mejor(preferidos)
  return contraste(propio, fondo) >= 4.5 ? propio : mejor([propio, '#ffffff', '#000000'])
}

/** Todos los roles de color, calculados a partir de los cuatro elegidos. */
export function paleta(colores) {
  const { fondo, texto, acento, portada } = colores
  const baseOriginal = fondo === COLORES_ORIGINALES.fondo && texto === COLORES_ORIGINALES.texto
  const fondoSuave = baseOriginal ? mezclar(ARENA, fondo, 0.22) : mezclar(texto, fondo, 0.07)
  const claros = [fondo, fondoSuave]
  const sobreOscuro = textoSobre(portada, [fondo, texto])
  const esOriginal = baseOriginal && portada === COLORES_ORIGINALES.portada

  return {
    fondo,
    texto,
    acento,
    portada,
    fondoSuave,
    borde: baseOriginal ? ARENA : mezclar(texto, fondo, 0.28),
    textoSuave: acercar(mezclar(texto, fondo, 0.75), texto, claros, 4.5),
    acentoTexto: baseOriginal && acento === COLORES_ORIGINALES.acento ? COBRE_TEXTO : acercar(acento, texto, claros, 4.5),
    sobreAcento: textoSobre(acento, [texto, fondo]),
    sobreOscuro,
    sobreOscuroSuave: esOriginal ? ARENA : acercar(mezclar(sobreOscuro, portada, 0.72), sobreOscuro, [portada], 4.5),
    // La frase de la portada es texto grande: alcanza con 3:1.
    acentoPortada: acercar(acento, sobreOscuro, [portada], 3),
  }
}

const VARIABLES = {
  fondo: '--color-fondo',
  texto: '--color-texto',
  textoSuave: '--color-texto-suave',
  acento: '--color-acento',
  acentoTexto: '--color-acento-texto',
  borde: '--color-borde',
  fondoSuave: '--color-fondo-suave',
  sobreAcento: '--color-sobre-acento',
  portada: '--color-superficie-oscura',
  sobreOscuro: '--color-sobre-oscuro',
  sobreOscuroSuave: '--color-sobre-oscuro-suave',
  acentoPortada: '--color-acento-portada',
}

/** Variables de CSS a sobrescribir. {} si el local usa los colores originales. */
export function variablesDeTema(tema) {
  const colores = coloresDelTema(tema)
  if (CLAVES_COLOR.every((c) => colores[c] === COLORES_ORIGINALES[c])) return {}
  const p = paleta(colores)
  return Object.fromEntries(Object.entries(VARIABLES).map(([rol, variable]) => [variable, p[rol]]))
}

/** ¿La franja de la portada es clara? (Entonces conviene el logo oscuro.) */
export function portadaClara(tema) {
  const { portada } = coloresDelTema(tema)
  return contraste(portada, '#000000') > contraste(portada, '#ffffff')
}
