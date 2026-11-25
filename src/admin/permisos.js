// Permisos del panel: funciones puras, sin red ni React (se prueban con scripts/probar-permisos.mjs).
//
// IMPORTANTE: esto es solo COMODIDAD para la interfaz (mostrar u ocultar botones y pantallas).
// La seguridad real vive en las políticas RLS de supabase/schema.sql: aunque alguien salteara
// estas funciones, la base rechaza lo que no le corresponde.
//
// Reglas (iguales a las del RLS):
//   - admin  (equipo de OESTACK): ve y gestiona todos los locales, crea locales y asigna usuarios.
//   - owner  (dueño):             gestiona categorías y productos de SU local y edita los datos del local.
//   - editor:                     gestiona categorías y productos de SU local; no edita los datos del local.
//
// Forma del "acceso" de un usuario (lo arma armarAcceso):
//   { esAdmin: boolean, locales: [{ id, slug, nombre, activo, rol }] }
//   donde rol es 'admin' | 'owner' | 'editor'. Un admin tiene rol 'admin' en todos los locales.

export const ROL_ADMIN = 'admin'
export const ROL_OWNER = 'owner'
export const ROL_EDITOR = 'editor'

const ROLES_DE_LOCAL = [ROL_OWNER, ROL_EDITOR]

const NOMBRES_DE_ROL = {
  [ROL_ADMIN]: 'Admin de OESTACK',
  [ROL_OWNER]: 'Dueño',
  [ROL_EDITOR]: 'Editor',
}

const DESCRIPCIONES_DE_ROL = {
  [ROL_ADMIN]: 'Podés ver y gestionar todos los locales.',
  [ROL_OWNER]: 'Podés editar el menú y los datos del local.',
  [ROL_EDITOR]: 'Podés editar el menú (categorías y productos).',
}

/** Nombre legible del rol ("owner" -> "Dueño"). Un rol desconocido devuelve "". */
export function nombreDeRol(rol) {
  return NOMBRES_DE_ROL[rol] ?? ''
}

/** Frase corta que explica qué puede hacer el rol. */
export function descripcionDeRol(rol) {
  return DESCRIPCIONES_DE_ROL[rol] ?? ''
}

function localValido(local) {
  return Boolean(local && typeof local === 'object' && typeof local.id === 'string' && typeof local.slug === 'string' && local.slug)
}

/**
 * Arma el acceso a partir de lo que devuelve la base.
 *   esAdmin:     ¿hay una fila del usuario en `admins`?
 *   membresias:  filas de `usuarios_locales` con el local anidado: [{ rol, locales: { id, slug, nombre, activo } }]
 *   todosLosLocales: (solo si es admin) todos los locales que la base le deja ver.
 * Ignora filas con roles desconocidos o locales mal formados, y no repite locales.
 */
export function armarAcceso({ esAdmin = false, membresias = [], todosLosLocales = [] } = {}) {
  const porSlug = new Map()

  if (esAdmin === true) {
    for (const local of Array.isArray(todosLosLocales) ? todosLosLocales : []) {
      if (!localValido(local)) continue
      porSlug.set(local.slug, { id: local.id, slug: local.slug, nombre: local.nombre ?? local.slug, activo: local.activo !== false, rol: ROL_ADMIN })
    }
  }

  for (const fila of Array.isArray(membresias) ? membresias : []) {
    const local = fila?.locales
    if (!ROLES_DE_LOCAL.includes(fila?.rol) || !localValido(local)) continue
    if (porSlug.has(local.slug)) continue // un admin conserva el rol 'admin'; un local no se repite
    porSlug.set(local.slug, { id: local.id, slug: local.slug, nombre: local.nombre ?? local.slug, activo: local.activo !== false, rol: fila.rol })
  }

  const locales = [...porSlug.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { esAdmin: esAdmin === true, locales }
}

/** El local (con su rol) al que el usuario accede por ese slug, o null si no tiene acceso. */
export function localDeAcceso(acceso, slug) {
  if (typeof slug !== 'string') return null
  return acceso?.locales?.find((local) => local.slug === slug.toLowerCase()) ?? null
}

/** Rol del usuario en ese local ('admin' | 'owner' | 'editor'), o null si no tiene acceso. */
export function rolEnLocal(acceso, slug) {
  return localDeAcceso(acceso, slug)?.rol ?? null
}

/** ¿Puede entrar al panel de ese local? */
export function puedeVerLocal(acceso, slug) {
  return rolEnLocal(acceso, slug) !== null
}

/** Categorías y productos: owner, editor y admin. */
export function puedeGestionarMenu(rol) {
  return rol === ROL_OWNER || rol === ROL_EDITOR || rol === ROL_ADMIN
}

/** Datos del local (nombre, horarios, contacto, aviso...): solo owner y admin. */
export function puedeEditarLocal(rol) {
  return rol === ROL_OWNER || rol === ROL_ADMIN
}

/** Crear locales: solo admins de OESTACK. */
export function puedeCrearLocales(acceso) {
  return acceso?.esAdmin === true
}

/** Asignar usuarios a locales: solo admins de OESTACK. */
export function puedeAsignarUsuarios(acceso) {
  return acceso?.esAdmin === true
}

/**
 * A dónde va el usuario al entrar a /admin:
 *   { tipo: 'local', slug }   tiene un único local y no es admin: va directo
 *   { tipo: 'elegir' }        tiene varios, o es admin de OESTACK: elige
 *   { tipo: 'sin-locales' }   no tiene ningún local asignado
 */
export function destinoInicial(acceso) {
  const locales = acceso?.locales ?? []
  if (locales.length === 0) return { tipo: 'sin-locales' }
  if (acceso.esAdmin === true || locales.length > 1) return { tipo: 'elegir' }
  return { tipo: 'local', slug: locales[0].slug }
}

/**
 * A dónde volver después de iniciar sesión. Solo se aceptan rutas internas del panel
 * (que empiecen con "/admin"): cualquier otra cosa (otra web, "//", "/admin/login") vuelve a "/admin".
 */
export function destinoTrasLogin(volver) {
  const porDefecto = '/admin'
  if (typeof volver !== 'string' || volver.length > 200) return porDefecto
  if (!/^\/admin(\/[A-Za-z0-9._~%-]+)*\/?$/.test(volver)) return porDefecto
  if (volver === '/admin/login' || volver.startsWith('/admin/login/')) return porDefecto
  return volver
}
