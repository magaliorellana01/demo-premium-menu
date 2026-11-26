// npm run cliente:estado — publica (activo) o despublica (inactivo) el menú de un local.
//   npm run cliente:estado '--' --slug mi-local --activo si     (o --activo no)   Opción: --dry-run
import { argumentos, conectar, ejecutar, sinCortar } from './consola.mjs'
import { cambiarEstado, planDeEstado } from './operaciones.mjs'

const nombre = (activo) => (activo ? 'ACTIVO (menú publicado)' : 'INACTIVO (menú oculto)')

await ejecutar(async (terminal) => {
  const a = argumentos({ slug: { type: 'string' }, activo: { type: 'string' } })
  const base = conectar()
  const slug = a.slug ?? (await terminal.preguntar('Slug del local:'))
  const activo = a.activo ?? (await terminal.preguntar('¿Tiene que quedar activo? (si/no):'))
  const plan = await planDeEstado(base, { slug, activo })

  console.log(`\n${plan.local.nombre} (/${plan.local.slug})\n  Ahora:     ${nombre(plan.local.activo)}\n  Va a quedar: ${nombre(plan.activo)}`)
  if (plan.sinCambios) {
    console.log('\nYa está así: no hay nada que cambiar.')
    return 0
  }
  if (a['dry-run']) {
    console.log('\n--dry-run: no escribí nada.')
    return 0
  }
  if (!(await terminal.confirmar('\n¿Confirmás?'))) {
    console.log('Cancelado: no cambié nada.')
    return 1
  }
  if (plan.protegido && (await terminal.preguntar(`Es parte de la demo o de las pruebas. Escribí "${plan.local.slug}" para confirmar:`)) !== plan.local.slug) {
    console.log('No coincide: no cambié nada.')
    return 1
  }
  const nueva = await sinCortar(() => cambiarEstado(base, plan))
  console.log(`\nListo: /${nueva.slug} quedó ${nombre(nueva.activo)}.`)
  return 0
})
