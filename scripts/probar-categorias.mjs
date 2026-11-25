// Pruebas de src/admin/categorias.js (sin red ni dependencias): node scripts/probar-categorias.mjs
import {
  anuncioDePosicion,
  categoriaDesdeFila,
  guardarAdicionalEnLista,
  interpretarPrecio,
  LARGO_MAX_NOMBRE_ADICIONAL,
  LARGO_MAX_NOMBRE_CATEGORIA,
  limpiarNombre,
  MAX_ADICIONALES,
  mensajeDeError,
  moverCategoria,
  ordenarCategorias,
  precioParaEditar,
  puedeAgregarAdicional,
  puedeEliminarCategoria,
  quitarAdicionalDeLista,
  renumerar,
  siguienteOrden,
  textoProductos,
  validarAdicional,
  validarNombreCategoria,
} from '../src/admin/categorias.js'

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

const cats = [
  { id: 'a', nombre: 'Cafés', orden: 1 },
  { id: 'b', nombre: 'Postres', orden: 2 },
  { id: 'c', nombre: 'Jugos y licuados', orden: 3 },
]
const nombres = (lista) => lista.map((c) => c.nombre)

console.log('— Nombre de categoría —')
caso('límite', LARGO_MAX_NOMBRE_CATEGORIA, 60)
caso('recorta y unifica espacios', limpiarNombre('   Tortas    y   budines  '), 'Tortas y budines')
caso('saltos de línea y tabs', limpiarNombre('Tortas\n\ty budines'), 'Tortas y budines')
caso('null y undefined', [limpiarNombre(null), limpiarNombre(undefined)], ['', ''])
caso('nombre válido', validarNombreCategoria('  Sándwiches ', cats), { ok: true, nombre: 'Sándwiches', error: '' })
caso('vacío', validarNombreCategoria('', cats).error, 'Escribí un nombre para la categoría.')
caso('solo espacios', validarNombreCategoria('    ', cats).ok, false)
caso('justo en el máximo', validarNombreCategoria('a'.repeat(60), cats).ok, true)
caso('uno más que el máximo', validarNombreCategoria('a'.repeat(61), cats).error, 'El nombre puede tener hasta 60 caracteres.')
caso('el máximo se cuenta después de recortar', validarNombreCategoria(`  ${'a'.repeat(60)}  `, cats).ok, true)
caso('sin letras ni números', validarNombreCategoria('☕ — !', cats).error, 'El nombre tiene que incluir al menos una letra o un número.')
caso('repetido exacto', validarNombreCategoria('Postres', cats).error, 'Ya tenés una categoría con ese nombre.')
caso('repetido sin tildes ni mayúsculas (mismo enlace en el menú)', validarNombreCategoria('CAFES', cats).ok, false)
caso('repetido con signos distintos (mismo enlace)', validarNombreCategoria('Jugos  y - licuados', cats).ok, false)
caso('al editar, no se compara consigo misma', validarNombreCategoria('cafés', cats, 'a').ok, true)
caso('al editar, sí se compara con las otras', validarNombreCategoria('Postres', cats, 'a').ok, false)

