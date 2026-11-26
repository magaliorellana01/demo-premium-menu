// npm run cliente:password — contraseña temporal nueva para un usuario (reemplaza la anterior).
//   npm run cliente:password '--' --email dueno@ejemplo.com     Opción: --dry-run
import { argumentos, conectar, ejecutar, sinCortar } from './consola.mjs'
import { planDePassword, regenerarPassword } from './operaciones.mjs'
import { LOCALES_PROTEGIDOS } from './reglas.mjs'

await ejecutar(async (terminal) => {
  const a = argumentos({ email: { type: 'string' } })
  const base = conectar()
  const plan = await planDePassword(base, { email: a.email ?? (await terminal.preguntar('Email del usuario:')) })

  console.log(`\nUsuario: ${plan.email}`)
  console.log(`Locales: ${plan.membresias.map((m) => `${m.slug} (${m.rol})`).join(', ') || 'ninguno'}${plan.esAdmin ? ' · ADMIN de OESTACK' : ''}`)
  console.log('Se va a generar una contraseña temporal nueva. La anterior deja de servir para ingresar.')
  if (a['dry-run']) {
    console.log('\n--dry-run: no escribí nada.')
    return 0
  }
  if (!(await terminal.confirmar('\n¿Confirmás?'))) {
    console.log('Cancelado: no cambié nada.')
    return 1
  }
  // Cambiarle la clave a un admin o a un usuario de la demo puede dejar afuera a alguien o
  // romper las pruebas: se pide además el email completo.
  if (plan.esAdmin || plan.membresias.some((m) => LOCALES_PROTEGIDOS.includes(m.slug))) {
    const escrito = await terminal.preguntar('Es un admin o un usuario de la demo. Para confirmar, escribí su email completo:')
    if (escrito.toLowerCase() !== plan.email) {
      console.log('No coincide: no cambié nada.')
      return 1
    }
  }

  const { contrasena } = await sinCortar(() => regenerarPassword(base, plan))
  console.log('\nListo. Copiala AHORA: no se guarda en ningún lado y no se vuelve a mostrar.')
  console.log('──────────────────────────────────────────────')
  console.log(`Email: ${plan.email}\nContraseña temporal: ${contrasena}\nAl entrar, cambiala en "Mi cuenta".`)
  console.log('──────────────────────────────────────────────')
  return 0
})
