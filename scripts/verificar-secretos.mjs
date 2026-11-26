// npm run verificar:secretos — falla si hay una clave secreta en lo que se versiona (o está por
// versionarse) o en la carpeta dist/ (lo que se publica). Conviene correrlo después del build.
// Nunca imprime lo que encontró: solo el archivo, la línea y el motivo.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { buscarSecretos } from './lib/secretos.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean)
// Versionados y nuevos sin ignorar (los que podrían entrar en el próximo commit).
const versionados = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard'))].filter((f) => existsSync(f))

const recorrer = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? recorrer(path.join(dir, e.name)) : [path.join(dir, e.name)]))
const publicados = existsSync('dist') ? recorrer('dist') : []

// Si hay .env, además se buscan los VALORES reales (la clave y las contraseñas de prueba).
const valores = []
if (existsSync('.env')) {
  for (const linea of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m || !/SECRET|PASSWORD/.test(m[1])) continue
    const valor = m[2].replace(/^(["'])(.*)\1$/, '$2')
    if (valor.length >= 8) valores.push({ nombre: m[1], valor })
  }
}

let revisados = 0
let total = 0
for (const archivo of [...versionados, ...publicados]) {
  if (statSync(archivo).size > 5 * 1024 * 1024) continue
  revisados++
  // latin1 conserva cualquier byte: también se revisan binarios sin romperlos.
  for (const { linea, motivo } of buscarSecretos(readFileSync(archivo, 'latin1'), { valores })) {
    total++
    console.log(`FALLÓ  ${archivo}:${linea}  →  ${motivo}`)
  }
}

console.log(`\n${revisados} archivos revisados (${versionados.length} del repo, ${publicados.length} de dist/) · ${valores.length} valor(es) secreto(s) del .env buscados`)
if (!existsSync('dist')) console.log('NOTA   No hay carpeta dist/: corré "npm run build" para revisar también lo que se publica.')
if (total) {
  console.log(`\n${total} hallazgo(s). No commitees ni publiques. Si una clave llegó a git o al sitio, borrala en Supabase y creá otra.`)
  process.exit(1)
}
console.log('Sin claves secretas.')
