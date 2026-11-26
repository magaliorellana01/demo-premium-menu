// Pruebas de la cuenta demo (sin red): node scripts/probar-demo.mjs
// La copia guardada y sus diferencias, el reinicio (con fallos a mitad de camino), la tarjeta
// del ingreso y las reglas de secretos. La "base" es de mentira: no toca Supabase.
import { armarCopia, canon, DEMO_EMAIL, describirDiferencias, diferencias, problemasDeCopia, revisarAntesDeGuardar } from './demo/copia.mjs'
import { capturarDemo, planDeReinicio, reiniciarDemo } from './demo/operaciones.mjs'
import { leerCopiaGuardada } from './demo/archivo.mjs'
import { buscarSecretos, problemasDeVariables, valoresProhibidos } from './lib/secretos.mjs'
import { revisarTexto } from './lib/historial.mjs'
import { AVISO_DEMO, credencialesDemo, esUsuarioDemo, mensajeDeErrorDemo, opcionesDeSalida } from '../src/admin/demo.js'
import { MENSAJE_CREDENCIALES, mensajeErrorLogin } from '../src/admin/login.js'
import { mensajeDeErrorAjustes } from '../src/admin/ajustes.js'
import { MENSAJE_CARPETA_LLENA } from '../src/admin/fotos.js'
import { mensajeDeErrorProducto } from '../src/admin/productos.js'

let total = 0
let fallos = 0
function caso(nombre, obtenido, esperado) {
  total++
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLÓ'} ${nombre}${ok ? '' : `\n        esperado: ${JSON.stringify(esperado)}\n        obtenido: ${JSON.stringify(obtenido)}`}`)
}
const si = (nombre, condicion) => caso(nombre, Boolean(condicion), true)
async function falla(nombre, tarea, patron) {
  try {
    await tarea()
    caso(nombre, 'no falló', `un error ${patron}`)
  } catch (error) {
    si(nombre, patron.test(error.message))
  }
}

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const LOCAL = { id: 'L-aroma', slug: 'aroma', updated_at: 'x', nombre: 'Aroma', activo: true, descripcion: 'Café', logo_url: '/locales/aroma/logo.webp', tema: { frase: 'hola', fondo: '#ffffff' }, horarios: { zona: 'z', semana: {} }, aviso_activo: false, aviso_texto: null }
const CAT = (n, orden, extra = {}) => ({ id: id(n), local_id: 'L-aroma', nombre: `Categoría ${n}`, orden, activa: true, adicionales: [], ...extra })
const PROD = (n, cat, orden, extra = {}) => ({ id: id(n), local_id: 'L-aroma', categoria_id: id(cat), nombre: `Producto ${n}`, descripcion: null, precio: 100, imagen_url: `/locales/aroma/productos/p${n}.webp`, destacado: false, disponible: true, etiquetas: [], variantes: [], orden, ...extra })
const CATS = [CAT(1, 1, { adicionales: [{ nombre: 'Leche', precio: 1 }] }), CAT(2, 2)]
const PRODS = [PROD(11, 1, 1, { variantes: [{ nombre: 'Chico', precio: 100 }] }), PROD(12, 1, 2, { destacado: true }), PROD(13, 2, 1, { disponible: false, etiquetas: ['vegano'] })]

// ── La copia ──
const copia = armarCopia({ local: LOCAL, categorias: [...CATS].reverse(), productos: [...PRODS].reverse(), archivos: ['logo/b.webp', 'logo/a.webp'] })
caso('del local no guarda id, slug ni updated_at (el slug va aparte)', [copia.slug, 'id' in copia.local, 'slug' in copia.local, 'updated_at' in copia.local], ['aroma', false, false, false])
si('de las filas guarda todos los campos menos local_id', copia.productos.every((p) => !('local_id' in p) && 'variantes' in p && 'etiquetas' in p && 'imagen_url' in p && 'orden' in p) && copia.categorias[0].adicionales.length === 1)
caso('orden estable: por categoría y orden, aunque la base devuelva otra cosa', [copia.categorias.map((c) => c.id), copia.productos.map((p) => p.id)], [[id(1), id(2)], [id(11), id(12), id(13)]])
caso('archivos ordenados', copia.archivos, ['logo/a.webp', 'logo/b.webp'])
caso('dos capturas del mismo estado son idénticas', canon(armarCopia({ local: LOCAL, categorias: CATS, productos: PRODS, archivos: ['logo/a.webp', 'logo/b.webp'] })), canon(copia))

