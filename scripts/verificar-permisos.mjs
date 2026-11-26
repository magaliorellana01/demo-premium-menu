// Comprueba contra Supabase REAL que el aislamiento entre locales funciona (RLS), usando SOLO la
// clave pública (anon) y las credenciales de dos usuarios de prueba:
//
//   usuario 1 = owner de "aroma"                (TEST_USER1_EMAIL / TEST_USER1_PASSWORD)
//   usuario 2 = owner solo de "local-prueba"    (TEST_USER2_EMAIL / TEST_USER2_PASSWORD)
//   anónimo   = sin sesión
//   editor    = editor solo de "local-prueba" (TEST_EDITOR_*)  } opcionales: los crea y los borra
//   admin     = admin de OESTACK de pruebas   (TEST_ADMIN_*)   } npm run pruebas:usuarios
//
// Requiere haber corrido supabase/08-admin-base.sql, 09-admin-categorias.sql,
// 10-admin-productos.sql, 11-admin-ajustes.sql y 12-admin-clientes.sql.
// Uso:  npm run verificar:permisos
//
// Las credenciales salen de .env (que no se versiona); las contraseñas nunca se imprimen.
//
// Seguridad de la prueba: nada se borra ni se pisa de forma permanente. Las escrituras permitidas
// son "no-ops" (se escribe el mismo valor) o filas temporales (nombre "ZZ-prueba-permisos-...") que
// quedan INACTIVAS y se borran al final. Los intentos de borrar algo ajeno apuntan solo a esas filas
// temporales o al local de prueba, jamás a datos reales de aroma. Al terminar se comprueba que no
// quedó basura (filas ni archivos de Storage, que usan el mismo prefijo) y que todo está como estaba.
//
// Los ajustes del local se prueban sobre las filas REALES de aroma y local-prueba (no hay otra
// forma): antes se copian, también a un archivo en la carpeta temporal del sistema, y al final
// se restauran. Si una corrida se corta, la siguiente restaura desde ese archivo antes de nada.
// Lo único que no vuelve atrás es updated_at (lo pone la base). El slug y el estado activo solo
// se INTENTAN cambiar: tienen que ser rechazados.
//
// El admin prueba "activo" SOLO sobre un local temporal (slug zz-prueba-permisos-...) que crea y
// borra: nunca activa ni desactiva aroma ni local-prueba. Acá nunca se usa la clave secreta.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: clave } = process.env
const credenciales = {
  u1: [process.env.TEST_USER1_EMAIL, process.env.TEST_USER1_PASSWORD],
  u2: [process.env.TEST_USER2_EMAIL, process.env.TEST_USER2_PASSWORD],
}
const faltan = [
  !url && 'VITE_SUPABASE_URL',
  !clave && 'VITE_SUPABASE_ANON_KEY',
  !credenciales.u1[0] && 'TEST_USER1_EMAIL',
  !credenciales.u1[1] && 'TEST_USER1_PASSWORD',
  !credenciales.u2[0] && 'TEST_USER2_EMAIL',
  !credenciales.u2[1] && 'TEST_USER2_PASSWORD',
].filter(Boolean)
if (faltan.length > 0) {
  console.error(`Faltan variables en .env: ${faltan.join(', ')} (ver .env.example y el README, "Usuarios del panel").`)
  process.exit(1)
}

// Sin "_" ni "%": en LIKE son comodines, y este prefijo se usa para BORRAR por patrón.
const PREFIJO = 'ZZ-prueba-permisos-'
const UUID_INEXISTENTE = '00000000-0000-0000-0000-000000000000'
const PNG_MINIMO = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

const WEBP_MINIMO = new Uint8Array(await sharp({ create: { width: 8, height: 10, channels: 3, background: '#b6784f' } }).webp().toBuffer())

const crear = () => createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const anon = crear()
const c1 = crear()
const c2 = crear()
const c3 = crear() // editor
const c4 = crear() // admin
const par = (nombre) => [process.env[`TEST_${nombre}_EMAIL`], process.env[`TEST_${nombre}_PASSWORD`]]
const opcionales = { editor: par('EDITOR'), admin: par('ADMIN') }
const hayEditor = opcionales.editor.every(Boolean)
const hayAdmin = opcionales.admin.every(Boolean)
const salteadas = []
const SLUG_TEMPORAL = 'zz-prueba-permisos-local'

