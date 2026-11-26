// Pruebas de los scripts de clientes (sin red): node scripts/probar-clientes.mjs
// Slug y email, contraseñas generadas, alta con fallos a mitad de camino, baja, argumentos,
// clave secreta, .env y detector de secretos. La "base" es de mentira: no toca Supabase.
import { argumentos } from './clientes/consola.mjs'
import { leerEntorno } from './clientes/clave.mjs'
import { cambiarEstado, darDeAlta, darDeBaja, ErrorDeUso, planDeAlta, planDeBaja, planDeEstado, planDePassword, regenerarPassword } from './clientes/operaciones.mjs'
import { direcciones, fichaDeAlta, generarContrasena, localNuevo, normalizarEmail, problemaDeEmail, problemaDeNombre, problemaDeSlug, SLUGS_RESERVADOS, TEMA_NEUTRO } from './clientes/reglas.mjs'
import { ponerVariables, quitarVariables } from './lib/env-archivo.mjs'
import { buscarSecretos, esClaveSecreta } from './lib/secretos.mjs'
import { faltantes } from '../src/admin/contrasena.js'
import { formularioHorarios, revisarContraste, temaDesdeFormulario, validarApariencia } from '../src/admin/ajustes.js'
import { COLORES_ORIGINALES, esColor } from '../src/lib/tema.js'
import { normalizarHorarios } from '../src/lib/horarios.js'

let total = 0
let fallos = 0
function caso(nombre, obtenido, esperado) {
  total++
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLÓ'} ${nombre}${ok ? '' : `\n        esperado: ${JSON.stringify(esperado)}\n        obtenido: ${JSON.stringify(obtenido)}`}`)
}
const si = (nombre, condicion) => caso(nombre, Boolean(condicion), true)
async function falla(nombre, promesa, patron) {
  try {
    await promesa()
    caso(nombre, 'no falló', `un error ${patron}`)
  } catch (error) {
    si(nombre, patron.test(error.message))
    return error
  }
}

// ── Slug, email y nombre ──
for (const bueno of ['abc', 'cafe-del-puerto', 'bar24', 'zz-prueba-cliente', 'a'.repeat(40)]) caso(`slug válido: ${bueno.slice(0, 20)}`, problemaDeSlug(bueno), '')
for (const malo of ['', 'ab', 'a'.repeat(41), 'Cafe', 'café', 'ñandu', 'con espacio', '-inicio', 'fin-', 'doble--guion', 'con_guion', 'punto.com', 'barra/x', '../x', 'ZZ-prueba']) {
  si(`slug inválido: ${JSON.stringify(malo.slice(0, 20))}`, problemaDeSlug(malo))
}
for (const reservado of ['admin', 'login', 'clientes', 'cuenta', 'api', 'assets', 'fonts', 'locales']) si(`slug reservado: ${reservado}`, /reservado/.test(problemaDeSlug(reservado)))
si('la lista de reservados incluye las rutas del panel', ['admin', 'login', 'clientes', 'cuenta'].every((s) => SLUGS_RESERVADOS.includes(s)))
caso('el email se recorta y pasa a minúsculas', normalizarEmail('  Dueño@X.COM '), 'dueño@x.com')
for (const bueno of ['a@b.co', 'juan.perez+menu@mi-cafe.com.ar', 'zz-prueba-editor@example.com']) caso(`email válido: ${bueno}`, problemaDeEmail(bueno), '')
for (const malo of ['', 'sin-arroba', 'a@b', 'a@@b.com', 'a b@c.com', 'a@b..com', '.a@b.com', 'a.@b.com', 'a..b@c.com', 'a@-b.com', 'a@b-.com', 'dueño@x.com', 'a@b.c', `${'a'.repeat(65)}@b.com`, `a@${'b'.repeat(250)}.com`, 'a@b.com\nbcc@c.com']) {
  si(`email inválido: ${JSON.stringify(malo.slice(0, 24))}`, problemaDeEmail(malo))
}
caso('nombre válido', problemaDeNombre('Café del Puerto'), '')
for (const malo of ['', '   ', 'a'.repeat(61), 'dos\nlíneas', 'con\ttab']) si(`nombre inválido: ${JSON.stringify(malo.slice(0, 12))}`, problemaDeNombre(malo))

