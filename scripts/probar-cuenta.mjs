// Pruebas de la cuenta, los primeros pasos y la vista de clientes (sin red):
//   node scripts/probar-cuenta.mjs
import { aCliente, fechaDeCambio, filtrarClientes, filtrosAParams, leerFiltrosDeClientes, mensajeDeErrorClientes, ordenarClientes, textoDeCantidad } from '../src/admin/clientes.js'
import { errorDeCambio, faltantes, problemaDeContrasena, REQUISITOS, validarCambio } from '../src/admin/contrasena.js'
import { primerosPasos, resumenDePasos, tieneContacto } from '../src/admin/pasos.js'

let total = 0
let fallos = 0
function caso(nombre, obtenido, esperado) {
  total++
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLÓ'} ${nombre}${ok ? '' : `\n        esperado: ${JSON.stringify(esperado)}\n        obtenido: ${JSON.stringify(obtenido)}`}`)
}
const si = (nombre, condicion) => caso(nombre, Boolean(condicion), true)

// ── Política ──
const BUENA = 'Cafe-Rico2026'
const claves = (c) => faltantes(c).map((r) => r.clave)
caso('una buena no tiene faltantes', claves(BUENA), [])
caso('exactamente 12 caracteres sirve', problemaDeContrasena('Aa1!aaaaaaaa'), '')
caso('11 caracteres no', claves('Aa1!aaaaaaa'), ['largo'])
caso('sin mayúscula', claves('cafe-rico2026'), ['mayuscula'])
caso('sin minúscula', claves('CAFE-RICO2026'), ['minuscula'])
caso('sin número', claves('Cafe-Rico-bueno'), ['numero'])
caso('sin símbolo', claves('CafeRico20261'), ['simbolo'])
caso('el espacio no cuenta como símbolo', claves('Cafe Rico2026'), ['simbolo'])
caso('ni una letra con tilde', claves('CafeRicoñ2026'), ['simbolo'])
for (const s of '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~') if (claves(`CafeRico2026${s}`).length) caso(`símbolo de Supabase aceptado: ${s}`, false, true)
si('los 32 símbolos de Supabase sirven', [...'!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~'].every((s) => claves(`CafeRico2026${s}`).length === 0))
caso('vacía: le falta todo', claves(''), REQUISITOS.map((r) => r.clave))
caso('mensaje con "y"', problemaDeContrasena('cafe-rico-bueno'), 'Le falta: una letra mayúscula y un número.')
si('más de 72 bytes: rechazada', problemaDeContrasena(`Aa1!${'a'.repeat(69)}`).includes('demasiado larga'))
si('el límite es en bytes (las tildes pesan doble)', problemaDeContrasena(`Aa1!${'á'.repeat(35)}`).includes('demasiado larga'))
caso('72 bytes justos sirve', problemaDeContrasena(`Aa1!${'a'.repeat(68)}`), '')

// ── Formulario ──
const F = { actual: 'Vieja-Clave2025', nueva: BUENA, repetida: BUENA }
caso('formulario correcto', validarCambio(F), { ok: true, errores: {}, primerError: null })
caso('todo vacío: tres errores y el foco al primero', [Object.keys(validarCambio({}).errores), validarCambio({}).primerError], [['actual', 'nueva', 'repetida'], 'actual'])
caso('nueva débil', validarCambio({ ...F, nueva: 'corta', repetida: 'corta' }).primerError, 'nueva')
si('nueva igual a la actual', validarCambio({ actual: BUENA, nueva: BUENA, repetida: BUENA }).errores.nueva?.includes('distinta'))
caso('no coinciden', validarCambio({ ...F, repetida: `${BUENA} ` }).errores, { repetida: 'No coincide con la contraseña nueva.' })
si('no recorta espacios', !validarCambio({ ...F, nueva: ` ${BUENA}`, repetida: BUENA }).ok)

