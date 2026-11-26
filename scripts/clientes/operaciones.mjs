// La lógica de alta, contraseña, estado y baja. No habla con Supabase directamente sino con
// una "base" (ver base.mjs), así los fallos a mitad de camino se prueban sin red
// (scripts/probar-clientes.mjs). Nada de acá imprime ni guarda contraseñas.
import { generarContrasena, LOCALES_PROTEGIDOS, localNuevo, normalizarEmail, problemaDeEmail, problemaDeNombre, problemaDeSlug } from './reglas.mjs'

/** Un error esperable, con un mensaje para mostrar tal cual. */
export class ErrorDeUso extends Error {}

const exigir = (condicion, mensaje) => {
  if (!condicion) throw new ErrorDeUso(mensaje)
}

// ── Alta ─────────────────────────────────────────────────────────────

/**
 * Mira todo antes de escribir. Devuelve el plan:
 *   { tipo: 'alta' | 'completar' | 'nada', datos, local, usuario, pasos: [texto] }
 * "completar" retoma un alta que quedó a medias; "nada" es que ya estaba hecha.
 */
export async function planDeAlta(base, { nombre, slug, email, usuarioExistente = false }) {
  const datos = { nombre: String(nombre ?? '').trim(), slug: String(slug ?? '').trim(), email: normalizarEmail(email), usuarioExistente }
  const problema = problemaDeNombre(datos.nombre) || problemaDeSlug(datos.slug) || problemaDeEmail(datos.email)
  exigir(!problema, problema)

  const [local, usuario] = [await base.buscarLocal(datos.slug), await base.buscarUsuario(datos.email)]

  if (local) {
    const miembros = await base.miembrosDeLocal(local.id)
    if (usuario && miembros.some((m) => m.user_id === usuario.id && m.rol === 'owner') && local.nombre === datos.nombre) {
      return { tipo: 'nada', datos, local, usuario, pasos: [] }
    }
    // Solo se retoma un local que es claramente un alta a medias: inactivo, sin nadie y vacío.
    const contenido = await base.contenidoDeLocal(local.id)
    const aMedias = !local.activo && miembros.length === 0 && contenido.categorias === 0 && contenido.productos === 0 && local.nombre === datos.nombre
    exigir(aMedias && !LOCALES_PROTEGIDOS.includes(datos.slug), `Ya existe un local con el slug "${datos.slug}". No se cambió nada.`)
  }

  if (usuario) {
    exigir(
      usuarioExistente,
      `Ya hay un usuario con ${datos.email}. Si es la misma persona, agregá --usuario-existente (conserva su contraseña; si no la tiene, después usá npm run cliente:password).`,
    )
  } else {
    exigir(!usuarioExistente, `Pediste --usuario-existente, pero no hay ningún usuario con ${datos.email}.`)
  }

  return {
    tipo: local ? 'completar' : 'alta',
    datos,
    local,
    usuario,
    pasos: [
      local ? `Usar el local "${datos.slug}" que quedó a medias` : `Crear el local "${datos.nombre}" (/${datos.slug}), INACTIVO y sin productos`,
      usuario ? `Vincular el usuario que ya existe (${datos.email}), sin tocar su contraseña` : `Crear el usuario ${datos.email} con email confirmado y contraseña temporal`,
      'Agregarlo como dueño del local',
    ],
  }
}

/**
 * Crea lo que dice el plan. Si algo falla, deshace SOLO lo que creó esta corrida. Si ni eso se
 * puede, el error trae `quedo` con lo que hay que limpiar a mano.
 * Devuelve { local, usuario, contrasena } (contrasena null si el usuario ya existía).
 */
export async function darDeAlta(base, plan, { generar = generarContrasena } = {}) {
  exigir(plan.tipo === 'alta' || plan.tipo === 'completar', 'Ese plan no tiene nada para crear.')
  const { datos } = plan
  const deshacer = [] // [descripcion, comoLimpiar, accion]
  try {
    let local = plan.local
    if (!local) {
      try {
        local = await base.crearLocal(localNuevo(datos))
      } catch (error) {
        // Pudo crearse y perderse la respuesta: si está y quedó vacío, también se deshace.
        const creado = await base.buscarLocal(datos.slug).catch(() => null)
        if (creado && !creado.activo && (await base.miembrosDeLocal(creado.id).catch(() => [1])).length === 0) {
          deshacer.push([`el local /${datos.slug}`, `npm run cliente:baja -- --slug ${datos.slug}`, () => base.borrarLocal(creado.id)])
        }
        throw error
      }
      deshacer.push([`el local /${datos.slug}`, `npm run cliente:baja -- --slug ${datos.slug}`, () => base.borrarLocal(local.id)])
    }

    let usuario = plan.usuario
    let contrasena = null
    if (!usuario) {
      contrasena = generar()
      const como = `npm run cliente:baja -- --email ${datos.email}`
      try {
        usuario = await base.crearUsuario(datos.email, contrasena)
      } catch (error) {
        // El plan comprobó que no existía: si ahora está, lo creó este intento.
        const creado = await base.buscarUsuario(datos.email).catch(() => null)
        if (creado) deshacer.push([`el usuario ${datos.email}`, como, () => base.borrarUsuario(creado.id)])
        throw error
      }
      deshacer.push([`el usuario ${datos.email}`, como, () => base.borrarUsuario(usuario.id)])
    }

    await base.agregarMiembro(usuario.id, local.id, 'owner')
    return { local, usuario, contrasena }
  } catch (error) {
    const quedo = []
    for (const [que, como, accion] of deshacer.reverse()) {
      try {
        await accion()
      } catch {
        quedo.push({ que, como })
      }
    }
    error.quedo = quedo
    error.deshecho = deshacer.length - quedo.length
    throw error
  }
}

