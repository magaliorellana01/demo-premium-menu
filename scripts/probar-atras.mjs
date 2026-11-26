// npm run probar:atras — en un Chrome real: con cambios sin guardar, "atrás", "adelante", las
// pestañas del panel y recargar tienen que preguntar antes de perderlos.
//
// Existe porque las pruebas puras no lo ven: depende del ORDEN en que corren los eventos del
// navegador (src/lib/atras.js tiene que registrarse antes que el router).
//
// Usa el usuario de prueba 1 del .env, compila antes y NO guarda nada (se comprueba que no salga
// ninguna escritura). Necesita Chrome instalado y Node 22 o más nuevo; no suma dependencias.
import { preview } from 'vite'
import { abrirChrome, pausa } from './lib/chrome.mjs'

const { TEST_USER1_EMAIL: email, TEST_USER1_PASSWORD: password } = process.env
if (!email || !password) {
  console.error('Faltan TEST_USER1_EMAIL y TEST_USER1_PASSWORD en el .env (ver README).')
  process.exit(1)
}

let total = 0
let fallos = 0
const ver = (titulo, ok, detalle = '') => {
  total++
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${titulo}${ok || !detalle ? '' : `  →  ${detalle}`}`)
}

const servidor = await preview({ logLevel: 'silent', preview: { port: 4317, strictPort: false } })
const BASE = servidor.resolvedUrls.local[0].replace(/\/$/, '')
let chrome

// Funciones que corren dentro de la página.
const porSelector = (s) => document.querySelector(s)
const porTexto = (s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent.trim() === t)
const hay = (s) => Boolean(document.querySelector(s))
const estado = () => ({ ruta: location.pathname, pregunta: Boolean(document.querySelector('.adm-salida[role="alertdialog"]')) })
const valorDe = (s) => document.querySelector(s)?.value ?? null

try {
  chrome = await abrirChrome()
  const { evaluar, esperar, clicar, escribir, dialogos, pedidos } = chrome

  await chrome.ir(`${BASE}/admin/login`)
  await clicar('el campo de email', porSelector, 'input[type="email"]')
  await escribir(email)
  await clicar('el campo de contraseña', porSelector, 'input[type="password"]')
  await escribir(password)
  await clicar('el botón de ingresar', porSelector, 'button[type="submit"]')
  await esperar('el panel', hay, '.adm-local__nombre, .adm-fila-local')
  const desdeAca = pedidos.length

  const pestana = async (nombre) => {
    await clicar(`la pestaña ${nombre}`, porTexto, '.adm-pestanas a', nombre)
    await pausa(250)
  }
  const boton = async (texto) => {
    await clicar(`"${texto}"`, porTexto, 'button, a', texto)
    await pausa(500)
  }
  const mover = async (hacia) => {
    await evaluar((h) => history[h](), hacia)
    await pausa(700)
  }
  const es = async (titulo, ruta, pregunta) => {
    const e = await evaluar(estado)
    ver(titulo, e.ruta === ruta && e.pregunta === pregunta, JSON.stringify(e))
  }
  const CAMPO = '#ajuste-info-descripcion'
  const ensuciar = async (texto) => {
    await esperar('la pantalla de Ajustes', hay, CAMPO)
    await pausa(300)
    await clicar('el campo de descripción', porSelector, CAMPO)
    await escribir(texto)
    await pausa(300)
  }
  const conserva = async (titulo, texto, selector = CAMPO) => ver(titulo, String(await evaluar(valorDe, selector)).includes(texto), String(await evaluar(valorDe, selector)))

  await chrome.ir(`${BASE}/admin/aroma`)
  await esperar('Inicio', hay, '.adm-pestanas')

  // ── Atrás ──
  await pestana('Ajustes')
  await ensuciar(' ZZ-atras')
  await mover('back')
  await es('Atrás con cambios: pregunta y no se va', '/admin/aroma/ajustes', true)
  await conserva('Atrás con cambios: lo escrito sigue', 'ZZ-atras')
  await boton('Seguir editando')
  await es('"Seguir editando" se queda', '/admin/aroma/ajustes', false)
  await mover('back')
  await es('Atrás otra vez: vuelve a preguntar', '/admin/aroma/ajustes', true)
  await boton('Salir sin guardar')
  await es('"Salir sin guardar" completa el atrás', '/admin/aroma', false)

  // ── Adelante ──
  await pestana('Ajustes')
  await pestana('Productos')
  await mover('back')
  await es('Sin cambios, atrás no pregunta', '/admin/aroma/ajustes', false)
  await ensuciar(' ZZ-adelante')
  await mover('forward')
  await es('Adelante con cambios: pregunta y no se va', '/admin/aroma/ajustes', true)
  await conserva('Adelante con cambios: lo escrito sigue', 'ZZ-adelante')
  await boton('Salir sin guardar')
  await es('"Salir sin guardar" completa el adelante', '/admin/aroma/productos', false)

  // ── Pestañas y recarga ──
  await pestana('Ajustes')
  await ensuciar(' ZZ-pestana')
  await pestana('Categorías')
  await es('Cambiar de pestaña con cambios: pregunta', '/admin/aroma/ajustes', true)
  await boton('Seguir editando')
  dialogos.length = 0
  await evaluar(() => void setTimeout(() => location.reload()))
  await pausa(1200)
  ver('Recargar con cambios: aviso del navegador', dialogos.includes('beforeunload'), dialogos.join() || 'no apareció')
  await conserva('Al cancelar la recarga, lo escrito sigue', 'ZZ-pestana')
  await pestana('Inicio')
  await boton('Salir sin guardar')

  // ── Formulario de producto ──
  await chrome.ir(`${BASE}/admin/aroma`)
  await esperar('Inicio', hay, '.adm-pestanas')
  await pestana('Productos')
  await boton('Nuevo producto')
  await clicar('el nombre del producto', porSelector, '#producto-nombre')
  await escribir('ZZ-prueba-permisos-sin-guardar')
  await pausa(300)
  await mover('back')
  await es('Producto con cambios: atrás pregunta', '/admin/aroma/productos/nuevo', true)
  await conserva('Producto con cambios: lo escrito sigue', 'ZZ-prueba-permisos-sin-guardar', '#producto-nombre')
  await boton('Salir sin guardar')
  await es('Producto: salir vuelve a la lista', '/admin/aroma/productos', false)

  const escrituras = pedidos.slice(desdeAca).filter((p) => /\/(rest|storage)\/v1\//.test(p.url) && !['GET', 'HEAD', 'OPTIONS'].includes(p.metodo) && !p.url.includes('/object/list/'))
  ver('La prueba no escribió nada en la base ni en Storage', escrituras.length === 0, escrituras.map((p) => p.metodo).join())
} catch (error) {
  ver('La prueba se pudo completar', false, error.message)
} finally {
  await chrome?.cerrar()
  await new Promise((listo) => servidor.httpServer.close(listo))
}

console.log(`\n${total - fallos}/${total} comprobaciones OK`)
process.exit(fallos ? 1 : 0)
