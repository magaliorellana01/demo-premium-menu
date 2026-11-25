// Pruebas de src/admin/permisos.js y src/admin/login.js (sin red ni dependencias):
//   node scripts/probar-permisos.mjs
import { mensajeErrorLogin, MENSAJE_CREDENCIALES, validarLogin } from '../src/admin/login.js'
import {
  armarAcceso,
  descripcionDeRol,
  destinoInicial,
  destinoTrasLogin,
  localDeAcceso,
  nombreDeRol,
  puedeAsignarUsuarios,
  puedeCrearLocales,
  puedeEditarLocal,
  puedeGestionarMenu,
  puedeVerLocal,
  rolEnLocal,
} from '../src/admin/permisos.js'

let total = 0
let fallos = 0
function caso(nombre, real, esperado) {
  total++
  const a = JSON.stringify(real)
  const b = JSON.stringify(esperado)
  const ok = a === b
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${nombre}${ok ? '' : `\n         esperado: ${b}\n         obtenido: ${a}`}`)
}

const aroma = { id: 'id-aroma', slug: 'aroma', nombre: 'Aroma', activo: true }
const prueba = { id: 'id-prueba', slug: 'local-prueba', nombre: 'Local de prueba', activo: false }
const tercero = { id: 'id-otro', slug: 'otro', nombre: 'Otro local', activo: true }

const dueno = armarAcceso({ esAdmin: false, membresias: [{ rol: 'owner', locales: aroma }] })
const editor = armarAcceso({ esAdmin: false, membresias: [{ rol: 'editor', locales: aroma }] })
const varios = armarAcceso({ esAdmin: false, membresias: [{ rol: 'owner', locales: aroma }, { rol: 'editor', locales: prueba }] })
const admin = armarAcceso({ esAdmin: true, membresias: [], todosLosLocales: [aroma, prueba, tercero] })
const nadie = armarAcceso({ esAdmin: false, membresias: [] })

console.log('— Armado del acceso —')
caso('dueño de un local', dueno, { esAdmin: false, locales: [{ ...aroma, rol: 'owner' }] })
caso('editor de un local', editor.locales.map((l) => l.rol), ['editor'])
caso('varios locales, ordenados por nombre', varios.locales.map((l) => `${l.slug}:${l.rol}`), ['aroma:owner', 'local-prueba:editor'])
caso('admin: ve todos los locales con rol admin', admin.locales.map((l) => `${l.slug}:${l.rol}`), ['aroma:admin', 'local-prueba:admin', 'otro:admin'])
caso('admin que además es miembro: conserva el rol admin y no se repite', armarAcceso({ esAdmin: true, membresias: [{ rol: 'owner', locales: aroma }], todosLosLocales: [aroma] }).locales, [{ ...aroma, rol: 'admin' }])
caso('sin ningún local', nadie, { esAdmin: false, locales: [] })
caso('un no-admin ignora la lista de "todos los locales"', armarAcceso({ esAdmin: false, membresias: [], todosLosLocales: [aroma] }).locales, [])
caso('esAdmin solo vale si es exactamente true', armarAcceso({ esAdmin: 'true', todosLosLocales: [aroma] }), { esAdmin: false, locales: [] })
caso('rol desconocido: se ignora', armarAcceso({ membresias: [{ rol: 'superusuario', locales: aroma }] }).locales, [])
caso('rol "admin" en una membresía: no se acepta (el admin sale de la tabla admins)', armarAcceso({ membresias: [{ rol: 'admin', locales: aroma }] }).locales, [])
caso('local nulo o mal formado: se ignora', armarAcceso({ membresias: [{ rol: 'owner', locales: null }, { rol: 'owner', locales: { slug: 'x' } }, { rol: 'owner' }, null, 5, { rol: 'owner', locales: aroma }] }).locales.map((l) => l.slug), ['aroma'])
caso('sin parámetros ni datos', [armarAcceso(), armarAcceso({ membresias: null, todosLosLocales: null })], [{ esAdmin: false, locales: [] }, { esAdmin: false, locales: [] }])
caso('local sin nombre: usa el slug', armarAcceso({ membresias: [{ rol: 'owner', locales: { id: 'x', slug: 'sin-nombre' } }] }).locales[0].nombre, 'sin-nombre')
caso('activo = false se conserva', varios.locales.find((l) => l.slug === 'local-prueba').activo, false)

console.log('\n— Rol y acceso por local —')
caso('rol en su local', rolEnLocal(dueno, 'aroma'), 'owner')
caso('rol en un local ajeno: null', rolEnLocal(dueno, 'local-prueba'), null)
caso('rol en un local que no existe: null (misma respuesta que uno ajeno)', rolEnLocal(dueno, 'no-existe'), null)
caso('el slug no distingue mayúsculas', rolEnLocal(dueno, 'AROMA'), 'owner')
caso('slug inválido (null, número, vacío)', [rolEnLocal(dueno, null), rolEnLocal(dueno, 5), rolEnLocal(dueno, '')], [null, null, null])
caso('acceso nulo', [rolEnLocal(null, 'aroma'), rolEnLocal(undefined, 'aroma')], [null, null])
caso('admin: rol admin en cualquier local', [rolEnLocal(admin, 'aroma'), rolEnLocal(admin, 'otro')], ['admin', 'admin'])
caso('admin: un local que no existe, null', rolEnLocal(admin, 'no-existe'), null)
caso('puedeVerLocal: sí / no', [puedeVerLocal(editor, 'aroma'), puedeVerLocal(editor, 'otro')], [true, false])
caso('localDeAcceso devuelve el local con su rol', localDeAcceso(dueno, 'aroma'), { ...aroma, rol: 'owner' })

console.log('\n— Qué puede hacer cada rol —')
caso('gestionar menú: owner, editor y admin sí; null y desconocido no', ['owner', 'editor', 'admin', null, undefined, 'visitante'].map(puedeGestionarMenu), [true, true, true, false, false, false])
caso('editar el local: owner y admin sí; editor no', ['owner', 'editor', 'admin', null, undefined, 'visitante'].map(puedeEditarLocal), [true, false, true, false, false, false])
caso('crear locales: solo admins', [puedeCrearLocales(admin), puedeCrearLocales(dueno), puedeCrearLocales(editor), puedeCrearLocales(nadie), puedeCrearLocales(null)], [true, false, false, false, false])
caso('asignar usuarios: solo admins', [puedeAsignarUsuarios(admin), puedeAsignarUsuarios(dueno), puedeAsignarUsuarios(varios), puedeAsignarUsuarios(undefined)], [true, false, false, false])
caso('un dueño con varios locales no es admin', puedeCrearLocales(varios), false)
caso('un editor en un local no puede editar ese local, aunque sea dueño de otro', [puedeEditarLocal(rolEnLocal(varios, 'local-prueba')), puedeEditarLocal(rolEnLocal(varios, 'aroma'))], [false, true])

console.log('\n— Nombres de rol —')
caso('nombres legibles', ['admin', 'owner', 'editor'].map(nombreDeRol), ['Admin de OESTACK', 'Dueño', 'Editor'])
caso('rol desconocido: vacío', [nombreDeRol('x'), nombreDeRol(null), descripcionDeRol('x')], ['', '', ''])
caso('descripciones distintas por rol', new Set(['admin', 'owner', 'editor'].map(descripcionDeRol)).size, 3)

console.log('\n— A dónde ir al entrar a /admin —')
caso('un solo local, sin ser admin: directo', destinoInicial(dueno), { tipo: 'local', slug: 'aroma' })
caso('varios locales: elegir', destinoInicial(varios), { tipo: 'elegir' })
caso('admin: elegir (aunque haya un solo local)', destinoInicial(armarAcceso({ esAdmin: true, todosLosLocales: [aroma] })), { tipo: 'elegir' })
caso('sin locales', destinoInicial(nadie), { tipo: 'sin-locales' })
caso('acceso nulo: sin locales', destinoInicial(null), { tipo: 'sin-locales' })
caso('admin sin ningún local en la base: sin locales', destinoInicial(armarAcceso({ esAdmin: true, todosLosLocales: [] })), { tipo: 'sin-locales' })

console.log('\n— Volver tras el login (solo rutas internas del panel) —')
caso('ruta del panel', destinoTrasLogin('/admin/aroma'), '/admin/aroma')
caso('subpágina', destinoTrasLogin('/admin/aroma/productos'), '/admin/aroma/productos')
caso('/admin', destinoTrasLogin('/admin'), '/admin')
caso('sin valor', [destinoTrasLogin(undefined), destinoTrasLogin(null), destinoTrasLogin('')], ['/admin', '/admin', '/admin'])
caso('otra web: se descarta', destinoTrasLogin('https://sitio-malo.com/admin'), '/admin')
caso('"//" (mismo protocolo, otro sitio): se descarta', destinoTrasLogin('//sitio-malo.com'), '/admin')
caso('"/\\" y otros trucos: se descartan', [destinoTrasLogin('/\\sitio-malo.com'), destinoTrasLogin('/admin/..//x'), destinoTrasLogin('/admin@sitio-malo.com')], ['/admin', '/admin', '/admin'])
caso('javascript: se descarta', destinoTrasLogin('javascript:alert(1)'), '/admin')
caso('una ruta que no es del panel (el menú público): se descarta', destinoTrasLogin('/aroma'), '/admin')
caso('no volver a /admin/login', [destinoTrasLogin('/admin/login'), destinoTrasLogin('/admin/login/x')], ['/admin', '/admin'])
caso('no es texto', [destinoTrasLogin(5), destinoTrasLogin({}), destinoTrasLogin(['/admin'])], ['/admin', '/admin', '/admin'])
caso('demasiado largo', destinoTrasLogin(`/admin/${'a'.repeat(300)}`), '/admin')
caso('con caracteres escapados', destinoTrasLogin('/admin/caf%C3%A9'), '/admin/caf%C3%A9')

console.log('\n— Validación del formulario de ingreso —')
caso('datos correctos (el email se limpia y baja a minúsculas)', validarLogin({ email: '  Ana@Correo.COM ', password: 'x' }), { ok: true, email: 'ana@correo.com', errores: {} })
caso('todo vacío', validarLogin({ email: '', password: '' }).errores, { email: 'Ingresá tu email.', password: 'Ingresá tu contraseña.' })
caso('solo espacios en el email', validarLogin({ email: '   ', password: 'x' }).errores, { email: 'Ingresá tu email.' })
caso('email incompleto', validarLogin({ email: 'ana@correo', password: 'x' }).errores.email, 'Revisá el email: parece incompleto.')
caso('email con espacios en el medio', validarLogin({ email: 'a na@correo.com', password: 'x' }).errores.email, 'Revisá el email: parece incompleto.')
caso('contraseña vacía', validarLogin({ email: 'ana@correo.com', password: '' }).errores, { password: 'Ingresá tu contraseña.' })
caso('la contraseña no se recorta (puede llevar espacios)', validarLogin({ email: 'ana@correo.com', password: '  ' }).ok, true)
caso('sin parámetros', validarLogin().ok, false)

console.log('\n— Mensajes de error al ingresar —')
caso('credenciales inválidas', mensajeErrorLogin({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }), MENSAJE_CREDENCIALES)
caso('credenciales inválidas (versión vieja, solo con el texto)', mensajeErrorLogin({ status: 400, message: 'Invalid login credentials' }), MENSAJE_CREDENCIALES)
caso('cuenta sin confirmar: el mismo mensaje (no revela el estado de la cuenta)', mensajeErrorLogin({ code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' }), MENSAJE_CREDENCIALES)
caso('usuario bloqueado: el mismo mensaje', mensajeErrorLogin({ code: 'user_banned', status: 400, message: 'User is banned' }), MENSAJE_CREDENCIALES)
caso('el mensaje no dice cuál dato falló', /email|contraseña/i.test(MENSAJE_CREDENCIALES) && !/(no existe|no está registrado|es incorrecta)/i.test(MENSAJE_CREDENCIALES), true)
caso('demasiados intentos (429)', mensajeErrorLogin({ status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' }), 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.')
caso('sin conexión', mensajeErrorLogin({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }), 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
caso('error del servidor (500)', mensajeErrorLogin({ status: 500, message: 'Internal error' }), 'Tuvimos un problema de nuestro lado. Probá de nuevo en unos minutos.')
caso('error desconocido', mensajeErrorLogin({ status: 422, code: 'raro', message: 'algo' }), 'No pudimos iniciar sesión. Probá de nuevo en unos minutos.')
caso('sin error: texto vacío', mensajeErrorLogin(null), '')

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
