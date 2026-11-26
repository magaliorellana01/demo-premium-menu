// El archivo versionado con la copia de la demo (datos ficticios: puede ir a git).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ErrorDeUso } from '../clientes/operaciones.mjs'

export const ARCHIVO = fileURLToPath(new URL('./aroma.json', import.meta.url))
export const ARCHIVO_VISIBLE = 'scripts/demo/aroma.json'

export function leerCopiaGuardada() {
  if (!existsSync(ARCHIVO)) return null
  try {
    return JSON.parse(readFileSync(ARCHIVO, 'utf8'))
  } catch {
    throw new ErrorDeUso(`${ARCHIVO_VISIBLE} está dañado (no es un JSON). Recuperalo con git o volvé a guardar la demo.`)
  }
}

export function escribirCopia(copia) {
  // En dos pasos: si se corta, no queda un archivo a medias.
  writeFileSync(`${ARCHIVO}.tmp`, `${JSON.stringify(copia, null, 2)}\n`)
  renameSync(`${ARCHIVO}.tmp`, ARCHIVO)
}