// ── Validación (una copia rota no puede aplicarse) ──
const base0 = armarCopia({ local: LOCAL, categorias: CATS, productos: PRODS, archivos: [] })
caso('una copia buena no tiene problemas', problemasDeCopia(base0), [])
const rota = (cambiar) => {
  const c = structuredClone(base0)
  cambiar(c)
  return problemasDeCopia(c).length > 0
}
for (const [nombre, cambiar] of [
  ['de otro local', (c) => (c.slug = 'local-prueba')],
  ['versión desconocida', (c) => (c.version = 9)],
  ['sin datos del local', (c) => delete c.local],
  ['local inactivo', (c) => (c.local.activo = false)],
  ['que intenta fijar el slug', (c) => (c.local.slug = 'otro')],
  ['que intenta fijar el id del local', (c) => (c.local.id = 'x')],
  ['sin categorías', (c) => (c.categorias = [])],
  ['sin productos (vaciaría el menú)', (c) => (c.productos = [])],
  ['con un id que no es uuid', (c) => (c.productos[0].id = '1')],
  ['con ids repetidos', (c) => (c.productos[1].id = c.productos[0].id)],
  ['con un producto sin nombre', (c) => (c.productos[0].nombre = ' ')],
  ['con local_id en una fila', (c) => (c.productos[0].local_id = 'otro')],
  ['con una categoría inexistente', (c) => (c.productos[0].categoria_id = id(99))],
  ['con una ruta que sube de carpeta', (c) => (c.archivos = ['../otro/x.webp'])],
  ['con una ruta absoluta', (c) => (c.archivos = ['/x.webp'])],
  ['con archivos repetidos', (c) => (c.archivos = ['a', 'a'])],
]) si(`rechaza una copia ${nombre}`, rota(cambiar))
si('rechaza algo que no es un objeto', problemasDeCopia(null).length === 1)

// ── Diferencias ──
caso('sin cambios: nada', diferencias(base0, structuredClone(base0)).total, 0)
const desordenada = structuredClone(base0)
desordenada.local.tema = { fondo: '#ffffff', frase: 'hola' }
desordenada.local.horarios = { semana: {}, zona: 'z' }
caso('el orden de las claves de jsonb no cuenta como cambio', diferencias(base0, desordenada).total, 0)
const tocada = structuredClone(base0)
tocada.local.nombre = 'Roto'
tocada.local.aviso_activo = true
tocada.categorias[0].orden = 2
tocada.categorias[1].orden = 1
tocada.categorias.push({ ...tocada.categorias[0], id: id(7), nombre: 'Intrusa' })
tocada.productos = tocada.productos.filter((p) => p.id !== id(13))
tocada.productos[0].precio = 1
tocada.productos[0].variantes = []
tocada.productos.push({ ...tocada.productos[0], id: id(77), nombre: 'Spam' })
tocada.archivos = ['productos/spam.webp']
let d = diferencias(base0, tocada)
caso('campos del local cambiados', d.local, ['aviso_activo', 'nombre'])
caso('categorías: agregada y reordenadas', [d.categorias.agregadas.map((f) => f.nombre), d.categorias.borradas.length, d.categorias.modificadas.map((f) => f.campos)], [['Intrusa'], 0, [['orden'], ['orden']]])
caso('productos: agregado, borrado y modificado (con sus campos)', [d.productos.agregadas.map((f) => f.nombre), d.productos.borradas.map((f) => f.nombre), d.productos.modificadas.map((f) => f.campos)], [['Spam'], ['Producto 13'], [['precio', 'variantes']]])
caso('archivos sobrantes y faltantes', diferencias({ ...base0, archivos: ['logo/a.webp'] }, tocada).archivos, { sobrantes: ['productos/spam.webp'], faltantes: ['logo/a.webp'] })
caso('total', d.total, 9)
const reordenados = structuredClone(base0)
reordenados.productos[0].orden = 2
reordenados.productos[1].orden = 1
caso('cambiar solo el orden también es una diferencia', diferencias(base0, reordenados).productos.modificadas.map((f) => f.campos), [['orden'], ['orden']])
si('la descripción nombra lo cambiado', describirDiferencias(d).join('\n').includes('"Spam"') && describirDiferencias(d).join('\n').includes('aviso_activo, nombre'))
const muchas = structuredClone(base0)
for (let i = 100; i < 400; i++) muchas.productos.push({ ...base0.productos[0], id: id(i), nombre: 'x'.repeat(500) })
si('con cientos de cambios la salida sigue corta', describirDiferencias(diferencias(base0, muchas)).join('\n').length < 600 && describirDiferencias(diferencias(base0, muchas))[0].includes('y 295 más'))

