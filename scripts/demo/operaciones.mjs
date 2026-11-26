// Guardar y reiniciar la demo. Trabaja sobre la "base" de scripts/clientes/base.mjs, así los
// fallos se prueban sin red (scripts/probar-demo.mjs). Nada de acá imprime contraseñas.
import { ErrorDeUso } from '../clientes/operaciones.mjs'
import { problemaDeContrasena } from '../../src/admin/contrasena.js'
import { armarCopia, DEMO_EMAIL, diferencias, problemasDeCopia, SLUG_DEMO } from './copia.mjs'

const exigir = (condicion, mensaje) => {
  if (!condicion) throw new ErrorDeUso(mensaje)
}

async function localDemo(base) {
  const local = await base.leerLocal(SLUG_DEMO)
  exigir(local && local.slug === SLUG_DEMO, `No existe el local "${SLUG_DEMO}".`)
  return local
}

/** El estado de Aroma tal como está ahora, con el mismo formato que la copia guardada. */
export async function leerEstado(base, local) {
  const [categorias, productos, rutas] = await Promise.all([
    base.listarFilas('categorias', local.id),
    base.listarFilas('productos', local.id),
    base.archivosDe(local.id),
  ])
  return armarCopia({ local, categorias, productos, archivos: rutas.map((r) => r.slice(local.id.length + 1)) })
}

export async function capturarDemo(base) {
  return leerEstado(base, await localDemo(base))
}

/**
 * Los usuarios que son la cuenta demo: el del email de la demo y los que tengan su marca (por si
 * alguien le cambió el email desde la API). La marca va en app_metadata, que el usuario no puede
 * tocar. Si alguno puede algo más que ser parte de Aroma, se frena: no se borra ni se modifica.
 */
async function cuentasDemo(base) {
  const usuarios = (await base.listarUsuarios()).filter((u) => u.email?.toLowerCase() === DEMO_EMAIL || u.marca === SLUG_DEMO)
  const cuentas = []
  for (const usuario of usuarios) {
    const [admin, membresias] = [await base.esAdmin(usuario.id), await base.membresiasDe(usuario.id)]
    exigir(!admin, `PELIGRO: ${usuario.email} es ADMIN. La cuenta demo es pública y nunca puede serlo. No cambié nada: sacalo de "admins" desde el SQL Editor.`)
    const otros = membresias.filter((m) => m.slug !== SLUG_DEMO).map((m) => m.slug)
    exigir(!otros.length, `PELIGRO: ${usuario.email} también tiene acceso a ${otros.join(', ')}. La cuenta demo es pública: solo puede ser de "${SLUG_DEMO}". No cambié nada: revisalo.`)
    cuentas.push({ ...usuario, membresias })
  }
  return cuentas
}

/** Mira todo antes de escribir. */
export async function planDeReinicio(base, copia, { password }) {
  const problemas = problemasDeCopia(copia)
  exigir(!problemas.length, `La copia guardada no se puede aplicar:\n  - ${problemas.join('\n  - ')}`)
  exigir(password, 'Falta DEMO_PASSWORD en el .env.')
  const problema = problemaDeContrasena(password)
  exigir(!problema, `DEMO_PASSWORD no cumple la política. ${problema}`)
  const local = await localDemo(base)
  const cuentas = await cuentasDemo(base)
  return { local, copia, cuentas, cambios: diferencias(copia, await leerEstado(base, local)) }
}

/**
 * Deja Aroma como la copia y la cuenta demo como nueva. Se puede repetir: si se corta, volver a
 * correrlo termina el trabajo. El orden importa:
 *   1. Se borra la cuenta demo. Con eso, hasta los accesos que alguien ya tenía abiertos dejan
 *      de poder escribir en el acto (cambiar solo la contraseña no corta el acceso en curso), y
 *      se van también un email, un segundo factor o datos que le hayan puesto desde la API.
 *   2. Primero se repone y recién después se borra lo que sobra: el menú nunca queda vacío.
 *   3. Se crea la cuenta de nuevo, dueña solo de Aroma.
 */
export async function reiniciarDemo(base, plan, { password, avisar = () => {} }) {
  const { local, copia } = plan

  for (const cuenta of plan.cuentas) await base.borrarUsuario(cuenta.id)
  avisar(plan.cuentas.length ? 'Sesiones de la demo cerradas.' : 'No había cuenta demo.')

  await base.actualizarLocal(local.id, copia.local)
  const conLocal = (filas) => filas.map((f) => ({ ...f, local_id: local.id }))
  await base.guardarFilas('categorias', conLocal(copia.categorias))
  await base.guardarFilas('productos', conLocal(copia.productos))

  const actual = await leerEstado(base, local)
  const cambios = diferencias(copia, actual)
  // Productos antes que categorías: no se puede borrar una categoría con productos.
  await base.borrarFilas('productos', local.id, cambios.productos.agregadas.map((f) => f.id))
  await base.borrarFilas('categorias', local.id, cambios.categorias.agregadas.map((f) => f.id))
  if (cambios.archivos.sobrantes.length) await base.borrarArchivos(cambios.archivos.sobrantes.map((a) => `${local.id}/${a}`))
  avisar('Menú, ajustes y archivos restaurados.')

  const usuario = await base.crearUsuario(DEMO_EMAIL, password, { oestack_demo: SLUG_DEMO })
  await base.agregarMiembro(usuario.id, local.id, 'owner')
  avisar('Cuenta demo creada, dueña solo de Aroma.')

  // Se comprueba contra la base, no se da por hecho.
  const final = diferencias(copia, await leerEstado(base, await localDemo(base)))
  const [cuenta, ...demas] = await cuentasDemo(base)
  const cuentaBien = Boolean(cuenta) && !demas.length && cuenta.membresias.length === 1 && cuenta.membresias[0].rol === 'owner'
  return { restantes: final, cuentaBien }
}
