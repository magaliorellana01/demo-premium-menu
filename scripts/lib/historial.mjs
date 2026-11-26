// Revisión de TODO el historial de git: cada versión de cada archivo y cada mensaje de commit
// de todas las ramas (locales y remotas), etiquetas y el último stash. Algo borrado en un commit
// posterior sigue ahí y se publica con el repositorio. Sin dependencias: solo git.
//
// No revisa lo que ya no cuelga de ninguna rama (commits descartados que git todavía guarda en
// esta computadora): eso no se sube con "git push".
import { execFileSync } from 'node:child_process'
import { buscarSecretos } from './secretos.mjs'

// Armados por partes para que este archivo no se detecte a sí mismo.
const OTRAS_CLAVES = [
  [new RegExp(`-----BEGIN [A-Z ]*PRIVATE ${'KEY'}-----`), 'clave privada'],
  [/\bpostgres(?:ql)?:\/\/[^\s:/@"'`]+:(?![[<$*{])[^\s@"'`]+@/, 'cadena de conexión a la base con contraseña'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/, 'token de GitHub'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'clave de AWS'],
]
// Una línea de archivo de entorno con una variable sensible CON valor (aunque no sea la de hoy).
const VARIABLE_CON_VALOR = /^[ \t]*(?:export[ \t]+)?[A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN)[A-Z0-9_]*=(?!=)[ \t]*["']?[^\s"'#<]/
// Públicas por diseño: se informan, no son una falla.
const JWT = /eyJ[A-Za-z0-9_-]{4,}\.eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{8,}/
const PUBLICABLE = new RegExp(`${['sb', 'publishable', ''].join('_')}[A-Za-z0-9_-]{12,}`)

/**
 * Lo que hay en un texto: { hallazgos: [{ linea, motivo }], avisos: [{ linea, motivo }] },
 * SIN los valores. `valores`: secretos conocidos (los del .env).
 */
export function revisarTexto(texto, { valores = [] } = {}) {
  const hallazgos = buscarSecretos(texto, { valores })
  const avisos = []
  String(texto)
    .split('\n')
    .forEach((linea, i) => {
      for (const [patron, motivo] of OTRAS_CLAVES) if (patron.test(linea)) hallazgos.push({ linea: i + 1, motivo })
      if (VARIABLE_CON_VALOR.test(linea)) hallazgos.push({ linea: i + 1, motivo: 'variable de contraseña, secreto o token con un valor escrito' })
      if (JWT.test(linea) && !hallazgos.some((h) => h.linea === i + 1)) avisos.push({ linea: i + 1, motivo: 'un JWT sin rol secreto (por ejemplo la clave pública anon)' })
      if (PUBLICABLE.test(linea)) avisos.push({ linea: i + 1, motivo: 'una clave publishable (pública)' })
    })
  return { hallazgos, avisos }
}

const git = (args, opciones = {}) => execFileSync('git', args, { maxBuffer: 1024 * 1024 * 1024, ...opciones })

/** Cada archivo distinto que existió en algún commit: Map<id, ruta>. */
function archivosDelHistorial() {
  const objetos = new Map()
  for (const linea of git(['rev-list', '--all', '--objects'], { encoding: 'utf8' }).split('\n')) {
    const corte = linea.indexOf(' ')
    if (corte > 0) objetos.set(linea.slice(0, corte), linea.slice(corte + 1))
  }
  return objetos
}

/** El contenido de esos objetos, en un solo pedido a git. Devuelve solo los archivos (blobs). */
function* contenidos(ids) {
  const salida = git(['cat-file', '--batch'], { input: `${ids.join('\n')}\n` })
  let desde = 0
  while (desde < salida.length) {
    const fin = salida.indexOf(10, desde)
    const [id, tipo, largo] = salida.toString('utf8', desde, fin).split(' ')
    const bytes = Number(largo)
    // latin1 conserva cualquier byte (también se revisan binarios).
    if (tipo === 'blob') yield { id, texto: salida.toString('latin1', fin + 1, fin + 1 + bytes), bytes }
    desde = fin + 1 + bytes + 1
  }
}

const commitsCon = (id) => git(['log', '--all', '--format=%h', `--find-object=${id}`], { encoding: 'utf8' }).split('\n').filter(Boolean)

const MAXIMO = 5 * 1024 * 1024

export function revisarHistorial({ valores = [] } = {}) {
  if (git(['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true') {
    throw new Error('El repositorio está incompleto (clon superficial): corré "git fetch --unshallow" y probá de nuevo.')
  }
  const objetos = archivosDelHistorial()
  const resultado = { commits: 0, archivos: 0, omitidos: [], hallazgos: [], avisos: [] }
  const anotar = (donde, { hallazgos, avisos }, commits) => {
    if (!hallazgos.length && !avisos.length) return
    const en = commits()
    for (const [lista, nuevos] of [[resultado.hallazgos, hallazgos], [resultado.avisos, avisos]]) {
      for (const x of nuevos) lista.push({ donde, linea: x.linea, motivo: x.motivo, commits: en })
    }
  }

  for (const { id, texto, bytes } of contenidos([...objetos.keys()])) {
    const ruta = objetos.get(id)
    resultado.archivos++
    // Un .env guardado alguna vez es un problema aunque no se reconozca nada adentro.
    if (/(^|\/)\.env($|\.)/.test(ruta) && !ruta.endsWith('.env.example')) {
      resultado.hallazgos.push({ donde: ruta, linea: 0, motivo: 'un archivo .env quedó guardado en el historial', commits: commitsCon(id) })
    }
    if (bytes > MAXIMO) {
      resultado.omitidos.push(ruta)
      continue
    }
    anotar(ruta, revisarTexto(texto, { valores }), () => commitsCon(id))
  }

  const mensajes = git(['log', '--all', '--format=%h%x00%B%x00'], { encoding: 'latin1' }).split('\0')
  for (let i = 0; i + 1 < mensajes.length; i += 2) {
    const commit = mensajes[i].trim()
    resultado.commits++
    anotar('mensaje de commit', revisarTexto(mensajes[i + 1], { valores }), () => [commit])
  }
  return resultado
}