// ── Antes de guardar ──
caso('un estado sano se puede guardar sin avisos', revisarAntesDeGuardar(base0), { impiden: [], avisos: [] })
for (const [nombre, cambiar] of [['un producto ZZ-prueba', (c) => (c.productos[0].nombre = 'ZZ-prueba-permisos-p')], ['una categoría "ZZ Cafés"', (c) => (c.categorias[0].nombre = 'ZZ Cafés')], ['el nombre del local de prueba', (c) => (c.local.nombre = 'ZZ-prueba-permisos-Aroma')], ['un archivo de prueba', (c) => (c.archivos = ['logo/ZZ-prueba-permisos-x.webp'])]]) {
  const c = structuredClone(base0)
  cambiar(c)
  si(`no deja guardar con ${nombre}`, revisarAntesDeGuardar(c).impiden.some((m) => m.includes('prueba')))
}
const conExterna = structuredClone(base0)
conExterna.productos[0].imagen_url = 'https://otro-sitio.example/x.jpg'
si('avisa de una imagen de otro sitio', revisarAntesDeGuardar(conExterna).avisos[0]?.includes('otro sitio'))
si('avisa que los archivos de Storage no se pueden recuperar', revisarAntesDeGuardar({ ...base0, archivos: ['logo/a.webp'] }).avisos[0]?.includes('no puede recuperarlos'))

