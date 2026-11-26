// Entrada y salida de los comandos de clientes: argumentos, preguntas, --dry-run y errores.
import readline from 'node:readline'
import { parseArgs } from 'node:util'
import { clienteSecreto, crearBase } from './base.mjs'
import { leerEntorno } from './clave.mjs'
import { ErrorDeUso } from './operaciones.mjs'

export function argumentos(opciones, argv = process.argv.slice(2), entorno = process.env) {
  let valores
  try {
    valores = parseArgs({ args: argv, options: { ...opciones, 'dry-run': { type: 'boolean' } }, allowPositionals: false }).values
  } catch (error) {
    throw new ErrorDeUso(
      `No entendí los argumentos (${error.message}).\nEn PowerShell el "--" va entre comillas:  npm run <comando> '--' --slug mi-local`,
    )
  }
  // En PowerShell, un "--" sin comillas se pierde y npm se queda con las opciones. Si se quedó
  // con --dry-run, se respeta; si se quedó con otra, se avisa en vez de seguir a ciegas.
  if (entorno.npm_config_dry_run === 'true') valores['dry-run'] = true
  const perdidas = Object.keys(opciones).filter((o) => entorno[`npm_config_${o.replaceAll('-', '_')}`] !== undefined)
  if (perdidas.length) {
    throw new ErrorDeUso(`npm se quedó con ${perdidas.map((o) => `--${o}`).join(', ')}. En PowerShell escribí:  npm run <comando> '--' --opcion valor`)
  }
  return valores
}

/** Preguntas por teclado. También funciona con las respuestas entrando por una tubería. */
export function consola() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false })
  const lineas = rl[Symbol.asyncIterator]()
  const preguntar = async (pregunta) => {
    process.stdout.write(`${pregunta} `)
    const { value, done } = await lineas.next()
    if (!process.stdin.isTTY) process.stdout.write('\n')
    return done ? '' : value.trim()
  }
  return {
    preguntar,
    async confirmar(pregunta) {
      return /^(si|sí)$/i.test(await preguntar(`${pregunta} Escribí "si" para seguir:`))
    },
    cerrar: () => rl.close(),
  }
}

export function conectar() {
  return crearBase(clienteSecreto(leerEntorno()))
}

/** Mientras se escribe en la base, Ctrl+C no corta a la mitad: se termina o se deshace. */
export async function sinCortar(tarea) {
  const avisar = () => console.log('\nEstoy escribiendo en la base: esperá a que termine (o se deshaga).')
  process.on('SIGINT', avisar)
  try {
    return await tarea()
  } finally {
    process.off('SIGINT', avisar)
  }
}

// Ningún mensaje de error puede mostrar la clave secreta ni la contraseña de la demo.
const ocultar = (texto) =>
  [process.env.SUPABASE_SECRET_KEY?.trim(), process.env.DEMO_PASSWORD].filter(Boolean).reduce((t, secreto) => t.split(secreto).join('[oculto]'), String(texto))

export async function ejecutar(comando) {
  const terminal = consola()
  try {
    process.exitCode = (await comando(terminal)) ?? 0
  } catch (error) {
    process.exitCode = 1
    console.error(`\n${ocultar(error.message)}`)
    if (error.quedo) {
      if (error.quedo.length === 0) console.error(error.deshecho ? 'Deshice lo que había creado: no quedó nada a medias.' : 'No se llegó a crear nada.')
      else {
        console.error('\nNo pude deshacer todo. Quedó creado:')
        for (const { que, como } of error.quedo) console.error(`  - ${que}  →  ${como}`)
      }
    }
  } finally {
    terminal.cerrar()
  }
}
