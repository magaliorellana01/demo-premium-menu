// Comprueba, usando SOLO la anon key (la misma que usa el navegador), que:
//   - se puede LEER el menú público;
//   - NO se puede escribir (insert / update / delete / subir archivos);
//   - NO se pueden leer las tablas internas (usuarios_locales, admins).
//
// Uso:  npm run verificar:rls   (lee las variables de .env)
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (ver .env.example).')
  process.exit(1)
}

const supabase = createClient(url, key)
let fallos = 0

function resultado(ok, titulo, detalle = '') {
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${titulo}${detalle ? `  →  ${detalle}` : ''}`)
}

// Una escritura bloqueada devuelve error o no afecta ninguna fila.
function bloqueada({ error, data }) {
  return Boolean(error) || !data || data.length === 0
}
const msg = (r) => (r.error ? `${r.error.code ?? ''} ${r.error.message}` : 'sin filas afectadas')

console.log('\n— Lectura pública (debe funcionar) —')
const locales = await supabase.from('locales').select('id, slug, activo')
resultado(!locales.error && locales.data.length > 0, 'Leer locales', locales.error?.message ?? `${locales.data?.length} local(es)`)
resultado(locales.data?.every((l) => l.activo), 'Solo se ven locales activos')

const menu = await supabase.from('locales').select('*, categorias(*, productos(*))').eq('slug', 'aroma').maybeSingle()
const categorias = menu.data?.categorias ?? []
const productos = categorias.flatMap((c) => c.productos)
resultado(categorias.length === 3, 'Leer categorías de "aroma"', `${categorias.length} categorías`)
resultado(productos.length === 18, 'Leer productos de "aroma"', `${productos.length} productos`)
resultado(productos.some((p) => p.disponible === false), 'Se ven también los productos con disponible = false')

console.log('\n— Escritura anónima (debe FALLAR) —')
const localId = menu.data?.id
const categoriaId = categorias[0]?.id
const productoId = productos[0]?.id

let r = await supabase.from('productos').insert({
  local_id: localId, categoria_id: categoriaId, nombre: 'Producto intruso', precio: 1,
}).select()
resultado(bloqueada(r), 'INSERT en productos', msg(r))

r = await supabase.from('productos').update({ precio: 1 }).eq('id', productoId).select()
resultado(bloqueada(r), 'UPDATE en productos', msg(r))

r = await supabase.from('productos').delete().eq('id', productoId).select()
resultado(bloqueada(r), 'DELETE en productos', msg(r))

r = await supabase.from('categorias').insert({ local_id: localId, nombre: 'Intrusa' }).select()
resultado(bloqueada(r), 'INSERT en categorias', msg(r))

r = await supabase.from('locales').insert({ slug: 'intruso', nombre: 'Intruso' }).select()
resultado(bloqueada(r), 'INSERT en locales', msg(r))

r = await supabase.from('locales').update({ activo: false }).eq('slug', 'aroma').select()
resultado(bloqueada(r), 'UPDATE en locales', msg(r))

r = await supabase.from('admins').insert({ user_id: '00000000-0000-0000-0000-000000000000' }).select()
resultado(bloqueada(r), 'INSERT en admins', msg(r))

r = await supabase.storage.from('imagenes').upload(`${localId}/productos/intruso.png`, new Blob(['x'], { type: 'image/png' }))
resultado(Boolean(r.error), 'Subir un archivo a Storage', r.error?.message ?? 'se subió (¡mal!)')

console.log('\n— Tablas internas (no deben verse) —')
for (const tabla of ['usuarios_locales', 'admins']) {
  r = await supabase.from(tabla).select('*')
  resultado(Boolean(r.error) || r.data.length === 0, `Leer ${tabla}`, r.error ? `${r.error.code} ${r.error.message}` : '0 filas')
}

// ── Lo que un anónimo puede leer (Tarea 13, docs/seguridad.md) ──
console.log('\n— Lectura anónima: solo las columnas del menú —')
// La lista completa de lo público A PROPÓSITO. Si aparece una columna nueva, esto falla para
// que alguien decida si puede ser pública (la lectura anónima está dada por TABLA).
const PUBLICAS = {
  locales: 'activo,aviso_activo,aviso_texto,descripcion,direccion,horarios,id,instagram,logo_url,nombre,slug,tema,updated_at,whatsapp',
  categorias: 'activa,adicionales,id,local_id,nombre,orden',
  productos: 'categoria_id,descripcion,destacado,disponible,etiquetas,id,imagen_url,local_id,nombre,orden,precio,variantes',
}
const leido = []
for (const [tabla, columnas] of Object.entries(PUBLICAS)) {
  r = await supabase.from(tabla).select('*')
  leido.push(...(r.data ?? []))
  const vistas = Object.keys(r.data?.[0] ?? {}).sort().join()
  resultado(!r.error && vistas === columnas, `${tabla}: ni más ni menos que las columnas esperadas`, r.error?.message ?? (vistas === columnas ? `${columnas.split(',').length} columnas, ${r.data.length} fila(s)` : `se ven: ${vistas}`))
}
const textoPublico = JSON.stringify(leido)
resultado(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(textoPublico) && !textoPublico.includes('user_id'), 'Ningún email ni id de usuario en lo que se lee')

console.log('\n— Locales inactivos y contenido oculto: no se pueden listar —')
for (const [que, consulta] of [
  ['locales inactivos (filtro activo=false)', supabase.from('locales').select('id').eq('activo', false)],
  ['el local de prueba, por slug', supabase.from('locales').select('id').eq('slug', 'local-prueba')],
  ['el local de prueba, buscando por parte del slug', supabase.from('locales').select('id').like('slug', '%prueba%')],
  ['categorías ocultas', supabase.from('categorias').select('id').eq('activa', false)],
  ['categorías de locales inactivos (por relación)', supabase.from('categorias').select('id, locales!inner(activo)').eq('locales.activo', false)],
  ['productos de locales inactivos (por relación)', supabase.from('productos').select('id, locales!inner(activo)').eq('locales.activo', false)],
]) {
  r = await consulta
  resultado(!r.error && r.data.length === 0, `No se leen ${que}`, r.error?.message ?? `${r.data.length} filas`)
}
const visibles = (await supabase.from('locales').select('id')).data?.length
r = await supabase.from('locales').select('*', { count: 'exact', head: true })
resultado(!r.error && r.count === visibles, 'Contar filas tampoco delata locales ocultos', `${r.count} contados, ${visibles} visibles`)

console.log('\n— Otras puertas (deben estar cerradas) —')
r = await supabase.from('locales').select('slug, usuarios_locales(*)')
resultado(Boolean(r.error), 'Leer membresías pidiéndolas como relación de un local', r.error ? msg(r) : 'SE LEYERON')
const U = '00000000-0000-0000-0000-000000000000'
for (const [funcion, args] of [['es_admin', {}], ['es_miembro', { p_local_id: U }], ['es_owner', { p_local_id: U }], ['reordenar_categorias', { p_local_id: U, p_ids: [] }], ['reordenar_productos', { p_local_id: U, p_categoria_id: U, p_ids: [] }], ['tema_valido', { p_tema: {} }], ['horarios_validos', { p_horarios: {} }]]) {
  r = await supabase.rpc(funcion, args)
  resultado(r.error?.code === '42501', `Ejecutar la función ${funcion}`, r.error ? `${r.error.code} ${r.error.message}` : 'SE EJECUTÓ')
}
for (const esquema of ['auth', 'storage']) {
  r = await supabase.schema(esquema).from('users').select('*')
  resultado(Boolean(r.error), `Leer el esquema interno "${esquema}"`, r.error ? msg(r) : 'SE LEYÓ')
}
const cabeceras = { apikey: key, Authorization: `Bearer ${key}` }
for (const [que, ruta] of [['la descripción de toda la API (OpenAPI)', '/rest/v1/'], ['la lista de usuarios (API de administración)', '/auth/v1/admin/users']]) {
  const x = await fetch(`${url}${ruta}`, { headers: cabeceras })
  resultado(x.status === 401 || x.status === 403, `Leer ${que}`, `HTTP ${x.status}`)
}

console.log('\n— Storage: un anónimo no puede listar —')
// Que haya archivos y aun así no se listen se comprueba en verificar:permisos (necesita sesión).
const cubos = await supabase.storage.listBuckets()
resultado(Boolean(cubos.error) || cubos.data.length === 0, 'Listar los buckets', cubos.error?.message ?? `${cubos.data.length} bucket(s)`)
for (const carpeta of ['', localId, `${localId}/productos`, `${localId}/logo`]) {
  const x = await supabase.storage.from('imagenes').list(carpeta, { limit: 100 })
  resultado(Boolean(x.error) || x.data.length === 0, `Listar ${carpeta ? `la carpeta ${carpeta.replace(localId, '<aroma>')}` : 'la raíz del bucket'}`, x.error?.message ?? `${x.data.length} entradas`)
}

console.log('\n— Registro de usuarios nuevos (debe estar cerrado) —')
const ajustes = await (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })).json()
resultado(ajustes.disable_signup === true, 'La configuración pública dice que el registro está desactivado')
// Con el registro abierto no se intenta: ya quedó informado y así no se crea ningún usuario.
if (ajustes.disable_signup === true) {
  const sinSesion = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'zz-registro' } })
  const alta = await sinSesion.auth.signUp({ email: 'zz-prueba-permisos-registro@example.com', password: `Zz!9-${crypto.randomUUID()}` })
  resultado(Boolean(alta.error) && !alta.data?.session, 'Registrarse desde la API: rechazado', alta.error ? `${alta.error.status} ${alta.error.code}` : 'SE CREÓ: borrá zz-prueba-permisos-registro@example.com en Authentication > Users')
  const anonimo = await sinSesion.auth.signInAnonymously()
  resultado(Boolean(anonimo.error) && !anonimo.data?.session, 'Entrar como usuario anónimo de Auth: rechazado', anonimo.error ? `${anonimo.error.status} ${anonimo.error.code}` : 'SE ACEPTÓ: desactivalo en Authentication > Sign In / Providers y borrá ese usuario')
}

console.log(fallos === 0 ? '\nTodo en orden: se puede leer el menú y no escribir.' : `\n${fallos} comprobación(es) fallaron: revisá las políticas.`)
process.exit(fallos === 0 ? 0 : 1)
