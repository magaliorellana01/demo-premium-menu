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

console.log(fallos === 0 ? '\nTodo en orden: se puede leer el menú y no escribir.' : `\n${fallos} comprobación(es) fallaron: revisá las políticas.`)
process.exit(fallos === 0 ? 0 : 1)