// ── Base de mentira ──
const BUENA = 'Cafe-Demo-2026!'
function baseFalsa({ usuarios = [], miembros = [], admins = [], categorias = CATS, productos = PRODS, local = LOCAL, archivos = [] } = {}) {
  const e = structuredClone({ usuarios, miembros, categorias, productos, local, archivos: archivos.map((a) => `L-aroma/${a}`), escrituras: [], minimoDeProductos: Infinity })
  e.fallar = null
  let n = 0
  const escribir = (op, hacer) => {
    if (e.fallar === op) throw new Error(`falla ${op}`)
    e.escrituras.push(op)
    const r = hacer()
    e.minimoDeProductos = Math.min(e.minimoDeProductos, e.productos.length)
    return r
  }
  const slugDe = (localId) => (localId === 'L-aroma' ? 'aroma' : localId)
  return {
    e,
    leerLocal: async (slug) => (e.local && e.local.slug === slug ? structuredClone(e.local) : null),
    listarFilas: async (tabla, localId) => structuredClone(e[tabla].filter((f) => f.local_id === localId)),
    archivosDe: async () => [...e.archivos],
    listarUsuarios: async () => e.usuarios.map((u) => ({ id: u.id, email: u.email, marca: u.marca ?? null })),
    esAdmin: async (uid) => admins.includes(uid),
    membresiasDe: async (uid) => e.miembros.filter((m) => m.user_id === uid).map((m) => ({ local_id: m.local_id, rol: m.rol, slug: slugDe(m.local_id) })),
    borrarUsuario: async (uid) => escribir('borrarUsuario', () => {
      e.usuarios = e.usuarios.filter((u) => u.id !== uid)
      e.miembros = e.miembros.filter((m) => m.user_id !== uid)
    }),
    actualizarLocal: async (_, cambios) => escribir('actualizarLocal', () => Object.assign(e.local, structuredClone(cambios))),
    guardarFilas: async (tabla, filas) => escribir(`guardar ${tabla}`, () => {
      for (const f of filas) {
        if (tabla === 'productos' && !e.categorias.some((c) => c.id === f.categoria_id)) throw new Error('clave foránea')
        const i = e[tabla].findIndex((x) => x.id === f.id)
        if (i === -1) e[tabla].push(structuredClone(f))
        else e[tabla][i] = structuredClone(f)
      }
    }),
    borrarFilas: async (tabla, localId, ids) => escribir(`borrar ${tabla}`, () => {
      if (tabla === 'categorias' && e.productos.some((p) => ids.includes(p.categoria_id))) throw new Error('la categoría tiene productos')
      e[tabla] = e[tabla].filter((f) => !(f.local_id === localId && ids.includes(f.id)))
    }),
    borrarArchivos: async (rutas) => escribir('borrarArchivos', () => (e.archivos = e.archivos.filter((a) => !rutas.includes(a)))),
    crearUsuario: async (email, password, marca) => escribir('crearUsuario', () => {
      if (e.usuarios.some((u) => u.email === email)) throw new Error('ya existe ese email')
      const u = { id: `U-nuevo-${++n}`, email, password, marca: marca.oestack_demo }
      e.usuarios.push(u)
      return u
    }),
    agregarMiembro: async (user_id, local_id, rol) => escribir('agregarMiembro', () => void e.miembros.push({ user_id, local_id, rol })),
  }
}
const DUENO_REAL = { usuarios: [{ id: 'U-real', email: 'real@x.com' }], miembros: [{ user_id: 'U-real', local_id: 'L-aroma', rol: 'owner' }] }
const CON_DEMO = { usuarios: [...DUENO_REAL.usuarios, { id: 'U-demo', email: DEMO_EMAIL, marca: 'aroma', password: 'cambiada-por-alguien' }], miembros: [...DUENO_REAL.miembros, { user_id: 'U-demo', local_id: 'L-aroma', rol: 'owner' }] }
/** Alguien jugando con la demo: borra, cambia, agrega, mueve y sube archivos. */
const VANDALIZADA = {
  ...CON_DEMO,
  local: { ...LOCAL, nombre: 'Hackeado', aviso_activo: true, aviso_texto: 'spam', tema: {} },
  categorias: [CAT(1, 5, { nombre: 'Renombrada', adicionales: [] }), CAT(8, 1, { nombre: 'Intrusa' })],
  productos: [{ ...PRODS[0], categoria_id: id(8), precio: 0 }, PROD(80, 8, 1), PROD(81, 1, 2)],
  archivos: ['productos/basura-480.webp', 'logo/otro.webp'],
}
const GUARDADA = armarCopia({ local: LOCAL, categorias: CATS, productos: PRODS, archivos: [] })
const reiniciar = async (b, password = BUENA) => reiniciarDemo(b, await planDeReinicio(b, GUARDADA, { password }), { password })

// ── Reinicio ──
let b = baseFalsa(VANDALIZADA)
const plan = await planDeReinicio(b, GUARDADA, { password: BUENA })
caso('planificar no escribe nada', b.e.escrituras, [])
si('el plan muestra lo que cambió', plan.cambios.local.includes('nombre') && plan.cambios.productos.borradas.length === 2 && plan.cambios.archivos.sobrantes.length === 2 && plan.cuentas.length === 1)
let r = await reiniciar(b)
caso('queda exactamente como la copia', [r.restantes.total, r.cuentaBien, canon(await capturarDemo(b))], [0, true, canon(GUARDADA)])
caso('conserva los mismos ids', b.e.productos.map((p) => p.id).sort(), PRODS.map((p) => p.id).sort())
caso('borra los archivos que no están en la copia', b.e.archivos, [])
caso('orden seguro: primero cierra las sesiones, repone y después borra; al final la cuenta', b.e.escrituras, ['borrarUsuario', 'actualizarLocal', 'guardar categorias', 'guardar productos', 'borrar productos', 'borrar categorias', 'borrarArchivos', 'crearUsuario', 'agregarMiembro'])
si('el menú nunca queda vacío durante el reinicio', b.e.minimoDeProductos >= PRODS.length)
const demo = b.e.usuarios.find((u) => u.email === DEMO_EMAIL)
si('la cuenta demo es nueva, con la contraseña pedida, su marca y solo dueña de aroma', demo.id !== 'U-demo' && demo.password === BUENA && demo.marca === 'aroma' && canon(b.e.miembros.filter((m) => m.user_id === demo.id)) === canon([{ user_id: demo.id, local_id: 'L-aroma', rol: 'owner' }]))
si('no toca a los demás usuarios de aroma', b.e.usuarios.some((u) => u.id === 'U-real') && b.e.miembros.some((m) => m.user_id === 'U-real'))
b.e.escrituras.length = 0
r = await reiniciar(b)
caso('repetirlo es inofensivo: mismo resultado, sin cuentas duplicadas', [r.restantes.total, r.cuentaBien, b.e.usuarios.filter((u) => u.email === DEMO_EMAIL).length, b.e.usuarios.length], [0, true, 1, 2])