// ── Errores de Supabase ──
const donde = (e, paso) => errorDeCambio(e, paso).campo
const dice = (e, paso) => errorDeCambio(e, paso).mensaje
caso('contraseña actual mala', errorDeCambio({ code: 'invalid_credentials', status: 400 }, 'verificar'), { campo: 'actual', mensaje: 'La contraseña actual no es correcta.' })
caso('la base rechaza la actual al cambiar', donde({ code: 'current_password_mismatch', status: 400 }, 'cambiar'), 'actual')
caso('igual a la anterior', donde({ code: 'same_password', status: 422 }, 'cambiar'), 'nueva')
caso('débil para Supabase', donde({ code: 'weak_password', status: 422 }, 'cambiar'), 'nueva')
si('demasiados intentos', dice({ status: 429 }, 'verificar').includes('demasiados intentos'))
si('sin red al comprobar', dice({ name: 'AuthRetryableFetchError', status: 0 }, 'verificar').includes('conexión'))
si('sin red al cambiar: no se sabe si cambió, explica qué probar', /no sabemos.*nueva.*anterior/.test(dice({ message: 'Failed to fetch' }, 'cambiar')))
si('sesión vieja', dice({ code: 'reauthentication_needed', status: 401 }, 'cambiar').includes('volvé a ingresar'))
si('desconocido: genérico, sin texto en inglés', dice({ code: 'x', status: 400, message: 'Something odd' }, 'cambiar') === 'No pudimos cambiar la contraseña. Probá de nuevo en unos minutos.')
si('el 500 no culpa a la contraseña', donde({ status: 500 }, 'verificar') === null)

// ── Primeros pasos ──
const VACIA = { logo_url: null, whatsapp: null, instagram: null, horarios: {} }
const LLENA = { logo_url: '/x.webp', whatsapp: '5491155551234', instagram: null, horarios: { semana: { lunes: [{ desde: '08:00', hasta: '20:00' }] } } }
const NADA = { fila: VACIA, categorias: 0, productos: 0, productosConFoto: 0 }
const TODO = { fila: LLENA, categorias: 1, productos: 1, productosConFoto: 1 }
const DUENO = { slug: 'mi-cafe', activo: false, puedeEditarLocal: true, esAdmin: false }
const hechos = (d, c = DUENO) => primerosPasos(d, c).map((p) => p.hecho)
caso('siete pasos, en orden', primerosPasos(NADA, DUENO).map((p) => p.clave), ['logo', 'contacto', 'horarios', 'categoria', 'producto', 'publicar', 'qr'])
caso('local nuevo: nada hecho', hechos(NADA), [false, false, false, false, false, false, false])
caso('todo cargado, sin publicar', hechos(TODO), [true, true, true, true, true, false, false])
caso('publicado: completo', resumenDePasos(primerosPasos(TODO, { ...DUENO, activo: true, qrListo: true })), { hechos: 7, total: 7, faltan: 0, cargando: false, completo: true })
caso('cargando: desconocido (menos publicar y el QR, que ya se saben)', hechos(null), [null, null, null, null, null, false, false])
caso('cargando nunca cuenta como completo', resumenDePasos(primerosPasos(null, { ...DUENO, activo: true })).completo, false)
for (const [clave, cambio] of [['logo', { fila: { ...LLENA, logo_url: null } }], ['contacto', { fila: { ...LLENA, whatsapp: null } }], ['horarios', { fila: { ...LLENA, horarios: { semana: { lunes: [] } } } }], ['categoria', { categorias: 0 }], ['producto', { productosConFoto: 0 }]]) {
  caso(`solo queda pendiente "${clave}"`, primerosPasos({ ...TODO, ...cambio }, { ...DUENO, activo: true, qrListo: true }).filter((p) => !p.hecho).map((p) => p.clave), [clave])
}
caso('un producto sin foto no alcanza', hechos({ ...TODO, productos: 5, productosConFoto: 0 })[4], false)
si('contacto: alcanza con Instagram', tieneContacto({ instagram: 'mi.cafe' }))
si('contacto: los datos de ejemplo no cuentan', !tieneContacto({ whatsapp: 'TODO 00000000000', instagram: 'TODO-reemplazar-instagram' }))
si('contacto: un enlace de otro sitio no cuenta', !tieneContacto({ instagram: 'https://evil.example/x', whatsapp: '123' }))
const enlaces = (d, c = DUENO) => primerosPasos(d, c).map((p) => p.enlace?.a ?? null)
caso('cada paso enlaza a su pantalla (dueño)', enlaces(NADA), ['/admin/mi-cafe/ajustes#titulo-logo', '/admin/mi-cafe/ajustes#titulo-info', '/admin/mi-cafe/ajustes#titulo-horarios', '/admin/mi-cafe/categorias', '/admin/mi-cafe/productos', null, '/admin/mi-cafe/qr'])
caso('con categoría y sin productos, va directo a cargar uno', enlaces({ ...NADA, categorias: 1 })[4], '/admin/mi-cafe/productos/nuevo')
caso('con productos sin foto, va a la lista', enlaces({ ...NADA, categorias: 1, productos: 2 })[4], '/admin/mi-cafe/productos')
const editor = primerosPasos(NADA, { ...DUENO, puedeEditarLocal: false })
caso('editor: sin enlace a ajustes y dice quién lo hace', editor.slice(0, 3).map((p) => [p.enlace, p.nota]), Array(3).fill([null, 'Lo completa el dueño.']))
caso('admin: publicar enlaza a clientes', enlaces(NADA, { ...DUENO, esAdmin: true })[5], '/admin/clientes')