// ── Contraseña ───────────────────────────────────────────────────────

export async function planDePassword(base, { email }) {
  const correo = normalizarEmail(email)
  const problema = problemaDeEmail(correo)
  exigir(!problema, problema)
  const usuario = await base.buscarUsuario(correo)
  exigir(usuario, `No hay ningún usuario con ${correo}.`)
  const [membresias, admin] = [await base.membresiasDe(usuario.id), await base.esAdmin(usuario.id)]
  return { email: correo, usuario, membresias, esAdmin: admin }
}

export async function regenerarPassword(base, plan, { generar = generarContrasena } = {}) {
  const contrasena = generar()
  await base.cambiarPassword(plan.usuario.id, contrasena)
  return { contrasena }
}

// ── Estado ───────────────────────────────────────────────────────────

const SI = ['activo', 'activar', 'si', 'sí', 'true']
const NO = ['inactivo', 'desactivar', 'no', 'false']

export async function planDeEstado(base, { slug, activo }) {
  const valor = String(activo ?? '').toLowerCase()
  exigir(SI.includes(valor) || NO.includes(valor), 'Indicá --activo si  o  --activo no.')
  const local = await base.buscarLocal(String(slug ?? '').trim())
  exigir(local, `No hay ningún local con el slug "${slug ?? ''}".`)
  const deseado = SI.includes(valor)
  return { local, activo: deseado, sinCambios: local.activo === deseado, protegido: LOCALES_PROTEGIDOS.includes(local.slug) }
}

export async function cambiarEstado(base, plan) {
  return base.cambiarActivo(plan.local.id, plan.activo)
}

// ── Baja ─────────────────────────────────────────────────────────────

/**
 * Qué se va a borrar. Solo se borra lo que se pide: el local (--slug), el usuario (--email) y,
 * con `conUsuarios`, los usuarios que quedarían sin ningún local.
 */
export async function planDeBaja(base, { slug, email, conUsuarios = false, permitirProtegidos = false }) {
  exigir(slug || email, 'Indicá qué borrar: --slug, --email o los dos.')
  const plan = { local: null, miembros: [], contenido: null, archivos: [], usuarios: [], quedanSinLocal: [], confirmacion: '' }
  const protegido = (queEs) => `${queEs} es parte de la demo o de las pruebas. Si de verdad querés borrarlo, agregá --permitir-protegidos.`

  if (slug) {
    plan.local = await base.buscarLocal(slug)
    exigir(plan.local, `No hay ningún local con el slug "${slug}".`)
    exigir(!LOCALES_PROTEGIDOS.includes(plan.local.slug) || permitirProtegidos, protegido(`El local "${plan.local.slug}"`))
    plan.miembros = await base.miembrosDeLocal(plan.local.id)
    plan.contenido = await base.contenidoDeLocal(plan.local.id)
    plan.archivos = await base.archivosDe(plan.local.id)
  }

  const candidatos = new Map()
  if (email) {
    const correo = normalizarEmail(email)
    const usuario = await base.buscarUsuario(correo)
    exigir(usuario, `No hay ningún usuario con ${correo}.`)
    candidatos.set(usuario.id, { id: usuario.id, email: correo, pedido: true })
  }
  for (const miembro of plan.miembros) {
    if (candidatos.has(miembro.user_id)) continue
    const otros = (await base.membresiasDe(miembro.user_id)).filter((m) => m.local_id !== plan.local.id)
    if (otros.length || (await base.esAdmin(miembro.user_id))) continue // sigue teniendo algo que hacer
    if (conUsuarios) candidatos.set(miembro.user_id, { id: miembro.user_id, email: miembro.email, pedido: false })
    else plan.quedanSinLocal.push(miembro.email)
  }

  for (const candidato of candidatos.values()) {
    const membresias = await base.membresiasDe(candidato.id)
    const admin = await base.esAdmin(candidato.id)
    const deLaDemo = membresias.some((m) => LOCALES_PROTEGIDOS.includes(m.slug))
    exigir(permitirProtegidos || (!admin && !deLaDemo), protegido(`El usuario ${candidato.email} ${admin ? 'es admin y' : 'tiene acceso a un local protegido y'}`))
    const otros = membresias.filter((m) => m.local_id !== plan.local?.id)
    plan.usuarios.push({ ...candidato, esAdmin: admin, otrosLocales: otros.map((m) => m.slug) })
  }

  plan.confirmacion = plan.local ? plan.local.slug : plan.usuarios[0].email
  return plan
}

/**
 * Borra en orden seguro: primero la base (el local arrastra categorías, productos y
 * membresías), después sus archivos y al final los usuarios. Si algo falla sigue con lo que
 * puede y devuelve lo que quedó.
 */
export async function darDeBaja(base, plan) {
  const hecho = []
  const quedo = []
  if (plan.local) {
    // Si el local no se puede borrar, no se toca nada más.
    await base.borrarLocal(plan.local.id)
    hecho.push(`Local /${plan.local.slug} (con sus categorías, productos y membresías)`)
    if (plan.archivos.length) {
      try {
        await base.borrarArchivos(plan.archivos)
        hecho.push(`${plan.archivos.length} archivo(s) de Storage`)
      } catch {
        quedo.push(...plan.archivos.map((ruta) => `Archivo de Storage: imagenes/${ruta}`))
      }
    }
  }
  for (const usuario of plan.usuarios) {
    try {
      await base.borrarUsuario(usuario.id)
      hecho.push(`Usuario ${usuario.email}`)
    } catch {
      quedo.push(`Usuario ${usuario.email} (borralo con: npm run cliente:baja -- --email ${usuario.email})`)
    }
  }
  return { hecho, quedo }
}