b = baseFalsa(DUENO_REAL)
r = await reiniciar(b)
caso('la primera vez crea la cuenta', [r.cuentaBien, b.e.escrituras.includes('borrarUsuario'), b.e.escrituras.includes('crearUsuario')], [true, false, true])
const CAMBIO_EMAIL = { ...VANDALIZADA, usuarios: [...DUENO_REAL.usuarios, { id: 'U-demo', email: 'intruso@x.com', marca: 'aroma' }] }
b = baseFalsa(CAMBIO_EMAIL)
await reiniciar(b)
caso('si le cambiaron el email, la reconoce por la marca y la borra', b.e.usuarios.map((u) => u.email).sort(), [DEMO_EMAIL, 'real@x.com'])

for (const op of ['borrarUsuario', 'actualizarLocal', 'guardar categorias', 'guardar productos', 'borrar productos', 'borrar categorias', 'borrarArchivos', 'crearUsuario', 'agregarMiembro']) {
  b = baseFalsa(VANDALIZADA)
  b.e.fallar = op
  await falla(`si falla "${op}", avisa`, () => reiniciar(b), new RegExp(op))
  b.e.fallar = null
  r = await reiniciar(b)
  caso(`  y volver a correrlo termina bien`, [r.restantes.total, r.cuentaBien, b.e.usuarios.filter((u) => u.email === DEMO_EMAIL).length], [0, true, 1])
}

b = baseFalsa({ ...CON_DEMO, archivos: [] })
r = await reiniciarDemo(b, await planDeReinicio(b, { ...GUARDADA, archivos: ['logo/perdido.webp'] }, { password: BUENA }), { password: BUENA })
caso('un archivo de la copia que ya no está se informa, no se esconde', r.restantes.archivos.faltantes, ['logo/perdido.webp'])

// ── Reinicio: cuándo se niega (sin escribir) ──
const niega = async (nombre, mundo, patron, copiaUsada = GUARDADA, password = BUENA) => {
  const x = baseFalsa(mundo)
  await falla(nombre, () => planDeReinicio(x, copiaUsada, { password }), patron)
  caso(`  sin escribir nada`, x.e.escrituras, [])
}
await niega('con una copia de otro local', CON_DEMO, /solo trabajan con "aroma"/, { ...GUARDADA, slug: 'local-prueba' })
await niega('con una copia vacía', CON_DEMO, /no se puede aplicar/, { ...GUARDADA, productos: [] })
await niega('si no existe aroma', { ...CON_DEMO, local: { ...LOCAL, slug: 'otro' } }, /No existe el local "aroma"/)
await niega('si la cuenta demo es admin', { ...CON_DEMO, admins: ['U-demo'] }, /es ADMIN/)
await niega('si la cuenta demo tiene otro local', { ...CON_DEMO, miembros: [...CON_DEMO.miembros, { user_id: 'U-demo', local_id: 'local-prueba', rol: 'editor' }] }, /también tiene acceso a local-prueba/)
await niega('sin DEMO_PASSWORD', CON_DEMO, /Falta DEMO_PASSWORD/, GUARDADA, '')
await niega('con una contraseña débil', CON_DEMO, /no cumple la política/, GUARDADA, 'demo1234')
await falla('el mensaje de error no incluye la contraseña', async () => {
  try {
    await planDeReinicio(baseFalsa(CON_DEMO), GUARDADA, { password: 'clave-corta' })
  } catch (error) {
    throw new Error(error.message.includes('clave-corta') ? 'la incluye' : 'limpio')
  }
}, /limpio/)

