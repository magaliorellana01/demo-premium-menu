// npm run verificar:auth — comprueba contra Supabase REAL la configuración de Authentication:
// registro cerrado, reglas de contraseña, cambio de contraseña y cierre de sesión.
//
// Crea UN usuario descartable (zz-prueba-permisos-password@example.com, sin membresías: no
// puede tocar ningún local) y lo borra al terminar. Para crearlo y borrarlo usa la clave
// secreta; todo lo que se PRUEBA se hace con la clave pública, como lo haría cualquiera.
// Nunca imprime contraseñas ni tokens. No manda mails. Correrlo después de tocar ajustes en
// Supabase (Authentication).
import { createClient } from '@supabase/supabase-js'
import { conectar } from './clientes/consola.mjs'
import { generarContrasena } from './clientes/reglas.mjs'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: clave } = process.env
if (!url || !clave) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (ver .env.example).')
  process.exit(1)
}

const EMAIL = 'zz-prueba-permisos-password@example.com'
const EMAIL_REGISTRO = 'zz-prueba-permisos-registro@example.com'
const crear = () => createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

let total = 0
let fallos = 0
function ver(ok, titulo, detalle = '') {
  total++
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${titulo}${detalle ? `  →  ${detalle}` : ''}`)
}
const seccion = (t) => console.log(`\n— ${t} —`)
// Solo el código y el estado del error: nunca datos del pedido.
const codigo = (error) => (error ? `${error.status ?? ''} ${error.code ?? error.name}`.trim() : 'SE ACEPTÓ')

let base
try {
  base = conectar()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const borrarSiExiste = async (email) => {
  const usuario = await base.buscarUsuario(email)
  if (usuario) await base.borrarUsuario(usuario.id)
  return Boolean(usuario)
}

try {
  await borrarSiExiste(EMAIL) // restos de una corrida cortada
  await borrarSiExiste(EMAIL_REGISTRO)

  // ═══ REGISTRO ════════════════════════════════════════════════
  seccion('Registro cerrado (con la clave pública)')
  const ajustes = await (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: clave } })).json()
  const activos = Object.entries(ajustes.external ?? {}).filter(([, v]) => v === true).map(([n]) => n)
  ver(ajustes.disable_signup === true, 'La configuración pública dice que el registro está desactivado', `disable_signup=${ajustes.disable_signup}`)
  ver(activos.join() === 'email', 'El único método de ingreso activo es email y contraseña', activos.join(', ') || 'ninguno')

  // Con el registro abierto no se intenta: el problema ya está informado y no se crea nada.
  if (ajustes.disable_signup === true) {
    const alta = await crear().auth.signUp({ email: EMAIL_REGISTRO, password: generarContrasena(24) })
    ver(Boolean(alta.error) && !alta.data?.session, 'Registrarse desde la API: rechazado', codigo(alta.error))
    const anonimo = await crear().auth.signInAnonymously()
    ver(Boolean(anonimo.error) && !anonimo.data?.session, 'Entrar como usuario anónimo: rechazado (si se aceptara, contaría como usuario con sesión)', codigo(anonimo.error))
    if (anonimo.data?.user) await base.borrarUsuario(anonimo.data.user.id)
    const enlace = await crear().auth.signInWithOtp({ email: EMAIL_REGISTRO, options: { shouldCreateUser: true } })
    ver(Boolean(enlace.error), 'Crear una cuenta con enlace o código por mail: rechazado', codigo(enlace.error))
    ver(!(await borrarSiExiste(EMAIL_REGISTRO)), 'No quedó ningún usuario creado por esos intentos')
  } else {
    ver(false, 'No se probó registrarse: desactivá "Allow new users to sign up" en Authentication > Sign In / Providers')
  }

  // ═══ CONTRASEÑAS ═════════════════════════════════════════════
  seccion('Usuario descartable')
  const actual = generarContrasena(24)
  await base.crearUsuario(EMAIL, actual)
  const sesion = crear()
  const entrada = await sesion.auth.signInWithPassword({ email: EMAIL, password: actual })
  ver(!entrada.error, 'Se creó e inicia sesión', entrada.error ? codigo(entrada.error) : 'ok')
  if (entrada.error) throw new Error('No se pudo iniciar sesión con el usuario descartable.')
  const propias = await sesion.from('usuarios_locales').select('rol')
  ver(!propias.error && propias.data.length === 0, 'No pertenece a ningún local')

  const puedeEntrar = async (password) => !(await crear().auth.signInWithPassword({ email: EMAIL, password })).error
  const nueva = generarContrasena(24)

  seccion('Cambiar la contraseña: hace falta la actual')
  for (const [caso, extra] of [['SIN la contraseña actual', {}], ['con la contraseña actual VACÍA', { current_password: '' }], ['con una contraseña actual EQUIVOCADA', { current_password: generarContrasena(24) }]]) {
    const x = await sesion.auth.updateUser({ password: nueva, ...extra })
    ver(Boolean(x.error), `Cambio ${caso}: rechazado`, x.error ? codigo(x.error) : 'SE ACEPTÓ. Revisá en Supabase: Authentication > Sign In / Providers > Email > "Require current password when updating"')
    if (!x.error) await base.cambiarPassword((await base.buscarUsuario(EMAIL)).id, actual)
  }
  ver((await puedeEntrar(actual)) && !(await puedeEntrar(nueva)), 'La contraseña sigue siendo la de antes')

  seccion('Reglas de contraseña (con la actual correcta)')
  const id = (await base.buscarUsuario(EMAIL)).id
  // Una sesión nueva por caso: restaurar la contraseña con la clave secreta cierra las sesiones,
  // y un "rechazo" por falta de sesión no probaría nada.
  const conSesion = async () => {
    const cliente = crear()
    const x = await cliente.auth.signInWithPassword({ email: EMAIL, password: actual })
    if (x.error) throw new Error(`No se pudo volver a iniciar sesión (${codigo(x.error)}).`)
    return cliente
  }
  // Cada una incumple UNA sola regla, y solo vale el rechazo por ESA razón.
  const DEBILES = {
    'sin símbolo': ['CafeRicoDelPuerto2026', 'weak_password'],
    'sin mayúscula': ['cafe-rico-del-puerto-2026', 'weak_password'],
    'sin minúscula': ['CAFE-RICO-DEL-PUERTO-2026', 'weak_password'],
    'sin número': ['Cafe-Rico-Del-Puerto-Azul', 'weak_password'],
    'de 11 caracteres (mínimo 12)': ['Zx7!qLm2#Wp', 'weak_password'],
    'igual a la actual': [actual, 'same_password'],
  }
  const OPCION = 'revisá en Authentication > Sign In / Providers > Email: "Minimum password length" 12 y, en "Password requirements", la opción que incluye SÍMBOLOS'
  for (const [caso, [debil, esperado]] of Object.entries(DEBILES)) {
    const x = await (await conSesion()).auth.updateUser({ password: debil, current_password: actual })
    ver(x.error?.code === esperado, `Contraseña ${caso}: rechazada`, x.error ? codigo(x.error) : `SE ACEPTÓ: ${OPCION}`)
    if (!x.error) await base.cambiarPassword(id, actual)
  }
  const nuevaSesion = await conSesion()
  const bien = await nuevaSesion.auth.updateUser({ password: nueva, current_password: actual })
  ver(!bien.error, 'Control: con la actual correcta y una contraseña que cumple, se cambia', bien.error ? codigo(bien.error) : 'ok')
  ver((await puedeEntrar(nueva)) && !(await puedeEntrar(actual)), 'Entra con la nueva y ya no con la anterior')

  // ═══ CIERRE DE SESIÓN ════════════════════════════════════════
  seccion('Cerrar sesión')
  const una = crear()
  const { data, error: alEntrar } = await una.auth.signInWithPassword({ email: EMAIL, password: nueva })
  if (alEntrar) throw new Error(`No se pudo iniciar sesión para probar el cierre (${codigo(alEntrar)}).`)
  const guardados = data.session // solo en memoria: nunca se imprimen
  const salida = await una.auth.signOut()
  ver(!salida.error && !(await una.auth.getSession()).data.session, 'El cliente borra la sesión')
  const renovar = await crear().auth.refreshSession({ refresh_token: guardados.refresh_token })
  ver(Boolean(renovar.error), 'El token de renovación anterior ya no sirve', codigo(renovar.error))
  const perfil = await fetch(`${url}/auth/v1/user`, { headers: { apikey: clave, Authorization: `Bearer ${guardados.access_token}` } })
  ver(perfil.status >= 400, 'Authentication ya no acepta el token de acceso anterior', `HTTP ${perfil.status}`)
  const datos = await fetch(`${url}/rest/v1/usuarios_locales?select=rol`, { headers: { apikey: clave, Authorization: `Bearer ${guardados.access_token}` } })
  console.log(`NOTA   La API de datos ${datos.status < 400 ? 'TODAVÍA acepta' : 'ya no acepta'} ese token de acceso (HTTP ${datos.status}). Los tokens de acceso valen ${Math.round(guardados.expires_in / 60)} minutos.`)

  // ═══ INTENTOS FALLIDOS ═══════════════════════════════════════
  // Una prueba chica a propósito (el límite por IP también afecta a quien corre esto).
  seccion('Intentos de ingreso fallidos')
  const estados = []
  for (let i = 0; i < 10; i++) {
    const x = await crear().auth.signInWithPassword({ email: EMAIL, password: `${nueva}-mal-${i}` })
    estados.push(x.error?.status ?? 200)
  }
  ver(estados.every((s) => s === 400 || s === 429), '10 contraseñas equivocadas seguidas: ninguna entra', `estados: ${[...new Set(estados)].join(', ')}`)
  console.log(`NOTA   Después de 10 errores, la contraseña correcta ${(await puedeEntrar(nueva)) ? 'sigue entrando: no hay bloqueo por cuenta, solo límites por IP' : 'NO entra (hay un límite o bloqueo activo)'}.`)
} catch (error) {
  fallos++
  console.error(`\nFALLÓ  La verificación se interrumpió: ${error.message}`)
} finally {
  seccion('Limpieza')
  try {
    await borrarSiExiste(EMAIL)
    await borrarSiExiste(EMAIL_REGISTRO)
    ver(!(await base.buscarUsuario(EMAIL)) && !(await base.buscarUsuario(EMAIL_REGISTRO)), 'No quedó ningún usuario de prueba')
  } catch (error) {
    ver(false, `No pude borrar el usuario de prueba: borrá a mano ${EMAIL} en Authentication > Users`, error.message)
  }
  console.log(`\n${total - fallos}/${total} comprobaciones OK${fallos ? ` · ${fallos} FALLÓ` : ''}`)
  process.exitCode = fallos ? 1 : 0
}
