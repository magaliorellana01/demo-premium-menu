// Detección de claves secretas de Supabase en un texto. Puro (scripts/probar-clientes.mjs).
// Los patrones están armados por partes para que este archivo no se detecte a sí mismo.

const PREFIJO = ['sb', 'secret', ''].join('_')
// El prefijo solo aparece en documentación y en supabase-js; una clave sigue con muchos caracteres.
const CLAVE_NUEVA = new RegExp(`${PREFIJO}[A-Za-z0-9_-]{12,}`)
const JWT = /eyJ[A-Za-z0-9_-]{4,}\.(eyJ[A-Za-z0-9_-]{4,})\.[A-Za-z0-9_-]{8,}/g
const ROL = ['service', 'role'].join('_')
// Una variable de entorno de clave secreta CON valor escrito (en .env.example va vacía).
const ASIGNACION = new RegExp(
  `\\b(?:SUPABASE_SECRET_KEY|SUPABASE_${ROL.toUpperCase()}_KEY|${ROL.toUpperCase()}_KEY)[ \\t]*[=:][ \\t]*["']?(?:eyJ|${PREFIJO})[A-Za-z0-9_.-]{8,}`,
)
// Vite publica todo lo VITE_: un nombre así con "secret" o el rol secreto es un error.
const NOMBRE_PUBLICADO = new RegExp(`\\bVITE_[A-Z0-9_]*(?:SECRET|${ROL.toUpperCase()})[A-Z0-9_]*[ \\t]*=`)

// Ninguna contraseña con VITE_ puede tener un valor escrito en un archivo (la de la demo
// incluida: en el repo, la variable va vacía).
const CONTRASENA_ESCRITA = /\bVITE_[A-Z0-9_]*PASSWORD[A-Z0-9_]*[ \t]*=(?!=)[ \t]*["']?[^\s"'=;,)}\]]/

// La ÚNICA contraseña pública a propósito: la de la cuenta demo del panel.
export const PUBLICA_PERMITIDA = 'VITE_DEMO_PASSWORD'
const DE_LA_DEMO = ['DEMO_PASSWORD', PUBLICA_PERMITIDA]
const ES_SENSIBLE = /SECRET|PASSWORD/

/**
 * Problemas en las variables de entorno: { nombre: valor }. Devuelve mensajes SIN valores.
 * La contraseña de la demo es pública, así que no puede ser igual a ninguna otra.
 */
export function problemasDeVariables(variables) {
  const problemas = []
  const entradas = Object.entries(variables).filter(([, valor]) => valor)
  for (const [nombre, valor] of entradas) {
    if (!nombre.startsWith('VITE_')) continue
    if (esClaveSecreta(valor)) problemas.push(`${nombre} contiene una clave SECRETA y Vite la publica.`)
    else if (ES_SENSIBLE.test(nombre) && nombre !== PUBLICA_PERMITIDA) problemas.push(`${nombre}: Vite publica todo lo VITE_. La única contraseña pública permitida es ${PUBLICA_PERMITIDA}.`)
  }
  for (const [nombre, valor] of entradas.filter(([n]) => DE_LA_DEMO.includes(n))) {
    if (esClaveSecreta(valor)) problemas.push(`${nombre} es una clave secreta: no puede ser la contraseña de la demo.`)
    const repetidas = entradas.filter(([n, v]) => !DE_LA_DEMO.includes(n) && ES_SENSIBLE.test(n) && v === valor).map(([n]) => n)
    if (repetidas.length) problemas.push(`${nombre} es igual a ${repetidas.join(', ')}. La contraseña de la demo es pública: usá una distinta.`)
  }
  return [...new Set(problemas)]
}

/**
 * Los valores que no pueden aparecer en un archivo. En lo que se publica (dist/) se permite la
 * contraseña de la demo; en el repo no. Si repite otra, esa otra igual se sigue buscando.
 */
export function valoresProhibidos(variables, { publicado = false } = {}) {
  return Object.entries(variables)
    .filter(([nombre, valor]) => ES_SENSIBLE.test(nombre) && valor && valor.length >= 8 && !(publicado && DE_LA_DEMO.includes(nombre)))
    .map(([nombre, valor]) => ({ nombre, valor }))
}

function rolDeJwt(carga) {
  try {
    return JSON.parse(Buffer.from(carga, 'base64url').toString('utf8')).role
  } catch {
    return null
  }
}

const jwtSecreto = (texto) => [...texto.matchAll(JWT)].some((m) => rolDeJwt(m[1]) === ROL)

/** ¿Este valor es una clave secreta (nueva o la service_role antigua)? */
export function esClaveSecreta(valor) {
  const texto = String(valor ?? '').trim()
  return CLAVE_NUEVA.test(texto) || jwtSecreto(texto)
}

/**
 * Busca claves en un texto. Devuelve [{ linea, motivo }], SIN el valor encontrado.
 * `valores`: secretos conocidos (del .env) que no tienen que aparecer: [{ nombre, valor }].
 */
export function buscarSecretos(texto, { valores = [] } = {}) {
  const hallazgos = []
  String(texto)
    .split('\n')
    .forEach((linea, i) => {
      const anotar = (motivo) => hallazgos.push({ linea: i + 1, motivo })
      if (CLAVE_NUEVA.test(linea)) anotar(`clave secreta (${PREFIJO}...)`)
      if (jwtSecreto(linea)) anotar(`JWT con rol ${ROL}`)
      if (ASIGNACION.test(linea)) anotar('variable de clave secreta con valor')
      if (NOMBRE_PUBLICADO.test(linea)) anotar('variable VITE_ con nombre de secreto (Vite la publica)')
      if (CONTRASENA_ESCRITA.test(linea)) anotar('variable VITE_ de contraseña con un valor escrito')
      for (const { nombre, valor } of valores) if (valor && linea.includes(valor)) anotar(`valor de ${nombre} del .env`)
    })
  return hallazgos
}