// ── El archivo versionado ──
const versionada = leerCopiaGuardada()
if (versionada) {
  caso('scripts/demo/aroma.json es una copia válida', problemasDeCopia(versionada), [])
  caso('y no tiene datos de prueba ni nada que avisar', revisarAntesDeGuardar(versionada), { impiden: [], avisos: [] })
  si('no guarda usuarios, emails ni contraseñas', !/@|password|contrase|user_id|sb_secret/i.test(canon(versionada)))
} else console.log('NOTA  Todavía no existe scripts/demo/aroma.json (npm run demo:guardar).')

// ── Tarjeta del ingreso ──
caso('con las dos variables hay tarjeta (email normalizado, contraseña tal cual)', credencialesDemo({ email: ' Demo@OESTACK.com ', password: ' Clave 1! ' }), { email: 'demo@oestack.com', password: ' Clave 1! ' })
for (const [nombre, env] of [['sin ninguna', {}], ['sin contraseña', { email: DEMO_EMAIL }], ['sin email', { password: BUENA }], ['vacías', { email: '  ', password: '' }], ['sin argumento', undefined]]) caso(`sin tarjeta: ${nombre}`, credencialesDemo(env), null)
si('reconoce la sesión demo sin importar mayúsculas', esUsuarioDemo({ email: 'DEMO@oestack.com' }, DEMO_EMAIL))
si('otra sesión no es la demo', !esUsuarioDemo({ email: 'real@x.com' }, DEMO_EMAIL) && !esUsuarioDemo(null, DEMO_EMAIL))
si('sin la variable, nadie es la demo (ni un usuario sin email)', !esUsuarioDemo({ email: DEMO_EMAIL }, undefined) && !esUsuarioDemo({}, '') && !esUsuarioDemo({ email: '' }, ''))
caso('la demo cierra solo su sesión; el resto, como siempre', [opcionesDeSalida(true), opcionesDeSalida(false)], [{ scope: 'local' }, undefined])
si('si la contraseña de la demo no anda, lo explica', mensajeDeErrorDemo(mensajeErrorLogin({ code: 'invalid_credentials' }), MENSAJE_CREDENCIALES).includes('alguien haya cambiado'))
si('otros errores quedan como en el ingreso común', mensajeDeErrorDemo(mensajeErrorLogin({ status: 429 }), MENSAJE_CREDENCIALES).includes('demasiados intentos'))
caso('el texto del aviso', AVISO_DEMO, 'Estás en una cuenta de demostración. Los datos se reinician periódicamente.')

// ── Carpeta llena (tope de supabase/12b-tope-demo.sql) ──
// Lo que Storage devolvió en la prueba real cuando el trigger rechazó la subida.
const LLENA = { paso: 'foto', status: 500, statusCode: '500', message: 'database error, code: 23514' }
caso('foto de producto con la carpeta llena', mensajeDeErrorProducto(LLENA), MENSAJE_CARPETA_LLENA)
caso('logo con la carpeta llena', mensajeDeErrorAjustes(LLENA), MENSAJE_CARPETA_LLENA)
si('otro error de la base al subir no se confunde', mensajeDeErrorProducto({ ...LLENA, message: 'database error, code: 23505' }) !== MENSAJE_CARPETA_LLENA)
si('fuera de una subida, un 23514 sigue siendo "datos rechazados"', mensajeDeErrorProducto({ code: '23514' }).includes('rechazó') && mensajeDeErrorAjustes({ code: '23514' }).includes('rechazó'))

