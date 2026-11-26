// La clave secreta: SOLO para scripts que se corren en la computadora de OESTACK. Saltea todo
// el RLS. Nunca va en src/, nunca con prefijo VITE_ y nunca se imprime.
import { esClaveSecreta } from '../lib/secretos.mjs'
import { ErrorDeUso } from './operaciones.mjs'

export const VARIABLE = 'SUPABASE_SECRET_KEY'

export const COMO_CONSEGUIRLA = [
  'Cómo conseguir la clave secreta:',
  '  1. Entrá a tu proyecto en https://supabase.com/dashboard.',
  '  2. Project Settings > API Keys.',
  '  3. En "Secret keys" copiá la clave que empieza con sb_secret_ (si no hay ninguna, creala ahí).',
  `  4. Abrí el archivo .env del proyecto y agregá una línea:  ${VARIABLE}=`,
  '     y pegá la clave después del igual. Guardá.',
  'No la pegues en un chat, un mail ni un mensaje, y no la subas a git. Si se filtra, borrala en',
  'esa misma pantalla y creá otra.',
].join('\n')

/** Devuelve { url, clave } o explica qué falta. Nunca incluye la clave en un mensaje. */
export function leerEntorno(entorno = process.env) {
  // La defensa más importante: nada con VITE_ puede ser secreto (Vite lo publica).
  const publicadas = Object.entries(entorno).filter(([nombre, valor]) => nombre.startsWith('VITE_') && esClaveSecreta(valor))
  if (publicadas.length) {
    throw new ErrorDeUso(
      `PELIGRO: ${publicadas.map(([n]) => n).join(', ')} contiene una clave SECRETA y Vite publica todo lo que empieza con VITE_. ` +
        'Sacala de ahí. Si ya publicaste el sitio con ese valor, borrá esa clave en Supabase y creá otra.',
    )
  }
  const url = entorno.VITE_SUPABASE_URL
  const clave = entorno[VARIABLE]?.trim()
  if (!url) throw new ErrorDeUso('Falta VITE_SUPABASE_URL en el .env.')
  if (!clave) throw new ErrorDeUso(`Falta ${VARIABLE} en el .env.\n\n${COMO_CONSEGUIRLA}`)
  if (!esClaveSecreta(clave)) {
    throw new ErrorDeUso(`${VARIABLE} no es una clave secreta (¿pegaste la anon o la publishable?).\n\n${COMO_CONSEGUIRLA}`)
  }
  return { url, clave }
}
