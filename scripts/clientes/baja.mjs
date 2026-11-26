// npm run cliente:baja — borra un local y/o un usuario. No se puede deshacer.
//   npm run cliente:baja '--' --slug mi-local --con-usuarios     (local y los usuarios que queden sin local)
//   npm run cliente:baja '--' --email dueno@ejemplo.com          (solo un usuario)
//   Opciones: --dry-run  --permitir-protegidos (aroma, local-prueba, sus usuarios y los admins)
import { argumentos, conectar, ejecutar, sinCortar } from './consola.mjs'
import { darDeBaja, planDeBaja } from './operaciones.mjs'

await ejecutar(async (terminal) => {
  const a = argumentos({ slug: { type: 'string' }, email: { type: 'string' }, 'con-usuarios': { type: 'boolean' }, 'permitir-protegidos': { type: 'boolean' } })
  const base = conectar()
  let { slug } = a
  if (!slug && !a.email) slug = await terminal.preguntar('Slug del local a borrar (para borrar solo un usuario, usá --email):')
  const plan = await planDeBaja(base, { slug, email: a.email, conUsuarios: Boolean(a['con-usuarios']), permitirProtegidos: Boolean(a['permitir-protegidos']) })

  console.log('\nSe va a BORRAR para siempre:')
  if (plan.local) {
    console.log(`  - El local "${plan.local.nombre}" (/${plan.local.slug})${plan.local.activo ? '  ⚠ está ACTIVO: el menú y su QR dejan de funcionar' : ''}`)
    console.log(`    ${plan.contenido.categorias} categoría(s), ${plan.contenido.productos} producto(s), ${plan.archivos.length} archivo(s) de Storage y ${plan.miembros.length} membresía(s)`)
  }
  for (const u of plan.usuarios) console.log(`  - El usuario ${u.email}${u.esAdmin ? ' (ADMIN)' : ''}${u.otrosLocales.length ? `  ⚠ también tiene acceso a: ${u.otrosLocales.join(', ')}` : ''}`)
  if (plan.quedanSinLocal.length) console.log(`\nQuedan sin ningún local (no se borran; para borrarlos agregá --con-usuarios): ${plan.quedanSinLocal.join(', ')}`)

  if (a['dry-run']) {
    console.log('\n--dry-run: no borré nada.')
    return 0
  }
  if (!(await terminal.confirmar('\n¿Seguro? No se puede deshacer.'))) {
    console.log('Cancelado: no borré nada.')
    return 1
  }
  if ((await terminal.preguntar(`Segunda confirmación: escribí "${plan.confirmacion}":`)) !== plan.confirmacion) {
    console.log('No coincide: no borré nada.')
    return 1
  }

  const { hecho, quedo } = await sinCortar(() => darDeBaja(base, plan))
  console.log('\nBorrado:')
  for (const x of hecho) console.log(`  - ${x}`)
  if (quedo.length) {
    console.log('\nNO se pudo borrar:')
    for (const x of quedo) console.log(`  - ${x}`)
    return 1
  }
  return 0
})
