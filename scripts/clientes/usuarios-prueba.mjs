// npm run pruebas:usuarios — crea o borra los dos usuarios de prueba que faltaban:
//   un EDITOR de "local-prueba" y un ADMIN de OESTACK de pruebas.
// Sus contraseñas son aleatorias y se escriben SOLO en tu .env (nunca en pantalla ni en git).
//   npm run pruebas:usuarios '--' crear      npm run pruebas:usuarios '--' borrar     Opción: --dry-run
//
// OJO: el admin de pruebas puede ver y cambiar TODOS los locales. Borralo cuando termines.
import { execFileSync } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { ponerVariables, quitarVariables } from '../lib/env-archivo.mjs'
import { conectar, ejecutar, sinCortar } from './consola.mjs'
import { ErrorDeUso } from './operaciones.mjs'
import { generarContrasena } from './reglas.mjs'

// example.com está reservado: nunca le llega un mail a nadie. El prefijo marca que se pueden borrar.
const USUARIOS = [
  { clave: 'EDITOR', email: 'zz-prueba-editor@example.com', que: 'editor de "local-prueba"' },
  { clave: 'ADMIN', email: 'zz-prueba-admin@example.com', que: 'admin de OESTACK (ve y cambia todos los locales)' },
]
const variables = (u) => [`TEST_${u.clave}_EMAIL`, `TEST_${u.clave}_PASSWORD`]
const ENV = '.env'

function guardarEnv(texto) {
  // En dos pasos: si se corta, no queda un .env a medias (el temporal también está ignorado).
  writeFileSync(`${ENV}.nuevo`, texto)
  renameSync(`${ENV}.nuevo`, ENV)
}

function exigirEnvIgnorado() {
  try {
    execFileSync('git', ['check-ignore', '--quiet', ENV])
    execFileSync('git', ['check-ignore', '--quiet', `${ENV}.nuevo`])
  } catch {
    throw new ErrorDeUso('El .env no está ignorado por git: no voy a escribir contraseñas ahí.')
  }
}

await ejecutar(async (terminal) => {
  const accion = process.argv[2]
  const dryRun = process.argv.includes('--dry-run') || process.env.npm_config_dry_run === 'true'
  if (accion !== 'crear' && accion !== 'borrar') throw new ErrorDeUso("Usá:  npm run pruebas:usuarios '--' crear   (o borrar)")
  exigirEnvIgnorado()
  const base = conectar()
  const prueba = await base.buscarLocal('local-prueba')
  if (!prueba) throw new ErrorDeUso('No existe "local-prueba" (corré supabase/08-admin-base.sql).')

  if (accion === 'crear') {
    if (prueba.activo) throw new ErrorDeUso('"local-prueba" está activo y tiene que estar inactivo. Revisalo antes.')
    console.log('\nSe van a crear en Supabase Auth (o renovarles la contraseña si ya existen):')
    for (const u of USUARIOS) console.log(`  - ${u.email}: ${u.que}`)
    console.log('Las contraseñas se guardan solo en tu .env. No se envía ningún mail.')
  } else {
    console.log('\nSe van a BORRAR de Supabase Auth y del .env:')
    for (const u of USUARIOS) console.log(`  - ${u.email}`)
  }
  if (dryRun) {
    console.log('\n--dry-run: no escribí nada.')
    return 0
  }
  if (!(await terminal.confirmar('\n¿Confirmás?'))) {
    console.log('Cancelado.')
    return 1
  }

  await sinCortar(async () => {
    for (const u of USUARIOS) {
      let usuario = await base.buscarUsuario(u.email)
      if (accion === 'borrar') {
        if (usuario) await base.borrarUsuario(usuario.id) // arrastra su membresía y su fila de admins
        guardarEnv(quitarVariables(readFileSync(ENV, 'utf8'), variables(u)))
        console.log(`  ${u.email}: ${usuario ? 'borrado' : 'no existía'}`)
        continue
      }
      const contrasena = generarContrasena(32)
      const existia = Boolean(usuario)
      if (existia) await base.cambiarPassword(usuario.id, contrasena)
      else usuario = await base.crearUsuario(u.email, contrasena)
      const [email, password] = variables(u)
      guardarEnv(ponerVariables(readFileSync(ENV, 'utf8'), { [email]: u.email, [password]: contrasena }))
      if (u.clave === 'ADMIN') await base.hacerAdmin(usuario.id)
      else await base.agregarMiembro(usuario.id, prueba.id, 'editor')
      console.log(`  ${u.email}: ${existia ? 'contraseña renovada' : 'creado'} y guardado en el .env`)
    }
  })
  console.log(accion === 'crear' ? "\nListo. Cuando termines las pruebas:  npm run pruebas:usuarios '--' borrar" : '\nListo.')
  return 0
})
