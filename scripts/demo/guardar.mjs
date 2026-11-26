// npm run demo:guardar — guarda cómo se ve Aroma AHORA como "así se ve la demo".
//   Opción: --dry-run
import { argumentos, conectar, ejecutar } from '../clientes/consola.mjs'
import { ARCHIVO_VISIBLE, escribirCopia, leerCopiaGuardada } from './archivo.mjs'
import { describirDiferencias, diferencias, problemasDeCopia, revisarAntesDeGuardar } from './copia.mjs'
import { capturarDemo } from './operaciones.mjs'

await ejecutar(async (terminal) => {
  const a = argumentos({})
  const copia = await capturarDemo(conectar())
  const { impiden, avisos } = revisarAntesDeGuardar(copia)

  const { local } = copia
  console.log(`\nAroma, como está ahora:`)
  console.log(`  Nombre: ${local.nombre} · ${local.activo ? 'activo' : 'INACTIVO'}`)
  console.log(`  Descripción: ${local.descripcion ?? '(sin descripción)'}`)
  console.log(`  Contacto: WhatsApp ${local.whatsapp ?? '—'} · Instagram ${local.instagram ?? '—'}`)
  console.log(`  Dirección: ${local.direccion ?? '—'}`)
  console.log(`  Logo: ${local.logo_url ?? '(sin logo)'}`)
  console.log(`  Colores y frase: ${JSON.stringify(local.tema)}`)
  console.log(`  Horarios cargados: ${Object.keys(local.horarios?.semana ?? {}).length} día(s)`)
  console.log(`  Aviso: ${local.aviso_activo ? 'ACTIVO' : 'apagado'}${local.aviso_texto ? ` — "${local.aviso_texto}"` : ''}`)
  console.log(`\n  ${copia.categorias.length} categorías y ${copia.productos.length} productos:`)
  for (const c of copia.categorias) {
    const suyos = copia.productos.filter((p) => p.categoria_id === c.id)
    console.log(`    - ${c.nombre}${c.activa ? '' : ' (oculta)'}: ${suyos.length} producto(s), ${(c.adicionales ?? []).length} adicional(es)`)
  }
  const cuantos = (f) => copia.productos.filter(f).length
  console.log(`  Destacados: ${cuantos((p) => p.destacado)} · no disponibles: ${cuantos((p) => !p.disponible)} · con opciones: ${cuantos((p) => p.variantes?.length)} · sin foto: ${cuantos((p) => !p.imagen_url)}`)
  console.log(`  Archivos en Storage: ${copia.archivos.length}`)

  const anterior = leerCopiaGuardada()
  if (anterior && !problemasDeCopia(anterior).length) {
    const d = diferencias(anterior, copia)
    if (d.total === 0) {
      console.log(`\nEs igual a lo guardado en ${ARCHIVO_VISIBLE}: no hay nada que guardar.`)
      return 0
    }
    console.log('\nCambios respecto de lo guardado:')
    for (const r of describirDiferencias(d, { agregadas: 'nuevas', borradas: 'que ya no están', modificadas: 'modificadas', sobrantes: 'se agregan', faltantes: 'se quitan' })) console.log(`  - ${r}`)
  } else console.log(`\nTodavía no hay una copia válida en ${ARCHIVO_VISIBLE}.`)

  for (const aviso of avisos) console.log(`\nOJO: ${aviso}`)
  if (impiden.length) {
    console.log(`\nNo se puede guardar:\n  - ${impiden.join('\n  - ')}`)
    return 1
  }
  if (a['dry-run']) {
    console.log('\n--dry-run: no guardé nada.')
    return 0
  }
  if (!(await terminal.confirmar('\nEsto pasa a ser "cómo se ve la demo": demo:reiniciar va a volver siempre acá. ¿Guardar?'))) {
    console.log('Cancelado: no guardé nada.')
    return 1
  }
  escribirCopia(copia)
  console.log(`\nGuardado en ${ARCHIVO_VISIBLE}. Revisalo y commitealo.`)
  return 0
})
