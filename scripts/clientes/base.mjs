// La "base" que usan las operaciones (operaciones.mjs), sobre Supabase con la clave secreta.
// Si algo falla se lanza un Error con lo que se estaba haciendo (nunca con datos sensibles).
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'imagenes'

export function clienteSecreto({ url, clave }) {
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export function crearBase(cliente) {
  const pedir = async (queHacia, consulta) => {
    const { data, error } = await consulta
    if (error) {
      const permiso = error.code === '42501' ? ' (¿corriste supabase/12-admin-clientes.sql?)' : ''
      throw Object.assign(new Error(`No se pudo ${queHacia}: ${error.message}${permiso}`), { code: error.code, status: error.status })
    }
    return data
  }
  const contar = async (tabla, localId) => {
    const { count, error } = await cliente.from(tabla).select('*', { count: 'exact', head: true }).eq('local_id', localId)
    if (error) throw new Error(`No se pudo contar ${tabla}: ${error.message}`)
    return count ?? 0
  }

  /** Todos los usuarios de Auth (la API de administración no busca por email). */
  async function usuarios() {
    const todos = []
    for (let pagina = 1; pagina <= 100; pagina++) {
      const data = await pedir('leer los usuarios', cliente.auth.admin.listUsers({ page: pagina, perPage: 200 }))
      todos.push(...data.users)
      if (data.users.length < 200) return todos
    }
    throw new Error('Hay demasiados usuarios para recorrerlos.')
  }

  async function archivosDe(carpeta) {
    const lista = await pedir('listar Storage', cliente.storage.from(BUCKET).list(carpeta, { limit: 1000 }))
    const rutas = []
    for (const objeto of lista) {
      const ruta = `${carpeta}/${objeto.name}`
      // Las "carpetas" vienen sin id.
      if (objeto.id) rutas.push(ruta)
      else rutas.push(...(await archivosDe(ruta)))
    }
    return rutas
  }

  return {
    buscarLocal: (slug) => pedir('buscar el local', cliente.from('locales').select('id, slug, nombre, activo').eq('slug', slug).maybeSingle()),
    crearLocal: (fila) => pedir('crear el local', cliente.from('locales').insert(fila).select('id, slug, nombre, activo').single()),
    borrarLocal: (id) => pedir('borrar el local', cliente.from('locales').delete().eq('id', id)),
    async cambiarActivo(id, activo) {
      return pedir('cambiar el estado', cliente.from('locales').update({ activo }).eq('id', id).select('id, slug, nombre, activo').single())
    },
    async contenidoDeLocal(id) {
      return { categorias: await contar('categorias', id), productos: await contar('productos', id) }
    },
    archivosDe,
    async borrarArchivos(rutas) {
      for (let i = 0; i < rutas.length; i += 100) await pedir('borrar archivos', cliente.storage.from(BUCKET).remove(rutas.slice(i, i + 100)))
    },

    async buscarUsuario(email) {
      const usuario = (await usuarios()).find((u) => u.email?.toLowerCase() === email)
      return usuario ? { id: usuario.id, email: usuario.email } : null
    },
    async crearUsuario(email, password) {
      // Email ya confirmado: no se envía ningún mail.
      const data = await pedir('crear el usuario', cliente.auth.admin.createUser({ email, password, email_confirm: true }))
      return { id: data.user.id, email: data.user.email }
    },
    borrarUsuario: (id) => pedir('borrar el usuario', cliente.auth.admin.deleteUser(id)),
    cambiarPassword: (id, password) => pedir('cambiar la contraseña', cliente.auth.admin.updateUserById(id, { password })),

    async miembrosDeLocal(localId) {
      const filas = await pedir('leer las membresías', cliente.from('usuarios_locales').select('user_id, rol').eq('local_id', localId))
      if (!filas.length) return []
      const correos = new Map((await usuarios()).map((u) => [u.id, u.email]))
      return filas.map((f) => ({ ...f, email: correos.get(f.user_id) ?? '(sin email)' }))
    },
    async membresiasDe(userId) {
      const filas = await pedir('leer las membresías', cliente.from('usuarios_locales').select('local_id, rol, locales(slug)').eq('user_id', userId))
      return filas.map((f) => ({ local_id: f.local_id, rol: f.rol, slug: f.locales?.slug }))
    },
    agregarMiembro: (userId, localId, rol) =>
      pedir('agregar el usuario al local', cliente.from('usuarios_locales').upsert({ user_id: userId, local_id: localId, rol }, { onConflict: 'user_id,local_id' })),
    async esAdmin(userId) {
      return Boolean(await pedir('leer los admins', cliente.from('admins').select('user_id').eq('user_id', userId).maybeSingle()))
    },
    hacerAdmin: (userId) => pedir('agregar el admin', cliente.from('admins').upsert({ user_id: userId }, { onConflict: 'user_id' })),
  }
}