console.log('\n— Orden y reordenamiento —')
caso('ordena por orden', nombres(ordenarCategorias([cats[2], cats[0], cats[1]])), ['Cafés', 'Postres', 'Jugos y licuados'])
caso('con órdenes repetidos, por nombre', nombres(ordenarCategorias([{ nombre: 'Zeta', orden: 1 }, { nombre: 'Alfa', orden: 1 }])), ['Alfa', 'Zeta'])
caso('no modifica la lista original', (() => { const l = [cats[2], cats[0]]; ordenarCategorias(l); return nombres(l) })(), ['Jugos y licuados', 'Cafés'])
caso('siguiente orden', siguienteOrden(cats), 4)
caso('siguiente orden sin categorías', siguienteOrden([]), 1)
caso('siguiente orden con huecos y repetidos', siguienteOrden([{ orden: 9 }, { orden: 9 }, { orden: 2 }]), 10)
caso('bajar la primera', nombres(moverCategoria(cats, 'a', 1)), ['Postres', 'Cafés', 'Jugos y licuados'])
caso('subir la última', nombres(moverCategoria(cats, 'c', -1)), ['Cafés', 'Jugos y licuados', 'Postres'])
caso('subir la primera: la misma lista', moverCategoria(cats, 'a', -1) === cats, true)
caso('bajar la última: la misma lista', moverCategoria(cats, 'c', 1) === cats, true)
caso('id inexistente: la misma lista', moverCategoria(cats, 'x', 1) === cats, true)
caso('dirección inválida: la misma lista', [moverCategoria(cats, 'b', 2) === cats, moverCategoria(cats, 'b', 0) === cats], [true, true])
caso('mover no modifica la original', (() => { moverCategoria(cats, 'a', 1); return nombres(cats) })(), ['Cafés', 'Postres', 'Jugos y licuados'])
caso('renumerar deja 1, 2, 3 sin repetidos', renumerar(moverCategoria(cats, 'a', 1)).map((c) => `${c.id}:${c.orden}`), ['b:1', 'a:2', 'c:3'])
caso('renumerar arregla órdenes repetidos', renumerar([{ id: 'x', orden: 5 }, { id: 'y', orden: 5 }]).map((c) => c.orden), [1, 2])
caso('anuncio de posición', anuncioDePosicion(moverCategoria(cats, 'a', 1), 'a'), 'Cafés pasó a la posición 2 de 3.')
caso('anuncio de un id que no está', anuncioDePosicion(cats, 'x'), '')

console.log('\n— Productos y borrado —')
caso('texto de cantidad', [textoProductos(0), textoProductos(1), textoProductos(6), textoProductos(undefined)], ['Sin productos', '1 producto', '6 productos', 'Sin productos'])
caso('solo se borra una vacía', [puedeEliminarCategoria({ cantidadProductos: 0 }), puedeEliminarCategoria({ cantidadProductos: 3 }), puedeEliminarCategoria({}), puedeEliminarCategoria(null)], [true, false, false, false])
caso('fila de la base', categoriaDesdeFila({ id: 'a', nombre: 'Cafés', orden: 1, activa: true, adicionales: [{ nombre: 'Leche', precio: 600 }], productos: [{ count: 6 }] }), { id: 'a', nombre: 'Cafés', orden: 1, activa: true, adicionales: [{ nombre: 'Leche', precio: 600 }], cantidadProductos: 6 })
caso('fila sin productos ni adicionales', categoriaDesdeFila({ id: 'a', nombre: 'X', orden: 2, activa: false }), { id: 'a', nombre: 'X', orden: 2, activa: false, adicionales: [], cantidadProductos: 0 })
caso('adicionales mal formados en la base: se ignoran', categoriaDesdeFila({ id: 'a', nombre: 'X', adicionales: '{roto' }).adicionales, [])

console.log('\n— Precios escritos a mano —')
caso('entero', interpretarPrecio('600'), 600)
caso('con $ y espacios', interpretarPrecio(' $ 600 '), 600)
caso('miles con punto (es-AR)', interpretarPrecio('1.200'), 1200)
caso('millones', interpretarPrecio('1.200.000'), 1200000)
caso('decimales con coma', interpretarPrecio('600,5'), 600.5)
caso('miles y decimales', interpretarPrecio('1.200,50'), 1200.5)
caso('decimales con punto', interpretarPrecio('600.50'), 600.5)
caso('cero es válido', interpretarPrecio('0'), 0)
caso('negativo: no', interpretarPrecio('-5'), null)
caso('letras: no', interpretarPrecio('caro'), null)
caso('vacío, null: no', [interpretarPrecio(''), interpretarPrecio(null)], [null, null])
caso('tres decimales: no', interpretarPrecio('1,234'), null)
caso('formatos raros: no', ['1,200.50', '1.20.0', '12..5', '1e5', '600$', 'NaN', 'Infinity'].map(interpretarPrecio), [null, null, null, null, null, null, null])
caso('enorme: no', interpretarPrecio('100000000'), null)
caso('para editar', [precioParaEditar(1200), precioParaEditar(600.5)], ['1200', '600,50'])

