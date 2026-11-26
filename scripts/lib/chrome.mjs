// Manejar el Chrome instalado sin dependencias: se abre sin ventana y se le habla por su
// protocolo de depuración con el WebSocket que trae Node (22 o más nuevo).
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CANDIDATOS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

export const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

async function hasta(condicion, que, limite = 20000) {
  const fin = Date.now() + limite
  while (Date.now() < fin) {
    const valor = await condicion()
    if (valor) return valor
    await pausa(60)
  }
  throw new Error(`Se agotó el tiempo esperando ${que}.`)
}

export async function abrirChrome({ ancho = 375, alto = 740 } = {}) {
  if (typeof WebSocket !== 'function') throw new Error('Hace falta Node 22 o más nuevo.')
  const ejecutable = CANDIDATOS.find((ruta) => ruta && existsSync(ruta))
  if (!ejecutable) throw new Error('No encontré Chrome. Definí CHROME_PATH con la ruta del ejecutable.')
  const perfil = mkdtempSync(path.join(os.tmpdir(), 'oestack-chrome-'))
  const proceso = spawn(ejecutable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })

  const archivoPuerto = path.join(perfil, 'DevToolsActivePort')
  const puerto = await hasta(() => existsSync(archivoPuerto) && readFileSync(archivoPuerto, 'utf8').split('\n')[0], 'a Chrome')
  const pestana = await hasta(async () => (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((t) => t.type === 'page'), 'la pestaña')

  const socket = new WebSocket(pestana.webSocketDebuggerUrl)
  await new Promise((listo, error) => {
    socket.onopen = listo
    socket.onerror = () => error(new Error('No me pude conectar con Chrome.'))
  })

  let siguiente = 0
  const pendientes = new Map()
  const escuchas = []
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (m.id) {
      const p = pendientes.get(m.id)
      pendientes.delete(m.id)
      if (m.error) p?.error(new Error(m.error.message))
      else p?.listo(m.result)
    } else for (const f of escuchas) f(m)
  }
  const enviar = (method, params = {}) =>
    new Promise((listo, error) => {
      const id = ++siguiente
      pendientes.set(id, { listo, error })
      socket.send(JSON.stringify({ id, method, params }))
    })

  const dialogos = []
  const pedidos = []
  escuchas.push((m) => {
    if (m.method === 'Page.javascriptDialogOpening') {
      dialogos.push(m.params.type)
      enviar('Page.handleJavaScriptDialog', { accept: false }).catch(() => {})
    }
    if (m.method === 'Network.requestWillBeSent') pedidos.push({ metodo: m.params.request.method, url: m.params.request.url })
  })

  await enviar('Page.enable')
  await enviar('Runtime.enable')
  await enviar('Network.enable')
  await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 700 })

  /** Ejecuta una función en la página (los argumentos van como JSON). */
  async function evaluar(funcion, ...argumentos) {
    const r = await enviar('Runtime.evaluate', { expression: `(${funcion})(...${JSON.stringify(argumentos)})`, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'Error en la página')
    return r.result.value
  }
  const esperar = (que, funcion, ...argumentos) => hasta(() => evaluar(funcion, ...argumentos).catch(() => false), que)

  /** Un clic de verdad (con el mouse): Chrome solo así lo cuenta como acción de la persona. */
  async function clicar(que, buscar, ...argumentos) {
    const punto = await hasta(
      () =>
        evaluar(
          (codigo, args) => {
            const e = new Function(`return (${codigo})`)()(...args)
            if (!e) return null
            e.scrollIntoView({ block: 'center', behavior: 'instant' })
            const r = e.getBoundingClientRect()
            return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
          },
          String(buscar),
          argumentos,
        ).catch(() => null),
      que,
    )
    for (const type of ['mousePressed', 'mouseReleased']) await enviar('Input.dispatchMouseEvent', { type, x: punto.x, y: punto.y, button: 'left', clickCount: 1 })
    await pausa(120)
  }

  return {
    evaluar,
    esperar,
    clicar,
    dialogos,
    pedidos,
    ir: (url) => enviar('Page.navigate', { url }),
    escribir: (texto) => enviar('Input.insertText', { text: texto }),
    async cerrar() {
      socket.close()
      const salio = new Promise((listo) => proceso.once('exit', listo))
      proceso.kill()
      await Promise.race([salio, pausa(3000)])
      // En Windows el perfil puede seguir tomado un instante.
      try {
        rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
      } catch {
        console.log(`NOTA   No pude borrar el perfil temporal: ${perfil}`)
      }
    },
  }
}