// ── Reglas de secretos ──
// Se arman por partes: este archivo no tiene que disparar el detector.
const PUBLICA = ['VITE', 'DEMO', 'PASSWORD'].join('_')
const SECRETA = ['sb', 'secret', 'A1b2C3d4E5f6G7h8I9j0K1l2'].join('_')
const SANO = { DEMO_PASSWORD: BUENA, [PUBLICA]: BUENA, VITE_DEMO_EMAIL: DEMO_EMAIL, TEST_USER1_PASSWORD: 'Otra-Distinta-1!', SUPABASE_SECRET_KEY: SECRETA, VITE_SUPABASE_ANON_KEY: 'sb_publishable_x' }
caso('el entorno de la demo es válido', problemasDeVariables(SANO), [])
for (const [nombre, cambio] of [
  ['otra VITE_ con contraseña', { [['VITE', 'ADMIN', 'PASSWORD'].join('_')]: 'x1234567!A' }],
  ['una VITE_ con SECRET en el nombre', { VITE_ALGO_SECRET: 'x1234567!A' }],
  ['la clave secreta como contraseña de la demo', { [PUBLICA]: SECRETA, DEMO_PASSWORD: '' }],
  ['la clave secreta en cualquier VITE_', { VITE_OTRA: SECRETA }],
  ['la demo repite la contraseña de un usuario', { [PUBLICA]: 'Otra-Distinta-1!' }],
  ['DEMO_PASSWORD repite la de un usuario', { DEMO_PASSWORD: 'Otra-Distinta-1!' }],
]) {
  const problemas = problemasDeVariables({ ...SANO, ...cambio })
  si(`falla: ${nombre}`, problemas.length >= 1)
  si('  (el mensaje no muestra valores)', problemas.every((m) => ![SECRETA, BUENA, 'Otra-Distinta-1!', 'x1234567!A'].some((v) => m.includes(v))))
}
const nombres = (lista) => lista.map((v) => v.nombre).sort()
caso('en el repo se buscan todas, también la de la demo', nombres(valoresProhibidos(SANO)), ['DEMO_PASSWORD', 'SUPABASE_SECRET_KEY', 'TEST_USER1_PASSWORD', PUBLICA])
caso('en lo publicado se permite solo la de la demo', nombres(valoresProhibidos(SANO, { publicado: true })), ['SUPABASE_SECRET_KEY', 'TEST_USER1_PASSWORD'])
si('si la demo repitiera otra, esa se sigue buscando en lo publicado', valoresProhibidos({ ...SANO, [PUBLICA]: 'Otra-Distinta-1!' }, { publicado: true }).some((v) => v.valor === 'Otra-Distinta-1!'))
const motivos = (texto) => buscarSecretos(texto).map((h) => h.motivo)
for (const linea of [`${PUBLICA}=${BUENA}`, `${PUBLICA}="${BUENA}"`, `${PUBLICA} = '${BUENA}'`, `${['VITE', 'X', 'PASSWORD'].join('_')}=abc`]) si(`detecta un valor escrito: ${linea.split('=')[0].trim()}`, motivos(linea).some((m) => m.includes('contraseña')))
for (const linea of [`${PUBLICA}=`, `${PUBLICA}=""`, `if (n === ${PUBLICA}) {}`, `password: import.meta.env.${PUBLICA} })`, `Cargá ${PUBLICA} en el hosting.`]) caso(`no marca: ${linea.replace(PUBLICA, '…')}`, motivos(linea), [])

// ── Historial de git ──
const hallados = (texto) => revisarTexto(texto).hallazgos.map((h) => h.motivo)
const armar = (...partes) => partes.join('')
si('historial: clave privada', hallados(armar('-----BEGIN RSA PRIVATE ', 'KEY-----')).includes('clave privada'))
si('historial: conexión a la base con contraseña', hallados(armar('postgres', '://usuario:Clave123@db.ejemplo.com/postgres')).length === 1)
caso('historial: una conexión con el lugar de la contraseña sin completar no cuenta', hallados(armar('postgres', '://usuario:[CONTRASEÑA]@db.ejemplo.com/postgres')), [])
si('historial: token de GitHub', hallados(armar('ghp', '_', 'a'.repeat(36))).includes('token de GitHub'))
si('historial: variable de entorno sensible con valor', hallados(armar('TEST_USER1_PASS', 'WORD=Clave-De-Antes1!')).length === 1)
for (const linea of ['TEST_USER1_PASSWORD=', 'DEMO_PASSWORD=""', 'const PASSWORD_MINIMO = 12', 'if (PASSWORD_X === otra) {}']) caso(`historial: no marca "${linea.split('=')[0]}"`, hallados(linea), [])
const publica = revisarTexto(armar('sb_publi', 'shable_', 'a'.repeat(24)))
caso('historial: la clave publishable es aviso, no falla', [publica.hallazgos.length, publica.avisos.length], [0, 1])
si('historial: nunca devuelve el valor encontrado', !JSON.stringify(revisarTexto(armar('TEST_PASS', 'WORD=Valor-Que-No-Sale1'))).includes('Valor-Que-No-Sale1'))

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