let fallos = 0
let total = 0
function ver(ok, titulo, detalle = '') {
  total++
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${titulo}${detalle ? `  →  ${detalle}` : ''}`)
}
// Una escritura "bloqueada": error de la base, o ninguna fila afectada.
const bloqueada = (r) => Boolean(r.error) || !r.data || (Array.isArray(r.data) && r.data.length === 0)
const permitida = (r) => !r.error && Array.isArray(r.data) && r.data.length >= 1
const msg = (r) => (r.error ? `${r.error.code ?? ''} ${r.error.message}`.trim() : 'sin filas afectadas')
const msgOk = (r) => (r.error ? `ERROR ${r.error.code ?? ''} ${r.error.message}`.trim() : `${r.data?.length ?? 0} fila(s)`)
const seccion = (t) => console.log(`\n— ${t} —`)

// Intentos de escritura, con el error de red (fetch) tratado como excepción real.
async function contar(cliente, tabla, filtro) {
  let q = cliente.from(tabla).select('*', { count: 'exact', head: true })
  for (const [col, val] of Object.entries(filtro ?? {})) q = q.eq(col, val)
  const r = await q
  if (r.error) throw new Error(`No se pudo contar ${tabla}: ${r.error.message}`)
  return r.count
}

const contexto = { copias: null, restaurados: false, aroma: null, prueba: null, antes: null, fotoCategorias: null, categoriasAntes: null, fotoProductos: null, productosAntes: null, archivosAntes: null }
const creadas = { aroma: { categorias: [], productos: [] }, prueba: { categorias: [], productos: [] }, archivos: [] }

// Columnas de ajustes: las únicas que se escriben (y se restauran).
const AJUSTES = ['nombre', 'descripcion', 'direccion', 'whatsapp', 'instagram', 'horarios', 'aviso_texto', 'aviso_activo', 'tema', 'logo_url']
const COPIA = path.join(os.tmpdir(), 'oestack-copia-ajustes-locales.json')
const sinVersion = (fila) => JSON.stringify(fila, (k, v) => (k === 'updated_at' ? undefined : v))

/** Devuelve las filas de `copias` a como estaban. Devuelve los errores. */
async function restaurarLocales(copias) {
  const errores = []
  for (const [cliente, copia] of [[c1, copias.aroma], [c2, copias.prueba]]) {
    const cambios = Object.fromEntries(AJUSTES.map((c) => [c, copia[c]]))
    const r = await cliente.from('locales').update(cambios).eq('id', copia.id).select('*')
    if (r.error || r.data.length !== 1) errores.push(`${copia.slug}: ${r.error?.message ?? 'no se actualizó ninguna fila'}`)
    else if (sinVersion(r.data[0]) !== sinVersion(copia)) errores.push(`${copia.slug}: quedó distinto de la copia (revisá slug y activo)`)
  }
  return errores
}

async function limpiarTemporales() {
  // Borra todo lo que empiece con el prefijo en ambos locales (también restos de una corrida anterior).
  const errores = []
  if (contexto.admin) {
    // El local temporal del admin (se lleva sus categorías, productos y membresías).
    const t = await c4.from('locales').delete().like('slug', 'zz-prueba-permisos-%').select('id')
    if (t.error) errores.push(`local temporal: ${t.error.message}`)
  }
  for (const [cliente, nombre] of [[c1, 'aroma'], [c2, 'local-prueba']]) {
    const p = await cliente.from('productos').delete().like('nombre', `${PREFIJO}%`).select('id')
    if (p.error) errores.push(`productos (${nombre}): ${p.error.message}`)
    const c = await cliente.from('categorias').delete().like('nombre', `${PREFIJO}%`).select('id')
    if (c.error) errores.push(`categorias (${nombre}): ${c.error.message}`)
  }
  for (const [cliente, ruta] of creadas.archivos) {
    const r = await cliente.storage.from('imagenes').remove([ruta])
    if (r.error) errores.push(`archivo ${ruta}: ${r.error.message}`)
  }
  creadas.archivos.length = 0
  // Restos de archivos de prueba de cualquier corrida (también si se cortó antes de anotarlos).
  for (const [cliente, localId] of [[c1, contexto.aroma?.id], [c2, contexto.prueba?.id]]) {
    if (!localId) continue
    const restos = await archivosDePrueba(cliente, localId)
    if (restos.length) {
      const r = await cliente.storage.from('imagenes').remove(restos)
      if (r.error) errores.push(`archivos de ${localId}: ${r.error.message}`)
    }
  }
  return errores
}

/** Todos los archivos de la carpeta de un local (raíz, productos/ y logo/). */
async function archivosDe(cliente, localId) {
  const salida = []
  for (const carpeta of [localId, `${localId}/productos`, `${localId}/logo`]) {
    const r = await cliente.storage.from('imagenes').list(carpeta, { limit: 1000 })
    if (r.error) throw new Error(`No se pudo listar Storage: ${r.error.message}`)
    // Las "carpetas" vienen sin id.
    salida.push(...r.data.filter((o) => o.id).map((o) => `${carpeta}/${o.name}`))
  }
  return salida.sort()
}
const archivosDePrueba = async (cliente, localId) => (await archivosDe(cliente, localId)).filter((ruta) => ruta.split('/').pop().startsWith(PREFIJO))

async function entrar(cliente, [email, password], nombre) {
  const { data, error } = await cliente.auth.signInWithPassword({ email, password })
  ver(!error && Boolean(data.session), `${nombre}: iniciar sesión`, error ? `${error.code ?? ''} ${error.message} (revisá el usuario en Authentication y el .env)` : 'sesión creada')
  if (error) throw new Error(`No se pudo iniciar sesión como ${nombre}.`)
  return data.user.id
}

try {
  // Si una corrida anterior se cortó, primero se limpia lo que haya quedado (sin fallar si todavía no hay sesión).
  seccion('Preparación')
  const id1 = await entrar(c1, credenciales.u1, 'usuario 1')
  const id2 = await entrar(c2, credenciales.u2, 'usuario 2')
  ver(id1 !== id2, 'Los dos usuarios de prueba son personas distintas')
  if (hayAdmin) {
    await entrar(c4, opcionales.admin, 'admin de pruebas')
    contexto.admin = true
  }
  await limpiarTemporales()
  if (fs.existsSync(COPIA)) {
    const errores = await restaurarLocales(JSON.parse(fs.readFileSync(COPIA, 'utf8')))
    ver(errores.length === 0, 'Había una copia de una corrida cortada: se restauraron los locales', errores.join(' | ') || 'restaurados')
    if (errores.length) throw new Error(`No se pudo restaurar. La copia sigue en ${COPIA}`)
    fs.rmSync(COPIA)
  }

  // ── Datos de referencia (sin modificar nada) ─────────────────
  const aroma = (await anon.from('locales').select('id, slug, nombre, descripcion, activo').eq('slug', 'aroma').maybeSingle()).data
  const pruebaPorU2 = (await c2.from('locales').select('id, slug, nombre, descripcion, activo').eq('slug', 'local-prueba').maybeSingle()).data
  if (!aroma || !pruebaPorU2) {
    throw new Error('No se encontraron los locales "aroma" y/o "local-prueba". ¿Corriste supabase/08-admin-base.sql con los UUID correctos?')
  }
  const aromaCats = (await anon.from('categorias').select('id').eq('local_id', aroma.id)).data ?? []
  const aromaProd = (await anon.from('productos').select('id, precio, nombre').eq('local_id', aroma.id).limit(1)).data?.[0]
  const pruebaCats = (await c2.from('categorias').select('id, nombre').eq('local_id', pruebaPorU2.id)).data ?? []
  const pruebaProds = (await c2.from('productos').select('id, nombre, precio').eq('local_id', pruebaPorU2.id)).data ?? []
  ver(aromaCats.length > 0 && Boolean(aromaProd), 'Hay datos de referencia en aroma', `${aromaCats.length} categorías (públicas)`)
  ver(pruebaCats.length > 0 && pruebaProds.length > 0, 'Hay datos de referencia en local-prueba', `${pruebaCats.length} categoría(s), ${pruebaProds.length} producto(s)`)
  ver(pruebaPorU2.activo === false, 'El local de prueba está INACTIVO (como corresponde)')

  contexto.aroma = aroma
  contexto.prueba = pruebaPorU2
  const antes = {
    aroma: { cats: await contar(c1, 'categorias', { local_id: aroma.id }), prods: await contar(c1, 'productos', { local_id: aroma.id }) },
    prueba: { cats: await contar(c2, 'categorias', { local_id: pruebaPorU2.id }), prods: await contar(c2, 'productos', { local_id: pruebaPorU2.id }) },
  }
  contexto.antes = antes
  const fotoCategorias = async () => {
    const r = await c1.from('categorias').select('id, nombre, orden, activa, adicionales').eq('local_id', aroma.id).not('nombre', 'like', `${PREFIJO}%`).order('id')
    if (r.error) throw new Error(`No se pudieron leer las categorías de aroma: ${r.error.message}`)
    return JSON.stringify(r.data)
  }
  contexto.fotoCategorias = fotoCategorias
  contexto.categoriasAntes = await fotoCategorias()
  const fotoProductos = async () => {
    const r = await c1.from('productos').select('*').eq('local_id', aroma.id).not('nombre', 'like', `${PREFIJO}%`).order('id')
    if (r.error) throw new Error(`No se pudieron leer los productos de aroma: ${r.error.message}`)
    return JSON.stringify(r.data)
  }
  contexto.fotoProductos = fotoProductos
  contexto.productosAntes = await fotoProductos()
  await limpiarTemporales() // ahora con los ids: también limpia archivos de corridas anteriores
  contexto.archivosAntes = JSON.stringify(await archivosDe(c1, aroma.id))

  // ═══ USUARIO 1: owner de aroma ═══════════════════════════════
  seccion('Usuario 1 (owner de aroma): lo suyo')
  const mem1 = await c1.from('usuarios_locales').select('rol, local_id')
  ver(!mem1.error && mem1.data.length === 1 && mem1.data[0].local_id === aroma.id && mem1.data[0].rol === 'owner', 'Lee sus propias membresías (solo la de aroma, rol owner)', mem1.error ? msg(mem1) : `${mem1.data.length} fila(s)`)
  const adm1 = await c1.from('admins').select('user_id')
  ver(!adm1.error && adm1.data.length === 0, 'No figura como admin de OESTACK (la tabla admins no le devuelve filas)', adm1.error ? msg(adm1) : `${adm1.data.length} fila(s)`)
  const loc1 = await c1.from('locales').select('id, activo').eq('slug', 'aroma').maybeSingle()
  ver(!loc1.error && loc1.data?.id === aroma.id, 'Lee su local')
  ver((await contar(c1, 'categorias', { local_id: aroma.id })) === antes.aroma.cats && (await contar(c1, 'productos', { local_id: aroma.id })) === antes.aroma.prods, 'Lee las categorías y los productos de su local')

  // Escrituras permitidas, sin cambiar nada de forma permanente.
  let r = await c1.from('locales').update({ descripcion: aroma.descripcion }).eq('id', aroma.id).select('id')
  ver(permitida(r), 'Puede editar los datos de su local (escribe el mismo valor)', msgOk(r))
  r = await c1.from('productos').update({ precio: aromaProd.precio }).eq('id', aromaProd.id).select('id')
  ver(permitida(r), 'Puede editar un producto de su local (escribe el mismo valor)', msgOk(r))

  const nombreCat = `${PREFIJO}categoria`
  r = await c1.from('categorias').insert({ local_id: aroma.id, nombre: nombreCat, activa: false, orden: 999 }).select('id')
  const catTemp = r.data?.[0]?.id
  ver(permitida(r), 'Puede crear una categoría en su local (temporal e inactiva)', msgOk(r))
  if (catTemp) creadas.aroma.categorias.push(catTemp)
  r = catTemp ? await c1.from('productos').insert({ local_id: aroma.id, categoria_id: catTemp, nombre: `${PREFIJO}producto`, precio: 1, disponible: false }).select('id') : { error: { message: 'sin categoría' } }
  const prodTemp = r.data?.[0]?.id
  ver(permitida(r), 'Puede crear un producto en su local (temporal)', msgOk(r))
  if (prodTemp) creadas.aroma.productos.push(prodTemp)
  r = prodTemp ? await c1.from('productos').update({ descripcion: 'editado' }).eq('id', prodTemp).select('id') : { error: { message: 'sin producto' } }
  ver(permitida(r), 'Puede modificar ese producto temporal', msgOk(r))

  // Un producto en su local con una categoría de OTRO local: la base lo rechaza (clave foránea compuesta).
  r = await c1.from('productos').insert({ local_id: aroma.id, categoria_id: pruebaCats[0].id, nombre: `${PREFIJO}cruzado`, precio: 1, disponible: false }).select('id')
  ver(bloqueada(r), 'No puede mezclar: producto de aroma con una categoría de otro local', msg(r))

  // ── Lo que usuario 1 NO debe poder hacer sobre local-prueba ──
  seccion('Usuario 1: NO puede tocar el local de prueba')
  const loc1b = await c1.from('locales').select('id').eq('slug', 'local-prueba')
  ver(!loc1b.error && loc1b.data.length === 0, 'No ve el local de prueba (ni siquiera existe para él)', loc1b.error ? msg(loc1b) : `${loc1b.data.length} fila(s)`)
  ver((await c1.from('categorias').select('id').eq('local_id', pruebaPorU2.id)).data?.length === 0, 'No ve sus categorías')
  ver((await c1.from('productos').select('id').eq('local_id', pruebaPorU2.id)).data?.length === 0, 'No ve sus productos')

  r = await c1.from('locales').update({ nombre: 'Hackeado por usuario 1' }).eq('id', pruebaPorU2.id).select('id')
  ver(bloqueada(r), 'UPDATE del local de prueba (cambiar el nombre)', msg(r))
  r = await c1.from('locales').update({ activo: true }).eq('id', pruebaPorU2.id).select('id')
  ver(bloqueada(r), 'UPDATE del local de prueba (activarlo para que sea público)', msg(r))
  r = await c1.from('categorias').insert({ local_id: pruebaPorU2.id, nombre: `${PREFIJO}intrusa1`, activa: false }).select('id')
  ver(bloqueada(r), 'INSERT de una categoría en el local de prueba', msg(r))
  if (permitida(r)) creadas.prueba.categorias.push(r.data[0].id)
  r = await c1.from('productos').insert({ local_id: pruebaPorU2.id, categoria_id: pruebaCats[0].id, nombre: `${PREFIJO}intruso1`, precio: 1, disponible: false }).select('id')
  ver(bloqueada(r), 'INSERT de un producto en el local de prueba', msg(r))
  r = await c1.from('productos').update({ precio: 1 }).eq('id', pruebaProds[0].id).select('id')
  ver(bloqueada(r), 'UPDATE de un producto del local de prueba', msg(r))
  r = await c1.from('productos').delete().eq('id', pruebaProds[0].id).select('id')
  ver(bloqueada(r), 'DELETE de un producto del local de prueba', msg(r))
  r = await c1.from('categorias').update({ nombre: 'Hackeada' }).eq('id', pruebaCats[0].id).select('id')
  ver(bloqueada(r), 'UPDATE de una categoría del local de prueba', msg(r))
  r = await c1.from('locales').delete().eq('id', pruebaPorU2.id).select('id')
  ver(bloqueada(r), 'DELETE del local de prueba', msg(r))

  seccion('Usuario 1: no puede darse permisos ni crear locales')
  r = await c1.from('usuarios_locales').insert({ user_id: id1, local_id: pruebaPorU2.id, rol: 'owner' }).select()
  ver(bloqueada(r), 'Agregarse como miembro del local de prueba', msg(r))
  r = await c1.from('usuarios_locales').update({ local_id: pruebaPorU2.id }).eq('user_id', id1).select()
  ver(bloqueada(r), 'Mover su membresía al local de prueba', msg(r))
  r = await c1.from('usuarios_locales').update({ rol: 'owner' }).eq('user_id', id2).select()
  ver(bloqueada(r), 'Cambiar la membresía de otro usuario', msg(r))
  r = await c1.from('admins').insert({ user_id: id1 }).select()
  ver(bloqueada(r), 'Hacerse admin de OESTACK', msg(r))
  r = await c1.from('locales').insert({ slug: 'zz-prueba-permisos-1', nombre: 'Local intruso', activo: false }).select('id')
  ver(bloqueada(r), 'Crear un local nuevo', msg(r))
  if (permitida(r)) await c1.from('locales').delete().eq('id', r.data[0].id)

  // ═══ USUARIO 2: owner solo de local-prueba ═══════════════════
  seccion('Usuario 2 (owner de local-prueba): lo suyo')
  const mem2 = await c2.from('usuarios_locales').select('rol, local_id')
  ver(!mem2.error && mem2.data.length === 1 && mem2.data[0].local_id === pruebaPorU2.id, 'Lee sus propias membresías (solo la de local-prueba)', mem2.error ? msg(mem2) : `${mem2.data.length} fila(s)`)
  ver((await c2.from('admins').select('user_id')).data?.length === 0, 'No figura como admin de OESTACK')
  ver(pruebaCats.length >= 1 && pruebaProds.length >= 1, 'Lee su local aunque esté inactivo, con sus categorías y productos')
  r = await c2.from('locales').update({ descripcion: pruebaPorU2.descripcion }).eq('id', pruebaPorU2.id).select('id')
  ver(permitida(r), 'Puede editar los datos de su local (escribe el mismo valor)', msgOk(r))
  r = await c2.from('categorias').insert({ local_id: pruebaPorU2.id, nombre: `${PREFIJO}categoria2`, activa: false }).select('id')
  const catTemp2 = r.data?.[0]?.id
  ver(permitida(r), 'Puede crear una categoría en su local (temporal)', msgOk(r))
  if (catTemp2) creadas.prueba.categorias.push(catTemp2)
  r = catTemp2 ? await c2.from('productos').insert({ local_id: pruebaPorU2.id, categoria_id: catTemp2, nombre: `${PREFIJO}producto2`, precio: 1, disponible: false }).select('id') : { error: { message: 'sin categoría' } }
  ver(permitida(r), 'Puede crear un producto en su local (temporal)', msgOk(r))
  if (r.data?.[0]?.id) creadas.prueba.productos.push(r.data[0].id)

  seccion('Usuario 2: NO puede tocar aroma')
  ver(!(await c2.from('locales').select('id').eq('slug', 'aroma')).error, 'Puede ver el menú público de aroma (como cualquiera)')
  r = await c2.from('locales').update({ descripcion: aroma.descripcion }).eq('id', aroma.id).select('id')
  ver(bloqueada(r), 'UPDATE de los datos de aroma (mismo valor)', msg(r))
  r = await c2.from('locales').update({ activo: false }).eq('id', aroma.id).select('id')
  ver(bloqueada(r), 'UPDATE de aroma (desactivarlo)', msg(r))
  r = await c2.from('productos').update({ precio: aromaProd.precio }).eq('id', aromaProd.id).select('id')
  ver(bloqueada(r), 'UPDATE de un producto de aroma (mismo valor)', msg(r))
  r = await c2.from('productos').update({ descripcion: 'editado por usuario 2' }).eq('id', prodTemp ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'UPDATE de un producto temporal de aroma', msg(r))
  r = await c2.from('categorias').insert({ local_id: aroma.id, nombre: `${PREFIJO}intrusa2`, activa: false }).select('id')
  ver(bloqueada(r), 'INSERT de una categoría en aroma', msg(r))
  if (permitida(r)) creadas.aroma.categorias.push(r.data[0].id)
  r = await c2.from('productos').insert({ local_id: aroma.id, categoria_id: aromaCats[0].id, nombre: `${PREFIJO}intruso2`, precio: 1, disponible: false }).select('id')
  ver(bloqueada(r), 'INSERT de un producto en aroma', msg(r))
  if (permitida(r)) creadas.aroma.productos.push(r.data[0].id)
  r = await c2.from('productos').delete().eq('id', prodTemp ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'DELETE de un producto temporal de aroma', msg(r))
  r = await c2.from('categorias').delete().eq('id', catTemp ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'DELETE de una categoría temporal de aroma', msg(r))
  r = await c2.from('usuarios_locales').insert({ user_id: id2, local_id: aroma.id, rol: 'owner' }).select()
  ver(bloqueada(r), 'Agregarse como miembro de aroma', msg(r))
  const memAjenas = await c2.from('usuarios_locales').select('user_id').eq('local_id', aroma.id)
  ver(!memAjenas.error && memAjenas.data.length === 0, 'No ve quiénes son los miembros de aroma', memAjenas.error ? msg(memAjenas) : `${memAjenas.data.length} fila(s)`)

  // ── Storage (imágenes): cada local solo sube a su carpeta ────
  seccion('Almacenamiento de imágenes (carpeta por local)')
  const miArchivo = `${aroma.id}/${PREFIJO}1.png`
  r = await c1.storage.from('imagenes').upload(miArchivo, PNG_MINIMO, { contentType: 'image/png', upsert: true })
  if (!r.error) creadas.archivos.push([c1, miArchivo])
  ver(!r.error, 'Usuario 1 puede subir un archivo a la carpeta de aroma (temporal)', r.error ? r.error.message : 'subido')
  const ajeno = `${pruebaPorU2.id}/${PREFIJO}2.png`
  r = await c1.storage.from('imagenes').upload(ajeno, PNG_MINIMO, { contentType: 'image/png', upsert: true })
  if (!r.error) creadas.archivos.push([c2, ajeno])
  ver(Boolean(r.error), 'Usuario 1 NO puede subir a la carpeta del local de prueba', r.error ? r.error.message : 'SE SUBIÓ (debería estar bloqueado)')
  const aAroma = `${aroma.id}/${PREFIJO}-2.png`
  r = await c2.storage.from('imagenes').upload(aAroma, PNG_MINIMO, { contentType: 'image/png', upsert: true })
  if (!r.error) creadas.archivos.push([c1, aAroma])
  ver(Boolean(r.error), 'Usuario 2 NO puede subir a la carpeta de aroma', r.error ? r.error.message : 'SE SUBIÓ (debería estar bloqueado)')
  r = await anon.storage.from('imagenes').upload(`${aroma.id}/${PREFIJO}-3.png`, PNG_MINIMO, { contentType: 'image/png' })
  if (!r.error) creadas.archivos.push([c1, `${aroma.id}/${PREFIJO}-3.png`])
  ver(Boolean(r.error), 'Un anónimo NO puede subir archivos', r.error ? r.error.message : 'SE SUBIÓ (debería estar bloqueado)')

  // ═══ CATEGORÍAS (Tarea 9) ════════════════════════════════════
  seccion('Categorías: usuario 1 en aroma (crear, editar, adicionales, borrar)')
  r = await c1.from('categorias').insert({ local_id: aroma.id, nombre: `${PREFIJO}vacia`, activa: false, orden: 998 }).select('id')
  const catVacia = r.data?.[0]?.id
  ver(permitida(r), 'Crea una categoría', msgOk(r))
  r = await c1.from('categorias').update({ nombre: `${PREFIJO}renombrada` }).eq('id', catVacia ?? UUID_INEXISTENTE).select('id, nombre')
  ver(permitida(r) && r.data[0].nombre === `${PREFIJO}renombrada`, 'Edita su nombre', msgOk(r))
  r = await c1.from('categorias').update({ adicionales: [{ nombre: 'Leche vegetal', precio: 600 }, { nombre: 'Shot extra', precio: 800.5 }] }).eq('id', catVacia ?? UUID_INEXISTENTE).select('adicionales')
  ver(permitida(r) && r.data[0].adicionales.length === 2, 'Guarda adicionales válidos', msgOk(r))
  const invalidos = {
    '9 adicionales (máximo 8)': Array.from({ length: 9 }, (_, i) => ({ nombre: `A${i}`, precio: 1 })),
    'precio negativo': [{ nombre: 'X', precio: -1 }],
    'precio como texto': [{ nombre: 'X', precio: '600' }],
    'sin nombre': [{ precio: 1 }],
    'no es una lista': { nombre: 'X', precio: 1 },
  }
  for (const [caso, adicionales] of Object.entries(invalidos)) {
    r = await c1.from('categorias').update({ adicionales }).eq('id', catVacia ?? UUID_INEXISTENTE).select('id')
    ver(r.error?.code === '23514', `La base rechaza adicionales inválidos: ${caso}`, msg(r))
  }
  r = await c1.from('categorias').delete().eq('id', catTemp ?? UUID_INEXISTENTE).select('id')
  ver(r.error?.code === '23503', 'NO puede borrar una categoría que tiene productos (clave foránea)', msg(r))
  r = await c1.from('categorias').update({ local_id: pruebaPorU2.id }).eq('id', catVacia ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'NO puede mover una categoría suya a un local ajeno', msg(r))
  r = await c1.from('categorias').insert({ local_id: pruebaPorU2.id, nombre: `${PREFIJO}ajena`, activa: false }).select('id')
  ver(bloqueada(r), 'NO puede crear una categoría con local_id ajeno', msg(r))
  if (permitida(r)) creadas.prueba.categorias.push(r.data[0].id)
  r = await c2.from('categorias').update({ nombre: `${PREFIJO}hack` }).eq('id', catVacia ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'Usuario 2 NO puede editar una categoría de aroma', msg(r))
  r = await c2.from('categorias').update({ adicionales: [] }).eq('id', catVacia ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'Usuario 2 NO puede cambiar adicionales de aroma', msg(r))
  r = await anon.from('categorias').update({ nombre: 'x' }).eq('id', catVacia ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'Un anónimo NO puede editar una categoría que existe', msg(r))
  r = await c1.from('categorias').delete().eq('id', catVacia ?? UUID_INEXISTENTE).select('id')
  ver(permitida(r), 'Borra una categoría vacía', msgOk(r))

  seccion('Reordenar categorías (función reordenar_categorias)')
  const ordenDe = async (cliente, localId) => {
    const q = await cliente.from('categorias').select('id, orden, nombre').eq('local_id', localId).order('orden').order('nombre')
    if (q.error) throw new Error(`No se pudo leer el orden: ${q.error.message}`)
    return q.data
  }
  const originalAroma = await ordenDe(c1, aroma.id) // incluye la temporal con productos
  const segunda = (await c1.from('categorias').insert({ local_id: aroma.id, nombre: `${PREFIJO}segunda`, activa: false, orden: 1000 }).select('id')).data?.[0]?.id
  const listaIds = (await ordenDe(c1, aroma.id)).map((c) => c.id)
  // Se intercambian SOLO las dos temporales (que quedan al final): las reales no cambian de lugar.
  const intercambiada = [...listaIds.slice(0, -2), listaIds.at(-1), listaIds.at(-2)]
  const rpc = await c1.rpc('reordenar_categorias', { p_local_id: aroma.id, p_ids: intercambiada })
  const falta = rpc.error?.code === 'PGRST202'
  ver(!rpc.error, 'Usuario 1 reordena las categorías de su local', rpc.error ? (falta ? 'la función no existe todavía: corré supabase/09-admin-categorias.sql' : msg(rpc)) : 'ok')

  // Sin la función, las pruebas de "NO puede" pasarían solas (darían error igual): solo valen si existe.
  if (!rpc.error) {
    const despues = await ordenDe(c1, aroma.id)
    ver(JSON.stringify(despues.map((c) => c.id)) === JSON.stringify(intercambiada), 'El orden guardado es exactamente el pedido')
    ver(despues.map((c) => c.orden).join() === despues.map((_, i) => i + 1).join(), 'No quedan órdenes repetidos (1, 2, 3...)', despues.map((c) => c.orden).join(','))

    const prueba = await ordenDe(c2, pruebaPorU2.id)
    const sinCambios = async () => JSON.stringify(await ordenDe(c1, aroma.id)) === JSON.stringify(despues)
    let x = await c1.rpc('reordenar_categorias', { p_local_id: aroma.id, p_ids: intercambiada.slice(1) })
    ver(x.error?.code === '22023' && (await sinCambios()), 'Lista incompleta: rechazada y nada cambia', msg(x))
    x = await c1.rpc('reordenar_categorias', { p_local_id: aroma.id, p_ids: [intercambiada[0], ...intercambiada.slice(0, -1)] })
    ver(x.error?.code === '22023' && (await sinCambios()), 'Ids repetidos: rechazada y nada cambia', msg(x))
    x = await c1.rpc('reordenar_categorias', { p_local_id: aroma.id, p_ids: [...intercambiada.slice(0, -1), prueba[0].id] })
    ver(x.error?.code === '22023' && (await sinCambios()), 'Un id de otro local en la lista: rechazada y nada cambia', msg(x))
    x = await c1.rpc('reordenar_categorias', { p_local_id: pruebaPorU2.id, p_ids: prueba.map((c) => c.id) })
    ver(x.error?.code === '42501', 'Usuario 1 NO puede reordenar el local de prueba', msg(x))
    x = await c2.rpc('reordenar_categorias', { p_local_id: aroma.id, p_ids: intercambiada })
    ver(x.error?.code === '42501' && (await sinCambios()), 'Usuario 2 NO puede reordenar aroma', msg(x))
    x = await anon.rpc('reordenar_categorias', { p_local_id: aroma.id, p_ids: intercambiada })
    ver(x.error?.code === '42501' && (await sinCambios()), 'Un anónimo NO puede ejecutar la función (sin permiso de ejecución)', msg(x))
    x = await c2.rpc('reordenar_categorias', { p_local_id: pruebaPorU2.id, p_ids: (await ordenDe(c2, pruebaPorU2.id)).map((c) => c.id) })
    ver(!x.error, 'Usuario 2 reordena su propio local', x.error ? msg(x) : 'ok')
  }
  // Borra la segunda temporal y restaura el orden que tenía cada categoría.
  if (segunda) await c1.from('categorias').delete().eq('id', segunda)
  for (const categoria of originalAroma) await c1.from('categorias').update({ orden: categoria.orden }).eq('id', categoria.id)

  // ═══ PRODUCTOS (Tarea 10) ════════════════════════════════════
  seccion('Productos: usuario 1 en aroma (crear, editar, borrar)')
  const catProd = (await c1.from('categorias').insert({ local_id: aroma.id, nombre: `${PREFIJO}productos`, activa: false, orden: 997 }).select('id')).data?.[0]?.id
  ver(Boolean(catProd), 'Categoría temporal para las pruebas de productos')
  const nuevoProducto = (extra = {}) => ({ local_id: aroma.id, categoria_id: catProd, nombre: `${PREFIJO}p`, precio: 100, disponible: false, ...extra })
  r = await c1.from('productos').insert(nuevoProducto({ nombre: `${PREFIJO}completo`, descripcion: 'prueba', precio: 1500.5, etiquetas: ['vegano'], variantes: [{ nombre: 'Chico', precio: 1500.5 }], orden: 1 })).select('*')
  const completo = r.data?.[0]?.id
  ver(permitida(r) && Number(r.data[0].precio) === 1500.5, 'Crea un producto con todos los campos', msgOk(r))
  r = await c1.from('productos').update({ nombre: `${PREFIJO}editado`, precio: 2000, disponible: true, destacado: true, variantes: [] }).eq('id', completo ?? UUID_INEXISTENTE).select('*')
  ver(permitida(r) && r.data[0].destacado === true, 'Edita nombre, precio, disponible y destacado (categoría oculta: no se ve en el menú)', msgOk(r))

  seccion('Productos: límites de la base (supabase/10-admin-productos.sql)')
  const rechazos = {
    'nombre de 61 caracteres': { nombre: PREFIJO.padEnd(61, 'x') },
    'nombre de solo espacios': { nombre: '    ' },
    'precio negativo': { precio: -1 },
    'precio "NaN"': { precio: 'NaN' },
    '5 variantes (máximo 4)': { variantes: Array.from({ length: 5 }, (_, i) => ({ nombre: `V${i}`, precio: 1 })) },
  }
  for (const [caso, cambio] of Object.entries(rechazos)) {
    r = await c1.from('productos').insert(nuevoProducto(cambio)).select('id')
    ver(r.error?.code === '23514', `La base rechaza: ${caso}`, r.error ? msg(r) : 'SE GUARDÓ')
    // Si entró (no debía), se borra ya: puede no llevar el prefijo.
    if (r.data?.[0]?.id) await c1.from('productos').delete().eq('id', r.data[0].id)
  }
  r = await c1.from('productos').insert(nuevoProducto({ nombre: PREFIJO.padEnd(60, 'x') })).select('id')
  ver(permitida(r), 'Acepta un nombre de exactamente 60 caracteres', msgOk(r))
  if (r.data?.[0]?.id) await c1.from('productos').delete().eq('id', r.data[0].id)
  r = await c1.from('categorias').insert({ local_id: aroma.id, nombre: PREFIJO.padEnd(61, 'x'), activa: false }).select('id')
  ver(r.error?.code === '23514', 'La base rechaza una categoría con nombre de 61 caracteres', r.error ? msg(r) : 'SE GUARDÓ')
  if (r.data?.[0]?.id) await c1.from('categorias').delete().eq('id', r.data[0].id)

  seccion('Productos: aislamiento entre locales')
  r = await c1.from('productos').insert(nuevoProducto({ categoria_id: pruebaCats[0].id })).select('id')
  ver(r.error?.code === '23503', 'categoria_id de otro local: rechazado al crear', msg(r))
  r = await c1.from('productos').update({ categoria_id: pruebaCats[0].id }).eq('id', completo ?? UUID_INEXISTENTE).select('id')
  ver(r.error?.code === '23503', 'categoria_id de otro local: rechazado al editar', msg(r))
  r = await c1.from('productos').update({ local_id: pruebaPorU2.id, categoria_id: pruebaCats[0].id }).eq('id', completo ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'Usuario 1 NO puede mover un producto suyo al local de prueba', msg(r))
  r = await c1.from('productos').upsert({ ...nuevoProducto(), id: pruebaProds[0].id }).select('id')
  ver(bloqueada(r), 'Usuario 1 NO puede apropiarse de un producto ajeno con upsert (mismo id)', msg(r))
  for (const cambio of [{ disponible: false }, { destacado: true }, { precio: 1 }, { imagen_url: null }]) {
    r = await c2.from('productos').update(cambio).eq('id', completo ?? UUID_INEXISTENTE).select('id')
    ver(bloqueada(r), `Usuario 2 NO puede cambiar ${Object.keys(cambio)[0]} de un producto de aroma`, msg(r))
  }
  r = await anon.from('productos').update({ disponible: false }).eq('id', completo ?? UUID_INEXISTENTE).select('id')
  ver(bloqueada(r), 'Un anónimo NO puede editar un producto de aroma', msg(r))
  r = await anon.from('productos').insert(nuevoProducto()).select('id')
  ver(bloqueada(r), 'Un anónimo NO puede crear productos', msg(r))

  seccion('Reordenar productos (función reordenar_productos)')
  const extra = []
  for (const orden of [2, 3]) {
    const alta = await c1.from('productos').insert(nuevoProducto({ nombre: `${PREFIJO}orden${orden}`, orden })).select('id')
    if (alta.data?.[0]?.id) extra.push(alta.data[0].id)
  }
  const ordenProductos = async (cliente, categoriaId) => {
    const q = await cliente.from('productos').select('id, orden').eq('categoria_id', categoriaId).order('orden').order('id')
    if (q.error) throw new Error(`No se pudo leer el orden: ${q.error.message}`)
    return q.data
  }
  const pedido = [extra[1], completo, extra[0]]
  const reordenar = (cliente, localId, categoriaId, ids) => cliente.rpc('reordenar_productos', { p_local_id: localId, p_categoria_id: categoriaId, p_ids: ids })
  const primera = await reordenar(c1, aroma.id, catProd, pedido)
  ver(!primera.error, 'Usuario 1 reordena los productos de una categoría suya', primera.error ? (primera.error.code === 'PGRST202' ? 'la función no existe todavía: corré supabase/10-admin-productos.sql' : msg(primera)) : 'ok')
  // Sin la función, las pruebas de "NO puede" pasarían solas: solo valen si existe.
  if (!primera.error) {
    const guardado = await ordenProductos(c1, catProd)
    ver(guardado.map((p) => p.id).join() === pedido.join() && guardado.map((p) => p.orden).join() === '1,2,3', 'Queda exactamente el orden pedido (1, 2, 3)')
    const intacto = async () => JSON.stringify(await ordenProductos(c1, catProd)) === JSON.stringify(guardado)
    const real = (await c1.from('productos').select('id').eq('local_id', aroma.id).not('nombre', 'like', `${PREFIJO}%`).limit(1)).data[0].id
    const invalidas = {
      'lista incompleta': pedido.slice(1),
      'ids repetidos': [pedido[0], pedido[0], pedido[1]],
      'un id de otro local': [pedido[0], pedido[1], pruebaProds[0].id],
      'un id de otra categoría del mismo local': [pedido[0], pedido[1], real],
      'con un id de más': [...pedido, real],
      'lista vacía': [],
    }
    for (const [caso, ids] of Object.entries(invalidas)) {
      const x = await reordenar(c1, aroma.id, catProd, ids)
      ver(x.error?.code === '22023' && (await intacto()), `Rechazada y nada cambia: ${caso}`, msg(x))
    }
    let x = await reordenar(c1, aroma.id, pruebaCats[0].id, [pruebaProds[0].id])
    ver(x.error?.code === '22023', 'Categoría de otro local con mi local_id: rechazada', msg(x))
    x = await reordenar(c1, pruebaPorU2.id, pruebaCats[0].id, [pruebaProds[0].id])
    ver(x.error?.code === '42501', 'Usuario 1 NO puede reordenar el local de prueba', msg(x))
    x = await reordenar(c2, aroma.id, catProd, [...pedido].reverse())
    ver(x.error?.code === '42501' && (await intacto()), 'Usuario 2 NO puede reordenar aroma', msg(x))
    x = await reordenar(anon, aroma.id, catProd, [...pedido].reverse())
    ver(x.error?.code === '42501' && (await intacto()), 'Un anónimo NO puede ejecutar la función', msg(x))
    const suyos = catTemp2 ? (await ordenProductos(c2, catTemp2)).map((p) => p.id) : []
    x = await reordenar(c2, pruebaPorU2.id, catTemp2, suyos)
    ver(!x.error, 'Usuario 2 reordena en su propio local', x.error ? msg(x) : 'ok')
  }

  r = await c1.from('productos').delete().eq('id', completo ?? UUID_INEXISTENTE).select('id')
  ver(permitida(r), 'Usuario 1 borra su producto', msgOk(r))

  // ═══ FOTOS DE PRODUCTOS EN STORAGE ═══════════════════════════
  seccion('Fotos: <local_id>/productos/ (subir, leer y borrar)')
  const imagenes = (cliente) => cliente.storage.from('imagenes')
  const duenoDe = (ruta) => (ruta.startsWith(pruebaPorU2.id) ? c2 : c1)
  const subir = async (cliente, ruta, bytes = WEBP_MINIMO, contentType = 'image/webp', opciones = {}) => {
    const x = await imagenes(cliente).upload(ruta, new Blob([bytes], { type: contentType }), { contentType, ...opciones })
    // Si entra algo (deba o no), queda anotado para borrarlo.
    if (!x.error) creadas.archivos.push([duenoDe(ruta), ruta])
    return x
  }
  const existe = async (ruta) => (await archivosDe(duenoDe(ruta), ruta.split('/')[0])).includes(ruta)
  const foto480 = `${aroma.id}/productos/${PREFIJO}foto-480.webp`
  const foto240 = `${aroma.id}/productos/${PREFIJO}foto-240.webp`
  let s1 = await subir(c1, foto480, WEBP_MINIMO, 'image/webp', { cacheControl: '31536000' })
  const s2 = await subir(c1, foto240, WEBP_MINIMO, 'image/webp', { cacheControl: '31536000' })
  ver(!s1.error && !s2.error, 'Usuario 1 sube las dos versiones a la carpeta de aroma', s1.error?.message ?? s2.error?.message ?? 'subidas')
  const publica = await fetch(imagenes(anon).getPublicUrl(foto480).data.publicUrl)
  const cache = publica.headers.get('cache-control') ?? ''
  ver(publica.status === 200 && publica.headers.get('content-type') === 'image/webp', 'La URL pública la entrega como image/webp', `${publica.status} ${publica.headers.get('content-type')}`)
  ver(cache.includes('max-age=31536000'), 'Con caché larga (un año)', cache)
  s1 = await subir(c1, foto480)
  ver(Boolean(s1.error), 'Sin upsert no se puede pisar un archivo existente', s1.error?.message ?? 'SE PISÓ')
  s1 = await subir(c1, `${aroma.id}/productos/${PREFIJO}jpg-480.jpg`, WEBP_MINIMO, 'image/jpeg')
  ver(!s1.error, 'Acepta image/jpeg (respaldo para navegadores sin WebP)', s1.error?.message ?? 'subida')

  seccion('Fotos: lo que el bucket debe rechazar')
  for (const tipo of ['text/plain', 'image/gif', 'image/svg+xml', 'application/octet-stream', 'text/html']) {
    const x = await subir(c1, `${aroma.id}/productos/${PREFIJO}tipo-${tipo.replace(/[^a-z]/g, '')}`, WEBP_MINIMO, tipo)
    ver(Boolean(x.error), `Tipo no permitido: ${tipo}`, x.error?.message ?? 'SE SUBIÓ')
  }
  s1 = await subir(c1, `${aroma.id}/productos/${PREFIJO}pesado-480.webp`, new Uint8Array(2 * 1024 * 1024 + 1024), 'image/webp')
  ver(Boolean(s1.error), 'Archivo de más de 2 MB: rechazado', s1.error?.message ?? 'SE SUBIÓ')
  s1 = await subir(c1, `${aroma.id}/productos/${PREFIJO}disfrazado-480.webp`, new TextEncoder().encode('esto no es una imagen'), 'image/webp')
  console.log(`NOTA   Un texto declarado como image/webp ${s1.error ? 'se RECHAZA: el bucket revisa el contenido' : 'se ACEPTA: el bucket mira el tipo declarado, no el contenido'}.`)

  seccion('Fotos: nadie escribe fuera de su carpeta')
  s1 = await subir(c1, `${pruebaPorU2.id}/productos/${PREFIJO}ajena-480.webp`)
  ver(Boolean(s1.error), 'Usuario 1 NO puede subir a local-prueba/productos', s1.error?.message ?? 'SE SUBIÓ')
  s1 = await subir(c1, `${PREFIJO}en-la-raiz.webp`)
  ver(Boolean(s1.error), 'Usuario 1 NO puede subir a la raíz del bucket', s1.error?.message ?? 'SE SUBIÓ')
  s1 = await imagenes(c1).upload(`${aroma.id}/../${pruebaPorU2.id}/productos/${PREFIJO}salto-480.webp`, new Blob([WEBP_MINIMO], { type: 'image/webp' }), { contentType: 'image/webp' })
  const salto = (await archivosDe(c2, pruebaPorU2.id)).filter((x) => x.includes(`${PREFIJO}salto`))
  if (!s1.error) creadas.archivos.push([c1, s1.data.path])
  ver(salto.length === 0, 'Una ruta con ".." no termina en la carpeta ajena', s1.error?.message ?? 'quedó dentro de la carpeta propia')
  let movido = await imagenes(c1).move(foto240, `${pruebaPorU2.id}/productos/${PREFIJO}movida-240.webp`)
  ver(Boolean(movido.error) && (await existe(foto240)), 'Usuario 1 NO puede mover un archivo suyo a la carpeta ajena', movido.error?.message ?? 'SE MOVIÓ')
  s1 = await subir(c2, `${aroma.id}/productos/${PREFIJO}intrusa-480.webp`)
  ver(Boolean(s1.error), 'Usuario 2 NO puede subir a aroma/productos', s1.error?.message ?? 'SE SUBIÓ')
  s1 = await imagenes(c2).upload(foto480, new Blob([PNG_MINIMO], { type: 'image/png' }), { contentType: 'image/png', upsert: true })
  ver(Boolean(s1.error), 'Usuario 2 NO puede reemplazar una foto de aroma', s1.error?.message ?? 'SE REEMPLAZÓ')
  await imagenes(c2).remove([foto480])
  ver(await existe(foto480), 'Usuario 2 NO puede borrar una foto de aroma (sigue ahí)')
  const copiada = `${pruebaPorU2.id}/productos/${PREFIJO}copiada-480.webp`
  movido = await imagenes(c2).copy(foto480, copiada)
  if (!movido.error) creadas.archivos.push([c2, copiada])
  ver(Boolean(movido.error), 'Usuario 2 NO puede copiar una foto de aroma con la API', movido.error?.message ?? 'SE COPIÓ')
  const listaAjena = await imagenes(c2).list(`${aroma.id}/productos`)
  ver(Boolean(listaAjena.error) || listaAjena.data.length === 0, 'Usuario 2 NO puede listar las fotos de aroma', `${listaAjena.data?.length ?? 0} archivo(s)`)
  s1 = await subir(anon, `${aroma.id}/productos/${PREFIJO}anon-480.webp`)
  ver(Boolean(s1.error), 'Un anónimo NO puede subir fotos', s1.error?.message ?? 'SE SUBIÓ')
  await imagenes(anon).remove([foto480])
  ver(await existe(foto480), 'Un anónimo NO puede borrar fotos (sigue ahí)')
  const listaAnon = await imagenes(anon).list(`${aroma.id}/productos`)
  ver(Boolean(listaAnon.error) || listaAnon.data.length === 0, 'Un anónimo NO puede listar el bucket', `${listaAnon.data?.length ?? 0} archivo(s)`)
  const propia = `${pruebaPorU2.id}/productos/${PREFIJO}propia-480.webp`
  s1 = await subir(c2, propia)
  ver(!s1.error, 'Usuario 2 sube a su propia carpeta', s1.error?.message ?? 'subida')
  await imagenes(c1).remove([propia])
  ver(await existe(propia), 'Usuario 1 NO puede borrar una foto del local de prueba')

  const borrado = await imagenes(c1).remove([foto480, foto240])
  ver(!borrado.error && borrado.data.length === 2 && !(await existe(foto480)) && !(await existe(foto240)), 'Usuario 1 borra sus dos versiones', borrado.error?.message ?? `${borrado.data.length} borradas`)

  // ═══ AJUSTES DEL LOCAL ═══════════════════════════════════════
  seccion('Ajustes: copia de las filas reales antes de tocar nada')
  const leerFila = async (cliente, id) => {
    const q = await cliente.from('locales').select('*').eq('id', id).maybeSingle()
    if (q.error) throw new Error(`No se pudo leer el local: ${q.error.message}`)
    return q.data
  }
  const copiaAroma = await leerFila(c1, aroma.id)
  const copiaPrueba = await leerFila(c2, pruebaPorU2.id)
  const hay11 = 'updated_at' in copiaAroma
  ver(hay11, 'La columna updated_at existe', hay11 ? 'sí' : 'falta: corré supabase/11-admin-ajustes.sql')
  // Sin el SQL 11 la base no valida: no se escribe nada en los locales.
  if (hay11) {
    fs.writeFileSync(COPIA, JSON.stringify({ aroma: copiaAroma, prueba: copiaPrueba }))
    contexto.copias = { aroma: copiaAroma, prueba: copiaPrueba }
    const editar = (cliente, id, cambios) => cliente.from('locales').update(cambios).eq('id', id).select('*')
    const actual = () => leerFila(c1, aroma.id)
    const intacta = async (antes) => JSON.stringify(await actual()) === JSON.stringify(antes)
    const urlDeLogo = (localId, nombre) => c1.storage.from('imagenes').getPublicUrl(`${localId}/logo/${nombre}`).data.publicUrl
    const franja = (desde, hasta) => ({ desde, hasta })
    // jsonb no conserva el orden de las claves: se compara con las claves ordenadas.
    const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((c) => [c, x[c]])) : x))

    seccion('Ajustes: el dueño actualiza los datos de SU local')
    const validos = {
      nombre: `${PREFIJO}Aroma`,
      descripcion: 'Descripción de prueba.',
      direccion: 'Calle de Prueba 123',
      whatsapp: '5491155551234',
      instagram: 'aroma.prueba',
      horarios: { zona: 'America/Argentina/Buenos_Aires', semana: { lunes: [franja('08:00', '13:00'), franja('16:00', '20:00')], viernes: [franja('20:00', '02:00')], sabado: [franja('02:00', '12:00')], domingo: [] } },
      aviso_texto: 'Aviso de prueba.',
      aviso_activo: true,
      tema: { frase: 'frase de prueba', fondo: '#FFFFFF', texto: '#111111', acento: '#2f6f6f', portada: '#101820' },
      logo_url: urlDeLogo(aroma.id, `${PREFIJO}logo-640x160.webp`),
    }
    let a = await editar(c1, aroma.id, validos)
    const distintas = AJUSTES.filter((c) => canon(a.data?.[0]?.[c]) !== canon(validos[c]))
    ver(permitida(a) && distintas.length === 0, 'Usuario 1 actualiza las 10 columnas de ajustes de aroma', a.error ? msg(a) : distintas.length ? `distintas: ${distintas}` : msgOk(a))
    ver(a.data?.[0]?.updated_at !== copiaAroma.updated_at, 'updated_at cambia solo al guardar')
    const version = a.data?.[0]?.updated_at
    a = await c1.from('locales').update({ descripcion: 'con versión vieja' }).eq('id', aroma.id).eq('updated_at', copiaAroma.updated_at).select('id')
    ver(!a.error && a.data.length === 0, 'Guardar con una versión vieja no pisa nada (0 filas)', msgOk(a))
    a = await c1.from('locales').update({ descripcion: 'con versión actual' }).eq('id', aroma.id).eq('updated_at', version).select('id')
    ver(permitida(a), 'Guardar con la versión actual sí (la fecha va y vuelve sin perder precisión)', msgOk(a))
    const aceptados = {
      'horarios vacíos {}': { horarios: {} },
      'las 24 horas toda la semana': { horarios: { semana: Object.fromEntries(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((d) => [d, [franja('00:00', '24:00')]])) } },
      'Instagram como enlace https': { instagram: 'https://www.instagram.com/aroma.prueba/' },
      'logo de la app (/locales/...)': { logo_url: '/locales/aroma/logo.webp' },
      'logo PNG en su carpeta de Storage': { logo_url: urlDeLogo(aroma.id, `${PREFIJO}logo-10x10.png`) },
      'campos opcionales vacíos (null)': { descripcion: null, direccion: null, whatsapp: null, instagram: null, aviso_texto: null, aviso_activo: false, logo_url: null },
      'tema vacío': { tema: {} },
    }
    for (const [caso, cambios] of Object.entries(aceptados)) {
      const x = await editar(c1, aroma.id, cambios)
      ver(permitida(x), `La base acepta: ${caso}`, msgOk(x))
    }

    seccion('Ajustes: la base rechaza datos peligrosos o mal formados')
    const antes = await actual()
    const rechazados = {
      'tema: inyección de CSS': { tema: { acento: 'red; background:url(x)' } },
      'tema: color con basura detrás': { tema: { fondo: '#ffffff; }' } },
      'tema: color corto': { tema: { texto: '#fff' } },
      'tema: color con salto de línea': { tema: { portada: '#000000\n' } },
      'tema: color que no es texto': { tema: { acento: 123456 } },
      'tema: clave desconocida': { tema: { 'acento;': '#000000' } },
      'tema: no es un objeto': { tema: ['#000000'] },
      'tema: frase de 81': { tema: { frase: 'a'.repeat(81) } },
      'instagram: javascript:': { instagram: 'javascript:alert(1)' },
      'instagram: data:': { instagram: 'data:text/html,x' },
      'instagram: http sin s': { instagram: 'http://instagram.com/a' },
      'instagram: https de otro sitio': { instagram: 'https://evil.example/a' },
      'whatsapp: un enlace': { whatsapp: 'javascript:alert(1)' },
      'whatsapp: 31 caracteres': { whatsapp: '1'.repeat(31) },
      'logo: javascript:': { logo_url: 'javascript:alert(1)' },
      'logo: data:': { logo_url: 'data:image/png;base64,AAAA' },
      'logo: https de otro sitio': { logo_url: 'https://evil.example/logo.png' },
      'logo: http': { logo_url: urlDeLogo(aroma.id, 'logo-1x1.webp').replace('https:', 'http:') },
      'logo: carpeta de OTRO local': { logo_url: urlDeLogo(pruebaPorU2.id, 'logo-1x1.webp') },
      'logo: SVG': { logo_url: urlDeLogo(aroma.id, 'logo.svg') },
      'logo: salto de carpeta': { logo_url: '/locales/aroma/../x.webp' },
      'horarios: superpuestos': { horarios: { semana: { lunes: [franja('08:00', '13:00'), franja('12:00', '20:00')] } } },
      'horarios: superpuestos del domingo al lunes': { horarios: { semana: { domingo: [franja('22:00', '09:00')], lunes: [franja('08:00', '12:00')] } } },
      'horarios: invertidos': { horarios: { semana: { lunes: [franja('20:00', '13:00')] } } },
      'horarios: misma hora': { horarios: { semana: { lunes: [franja('08:00', '08:00')] } } },
      'horarios: hora imposible': { horarios: { semana: { lunes: [franja('25:00', '26:00')] } } },
      'horarios: 4 franjas': { horarios: { semana: { lunes: [franja('01:00', '02:00'), franja('03:00', '04:00'), franja('05:00', '06:00'), franja('07:00', '08:00')] } } },
      'horarios: día desconocido': { horarios: { semana: { funday: [] } } },
      'horarios: clave de más en una franja': { horarios: { semana: { lunes: [{ desde: '08:00', hasta: '09:00', x: 1 }] } } },
      'horarios: formato viejo': { horarios: { 'Lunes a viernes': '8 a 20 h' } },
      'horarios: semana que no es objeto': { horarios: { semana: [] } },
      'horarios: zona rara': { horarios: { zona: '<script>', semana: {} } },
      'horarios: sin hasta': { horarios: { semana: { lunes: [{ desde: '08:00' }] } } },
      'nombre vacío': { nombre: '   ' },
      'nombre de 61': { nombre: 'a'.repeat(61) },
      'descripción de 201': { descripcion: 'a'.repeat(201) },
      'dirección de 121': { direccion: 'a'.repeat(121) },
      'aviso de 201': { aviso_texto: 'a'.repeat(201) },
    }
    for (const [caso, cambios] of Object.entries(rechazados)) {
      const x = await editar(c1, aroma.id, cambios)
      ver(x.error?.code === '23514' && (await intacta(antes)), `Rechazado y nada cambia: ${caso}`, msg(x))
    }

    seccion('Ajustes: ni el dueño puede cambiar slug, activo ni nada estructural')
    const prohibidos = {
      slug: { slug: 'zz-prueba-permisos-slug' },
      'activo (desactivar su local)': { activo: false },
      id: { id: UUID_INEXISTENTE },
      updated_at: { updated_at: '2000-01-01T00:00:00Z' },
      'activo junto con un dato permitido (se rechaza todo)': { descripcion: 'no tiene que guardarse', activo: false },
      'slug junto con un dato permitido': { descripcion: 'no tiene que guardarse', slug: 'zz-prueba-permisos-slug' },
    }
    for (const [caso, cambios] of Object.entries(prohibidos)) {
      const x = await editar(c1, aroma.id, cambios)
      // Si entrara (la protección falló), se deshace en el momento.
      if (permitida(x)) await editar(c1, aroma.id, { slug: copiaAroma.slug, activo: copiaAroma.activo })
      ver(x.error?.code === '42501' && (await intacta(antes)), `Usuario 1 NO puede cambiar ${caso}`, msg(x))
    }
    const publico = await anon.from('locales').select('slug, activo').eq('id', aroma.id).maybeSingle()
    ver(publico.data?.slug === 'aroma' && publico.data?.activo === true, 'aroma conserva su slug y sigue activo', JSON.stringify(publico.data))

    seccion('Ajustes: aislamiento entre locales')
    const intentos = { nombre: { nombre: 'Hackeado' }, tema: { tema: {} }, aviso: { aviso_texto: 'x', aviso_activo: true }, horarios: { horarios: {} } }
    for (const [caso, cambios] of Object.entries(intentos)) {
      const x = await editar(c1, pruebaPorU2.id, cambios)
      ver(bloqueada(x), `Usuario 1 NO puede cambiar ${caso} de local-prueba`, msg(x))
      const y = await editar(c2, aroma.id, cambios)
      ver(bloqueada(y) && (await intacta(antes)), `Usuario 2 NO puede cambiar ${caso} de aroma`, msg(y))
      const z = await editar(anon, aroma.id, cambios)
      ver(z.error?.code === '42501' && (await intacta(antes)), `Un anónimo NO puede cambiar ${caso} de aroma`, msg(z))
    }
    ver(sinVersion(await leerFila(c2, pruebaPorU2.id)) === sinVersion(copiaPrueba), 'local-prueba no cambió con los intentos del usuario 1')
    let q = await editar(c2, pruebaPorU2.id, { descripcion: 'Descripción del usuario 2.' })
    ver(permitida(q), 'Usuario 2 actualiza los ajustes de su propio local', msgOk(q))
    q = await editar(c2, pruebaPorU2.id, { activo: true })
    if (permitida(q)) await editar(c2, pruebaPorU2.id, { activo: false })
    ver(q.error?.code === '42501', 'Usuario 2 NO puede activar su local', msg(q))
    // Si hubiera entrado, local-prueba quedaría publicado: se comprueba.
    ver((await leerFila(c2, pruebaPorU2.id)).activo === false, 'local-prueba sigue inactivo')

    seccion('Logo en Storage: <local_id>/logo/')
    const logos = (cliente) => cliente.storage.from('imagenes')
    const subirLogo = async (cliente, localId, nombre, contentType = 'image/webp', bytes = WEBP_MINIMO) => {
      const ruta = `${localId}/logo/${nombre}`
      const x = await logos(cliente).upload(ruta, new Blob([bytes], { type: contentType }), { contentType })
      if (!x.error) creadas.archivos.push([localId === pruebaPorU2.id ? c2 : c1, ruta])
      return x
    }
    const sigue = async (cliente, localId, nombre) => (await archivosDe(cliente, localId)).includes(`${localId}/logo/${nombre}`)
    const miLogo = `${PREFIJO}logo-8x10.webp`
    let l = await subirLogo(c1, aroma.id, miLogo)
    ver(!l.error, 'Usuario 1 (dueño) sube un logo a la carpeta de aroma', l.error?.message ?? 'subido')
    l = await subirLogo(c1, aroma.id, `${PREFIJO}logo-8x10.png`, 'image/png', PNG_MINIMO)
    ver(!l.error, 'También en PNG (respaldo con transparencia)', l.error?.message ?? 'subido')
    l = await subirLogo(c1, aroma.id, `${PREFIJO}logo.svg`, 'image/svg+xml')
    ver(Boolean(l.error), 'SVG: rechazado', l.error?.message ?? 'SE SUBIÓ')
    l = await subirLogo(c1, aroma.id, `${PREFIJO}logo-pesado.webp`, 'image/webp', new Uint8Array(2 * 1024 * 1024 + 1024))
    ver(Boolean(l.error), 'Más de 2 MB: rechazado', l.error?.message ?? 'SE SUBIÓ')
    l = await subirLogo(c1, pruebaPorU2.id, `${PREFIJO}ajeno.webp`)
    ver(Boolean(l.error), 'Usuario 1 NO puede subir un logo a local-prueba', l.error?.message ?? 'SE SUBIÓ')
    l = await subirLogo(c2, aroma.id, `${PREFIJO}intruso.webp`)
    ver(Boolean(l.error), 'Usuario 2 NO puede subir un logo a aroma', l.error?.message ?? 'SE SUBIÓ')
    l = await subirLogo(anon, aroma.id, `${PREFIJO}anon.webp`)
    ver(Boolean(l.error), 'Un anónimo NO puede subir un logo', l.error?.message ?? 'SE SUBIÓ')
    await logos(c2).remove([`${aroma.id}/logo/${miLogo}`])
    ver(await sigue(c1, aroma.id, miLogo), 'Usuario 2 NO puede borrar el logo de aroma (sigue ahí)')
    await logos(anon).remove([`${aroma.id}/logo/${miLogo}`])
    ver(await sigue(c1, aroma.id, miLogo), 'Un anónimo NO puede borrarlo (sigue ahí)')
    l = await subirLogo(c2, pruebaPorU2.id, miLogo)
    ver(!l.error, 'Usuario 2 (dueño) sube un logo a su propio local', l.error?.message ?? 'subido')
    l = await logos(c1).remove([`${aroma.id}/logo/${miLogo}`])
    ver(!l.error && l.data.length === 1 && !(await sigue(c1, aroma.id, miLogo)), 'Usuario 1 borra su logo', l.error?.message ?? `${l.data.length} borrado`)
    if (!hayEditor) console.log('NOTA   Sin usuario editor, que no pueda escribir en logo/ no se prueba acá (ver "Editor real").')

    seccion('Ajustes: restaurar las filas originales')
    const errores = await restaurarLocales(contexto.copias)
    ver(errores.length === 0, 'aroma y local-prueba restaurados (todas las columnas iguales salvo updated_at)', errores.join(' | ') || 'ok')
    if (errores.length === 0) {
      fs.rmSync(COPIA)
      contexto.restaurados = true
    }
  }

  // ═══ EDITOR REAL (Tarea 12) ══════════════════════════════════
  // La misma consulta que usa la vista de clientes, con los permisos de cada uno.
  const consultaClientes = (cliente) => cliente.from('locales').select('id, slug, nombre, activo, updated_at, categorias(count), productos(count)')
  if (!hayEditor) {
    salteadas.push('editor (faltan TEST_EDITOR_EMAIL y TEST_EDITOR_PASSWORD: npm run pruebas:usuarios)')
  } else {
    seccion('Editor real: su rol')
    const id3 = await entrar(c3, opcionales.editor, 'editor')
    const mem3 = await c3.from('usuarios_locales').select('rol, local_id')
    ver(!mem3.error && mem3.data.length === 1 && mem3.data[0].local_id === pruebaPorU2.id && mem3.data[0].rol === 'editor', 'Es editor de local-prueba y de ningún otro', mem3.error ? msg(mem3) : mem3.data.map((m) => m.rol).join())
    ver((await c3.from('admins').select('user_id')).data?.length === 0, 'No es admin')

    seccion('Editor real: edita categorías y productos de SU local')
    r = await c3.from('categorias').insert({ local_id: pruebaPorU2.id, nombre: `${PREFIJO}editor`, activa: false, orden: 996 }).select('id')
    const catEditor = r.data?.[0]?.id
    ver(permitida(r), 'Crea una categoría', msgOk(r))
    r = await c3.from('categorias').update({ nombre: `${PREFIJO}editor2`, adicionales: [{ nombre: 'Extra', precio: 1 }] }).eq('id', catEditor ?? UUID_INEXISTENTE).select('id')
    ver(permitida(r), 'La edita (nombre y adicionales)', msgOk(r))
    r = await c3.from('productos').insert({ local_id: pruebaPorU2.id, categoria_id: catEditor, nombre: `${PREFIJO}p-editor`, precio: 10, disponible: false }).select('id')
    const prodEditor = r.data?.[0]?.id
    ver(permitida(r), 'Crea un producto', msgOk(r))
    r = await c3.from('productos').update({ precio: 20, destacado: true }).eq('id', prodEditor ?? UUID_INEXISTENTE).select('id')
    ver(permitida(r), 'Lo edita', msgOk(r))
    const orden = await c3.rpc('reordenar_productos', { p_local_id: pruebaPorU2.id, p_categoria_id: catEditor ?? UUID_INEXISTENTE, p_ids: [prodEditor ?? UUID_INEXISTENTE] })
    ver(!orden.error, 'Reordena con la función', orden.error ? msg(orden) : 'ok')
    const fotoEditor = `${pruebaPorU2.id}/productos/${PREFIJO}editor-480.webp`
    const subeFoto = await c3.storage.from('imagenes').upload(fotoEditor, new Blob([WEBP_MINIMO], { type: 'image/webp' }), { contentType: 'image/webp' })
    if (!subeFoto.error) creadas.archivos.push([c2, fotoEditor])
    ver(!subeFoto.error, 'Sube la foto de un producto', subeFoto.error?.message ?? 'subida')
    r = await c3.from('productos').delete().eq('id', prodEditor ?? UUID_INEXISTENTE).select('id')
    ver(permitida(r), 'Borra el producto', msgOk(r))
    r = await c3.from('categorias').delete().eq('id', catEditor ?? UUID_INEXISTENTE).select('id')
    ver(permitida(r), 'Borra la categoría', msgOk(r))

    seccion('Editor real: NO puede cambiar ajustes')
    const filaPrueba = async () => JSON.stringify((await c2.from('locales').select('*').eq('id', pruebaPorU2.id).single()).data)
    const antesEditor = await filaPrueba()
    const cambiosEditor = {
      nombre: { nombre: 'Hackeado' }, descripcion: { descripcion: 'x' }, direccion: { direccion: 'x' }, whatsapp: { whatsapp: '5491100000000' }, instagram: { instagram: 'x' },
      horarios: { horarios: {} }, aviso: { aviso_texto: 'x', aviso_activo: true }, tema: { tema: {} }, logo_url: { logo_url: null }, activo: { activo: true }, slug: { slug: 'zz-prueba-permisos-editor' },
    }
    for (const [caso, cambios] of Object.entries(cambiosEditor)) {
      // Si entrara (no debía), la comparación con la fila lo marca.
      const x = await c3.from('locales').update(cambios).eq('id', pruebaPorU2.id).select('id')
      ver(bloqueada(x) && (await filaPrueba()) === antesEditor, `Editor NO puede cambiar ${caso}`, msg(x))
    }
    r = await c3.from('locales').delete().eq('id', pruebaPorU2.id).select('id')
    ver(bloqueada(r), 'Editor NO puede borrar su local', msg(r))
    r = await c3.from('usuarios_locales').update({ rol: 'owner' }).eq('user_id', id3).select()
    ver(bloqueada(r), 'Editor NO puede hacerse dueño', msg(r))
    r = await c3.from('admins').insert({ user_id: id3 }).select()
    ver(bloqueada(r), 'Editor NO puede hacerse admin', msg(r))

    seccion('Editor real: la carpeta del logo es solo del dueño y los admins')
    const nombreLogo = `${PREFIJO}del-dueno-8x10.webp`
    const logoDelDueno = `${pruebaPorU2.id}/logo/${nombreLogo}`
    const puesto = await c2.storage.from('imagenes').upload(logoDelDueno, new Blob([WEBP_MINIMO], { type: 'image/webp' }), { contentType: 'image/webp' })
    if (!puesto.error) creadas.archivos.push([c2, logoDelDueno])
    ver(!puesto.error, 'El dueño pone un logo de prueba', puesto.error?.message ?? 'subido')
    const estaElLogo = async () => (await archivosDe(c2, pruebaPorU2.id)).includes(logoDelDueno)
    const subirComoEditor = async (ruta, opciones = {}) => {
      const x = await c3.storage.from('imagenes').upload(ruta, new Blob([PNG_MINIMO], { type: 'image/png' }), { contentType: 'image/png', ...opciones })
      if (!x.error) creadas.archivos.push([c2, ruta])
      return x
    }
    let subida = await subirComoEditor(`${pruebaPorU2.id}/logo/${PREFIJO}editor.png`)
    ver(Boolean(subida.error), 'Editor NO puede subir a logo/', subida.error?.message ?? 'SE SUBIÓ')
    const suelto = `${pruebaPorU2.id}/logo.${PREFIJO}png`
    subida = await subirComoEditor(suelto)
    ver(Boolean(subida.error), 'Tampoco un "logo.<ext>" suelto en la carpeta del local', subida.error?.message ?? 'SE SUBIÓ')
    subida = await subirComoEditor(logoDelDueno, { upsert: true })
    const peso = (await c2.storage.from('imagenes').list(`${pruebaPorU2.id}/logo`)).data?.find((o) => o.name === nombreLogo)?.metadata?.size
    ver(Boolean(subida.error) && peso === WEBP_MINIMO.length, 'Editor NO puede reemplazar el logo', subida.error?.message ?? 'SE REEMPLAZÓ')
    await c3.storage.from('imagenes').remove([logoDelDueno])
    ver(await estaElLogo(), 'Editor NO puede borrar el logo (sigue ahí)')
    const sacado = `${pruebaPorU2.id}/productos/${PREFIJO}sacado-480.webp`
    let movida = await c3.storage.from('imagenes').move(logoDelDueno, sacado)
    if (!movida.error) creadas.archivos.push([c2, sacado])
    ver(Boolean(movida.error) && (await estaElLogo()), 'Editor NO puede sacar el logo de su carpeta moviéndolo', movida.error?.message ?? 'SE MOVIÓ')
    const colado = `${pruebaPorU2.id}/logo/${PREFIJO}colado.webp`
    movida = await c3.storage.from('imagenes').move(fotoEditor, colado)
    if (!movida.error) creadas.archivos.push([c2, colado])
    ver(Boolean(movida.error) && !(await archivosDe(c2, pruebaPorU2.id)).includes(colado), 'Editor NO puede meter una foto en logo/ moviéndola', movida.error?.message ?? 'SE MOVIÓ')

    seccion('Editor real: nada de otros locales')
    r = await c3.from('productos').update({ precio: aromaProd.precio }).eq('id', aromaProd.id).select('id')
    ver(bloqueada(r), 'NO puede editar un producto de aroma', msg(r))
    r = await c3.from('categorias').insert({ local_id: aroma.id, nombre: `${PREFIJO}intrusa-editor`, activa: false }).select('id')
    ver(bloqueada(r), 'NO puede crear una categoría en aroma', msg(r))
    const enAroma = `${aroma.id}/productos/${PREFIJO}editor-480.webp`
    const ajena = await c3.storage.from('imagenes').upload(enAroma, new Blob([WEBP_MINIMO], { type: 'image/webp' }), { contentType: 'image/webp' })
    if (!ajena.error) creadas.archivos.push([c1, enAroma])
    ver(Boolean(ajena.error), 'NO puede subir fotos a aroma', ajena.error?.message ?? 'SE SUBIÓ')
  }

  // ═══ ADMIN REAL (Tarea 12) ═══════════════════════════════════
  if (!hayAdmin) {
    salteadas.push('admin (faltan TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD: npm run pruebas:usuarios)')
  } else {
    seccion('Admin real: ve todos los locales')
    const id4 = (await c4.auth.getUser()).data.user.id
    const mio = await c4.from('admins').select('user_id')
    ver(!mio.error && mio.data.length === 1 && mio.data[0].user_id === id4, 'Figura en admins (y solo ve su propia fila)', mio.error ? msg(mio) : `${mio.data.length} fila(s)`)
    ver((await c4.from('usuarios_locales').select('local_id').eq('user_id', id4)).data?.length === 0, 'No es miembro de ningún local: lo que puede es por ser admin')
    const todos = await consultaClientes(c4)
    const fAroma = todos.data?.find((l) => l.id === aroma.id)
    ver(!todos.error && Boolean(fAroma) && todos.data.some((l) => l.id === pruebaPorU2.id), 'La consulta de clientes le trae también un local inactivo ajeno', todos.error ? msg(todos) : `${todos.data.length} local(es)`)
    ver(fAroma?.categorias[0].count === (await contar(c1, 'categorias', { local_id: aroma.id })) && fAroma?.productos[0].count === (await contar(c1, 'productos', { local_id: aroma.id })), 'Los conteos de aroma coinciden con los que ve su dueño', `${fAroma?.categorias[0].count} categorías, ${fAroma?.productos[0].count} productos`)

    seccion('Admin real: cambia "activo" contra la base real (en un local temporal)')
    let t = await c4.from('locales').insert({ slug: SLUG_TEMPORAL, nombre: `${PREFIJO}local`, activo: false }).select('*')
    const temporal = t.data?.[0]
    ver(permitida(t), 'Admin crea un local temporal (inactivo)', msgOk(t))
    if (temporal) {
      const leerTemporal = async () => JSON.stringify((await c4.from('locales').select('*').eq('id', temporal.id).maybeSingle()).data)
      const publico = async () => (await anon.from('locales').select('id').eq('slug', SLUG_TEMPORAL)).data?.length
      ver((await publico()) === 0, 'Inactivo: el público no lo ve')
      ver(!(await consultaClientes(c2)).data?.some((l) => l.id === temporal.id), 'Un dueño de otro local no lo ve mientras está inactivo')
      if (hayEditor) ver(!(await consultaClientes(c3)).data?.some((l) => l.id === temporal.id), 'El editor tampoco')

      t = await c4.from('locales').update({ activo: true }).eq('id', temporal.id).select('activo')
      ver(permitida(t) && t.data[0].activo === true, 'El ADMIN lo ACTIVA', msgOk(t))
      ver((await publico()) === 1, 'Activo: el público lo ve')
      t = await c4.from('locales').update({ activo: false }).eq('id', temporal.id).select('activo')
      ver(permitida(t) && t.data[0].activo === false, 'El ADMIN lo DESACTIVA', msgOk(t))
      ver((await publico()) === 0, 'Inactivo de nuevo: el público no lo ve')

      const asignado = await c4.from('usuarios_locales').insert({ user_id: id2, local_id: temporal.id, rol: 'owner' }).select()
      ver(permitida(asignado), 'El admin le asigna un dueño', msgOk(asignado))
      t = await c2.from('locales').update({ descripcion: 'del dueño' }).eq('id', temporal.id).select('id')
      ver(permitida(t), 'Ese dueño edita los datos de su local', msgOk(t))
      let quieto = await leerTemporal()
      t = await c2.from('locales').update({ activo: true }).eq('id', temporal.id).select('id')
      ver(t.error?.code === '42501' && (await leerTemporal()) === quieto, 'El DUEÑO NO puede activar su propio local', msg(t))
      for (const [quien, cliente] of [['el dueño', c2], ['el admin', c4], ['el dueño de otro local', c1], ...(hayEditor ? [['el editor', c3]] : []), ['un anónimo', anon]]) {
        const x = await cliente.from('locales').update({ slug: 'zz-prueba-permisos-otro' }).eq('id', temporal.id).select('id')
        ver(bloqueada(x) && (await leerTemporal()) === quieto, `Nadie cambia el slug: ${quien}`, msg(x))
      }
      for (const [caso, cambios] of Object.entries({ id: { id: UUID_INEXISTENTE }, updated_at: { updated_at: '2000-01-01T00:00:00Z' } })) {
        const x = await c4.from('locales').update(cambios).eq('id', temporal.id).select('id')
        ver(x.error?.code === '42501' && (await leerTemporal()) === quieto, `Ni el admin cambia ${caso}`, msg(x))
      }
      t = await c2.from('locales').delete().eq('id', temporal.id).select('id')
      ver(bloqueada(t) && (await leerTemporal()) === quieto, 'El dueño NO puede borrar el local', msg(t))

      seccion('Slugs reservados (supabase/12-admin-clientes.sql)')
      for (const slug of ['admin', 'login', 'clientes', 'cuenta']) {
        const x = await c4.from('locales').insert({ slug, nombre: `${PREFIJO}reservado`, activo: false }).select('id')
        // Si entrara (falta el SQL 12), se borra en el momento.
        if (permitida(x)) await c4.from('locales').delete().eq('id', x.data[0].id)
        ver(x.error?.code === '23514', `La base rechaza el slug "${slug}"`, x.error ? msg(x) : 'SE CREÓ (¿falta el SQL 12?)')
      }
      t = await c4.from('admins').insert({ user_id: id2 }).select()
      ver(bloqueada(t), 'Ni un admin puede sumar admins desde la aplicación', msg(t))

      t = await c4.from('locales').delete().eq('id', temporal.id).select('id')
      ver(permitida(t), 'El admin borra el local temporal', msgOk(t))
      quieto = (await c2.from('usuarios_locales').select('local_id')).data
      ver(quieto?.length === 1 && quieto[0].local_id === pruebaPorU2.id, 'El dueño vuelve a tener solo su local')
    }
  }

  // ═══ ANÓNIMO ═════════════════════════════════════════════════
  seccion('Anónimo (sin sesión): sigue sin poder escribir en ninguna tabla')
  const falsos = {
    locales: { slug: 'zz-prueba-permisos-anon', nombre: 'Intruso' },
    categorias: { local_id: aroma.id, nombre: `${PREFIJO}anon` },
    productos: { local_id: aroma.id, categoria_id: aromaCats[0].id, nombre: `${PREFIJO}anon`, precio: 1 },
    usuarios_locales: { user_id: id1, local_id: aroma.id, rol: 'owner' },
    admins: { user_id: id1 },
  }
  for (const [tabla, fila] of Object.entries(falsos)) {
    const ins = await anon.from(tabla).insert(fila).select()
    ver(bloqueada(ins), `INSERT en ${tabla}`, msg(ins))
    if (permitida(ins)) console.log('       ⚠ se creó una fila: hay que borrarla a mano')
    const columnaClave = tabla === 'admins' || tabla === 'usuarios_locales' ? 'user_id' : 'id'
    const upd = await anon.from(tabla).update(columnaClave === 'user_id' ? { user_id: id1 } : { nombre: 'x' }).eq(columnaClave, UUID_INEXISTENTE).select()
    ver(bloqueada(upd), `UPDATE en ${tabla}`, msg(upd))
    const del = await anon.from(tabla).delete().eq(columnaClave, UUID_INEXISTENTE).select()
    ver(bloqueada(del), `DELETE en ${tabla}`, msg(del))
  }
  // Y contra filas que SÍ existen, pero temporales:
  if (prodTemp) {
    r = await anon.from('productos').update({ descripcion: 'editado por anónimo' }).eq('id', prodTemp).select('id')
    ver(bloqueada(r), 'UPDATE anónimo de un producto temporal que sí existe', msg(r))
    r = await anon.from('productos').delete().eq('id', prodTemp).select('id')
    ver(bloqueada(r), 'DELETE anónimo de un producto temporal que sí existe', msg(r))
  }
  const ul = await anon.from('usuarios_locales').select('user_id')
  ver(Boolean(ul.error) || ul.data.length === 0, 'No lee usuarios_locales', ul.error ? msg(ul) : `${ul.data.length} fila(s)`)
  const ad = await anon.from('admins').select('user_id')
  ver(Boolean(ad.error) || ad.data.length === 0, 'No lee admins', ad.error ? msg(ad) : `${ad.data.length} fila(s)`)

  seccion('El menú público NO muestra nada del local inactivo')
  const pubLocal = await anon.from('locales').select('id').eq('slug', 'local-prueba')
  ver(!pubLocal.error && pubLocal.data.length === 0, 'No se puede leer el local inactivo', pubLocal.error ? msg(pubLocal) : `${pubLocal.data.length} fila(s)`)
  const pubCats = await anon.from('categorias').select('id').eq('local_id', pruebaPorU2.id)
  ver(!pubCats.error && pubCats.data.length === 0, 'No se pueden leer sus categorías', pubCats.error ? msg(pubCats) : `${pubCats.data.length} fila(s)`)
  const pubProds = await anon.from('productos').select('id').eq('local_id', pruebaPorU2.id)
  ver(!pubProds.error && pubProds.data.length === 0, 'No se pueden leer sus productos', pubProds.error ? msg(pubProds) : `${pubProds.data.length} fila(s)`)
  const pubMenu = await anon.from('locales').select('slug, categorias(id, productos(id))')
  ver(!pubMenu.error && !pubMenu.data.some((l) => l.slug === 'local-prueba') && pubMenu.data.some((l) => l.slug === 'aroma'), 'La consulta del menú público (con relaciones) no lo incluye, y aroma sigue visible', pubMenu.error ? msg(pubMenu) : `${pubMenu.data.length} local(es) visibles`)
  const pubTemp = await anon.from('productos').select('id').like('nombre', `${PREFIJO}%`)
  ver(!pubTemp.error && pubTemp.data.length === 0, 'Las filas temporales de la prueba (inactivas) tampoco se ven en el menú público', pubTemp.error ? msg(pubTemp) : `${pubTemp.data.length} fila(s)`)
} catch (error) {
  fallos++
  console.error(`\nFALLÓ  La verificación se interrumpió: ${error.message}`)
} finally {
  // ═══ LIMPIEZA Y COMPROBACIÓN FINAL ═══════════════════════════
  seccion('Limpieza')
  try {
    // Si la corrida se cortó en medio de los ajustes, primero vuelven las filas originales.
    if (contexto.copias && !contexto.restaurados) {
      const errores = await restaurarLocales(contexto.copias)
      ver(errores.length === 0, 'Locales restaurados tras la interrupción', errores.join(' | ') || 'ok')
      if (errores.length === 0) fs.rmSync(COPIA)
      else console.log(`NOTA   La copia de las filas originales sigue en ${COPIA}`)
    }
    const errores = await limpiarTemporales()
    ver(errores.length === 0, 'Se borraron las filas y archivos temporales', errores.join(' | '))

    const { aroma, prueba, antes } = contexto
    if (aroma && prueba && antes) {
      const restos = []
      for (const cliente of [c1, c2]) {
        for (const tabla of ['productos', 'categorias']) {
          const r = await cliente.from(tabla).select('id', { count: 'exact', head: true }).like('nombre', `${PREFIJO}%`)
          restos.push(r.count ?? 0)
        }
      }
      const basura = restos.reduce((a, b) => a + b, 0)
      ver(basura === 0, 'No quedó ninguna fila temporal en la base', `${basura} fila(s)`)

      const despues = {
        aromaCats: await contar(c1, 'categorias', { local_id: aroma.id }),
        aromaProds: await contar(c1, 'productos', { local_id: aroma.id }),
        pruebaCats: await contar(c2, 'categorias', { local_id: prueba.id }),
        pruebaProds: await contar(c2, 'productos', { local_id: prueba.id }),
      }
      ver(despues.aromaCats === antes.aroma.cats && despues.aromaProds === antes.aroma.prods, 'aroma quedó con la misma cantidad de categorías y productos', `${despues.aromaCats} cat. / ${despues.aromaProds} prod. (antes: ${antes.aroma.cats} / ${antes.aroma.prods})`)
      ver(despues.pruebaCats === antes.prueba.cats && despues.pruebaProds === antes.prueba.prods, 'local-prueba quedó con la misma cantidad de categorías y productos', `${despues.pruebaCats} cat. / ${despues.pruebaProds} prod. (antes: ${antes.prueba.cats} / ${antes.prueba.prods})`)
      ver((await contexto.fotoCategorias()) === contexto.categoriasAntes, 'Las categorías reales de aroma quedaron idénticas (nombre, orden, visibilidad y adicionales)')
      ver((await contexto.fotoProductos()) === contexto.productosAntes, 'Los productos reales de aroma quedaron idénticos (todas las columnas)')
      const sobrantes = [...(await archivosDePrueba(c1, aroma.id)), ...(await archivosDePrueba(c2, prueba.id))]
      ver(sobrantes.length === 0, 'No quedó ningún archivo de prueba en Storage', sobrantes.join(', '))
      const archivosDespues = await archivosDe(c1, aroma.id)
      ver(JSON.stringify(archivosDespues) === contexto.archivosAntes, 'La carpeta de aroma en Storage quedó como estaba', `${archivosDespues.length} archivo(s)`)
      const estado = await c2.from('locales').select('activo, descripcion, nombre').eq('id', prueba.id).maybeSingle()
      ver(estado.data?.activo === false && estado.data?.nombre === prueba.nombre, 'El local de prueba sigue inactivo y con su nombre', estado.error ? msg(estado) : '')
      const estadoAroma = await anon.from('locales').select('activo, nombre, descripcion').eq('id', aroma.id).maybeSingle()
      ver(estadoAroma.data?.activo === true && estadoAroma.data?.nombre === aroma.nombre && estadoAroma.data?.descripcion === aroma.descripcion, 'aroma sigue activo y con sus datos', estadoAroma.error ? msg(estadoAroma) : '')
    }
  } catch (e) {
    ver(false, 'La limpieza terminó con un error', e.message)
  }
  await Promise.allSettled([c1, c2, c3, c4].map((c) => c.auth.signOut({ scope: 'local' })))

  for (const que of salteadas) console.log(`\nSALTEADO  No se probó el ${que}.`)
  console.log(`\n${total - fallos}/${total} comprobaciones OK${fallos ? ` · ${fallos} FALLÓ` : ''}`)
  process.exit(fallos ? 1 : 0)
}
