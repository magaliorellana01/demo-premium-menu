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
      for (const { nombre, valor } of valores) if (valor && linea.includes(valor)) anotar(`valor de ${nombre} del .env`)
    })
  return hallazgos
}