// ── Vista de clientes ──
const filas = [
  { id: '1', slug: 'cafe-nandu', nombre: 'Café Ñandú', activo: true, updated_at: '2026-11-26T00:39:02.9+00:00', categorias: [{ count: 3 }], productos: [{ count: 18 }] },
  { id: '2', slug: 'bar-uno', nombre: 'Bar Uno', activo: false, updated_at: null, categorias: [], productos: [{ count: 0 }] },
  { id: '3', slug: 'abasto', nombre: 'El Abasto', activo: true, updated_at: 'basura', categorias: [{ count: 1 }], productos: [{ count: 2 }] },
]
const clientes = filas.map(aCliente)
caso('lee los conteos de la consulta agrupada', [clientes[0].categorias, clientes[0].productos, clientes[1].categorias, clientes[1].productos], [3, 18, 0, 0])
caso('orden por nombre', ordenarClientes(clientes).map((c) => c.slug), ['bar-uno', 'cafe-nandu', 'abasto'])
const ids = (f) => filtrarClientes(clientes, f).map((c) => c.id)
caso('sin filtros: todos', ids({}), ['1', '2', '3'])
caso('busca sin tildes ni mayúsculas', ids({ texto: 'CAFE nandu' }), ['1'])
caso('busca también en el slug', ids({ texto: 'abas' }), ['3'])
caso('todas las palabras tienen que estar', ids({ texto: 'cafe uno' }), [])
caso('solo activos', ids({ estado: 'activos' }), ['1', '3'])
caso('solo inactivos', ids({ estado: 'inactivos' }), ['2'])
caso('estado y texto juntos', ids({ estado: 'activos', texto: 'bar' }), [])
caso('espacios de más no filtran', ids({ texto: '   ' }), ['1', '2', '3'])
caso('filtros desde la URL', leerFiltrosDeClientes(new URLSearchParams('q=bar&estado=inactivos')), { texto: 'bar', estado: 'inactivos' })
caso('un estado inventado en la URL se ignora', leerFiltrosDeClientes(new URLSearchParams('estado=borrados')), { texto: '', estado: 'todos' })
caso('la búsqueda de la URL se recorta', leerFiltrosDeClientes(new URLSearchParams(`q=${'a'.repeat(200)}`)).texto.length, 60)
caso('a la URL solo va lo distinto del valor por defecto', [filtrosAParams({ texto: '', estado: 'todos' }).toString(), filtrosAParams({ texto: 'b', estado: 'activos' }).toString()], ['', 'q=b&estado=activos'])
caso('cantidad', [textoDeCantidad(3, 3), textoDeCantidad(1, 1), textoDeCantidad(1, 3), textoDeCantidad(0, 3)], ['3 locales', '1 local', '1 de 3 locales', '0 de 3 locales'])
caso('fecha en hora de Buenos Aires (cambia el día)', fechaDeCambio(filas[0].updated_at), '25/11/2026 21:39')
caso('sin fecha o fecha rota', [fechaDeCambio(null), fechaDeCambio('basura')], ['Sin datos', 'Sin datos'])
si('error de permiso: lo explica', mensajeDeErrorClientes({ code: '42501' }).includes('solo un admin'))
si('sin filas', mensajeDeErrorClientes({ code: 'SIN_FILAS' }).includes('No se cambió nada'))
si('sin red', mensajeDeErrorClientes(new TypeError('Failed to fetch')).includes('conexión'))

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