console.log('\n— Adicionales —')
const lista = [{ nombre: 'Leche vegetal', precio: 600 }, { nombre: 'Shot extra', precio: 800 }]
caso('límites', [MAX_ADICIONALES, LARGO_MAX_NOMBRE_ADICIONAL], [8, 40])
caso('alta válida (recorta)', validarAdicional({ nombre: '  Jarabe  de vainilla ', precio: '500' }, lista), { ok: true, adicional: { nombre: 'Jarabe de vainilla', precio: 500 }, errores: {} })
caso('nombre obligatorio', validarAdicional({ nombre: ' ', precio: '500' }, lista).errores.nombre, 'Escribí el nombre del adicional.')
caso('precio obligatorio', validarAdicional({ nombre: 'Canela', precio: '' }, lista).errores.precio, 'Escribí el precio.')
caso('precio negativo', validarAdicional({ nombre: 'Canela', precio: '-1' }, lista).ok, false)
caso('precio no numérico', validarAdicional({ nombre: 'Canela', precio: 'x' }, lista).ok, false)
caso('nombre de más de 40', validarAdicional({ nombre: 'a'.repeat(41), precio: '1' }, lista).errores.nombre, 'El nombre puede tener hasta 40 caracteres.')
caso('duplicado sin tildes ni mayúsculas', validarAdicional({ nombre: 'LECHE VEGETAL', precio: '1' }, lista).errores.nombre, 'Ya hay un adicional con ese nombre.')
caso('al editar, puede conservar su nombre', validarAdicional({ nombre: 'Leche vegetal', precio: '700' }, lista, 0).ok, true)
caso('al editar, no puede tomar el de otro', validarAdicional({ nombre: 'shot extra', precio: '700' }, lista, 0).ok, false)
const ocho = Array.from({ length: 8 }, (_, i) => ({ nombre: `A${i}`, precio: 1 }))
caso('con 7 entra uno más', puedeAgregarAdicional(ocho.slice(0, 7)), true)
caso('con 8 no entra', puedeAgregarAdicional(ocho), false)
caso('agregar el noveno: rechazado', validarAdicional({ nombre: 'Nuevo', precio: '1' }, ocho).errores.nombre, 'Podés cargar hasta 8 adicionales.')
caso('con 8, igual se puede editar', validarAdicional({ nombre: 'A0 editado', precio: '2' }, ocho, 0).ok, true)
caso('agregar a la lista', guardarAdicionalEnLista(lista, { nombre: 'Canela', precio: 1 }).map((a) => a.nombre), ['Leche vegetal', 'Shot extra', 'Canela'])
caso('reemplazar en la lista', guardarAdicionalEnLista(lista, { nombre: 'Shot doble', precio: 900 }, 1).map((a) => a.nombre), ['Leche vegetal', 'Shot doble'])
caso('quitar', quitarAdicionalDeLista(lista, 0).map((a) => a.nombre), ['Shot extra'])
caso('quitar no modifica la original', lista.length, 2)

console.log('\n— Mensajes de error (nunca técnicos) —')
caso('borrar con productos', mensajeDeError({ code: '23503' }).startsWith('No se puede eliminar'), true)
caso('restricción de la base', mensajeDeError({ code: '23514' }).startsWith('La base rechazó'), true)
caso('sin permiso (RLS)', mensajeDeError({ code: '42501', message: 'new row violates row-level security policy' }), 'No tenés permiso para hacer ese cambio.')
caso('ninguna fila afectada', mensajeDeError({ code: 'SIN_FILAS' }).startsWith('No se guardó'), true)
caso('falta la función 09', mensajeDeError({ code: 'PGRST202' }).includes('09-admin-categorias.sql'), true)
caso('lista cambiada', mensajeDeError({ code: '22023' }).startsWith('La lista de categorías cambió'), true)
caso('sin conexión', mensajeDeError({ message: 'TypeError: Failed to fetch' }), 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
caso('sesión vencida', mensajeDeError({ code: 'PGRST301', message: 'JWT expired' }), 'Tu sesión venció. Volvé a ingresar.')
caso('desconocido: genérico, sin texto técnico', mensajeDeError({ code: 'XX000', message: 'internal: relation foo' }), 'No pudimos guardar el cambio. Probá de nuevo en unos instantes.')
caso('sin error', mensajeDeError(undefined), 'No pudimos guardar el cambio. Probá de nuevo en unos instantes.')

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