// ── Contraseñas generadas ──
const generadas = Array.from({ length: 2000 }, () => generarContrasena())
si('2000 contraseñas cumplen la política', generadas.every((c) => faltantes(c).length === 0))
si('todas de 16 caracteres y distintas', generadas.every((c) => c.length === 16) && new Set(generadas).size === 2000)
si('sin caracteres que se confunden (0 O 1 l I)', generadas.every((c) => !/[0O1lI]/.test(c)))
si('sin caracteres que WhatsApp o el .env rompen (* _ ~ ` comillas barras espacios)', generadas.every((c) => !/[*_~`"'\\/| <>]/.test(c)))
si('el primer carácter varía (están mezcladas)', new Set(generadas.map((c) => (/[a-z]/.test(c[0]) ? 'a' : /[A-Z]/.test(c[0]) ? 'A' : /\d/.test(c[0]) ? '1' : '#'))).size === 4)
caso('largo de 32 a pedido', generarContrasena(32).length, 32)
for (const largo of [11, 65, 12.5]) await falla(`largo ${largo}: rechazado`, async () => generarContrasena(largo), /largo/)

// ── Local nuevo y ficha ──
const nuevo = localNuevo({ nombre: '  Mi Café ', slug: 'mi-cafe' })
caso('nace inactivo, sin textos ni horarios inventados', [nuevo.activo, nuevo.nombre, nuevo.horarios, nuevo.descripcion, nuevo.logo_url, nuevo.aviso_activo], [false, 'Mi Café', {}, null, null, false])
si('el tema neutro usa colores válidos y distintos de los de Aroma', Object.entries(TEMA_NEUTRO).every(([k, v]) => esColor(v) && v !== COLORES_ORIGINALES[k]))
const apariencia = { frase: '', ...TEMA_NEUTRO }
si('el tema neutro se puede guardar desde Ajustes y todo se lee', validarApariencia(apariencia).ok && revisarContraste(apariencia).filas.every((f) => f.nivel === 'bien'))
caso('Ajustes lo vuelve a guardar igual', temaDesdeFormulario(apariencia), TEMA_NEUTRO)
si('sin horarios: el menú no los muestra y el panel los puede abrir', normalizarHorarios(nuevo.horarios) === null && Boolean(formularioHorarios(nuevo.horarios).lunes))
caso('direcciones sin barras dobles', direcciones('https://menu.oestack.com/', 'mi-cafe'), { menu: 'https://menu.oestack.com/mi-cafe', panel: 'https://menu.oestack.com/admin' })
const SECRETA = 'Ab3#clave-temporal'
const ficha = fichaDeAlta({ nombre: 'Mi Café', slug: 'mi-cafe', email: 'a@b.com', contrasena: SECRETA, urlPublica: 'https://x.com' })
si('la ficha trae enlaces, email, contraseña y que la cambie en "Mi cuenta"', ['https://x.com/mi-cafe', 'https://x.com/admin', 'a@b.com', SECRETA, 'Mi cuenta'].every((t) => ficha.includes(t)))
si('la ficha no habla de la clave secreta (se le manda al cliente)', !/secret|service|supabase|\.env/i.test(ficha))
const fichaExistente = fichaDeAlta({ nombre: 'X', slug: 'x-x', email: 'a@b.com', contrasena: null })
si('con usuario existente no hay contraseña temporal', !fichaExistente.includes('temporal') && fichaExistente.includes('la que ya usás'))

// ── Base de mentira ──
function baseFalsa({ locales = [], usuarios = [], miembros = [], admins = [], contenido = {}, archivos = {} } = {}) {
  const estado = { locales: structuredClone(locales), usuarios: structuredClone(usuarios), miembros: structuredClone(miembros), admins: [...admins], archivos: structuredClone(archivos), escrituras: [], fallar: {} }
  let n = 0
  // fallar[op] = 'antes' (no hace nada) o 'despues' (lo hace y se pierde la respuesta)
  const escribir = (op, hacer) => {
    const modo = estado.fallar[op]
    if (modo === 'antes') throw new Error(`falla ${op}`)
    estado.escrituras.push(op)
    const r = hacer()
    if (modo === 'despues') throw new Error(`falla ${op}`)
    return r
  }
  return {
    estado,
    buscarLocal: async (slug) => estado.locales.find((l) => l.slug === slug) ?? null,
    crearLocal: async (fila) => escribir('crearLocal', () => (estado.locales.push({ id: `L${++n}`, ...fila }), estado.locales.at(-1))),
    borrarLocal: async (id) => escribir('borrarLocal', () => {
      estado.locales = estado.locales.filter((l) => l.id !== id)
      estado.miembros = estado.miembros.filter((m) => m.local_id !== id)
    }),
    cambiarActivo: async (id, activo) => escribir('cambiarActivo', () => Object.assign(estado.locales.find((l) => l.id === id), { activo })),
    contenidoDeLocal: async (id) => contenido[id] ?? { categorias: 0, productos: 0 },
    archivosDe: async (id) => estado.archivos[id] ?? [],
    borrarArchivos: async (rutas) => escribir('borrarArchivos', () => { for (const k of Object.keys(estado.archivos)) estado.archivos[k] = estado.archivos[k].filter((r) => !rutas.includes(r)) }),
    buscarUsuario: async (email) => estado.usuarios.find((u) => u.email === email) ?? null,
    crearUsuario: async (email, password) => escribir('crearUsuario', () => (estado.usuarios.push({ id: `U${++n}`, email, password }), { id: `U${n}`, email })),
    borrarUsuario: async (id) => escribir('borrarUsuario', () => {
      estado.usuarios = estado.usuarios.filter((u) => u.id !== id)
      estado.miembros = estado.miembros.filter((m) => m.user_id !== id)
    }),
    cambiarPassword: async (id, password) => escribir('cambiarPassword', () => { estado.usuarios.find((u) => u.id === id).password = password }),
    miembrosDeLocal: async (id) => estado.miembros.filter((m) => m.local_id === id).map((m) => ({ user_id: m.user_id, rol: m.rol, email: estado.usuarios.find((u) => u.id === m.user_id)?.email })),
    membresiasDe: async (id) => estado.miembros.filter((m) => m.user_id === id).map((m) => ({ local_id: m.local_id, rol: m.rol, slug: estado.locales.find((l) => l.id === m.local_id)?.slug })),
    agregarMiembro: async (user_id, local_id, rol) => escribir('agregarMiembro', () => void estado.miembros.push({ user_id, local_id, rol })),
    esAdmin: async (id) => admins.includes(id),
  }
}
const foto = (base) => JSON.stringify([base.estado.locales, base.estado.usuarios, base.estado.miembros])
const PEDIDO = { nombre: 'Mi Café', slug: 'mi-cafe', email: 'Dueno@Ejemplo.com' }

// ── Alta ──
let base = baseFalsa()
let plan = await planDeAlta(base, PEDIDO)
caso('planificar no escribe nada', [plan.tipo, plan.pasos.length, base.estado.escrituras], ['alta', 3, []])
let r = await darDeAlta(base, plan)
caso('alta: local, usuario y membresía, en ese orden', base.estado.escrituras, ['crearLocal', 'crearUsuario', 'agregarMiembro'])
si('el local queda inactivo, el dueño es owner y la contraseña cumple', base.estado.locales[0].activo === false && base.estado.miembros[0].rol === 'owner' && faltantes(r.contrasena).length === 0 && base.estado.usuarios[0].email === 'dueno@ejemplo.com')
si('la contraseña no queda en el plan', !JSON.stringify(plan).includes(r.contrasena))
plan = await planDeAlta(base, PEDIDO)
caso('repetir el mismo alta no hace nada', [plan.tipo, plan.pasos], ['nada', []])
await falla('mismo slug con otro email: rechazado', () => planDeAlta(base, { ...PEDIDO, email: 'otro@ejemplo.com' }), /Ya existe un local/)

for (const [op, modo] of [['crearLocal', 'antes'], ['crearLocal', 'despues'], ['crearUsuario', 'antes'], ['crearUsuario', 'despues'], ['agregarMiembro', 'antes'], ['agregarMiembro', 'despues']]) {
  base = baseFalsa()
  plan = await planDeAlta(base, PEDIDO)
  base.estado.fallar[op] = modo
  const error = await falla(`falla en ${op} (${modo}): avisa`, () => darDeAlta(base, plan), new RegExp(op))
  caso(`falla en ${op} (${modo}): no queda nada creado`, [foto(base), error.quedo], [JSON.stringify([[], [], []]), []])
}
base = baseFalsa()
plan = await planDeAlta(base, PEDIDO)
base.estado.fallar = { agregarMiembro: 'antes', borrarUsuario: 'antes' }
let error = await falla('si tampoco puede deshacer: avisa', () => darDeAlta(base, plan), /agregarMiembro/)
si('y dice qué quedó y con qué comando limpiarlo', error.quedo.length === 1 && /usuario dueno@ejemplo\.com/.test(error.quedo[0].que) && /cliente:baja -- --email/.test(error.quedo[0].como) && base.estado.locales.length === 0)

const conUsuario = { usuarios: [{ id: 'U9', email: 'dueno@ejemplo.com', password: 'la-suya' }] }
await falla('email existente sin --usuario-existente: rechazado', () => planDeAlta(baseFalsa(conUsuario), PEDIDO), /--usuario-existente/)
await falla('--usuario-existente con email inexistente: rechazado', () => planDeAlta(baseFalsa(), { ...PEDIDO, usuarioExistente: true }), /no hay ningún usuario/)
base = baseFalsa(conUsuario)
r = await darDeAlta(base, await planDeAlta(base, { ...PEDIDO, usuarioExistente: true }))
caso('usuario existente: se vincula sin tocar su contraseña', [r.contrasena, base.estado.usuarios[0].password, base.estado.escrituras], [null, 'la-suya', ['crearLocal', 'agregarMiembro']])
base = baseFalsa(conUsuario)
plan = await planDeAlta(base, { ...PEDIDO, usuarioExistente: true })
base.estado.fallar.agregarMiembro = 'antes'
await falla('con usuario existente, si falla...', () => darDeAlta(base, plan), /agregarMiembro/)
caso('...NO borra al usuario que ya estaba', [base.estado.usuarios.length, base.estado.locales.length], [1, 0])

const aMedias = { locales: [{ id: 'L0', slug: 'mi-cafe', nombre: 'Mi Café', activo: false }] }
base = baseFalsa(aMedias)
plan = await planDeAlta(base, PEDIDO)
await darDeAlta(base, plan)
caso('un alta a medias (local vacío, sin nadie) se completa', [plan.tipo, base.estado.escrituras], ['completar', ['crearUsuario', 'agregarMiembro']])
base = baseFalsa(aMedias)
plan = await planDeAlta(base, PEDIDO)
base.estado.fallar.agregarMiembro = 'antes'
await falla('si falla al completar...', () => darDeAlta(base, plan), /agregarMiembro/)
caso('...no borra el local que no creó esta corrida', [base.estado.locales.length, base.estado.usuarios.length], [1, 0])
for (const [caso_, extra] of [
  ['activo', { locales: [{ id: 'L0', slug: 'mi-cafe', nombre: 'Mi Café', activo: true }] }],
  ['con productos', { ...aMedias, contenido: { L0: { categorias: 1, productos: 2 } } }],
  ['con otro nombre', { locales: [{ id: 'L0', slug: 'mi-cafe', nombre: 'Otro', activo: false }] }],
  ['con otro miembro', { ...aMedias, miembros: [{ user_id: 'X', local_id: 'L0', rol: 'owner' }] }],
]) await falla(`un local existente ${caso_} no se toma como alta a medias`, () => planDeAlta(baseFalsa(extra), PEDIDO), /Ya existe un local/)
await falla('local-prueba nunca se "completa"', () => planDeAlta(baseFalsa({ locales: [{ id: 'P', slug: 'local-prueba', nombre: 'X', activo: false }] }), { nombre: 'X', slug: 'local-prueba', email: 'a@b.com' }), /Ya existe un local/)
await falla('datos inválidos: ni siquiera consulta', () => planDeAlta({}, { ...PEDIDO, slug: 'admin' }), /reservado/)

// ── Contraseña y estado ──
base = baseFalsa({ ...conUsuario, admins: [] })
const planP = await planDePassword(base, { email: ' DUENO@ejemplo.com ' })
r = await regenerarPassword(base, planP)
si('contraseña nueva: reemplaza la anterior y cumple', base.estado.usuarios[0].password === r.contrasena && faltantes(r.contrasena).length === 0)
await falla('usuario inexistente', () => planDePassword(base, { email: 'nadie@x.com' }), /No hay ningún usuario/)
base = baseFalsa(aMedias)
let planE = await planDeEstado(base, { slug: 'mi-cafe', activo: 'si' })
await cambiarEstado(base, planE)
caso('activar', [base.estado.locales[0].activo, planE.sinCambios, planE.protegido], [true, false, false])
caso('pedir lo que ya está', (await planDeEstado(base, { slug: 'mi-cafe', activo: 'activar' })).sinCambios, true)
await falla('estado sin indicar', () => planDeEstado(base, { slug: 'mi-cafe', activo: 'quizás' }), /--activo/)
await falla('local inexistente', () => planDeEstado(base, { slug: 'nada', activo: 'no' }), /No hay ningún local/)
si('aroma figura como protegido', (await planDeEstado(baseFalsa({ locales: [{ id: 'A', slug: 'aroma', activo: true }] }), { slug: 'aroma', activo: 'no' })).protegido)

// ── Baja ──
const MUNDO = {
  locales: [{ id: 'L1', slug: 'mi-cafe', nombre: 'Mi Café', activo: false }, { id: 'A', slug: 'aroma', nombre: 'Aroma', activo: true }, { id: 'L2', slug: 'otro-bar', nombre: 'Otro', activo: true }],
  usuarios: [{ id: 'U1', email: 'solo@x.com' }, { id: 'U2', email: 'dos@x.com' }, { id: 'U3', email: 'jefa@x.com' }, { id: 'U4', email: 'demo@x.com' }],
  miembros: [{ user_id: 'U1', local_id: 'L1', rol: 'owner' }, { user_id: 'U2', local_id: 'L1', rol: 'editor' }, { user_id: 'U2', local_id: 'L2', rol: 'owner' }, { user_id: 'U3', local_id: 'L1', rol: 'owner' }, { user_id: 'U4', local_id: 'A', rol: 'owner' }],
  admins: ['U3'],
  contenido: { L1: { categorias: 2, productos: 3 } },
  archivos: { L1: ['L1/productos/a.webp', 'L1/logo/b.webp'] },
}
base = baseFalsa(MUNDO)
let planB = await planDeBaja(base, { slug: 'mi-cafe' })
caso('sin --con-usuarios solo se borra el local; avisa quién queda sin local', [planB.usuarios, planB.quedanSinLocal, planB.confirmacion, base.estado.escrituras], [[], ['solo@x.com'], 'mi-cafe', []])
planB = await planDeBaja(base, { slug: 'mi-cafe', conUsuarios: true })
caso('con --con-usuarios: solo quien queda sin nada (ni otro local ni admin)', planB.usuarios.map((u) => u.email), ['solo@x.com'])
let baja = await darDeBaja(base, planB)
caso('orden seguro: base, archivos, usuarios', base.estado.escrituras, ['borrarLocal', 'borrarArchivos', 'borrarUsuario'])
caso('queda lo ajeno', [base.estado.locales.map((l) => l.slug), base.estado.usuarios.map((u) => u.email), baja.quedo], [['aroma', 'otro-bar'], ['dos@x.com', 'jefa@x.com', 'demo@x.com'], []])
for (const slug of ['aroma', 'local-prueba']) {
  await falla(`no borra ${slug} sin el flag`, () => planDeBaja(baseFalsa({ locales: [{ id: 'A', slug }] }), { slug }), /--permitir-protegidos/)
}
si('con el flag sí lo planifica', (await planDeBaja(baseFalsa(MUNDO), { slug: 'aroma', permitirProtegidos: true })).local.slug === 'aroma')
await falla('no borra un usuario de la demo sin el flag', () => planDeBaja(baseFalsa(MUNDO), { email: 'demo@x.com' }), /--permitir-protegidos/)
await falla('no borra un admin sin el flag', () => planDeBaja(baseFalsa(MUNDO), { email: 'jefa@x.com' }), /es admin/)
planB = await planDeBaja(baseFalsa(MUNDO), { email: 'dos@x.com' })
caso('solo usuario: muestra sus otros locales y se confirma con el email', [planB.usuarios[0].otrosLocales, planB.confirmacion, planB.local], [['mi-cafe', 'otro-bar'], 'dos@x.com', null])
await falla('baja sin decir qué', () => planDeBaja(baseFalsa(MUNDO), {}), /Indicá qué borrar/)
base = baseFalsa(MUNDO)
planB = await planDeBaja(base, { slug: 'mi-cafe', conUsuarios: true })
base.estado.fallar.borrarLocal = 'antes'
await falla('si no puede borrar el local, no toca nada más', () => darDeBaja(base, planB), /borrarLocal/)
caso('(ni archivos ni usuarios)', base.estado.escrituras, [])
base.estado.fallar = { borrarArchivos: 'antes', borrarUsuario: 'antes' }
baja = await darDeBaja(base, planB)
si('si fallan archivos y usuario, lista lo que quedó', baja.quedo.length === 3 && baja.quedo.filter((x) => x.includes('Storage')).length === 2 && baja.quedo.some((x) => x.includes('solo@x.com')))
si('los errores esperables son ErrorDeUso', (await planDeBaja(baseFalsa(), { slug: 'x' }).catch((e) => e)) instanceof ErrorDeUso)

// ── Argumentos ──
const OPCIONES = { slug: { type: 'string' }, 'con-usuarios': { type: 'boolean' } }
caso('argumentos normales', { ...argumentos(OPCIONES, ['--slug', 'x', '--dry-run', '--con-usuarios'], {}) }, { slug: 'x', 'dry-run': true, 'con-usuarios': true })
caso('si npm se quedó con --dry-run, igual no se escribe', { ...argumentos(OPCIONES, [], { npm_config_dry_run: 'true' }) }, { 'dry-run': true })
await falla('si npm se quedó con otra opción, frena', async () => argumentos(OPCIONES, [], { npm_config_slug: 'x' }), /npm se quedó/)
await falla('un valor suelto (se perdió el nombre de la opción), frena', async () => argumentos(OPCIONES, ['mi-cafe'], {}), /PowerShell/)
await falla('una opción desconocida, frena', async () => argumentos(OPCIONES, ['--forzar'], {}), /No entendí/)

// ── Clave secreta ──
// Las claves de mentira se arman por partes: este archivo no tiene que disparar el detector.
const NUEVA = ['sb', 'secret', 'A1b2C3d4E5f6G7h8I9j0K1l2'].join('_')
const jwt = (rol) => [{ alg: 'HS256' }, { role: rol, iss: 'supabase' }].map((x) => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.firmaDeMentira123'
const SERVICIO = jwt(['service', 'role'].join('_'))
const ANONIMA = jwt('anon')
si('reconoce la clave nueva y la service_role', esClaveSecreta(NUEVA) && esClaveSecreta(SERVICIO))
si('la anon y la publishable no son secretas', !esClaveSecreta(ANONIMA) && !esClaveSecreta('sb_publishable_A1b2C3d4E5f6G7h8'))
const entorno = { VITE_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: NUEVA, VITE_SUPABASE_ANON_KEY: ANONIMA }
caso('entorno correcto', Object.keys(leerEntorno(entorno)), ['url', 'clave'])
for (const [nombre, cambio, patron] of [
  ['sin clave: explica cómo conseguirla', { SUPABASE_SECRET_KEY: '' }, /API Keys/],
  ['con la anon en su lugar', { SUPABASE_SECRET_KEY: ANONIMA }, /no es una clave secreta/],
  ['sin URL', { VITE_SUPABASE_URL: '' }, /VITE_SUPABASE_URL/],
  ['secreta pegada en la VITE_ de la anon: frena', { VITE_SUPABASE_ANON_KEY: NUEVA }, /PELIGRO/],
  ['service_role en una VITE_ cualquiera: frena', { VITE_OTRA: SERVICIO }, /PELIGRO/],
]) {
  const e = await falla(nombre, async () => leerEntorno({ ...entorno, ...cambio }), patron)
  si(`  (el mensaje no muestra claves)`, !e.message.includes(NUEVA) && !e.message.includes(SERVICIO))
}

// ── Detector de secretos ──
const motivos = (texto, opciones) => buscarSecretos(texto, opciones).map((h) => h.motivo)
si('detecta una clave nueva', motivos(`const k = '${NUEVA}'`).length >= 1)
si('detecta un JWT service_role', motivos(`key=${SERVICIO}`).some((m) => m.includes('JWT')))
caso('un JWT anon no es hallazgo', motivos(`VITE_SUPABASE_ANON_KEY=${ANONIMA}`), [])
caso('mencionar el prefijo o el rol en documentación no es hallazgo', motivos('Empieza con sb_secret_ (o la service_role antigua).\ngrant select on t to service_role;\nSUPABASE_SECRET_KEY=\ne.startsWith(`sb_secret_`)'), [])
si('detecta la variable con valor', motivos(`SUPABASE_SECRET_KEY="${NUEVA}"`).some((m) => m.includes('con valor')))
si('detecta un nombre VITE_ con secreto', motivos(['VITE_SUPABASE', 'SECRET_KEY=x'].join('_')).some((m) => m.includes('VITE_')))
const conValor = buscarSecretos('uno\ndos contraseña-real-123 tres', { valores: [{ nombre: 'TEST_X_PASSWORD', valor: 'contraseña-real-123' }] })
caso('busca los valores del .env y no repite el valor en el hallazgo', conValor, [{ linea: 2, motivo: 'valor de TEST_X_PASSWORD del .env' }])

// ── .env ──
const ENV = '# comentario\r\nA=1\r\nTEST_EDITOR_EMAIL=\r\n'
const escrito = ponerVariables(ENV, { TEST_EDITOR_EMAIL: 'e@x.com', TEST_EDITOR_PASSWORD: 'Ab#1=x$y' })
caso('reemplaza, agrega, conserva el resto y los CRLF', escrito, '# comentario\r\nA=1\r\nTEST_EDITOR_EMAIL="e@x.com"\r\nTEST_EDITOR_PASSWORD="Ab#1=x$y"\r\n')
caso('quitar deja lo demás igual', quitarVariables(escrito, ['TEST_EDITOR_EMAIL', 'TEST_EDITOR_PASSWORD']), '# comentario\r\nA=1\r\n')
for (const malo of ['con"comilla', 'dos\nlineas', 'barra\\']) await falla(`valor que rompería el .env: ${JSON.stringify(malo)}`, async () => ponerVariables('', { X: malo }), /No se puede guardar/)

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
