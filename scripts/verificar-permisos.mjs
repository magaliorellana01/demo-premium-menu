// Comprueba contra Supabase REAL que el aislamiento entre locales funciona (RLS), usando SOLO la
// clave pública (anon) y las credenciales de dos usuarios de prueba:
//
//   usuario 1 = owner de "aroma"                (TEST_USER1_EMAIL / TEST_USER1_PASSWORD)
//   usuario 2 = owner solo de "local-prueba"    (TEST_USER2_EMAIL / TEST_USER2_PASSWORD)
//   anónimo   = sin sesión
//
// Requiere haber corrido supabase/08-admin-base.sql. Uso:  npm run verificar:permisos
//
// Las credenciales salen de .env (que no se versiona); las contraseñas nunca se imprimen.
//
// Seguridad de la prueba: nada se borra ni se pisa de forma permanente. Las escrituras permitidas
// son "no-ops" (se escribe el mismo valor) o filas temporales (nombre "ZZ-prueba-permisos-...") que
// quedan INACTIVAS y se borran al final. Los intentos de borrar algo ajeno apuntan solo a esas filas
// temporales o al local de prueba, jamás a datos reales de aroma. Al terminar se comprueba que no
// quedó basura y que todo está como estaba.
import { createClient } from '@supabase/supabase-js'

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

const crear = () => createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const anon = crear()
const c1 = crear()
const c2 = crear()

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

const contexto = { aroma: null, prueba: null, antes: null }
const creadas = { aroma: { categorias: [], productos: [] }, prueba: { categorias: [], productos: [] }, archivos: [] }

async function limpiarTemporales() {
  // Borra todo lo que empiece con el prefijo en ambos locales (también restos de una corrida anterior).
  const errores = []
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
  return errores
}

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
  await limpiarTemporales()

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
      const estado = await c2.from('locales').select('activo, descripcion, nombre').eq('id', prueba.id).maybeSingle()
      ver(estado.data?.activo === false && estado.data?.nombre === prueba.nombre, 'El local de prueba sigue inactivo y con su nombre', estado.error ? msg(estado) : '')
      const estadoAroma = await anon.from('locales').select('activo, nombre, descripcion').eq('id', aroma.id).maybeSingle()
      ver(estadoAroma.data?.activo === true && estadoAroma.data?.nombre === aroma.nombre && estadoAroma.data?.descripcion === aroma.descripcion, 'aroma sigue activo y con sus datos', estadoAroma.error ? msg(estadoAroma) : '')
    }
  } catch (e) {
    ver(false, 'La limpieza terminó con un error', e.message)
  }
  await Promise.allSettled([c1.auth.signOut(), c2.auth.signOut()])

  console.log(`\n${total - fallos}/${total} comprobaciones OK${fallos ? ` · ${fallos} FALLÓ` : ''}`)
  process.exit(fallos ? 1 : 0)
}
