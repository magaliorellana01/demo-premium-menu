// npm run demo:reiniciar — deja Aroma como la copia guardada y la cuenta demo como nueva.
// También sirve la primera vez (crea la cuenta demo).   Opción: --dry-run
// Solo trabaja con "aroma": no recibe ningún slug.
import { argumentos, conectar, ejecutar, sinCortar } from '../clientes/consola.mjs'
import { ARCHIVO_VISIBLE, leerCopiaGuardada } from './archivo.mjs'
import { DEMO_EMAIL, describirDiferencias } from './copia.mjs'
import { planDeReinicio, reiniciarDemo } from './operaciones.mjs'

const HARIA = { agregadas: 'que se van a BORRAR', borradas: 'que se van a reponer', modificadas: 'que se van a restaurar', sobrantes: 'se van a BORRAR', faltantes: 'faltan y NO se pueden recuperar' }

await ejecutar(async (terminal) => {
  const a = argumentos({})
  const base = conectar()
  const copia = leerCopiaGuardada()
  if (!copia) {
    console.log(`Todavía no hay una copia guardada. Primero: npm run demo:guardar`)
    return 1
  }
  const password = process.env.DEMO_PASSWORD
  const plan = await planDeReinicio(base, copia, { password })

  console.log(`\nReinicio de la demo (local "aroma", según ${ARCHIVO_VISIBLE})`)
  const renglones = describirDiferencias(plan.cambios, HARIA)
  console.log(renglones.length ? renglones.map((r) => `  - ${r}`).join('\n') : '  - El menú y los ajustes ya están como en la copia.')
  console.log(
    plan.cuentas.length
      ? `  - La cuenta demo (${plan.cuentas.map((c) => c.email).join(', ')}) se borra y se vuelve a crear como ${DEMO_EMAIL} con la contraseña de DEMO_PASSWORD: se cierran todas sus sesiones.`
      : `  - Se crea la cuenta demo ${DEMO_EMAIL}, dueña solo de Aroma, con la contraseña de DEMO_PASSWORD. No se manda ningún mail.`,
  )
  if (a['dry-run']) {
    console.log('\n--dry-run: no escribí nada.')
    return 0
  }
  if (!(await terminal.confirmar('\nLo que se haya cambiado en Aroma y no esté en la copia se pierde. ¿Reiniciar?'))) {
    console.log('Cancelado: no cambié nada.')
    return 1
  }

  console.log('')
  let resultado
  try {
    resultado = await sinCortar(() => reiniciarDemo(base, plan, { password, avisar: (t) => console.log(`  ${t}`) }))
  } catch (error) {
    error.message = `${error.message}\n\nEl reinicio quedó a medias. Volvé a correr npm run demo:reiniciar: retoma sin duplicar nada.`
    throw error
  }
  const { restantes, cuentaBien } = resultado
  if (restantes.total || !cuentaBien) {
    console.log('\nATENCIÓN: terminó, pero la comprobación final no coincide:')
    for (const r of describirDiferencias(restantes)) console.log(`  - ${r}`)
    if (!cuentaBien) console.log('  - La cuenta demo no quedó como única dueña de Aroma.')
    return 1
  }
  console.log('\nListo: Aroma quedó igual a la copia guardada y la cuenta demo, lista para usar.')
  return 0
})
