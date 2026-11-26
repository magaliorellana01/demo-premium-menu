// Pruebas de los ajustes del local (sin red ni dependencias): node scripts/probar-ajustes.mjs
// Colores y contraste, WhatsApp y enlaces, horarios, límites de texto, guardado sin pisar,
// logo y protección contra salir con cambios sin guardar.
import {
  cambiosReales,
  cambiarModo,
  coloresOriginales,
  copiarATodos,
  cruzaMedianoche,
  estable,
  formularioApariencia,
  formularioAviso,
  formularioHorarios,
  formularioInfo,
  guardarSinPisar,
  horariosDesdeFormulario,
  huella,
  LIMITES,
  localParaVistaPrevia,
  mensajeDeErrorAjustes,
  normalizarInstagram,
  normalizarWhatsApp,
  nuevaFranja,
  rebasar,
  revisarContraste,
  temaDesdeFormulario,
  todoCerrado,
  validarApariencia,
  validarAviso,
  validarHorarios,
  validarInfo,
} from '../src/admin/ajustes.js'
import {
  analizarLogo,
  guardarLogo,
  logoOriginal,
  medidasDeLogo,
  nombreDeLogo,
  recortarTransparente,
  revisarArchivoLogo,
  rutaDeLogo,
  rutaDeLogoDesdeUrl,
} from '../src/admin/logo.js'
import { destinoDeClic, pasoDeRegreso } from '../src/admin/salida.js'
import { enlaceInstagram, enlaceWhatsApp } from '../src/lib/contacto.js'
import { describirEstado, normalizarHorarios } from '../src/lib/horarios.js'
import { logoDePortada } from '../src/lib/imagenes.js'
import { CLAVES_COLOR, COLORES_ORIGINALES, coloresDelTema, contraste, esColor, mezclar, paleta, portadaClara, variablesDeTema } from '../src/lib/tema.js'

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
const titulo = (t) => console.log(`\n— ${t} —`)
const redondo = (n) => Math.round(n * 100) / 100

// ── Colores ─────────────────────────────────────────────────
titulo('Colores: formato estricto')
caso('#RRGGBB en mayúsculas o minúsculas', ['#b6784f', '#B6784F'].map(esColor), [true, true])
const inyecciones = ['red', '#fff', '#b6784f;', 'red; background:url(x)', '#b6784f; background:url(x)', 'url(javascript:alert(1))', 'rgb(0,0,0)', 'var(--x)', '#gggggg', ' #b6784f', '#b6784f\n', '', null, 12, ['#b6784f']]
caso('se rechaza todo lo demás (inyección de CSS incluida)', inyecciones.filter(esColor), [])
caso('un tema hostil no genera variables', variablesDeTema({ fondo: 'red; background:url(x)', acento: 'url(x)', texto: '}' }), {})
caso('colores inválidos toman el original', coloresDelTema({ fondo: 'nada', acento: '#112233' }), { ...COLORES_ORIGINALES, acento: '#112233' })
caso('sin tema, null o solo frase: no se toca nada', [variablesDeTema({}), variablesDeTema(null), variablesDeTema({ frase: 'hola' })], [{}, {}, {}])
caso('elegir exactamente los originales (en mayúsculas) tampoco', variablesDeTema({ fondo: '#F4EEE5', portada: '#251E1A' }), {})

titulo('Colores: contraste WCAG')
caso('negro sobre blanco 21:1', redondo(contraste('#000000', '#ffffff')), 21)
caso('mismo color 1:1', contraste('#777777', '#777777'), 1)
caso('cobre sobre porcelana 3,15:1 (como en el brand book)', redondo(contraste('#b6784f', '#f4eee5')), 3.15)
caso('espresso sobre porcelana ≈ 14:1', Math.round(contraste('#251e1a', '#f4eee5')), 14)
caso('mezclar como color-mix', [mezclar('#000000', '#ffffff', 0.5), mezclar('#123456', '#ffffff', 1), mezclar('#123456', '#abcdef', 0)], ['#808080', '#123456', '#abcdef'])

const original = paleta(COLORES_ORIGINALES)
caso('con los originales salen los tonos del diseño', [original.acentoTexto, original.borde, original.sobreOscuro, original.sobreOscuroSuave, original.sobreAcento, original.acentoPortada], ['#905d3c', '#b6a38c', '#f4eee5', '#b6a38c', '#251e1a', '#b6784f'])

// Muestra amplia y repetible de combinaciones: lo calculado siempre se tiene que leer.
let semilla = 7
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return `#${(Math.floor(semilla / 128) % 0x1000000).toString(16).padStart(6, '0')}`
}
const malas = []
let probadas = 0
for (let i = 0; i < 6000; i++) {
  const c = { fondo: azar(), texto: azar(), acento: azar(), portada: azar() }
  const p = paleta(c)
  if (Object.values(p).some((v) => !esColor(v))) malas.push(['formato', c])
  if (contraste(p.sobreOscuro, c.portada) < 4.5) malas.push(['portada', c])
  if (contraste(p.sobreOscuroSuave, c.portada) < 4.5) malas.push(['portada suave', c])
  if (contraste(p.sobreAcento, c.acento) < 4.5) malas.push(['botón', c])
  if (contraste(p.acentoPortada, c.portada) < 3) malas.push(['frase', c])
  // Si el texto elegido se lee, enlaces y texto suave también (salvo que ni el texto llegue sobre el fondo suave).
  if (Math.min(contraste(c.texto, c.fondo), contraste(c.texto, p.fondoSuave)) >= 4.5) {
    probadas++
    for (const color of [p.acentoTexto, p.textoSuave]) {
      if (Math.min(contraste(color, c.fondo), contraste(color, p.fondoSuave)) < 4.5) malas.push(['texto derivado', c])
    }
  }
}
caso(`6000 temas al azar (${probadas} con texto legible): todo lo calculado se lee`, malas.slice(0, 3), [])
const v = variablesDeTema({ acento: '#2f6f6f' })
caso('un tema propio define los 12 roles, todos en #rrggbb', [Object.keys(v).length, Object.values(v).every(esColor), v['--color-acento']], [12, true, '#2f6f6f'])
caso('portada clara u oscura', [portadaClara({}), portadaClara({ portada: '#f0f0f0' })], [false, true])

const nivel = (cambios) => {
  const r = revisarContraste({ ...COLORES_ORIGINALES, ...cambios })
  return [r.bloquea, r.filas.find((f) => f.clave === 'texto')?.nivel]
}
caso('originales: no bloquea y el texto está bien', nivel({}), [false, 'bien'])
caso('originales: ninguna fila con aviso', revisarContraste(COLORES_ORIGINALES).filas.filter((f) => f.nivel !== 'bien'), [])
caso('texto casi igual al fondo: ilegible y bloquea', nivel({ texto: '#e0d8cc' }), [true, 'ilegible'])
caso('texto entre 3 y 4,5: avisa pero deja guardar', nivel({ fondo: '#ffffff', texto: '#808080' }), [false, 'aviso'])
caso('acento invisible sobre el fondo: avisa, no bloquea', revisarContraste({ ...COLORES_ORIGINALES, acento: '#f0e9df' }).filas.find((f) => f.clave === 'acento').nivel, 'aviso')
caso('un color a medio escribir: sin filas', revisarContraste({ ...COLORES_ORIGINALES, fondo: '#f4e' }), { filas: [], bloquea: false })
caso('el número se muestra con coma y sin redondear para arriba', revisarContraste(COLORES_ORIGINALES).filas.find((f) => f.clave === 'acento').texto, '3,14:1')

titulo('Apariencia')
const filaTema = { tema: { frase: 'menos prisa, más aroma.' } }
caso('formulario con los originales', formularioApariencia(filaTema), { frase: 'menos prisa, más aroma.', ...COLORES_ORIGINALES })
caso('sin cambios de color solo se guarda la frase', temaDesdeFormulario(formularioApariencia(filaTema)), filaTema.tema)
caso('se guardan solo los colores distintos, en minúsculas', temaDesdeFormulario({ ...formularioApariencia(filaTema), acento: '#2F6F6F' }), { frase: 'menos prisa, más aroma.', acento: '#2f6f6f' })
caso('restaurar conserva la frase', temaDesdeFormulario(coloresOriginales({ frase: 'hola', fondo: '#000000', texto: '#ffffff', acento: '#ff0000', portada: '#222222' })), { frase: 'hola' })
caso('frase vacía: no se guarda la clave', temaDesdeFormulario({ ...formularioApariencia(filaTema), frase: '   ' }), {})
caso('frase de 80 vale, de 81 no', [80, 81].map((n) => validarApariencia({ frase: 'a'.repeat(n), ...COLORES_ORIGINALES }).ok), [true, false])
caso('hex sin # o corto: error en ese campo', Object.keys(validarApariencia({ frase: '', ...COLORES_ORIGINALES, fondo: 'f4eee5', acento: '#abc' }).errores), ['fondo', 'acento'])
caso('ilegible: no se puede guardar', validarApariencia({ frase: '', ...COLORES_ORIGINALES, texto: '#f0f0f0' }).primerError, 'texto')

// ── WhatsApp e Instagram ────────────────────────────────────
titulo('WhatsApp: formato internacional argentino')
const wa = (t) => normalizarWhatsApp(t).valor
const esperado = '5491155551234'
for (const escrito of ['11 5555-1234', '(011) 5555-1234', '011 15 5555-1234', '11 15 5555 1234', '+54 9 11 5555-1234', '+54 11 5555-1234', '5491155551234', '54 9 11 5555 1234', '9 11 5555 1234', '0054 9 11 5555-1234', '+549 011 15 5555-1234', '1155551234']) {
  caso(`"${escrito}"`, wa(escrito), esperado)
}
caso('interior con 15 (área de 3)', wa('0351 15 555-1234'), '5493515551234')
caso('interior sin 15 (área de 4)', wa('2944 55-1234'), '5492944551234')
caso('otro país, solo con +', [wa('+598 94 123 456'), normalizarWhatsApp('598 94 123 456').ok], ['59894123456', false])
caso('vacío: se borra', normalizarWhatsApp('  '), { ok: true, valor: null, error: '' })
caso('incompletos o sin área', ['5555-1234', '15 5555-1234', '123', '+54 9 11 5555', '+0 000'].map((t) => normalizarWhatsApp(t).ok), [false, false, false, false, false])
caso('letras, enlaces y esquemas', ['TODO 00000000000', 'https://wa.me/5491155551234', 'javascript:alert(1)', '11-5555-1234;x', '00000000000'].map((t) => normalizarWhatsApp(t).ok), [false, false, false, false, false])
caso('lo normalizado arma el enlace de contacto.js', enlaceWhatsApp(esperado, 'Aroma').startsWith('https://wa.me/5491155551234?text='), true)

titulo('Instagram y URLs: solo https')
const ig = (t) => normalizarInstagram(t).valor
caso('usuario, @usuario y perfil', ['aroma.cafe', '@aroma.cafe', 'https://www.instagram.com/aroma.cafe/', 'instagram.com/aroma.cafe', 'https://instagram.com/aroma.cafe?igsh=1'].map(ig), Array(5).fill('aroma.cafe'))
const peligrosas = ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'file:///etc/passwd', 'ftp://instagram.com/a', 'http://instagram.com/aroma', 'https://evil.com/aroma', 'https://instagram.com.evil.com/aroma', 'https://evil.com/instagram.com/aroma', '//evil.com/aroma', 'https://instagram.com/', 'con espacios', '<img src=x>', 'a'.repeat(31), 'TODO-reemplazar-instagram']
caso('se rechazan esquemas peligrosos, otros sitios y usuarios inválidos', peligrosas.filter((t) => normalizarInstagram(t).ok), [])
caso('el menú tampoco arma enlaces peligrosos con datos viejos', ['javascript:alert(1)', 'data:text/html,x', 'http://instagram.com/a'].map(enlaceInstagram), [null, null, null])

titulo('Información y límites de texto')
const fila = { nombre: 'Aroma', descripcion: 'Café.', direccion: 'Av. Ejemplo 1234', whatsapp: 'TODO 00000000000', instagram: 'TODO-reemplazar-instagram', updated_at: 'v1' }
const info = (cambios) => validarInfo({ ...formularioInfo(fila), ...cambios }, fila)
caso('sin cambios no se valida lo viejo ni se manda nada', info({}), { ok: true, errores: {}, primerError: null, cambios: {} })
caso('cambiar la dirección no exige arreglar los datos de ejemplo', info({ direccion: '  Calle   1 ' }).cambios, { direccion: 'Calle 1' })
caso('vaciar un opcional guarda null', info({ descripcion: '  ', whatsapp: '', instagram: '' }).cambios, { descripcion: null, whatsapp: null, instagram: null })
caso('contacto normalizado', info({ whatsapp: '11 5555-1234', instagram: '@aroma.cafe' }).cambios, { whatsapp: esperado, instagram: 'aroma.cafe' })
caso('nombre vacío', info({ nombre: '   ' }).primerError, 'nombre')
for (const campo of ['nombre', 'descripcion', 'direccion']) {
  caso(`${campo}: ${LIMITES[campo]} vale y ${LIMITES[campo] + 1} no`, [0, 1].map((x) => info({ [campo]: 'a'.repeat(LIMITES[campo] + x) }).ok), [true, false])
}
caso('límites iguales a los de la base', LIMITES, { nombre: 60, descripcion: 200, direccion: 120, whatsapp: 30, instagram: 100, frase: 80, aviso: 200 })
caso('primer error en el orden de los campos', info({ instagram: 'x y', nombre: '' }).primerError, 'nombre')
caso('cambiosReales descarta lo igual (sin importar el orden de las claves)', cambiosReales({ tema: { a: 1, b: 2 }, nombre: 'Aroma' }, { tema: { b: 2, a: 1 }, nombre: 'Aroma' }), {})

titulo('Aviso')
const aviso = (texto, activo) => validarAviso({ texto, activo })
caso('formulario', formularioAviso({ aviso_texto: null, aviso_activo: false }), { texto: '', activo: false })
caso('guarda texto unificado', aviso(' Hoy\ncerramos  temprano ', true).cambios, { aviso_texto: 'Hoy cerramos temprano', aviso_activo: true })
caso('apagado y vacío vale', aviso('', false).cambios, { aviso_texto: null, aviso_activo: false })
caso('activo y vacío no', aviso('   ', true).primerError, 'texto')
caso('200 vale y 201 no', [200, 201].map((n) => aviso('a'.repeat(n), true).ok), [true, false])

// ── Horarios ────────────────────────────────────────────────
titulo('Horarios: leer y escribir')
const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const crudo = { zona: 'America/Argentina/Buenos_Aires', semana: { lunes: [{ desde: '16:00', hasta: '20:00' }, { desde: '08:00', hasta: '13:00' }], sabado: [{ desde: '20:00', hasta: '02:00' }], domingo: [] } }
const f = formularioHorarios(crudo)
caso('modos por día', dias.map((d) => f[d].modo), ['abierto', 'cerrado', 'cerrado', 'cerrado', 'cerrado', 'abierto', 'cerrado'])
caso('ida y vuelta ordenando las franjas', horariosDesdeFormulario(f).semana.lunes, [{ desde: '08:00', hasta: '13:00' }, { desde: '16:00', hasta: '20:00' }])
caso('los 7 días quedan escritos', Object.keys(horariosDesdeFormulario(f).semana), dias)
caso('00:00 a 24:00 es "las 24 horas" y vuelve igual', [formularioHorarios({ semana: { lunes: [{ desde: '00:00', hasta: '24:00' }] } }).lunes.modo, horariosDesdeFormulario(formularioHorarios({ semana: { lunes: [{ desde: '00:00', hasta: '24:00' }] } })).semana.lunes], ['24h', [{ desde: '00:00', hasta: '24:00' }]])
caso('un cierre "24:00" se muestra como 00:00', formularioHorarios({ semana: { lunes: [{ desde: '20:00', hasta: '24:00' }] } }).lunes.franjas[0].hasta, '00:00')
caso('formato viejo, vacío o basura: todo cerrado', [null, {}, { 'Lunes a viernes': '8 a 20' }, { semana: { lunes: 'x', martes: [{ desde: '8', hasta: 'y' }] } }].map((x) => todoCerrado(formularioHorarios(x))), [true, true, true, true])

titulo('Horarios: validación')
const semana = (porDia) => {
  const base = formularioHorarios(null)
  for (const [d, valor] of Object.entries(porDia)) {
    base[d] = valor === '24h' ? { modo: '24h', franjas: [] } : { modo: 'abierto', franjas: valor.map(([a, b]) => nuevaFranja(a, b)) }
  }
  return base
}
const errores = (porDia) => Object.keys(validarHorarios(semana(porDia)).errores)
caso('semana válida con dos turnos y trasnoche', errores({ lunes: [['08:00', '13:00'], ['16:00', '20:00']], viernes: [['20:00', '02:00']], sabado: [['09:00', '13:00'], ['20:00', '04:00']] }), [])
caso('franjas que se tocan no se superponen', errores({ lunes: [['08:00', '13:00'], ['13:00', '20:00']] }), [])
caso('superpuestas el mismo día: marca la segunda', errores({ lunes: [['08:00', '13:00'], ['12:00', '20:00']] }), ['lunes-1'])
caso('una contenida en otra', errores({ lunes: [['08:00', '20:00'], ['10:00', '11:00']] }), ['lunes-1'])
caso('dos iguales: un solo error, en la segunda', errores({ lunes: [['08:00', '20:00'], ['08:00', '20:00']] }), ['lunes-1'])
caso('la trasnoche pisa el día siguiente', errores({ viernes: [['20:00', '03:00']], sabado: [['02:00', '10:00']] }), ['sabado-0'])
caso('la trasnoche del domingo pisa el lunes', errores({ domingo: [['22:00', '09:00']], lunes: [['08:00', '12:00']] }), ['lunes-0'])
caso('trasnoche que no llega a la apertura siguiente', errores({ viernes: [['20:00', '03:00']], sabado: [['03:00', '10:00']] }), [])
caso('24 horas contra la trasnoche anterior', errores({ lunes: [['20:00', '01:00']], martes: '24h' }), ['martes'])
caso('24 horas todos los días vale', errores(Object.fromEntries(dias.map((d) => [d, '24h']))), [])
caso('invertidas (20:00 a 13:00)', errores({ lunes: [['20:00', '13:00']] }), ['lunes-0'])
caso('cerrar a las 12:00 del día siguiente todavía vale; 12:01 no', [errores({ lunes: [['20:00', '12:00']] }).length, errores({ lunes: [['20:00', '12:01']] }).length], [0, 1])
caso('cerrar a medianoche', errores({ lunes: [['18:00', '00:00']] }), [])
caso('misma hora, incompleta o mal escrita', errores({ lunes: [['08:00', '08:00']], martes: [['08:00', '']], miercoles: [['25:00', '26:00']] }), ['lunes-0', 'martes-0', 'miercoles-0'])
caso('abierto sin franjas y más de 3', errores({ lunes: [], martes: [['01:00', '02:00'], ['03:00', '04:00'], ['05:00', '06:00'], ['07:00', '08:00']] }), ['lunes', 'martes'])
caso('un día cerrado no valida sus franjas guardadas', Object.keys(validarHorarios({ ...semana({}), lunes: { modo: 'cerrado', franjas: [nuevaFranja('', '')] } }).errores), [])
caso('primer error: el que se ve primero', validarHorarios(semana({ domingo: [['', '']], martes: [['', '']] })).primerError, 'martes-0')
caso('conserva la zona del local', validarHorarios(semana({ lunes: [['08:00', '09:00']] }), { horarios: { zona: 'America/Argentina/Cordoba' } }).cambios.horarios.zona, 'America/Argentina/Cordoba')

titulo('Horarios: copiar y "Abierto ahora"')
const copiado = copiarATodos(semana({ lunes: [['09:00', '18:00']] }), 'lunes')
caso('copiar a todos', dias.map((d) => horariosDesdeFormulario(copiado).semana[d].length), Array(7).fill(1))
caso('las copias son independientes', new Set(dias.map((d) => copiado[d].franjas[0].clave)).size, 7)
caso('copiar un día cerrado cierra todos', todoCerrado(copiarATodos(semana({ lunes: [['09:00', '18:00']] }), 'martes')), true)
caso('pasar a "abierto" propone una franja', cambiarModo({ modo: 'cerrado', franjas: [] }, 'abierto').franjas.length, 1)
caso('cruza medianoche', [['20:00', '02:00'], ['08:00', '20:00'], ['', '']].map(([desde, hasta]) => cruzaMedianoche({ desde, hasta })), [true, false, false])
// 2026-11-28 es sábado: 00:30 en Buenos Aires (UTC-3) todavía pertenece al viernes.
const trasnoche = normalizarHorarios(validarHorarios(semana({ viernes: [['20:00', '02:00']] })).cambios.horarios)
caso('lo que guarda el panel lo entiende el menú', describirEstado(trasnoche, new Date('2026-11-28T03:30:00Z')).texto, 'Abierto ahora · hasta las 2:00')
caso('cambiar solo las claves internas no cuenta como cambio', huella.horarios(formularioHorarios(crudo)) === huella.horarios(formularioHorarios(crudo)), true)
caso('cambiar una hora sí', huella.horarios(formularioHorarios(crudo)) === huella.horarios(semana({ lunes: [['09:00', '13:00']] })), false)
caso('el color en mayúsculas no es un cambio', huella.apariencia({ frase: '', ...COLORES_ORIGINALES }) === huella.apariencia({ frase: '', ...COLORES_ORIGINALES, fondo: '#F4EEE5' }), true)

titulo('Vista previa')
const base = { nombre: 'Aroma', descripcion: 'Café.', tema: { frase: 'hola', acento: '#112233' }, horarios: crudo, aviso_texto: null, aviso_activo: false }
caso('sin borradores es lo guardado', localParaVistaPrevia(base, {}), base)
caso(
  'muestra lo escrito; un color a medias deja el guardado',
  localParaVistaPrevia(base, { info: { nombre: '', descripcion: ' nueva ' }, aviso: { texto: 'Hoy', activo: true }, apariencia: { frase: 'chau', ...COLORES_ORIGINALES, acento: '#11', portada: '#000000' } }),
  { ...base, descripcion: 'nueva', aviso_texto: 'Hoy', aviso_activo: true, tema: { frase: 'chau', acento: '#112233', portada: '#000000' } },
)

// ── Guardar sin pisar ───────────────────────────────────────
titulo('Guardar sin pisar cambios de otro equipo')
function servidor(inicial, { rechaza = false } = {}) {
  let actual = { ...inicial }
  let version = 1
  return {
    llamadas: 0,
    otroEquipo(cambios) {
      actual = { ...actual, ...cambios, updated_at: `v${++version}` }
    },
    async actualizar(cambios, v) {
      this.llamadas++
      if (rechaza || v !== actual.updated_at) return null
      actual = { ...actual, ...cambios, updated_at: `v${++version}` }
      return actual
    },
    leer: async () => actual,
  }
}
const inicial = { nombre: 'Aroma', direccion: 'A', aviso_texto: null, updated_at: 'v1' }
const guardar = (s, cambios) => guardarSinPisar({ base: inicial, cambios, actualizar: (c, v) => s.actualizar(c, v), leer: s.leer }).then((r) => r, (e) => ({ error: e.code, actual: e.actual?.direccion }))

let s = servidor(inicial)
caso('sin cambios ajenos', (await guardar(s, { direccion: 'B' })).direccion, 'B')
s = servidor(inicial)
s.otroEquipo({ aviso_texto: 'otro' })
let r = await guardar(s, { direccion: 'B' })
caso('otro cambió otra columna: se reintenta y quedan las dos', [r.direccion, r.aviso_texto, s.llamadas], ['B', 'otro', 2])
s = servidor(inicial)
s.otroEquipo({ direccion: 'C' })
caso('otro cambió la misma columna: conflicto, no se pisa', [await guardar(s, { direccion: 'B' }), (await s.leer()).direccion], [{ error: 'CONFLICTO', actual: 'C' }, 'C'])
s = servidor(inicial)
s.otroEquipo({ direccion: 'B' })
caso('ya estaba guardado (respuesta perdida): éxito', (await guardar(s, { direccion: 'B' })).direccion, 'B')
caso('sin permiso (0 filas y la fila no cambió)', await guardar(servidor(inicial, { rechaza: true }), { direccion: 'B' }), { error: 'SIN_FILAS' })
caso('la fila ya no se puede leer', await guardarSinPisar({ base: inicial, cambios: { direccion: 'B' }, actualizar: async () => null, leer: async () => null }).catch((e) => e.code), 'SIN_FILAS')
caso('rebasar: lo no tocado toma lo nuevo y lo tocado queda', rebasar({ nombre: 'Mío', direccion: 'A' }, { nombre: 'Aroma', direccion: 'A' }, { nombre: 'Aroma', direccion: 'C' }), { nombre: 'Mío', direccion: 'C' })
const antes = formularioHorarios(crudo)
const borrador = { ...antes, lunes: { modo: 'cerrado', franjas: [] } }
const despues = formularioHorarios({ semana: { ...crudo.semana, martes: [{ desde: '10:00', hasta: '11:00' }] } })
const mezcla = rebasar(borrador, antes, despues)
caso('rebasar horarios por día (las claves internas no cuentan)', [mezcla.lunes.modo, mezcla.martes.modo], ['cerrado', 'abierto'])
caso('estable ignora el orden de las claves', estable({ b: [1, { d: 1, c: 2 }], a: 1 }) === estable({ a: 1, b: [1, { c: 2, d: 1 }] }), true)

titulo('Mensajes de error (nunca técnicos)')
const msj = mensajeDeErrorAjustes
caso('conflicto', msj({ code: 'CONFLICTO' }).includes('otro equipo'), true)
caso('check de la base', msj({ code: '23514', message: 'violates check constraint "locales_tema_valido"' }), 'La base rechazó esos datos. Revisá el formato y el largo de cada campo.')
caso('trigger o columna protegida', msj({ code: '42501', message: 'permission denied for table locales' }), 'No tenés permiso para hacer ese cambio.')
caso('falta el SQL 11', msj({ code: '42703', message: 'column locales.updated_at does not exist' }).includes('11-admin-ajustes.sql'), true)
caso('sin conexión', msj({ message: 'TypeError: Failed to fetch', code: '' }).startsWith('No pudimos conectarnos'), true)
caso('sin permiso al subir el logo', msj({ paso: 'foto', statusCode: '403' }), 'No tenés permiso para subir el logo de este local.')
caso('desconocido: genérico', msj({ code: 'XX000', message: 'relation x' }), 'No pudimos guardar los cambios. Probá de nuevo en unos instantes.')

// ── Logo ────────────────────────────────────────────────────
titulo('Logo: archivo, recorte y medidas')
const archivo = (type, size = 1000, name = 'l') => ({ type, size, name })
caso('PNG, WebP y JPG', ['image/png', 'image/webp', 'image/jpeg'].map((t) => revisarArchivoLogo(archivo(t)).ok), [true, true, true])
caso('SVG, GIF, HEIC y texto no', ['image/svg+xml', 'image/gif', 'image/heic', 'text/html'].map((t) => revisarArchivoLogo(archivo(t)).ok), [false, false, false, false])
caso('vacío y de más de 10 MB', [revisarArchivoLogo(archivo('image/png', 0)).ok, revisarArchivoLogo(archivo('image/png', 11 * 1024 * 1024)).ok], [false, false])
const pixeles = (ancho, alto, pintar) => {
  const d = new Uint8ClampedArray(ancho * alto * 4)
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) d.set(pintar(x, y), (y * ancho + x) * 4)
  return d
}
const cuadro = pixeles(10, 8, (x, y) => (x >= 2 && x <= 6 && y >= 3 && y <= 4 ? [255, 255, 255, 255] : [0, 0, 0, 0]))
caso('recorta los bordes transparentes', recortarTransparente(cuadro, 10, 8), { x: 2, y: 3, ancho: 5, alto: 2 })
caso('todo transparente', recortarTransparente(pixeles(4, 4, () => [0, 0, 0, 0]), 4, 4), null)
caso('opaco entero: no recorta', recortarTransparente(pixeles(4, 3, () => [0, 0, 0, 255]), 4, 3), { x: 0, y: 0, ancho: 4, alto: 3 })
caso('achica sin deformar para entrar en 640 × 320', [medidasDeLogo(1280, 320), medidasDeLogo(1000, 1000), medidasDeLogo(3000, 100)], [{ ancho: 640, alto: 160 }, { ancho: 320, alto: 320 }, { ancho: 640, alto: 21 }])
caso('nunca agranda', medidasDeLogo(100, 40), { ancho: 100, alto: 40 })
caso('logo blanco sobre portada oscura se ve; sobre blanca no', [analizarLogo(cuadro, '#251e1a').visible, analizarLogo(cuadro, '#ffffff').visible], [1, 0])
caso('detecta si tiene transparencia', [analizarLogo(cuadro, '#000000').transparente, analizarLogo(pixeles(4, 4, () => [9, 9, 9, 255]), '#000000').transparente], [true, false])

titulo('Logo: rutas y cómo lo muestra el menú')
const SUPA = 'https://x.supabase.co'
const ID = 'local-1'
const nombreSubido = nombreDeLogo('ab12', 640, 160, 'webp')
const urlSubida = `${SUPA}/storage/v1/object/public/imagenes/${rutaDeLogo(ID, nombreSubido)}`
caso('ruta dentro de <local_id>/logo/', rutaDeLogo(ID, nombreSubido), 'local-1/logo/logo-ab12-640x160.webp')
caso('solo se borran logos de la carpeta propia', rutaDeLogoDesdeUrl(urlSubida, SUPA, ID), 'local-1/logo/logo-ab12-640x160.webp')
const ajenas = ['/locales/aroma/logo.webp', urlSubida.replace('local-1', 'local-2'), urlSubida.replace(SUPA, 'https://otro.co'), `${SUPA}/storage/v1/object/public/imagenes/local-1/productos/a-480.webp`, `${SUPA}/storage/v1/object/public/imagenes/local-1/logo/../productos/a.webp`, null]
caso('ninguna otra se borra', ajenas.map((u) => rutaDeLogoDesdeUrl(u, SUPA, ID)), Array(ajenas.length).fill(null))
caso('el menú usa el logo subido con sus medidas', logoDePortada(urlSubida), { src: urlSubida, ancho: 640, alto: 160 })
caso('PNG de respaldo también', logoDePortada(urlSubida.replace('.webp', '.png')).alto, 160)
caso('Aroma sigue igual: versión clara sobre portada oscura', logoDePortada('/locales/aroma/logo.webp'), { src: '/locales/aroma/logo-claro.webp', ancho: 560, alto: 111 })
caso('sobre portada clara, el logo oscuro', logoDePortada('/locales/aroma/logo.webp', true).src, '/locales/aroma/logo.webp')
caso('sin logo o con una URL rara: se muestra el nombre', [null, '', 'javascript:alert(1)', 'https://evil.com/x.png'].map((u) => logoDePortada(u)), [null, null, null, null])
caso('al quitar el propio, Aroma recupera el original', [logoOriginal('aroma'), logoOriginal('otro')], ['/locales/aroma/logo.webp', null])

titulo('Logo: orden seguro (fallas entre Storage y la base)')
const urlVieja = urlSubida.replace('ab12', 'vieja1')
async function probarLogo({ falla = {}, cambio, anteriorUrl = urlVieja, base = anteriorUrl } = {}) {
  const pasos = []
  let enBase = base
  const api = {
    supabaseUrl: SUPA,
    urlPublica: (ruta) => `${SUPA}/storage/v1/object/public/imagenes/${ruta}`,
    async subir() {
      pasos.push('subir')
      if (falla.subir) throw new Error('red')
    },
    async borrar(rutas) {
      pasos.push(`borrar:${rutas.map((x) => x.split('/').pop())}`)
      return falla.borrar ? rutas : []
    },
  }
  try {
    const salida = await guardarLogo({
      api,
      localId: ID,
      cambio: cambio ?? { tipo: 'nuevo', blob: {}, nombre: nombreSubido },
      anteriorUrl,
      async guardar(url) {
        pasos.push('guardar')
        if (falla.rechaza) throw Object.assign(new Error('no'), { code: '23514' })
        if (falla.respuesta) {
          if (falla.respuesta === 'llego') enBase = url
          throw Object.assign(new Error('Failed to fetch'), { code: '' })
        }
        enBase = url
        return { logo_url: url }
      },
      async leer() {
        pasos.push('leer')
        if (falla.leer) throw new Error('red')
        return { logo_url: enBase }
      },
    })
    return { pasos, ok: salida.fila.logo_url === enBase, huerfanos: salida.huerfanos.length }
  } catch (e) {
    return { pasos, ok: false, huerfanos: e.huerfanos.length, enDuda: Boolean(e.urlEnDuda) }
  }
}
const NUEVO = 'logo-ab12-640x160.webp'
const VIEJO = 'logo-vieja1-640x160.webp'
caso('camino feliz: subir, guardar y recién ahí borrar lo viejo', await probarLogo(), { pasos: ['subir', 'guardar', `borrar:${VIEJO}`], ok: true, huerfanos: 0 })
caso('falla la subida: no se toca la base', await probarLogo({ falla: { subir: true } }), { pasos: ['subir', `borrar:${NUEVO}`], ok: false, huerfanos: 0, enDuda: false })
caso('la base rechaza: se borra solo lo nuevo', await probarLogo({ falla: { rechaza: true } }), { pasos: ['subir', 'guardar', `borrar:${NUEVO}`], ok: false, huerfanos: 0, enDuda: false })
caso('respuesta perdida pero guardó: éxito', await probarLogo({ falla: { respuesta: 'llego' } }), { pasos: ['subir', 'guardar', 'leer', `borrar:${VIEJO}`], ok: true, huerfanos: 0 })
caso('se cortó y no guardó: se borra lo nuevo', await probarLogo({ falla: { respuesta: 'no' } }), { pasos: ['subir', 'guardar', 'leer', `borrar:${NUEVO}`], ok: false, huerfanos: 0, enDuda: false })
caso('en duda: no se borra nada y se informa', await probarLogo({ falla: { respuesta: 'no', leer: true } }), { pasos: ['subir', 'guardar', 'leer'], ok: false, huerfanos: 1, enDuda: true })
caso('no se pudo borrar lo viejo: se informa', await probarLogo({ falla: { borrar: true } }), { pasos: ['subir', 'guardar', `borrar:${VIEJO}`], ok: true, huerfanos: 1 })
caso('el logo del demo nunca se borra', (await probarLogo({ anteriorUrl: '/locales/aroma/logo.webp' })).pasos, ['subir', 'guardar'])
caso('quitar: primero la base y después el archivo', await probarLogo({ cambio: { tipo: 'quitar', url: '/locales/aroma/logo.webp' } }), { pasos: ['guardar', `borrar:${VIEJO}`], ok: true, huerfanos: 0 })

// ── Salir con cambios sin guardar ───────────────────────────
titulo('Protección de cambios sin guardar')
const actual = { origin: 'https://menu.test', pathname: '/admin/aroma/ajustes' }
const clic = (extra = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...extra })
const a = (href, extra = {}) => ({ href: href.startsWith('http') || href.startsWith('mailto') ? href : `https://menu.test${href}`, target: '', download: false, ...extra })
caso('otra pestaña del panel: se frena', destinoDeClic(clic(), a('/admin/aroma/productos'), actual), '/admin/aroma/productos')
caso('conserva filtros y ancla', destinoDeClic(clic(), a('/admin/aroma/productos?q=a#x'), actual), '/admin/aroma/productos?q=a#x')
caso('cambiar de local', destinoDeClic(clic(), a('/admin'), actual), '/admin')
caso('misma pantalla (saltar al contenido, pestaña actual)', [a('/admin/aroma/ajustes#contenido'), a('/admin/aroma/ajustes')].map((e) => destinoDeClic(clic(), e, actual)), [null, null])
caso('abrir en otra pestaña no pierde nada', [destinoDeClic(clic({ ctrlKey: true }), a('/admin'), actual), destinoDeClic(clic({ metaKey: true }), a('/admin'), actual), destinoDeClic(clic({ shiftKey: true }), a('/admin'), actual), destinoDeClic(clic({ button: 1 }), a('/admin'), actual), destinoDeClic(clic(), a('/aroma', { target: '_blank' }), actual)], [null, null, null, null, null])
caso('descargas, otros sitios y mailto', [a('/x.pdf', { download: true }), a('https://wa.me/1'), a('mailto:a@b.c')].map((e) => destinoDeClic(clic(), e, actual)), [null, null, null])
caso('clic fuera de un enlace o ya cancelado', [destinoDeClic(clic(), null, actual), destinoDeClic(clic({ defaultPrevented: true }), a('/admin'), actual)], [null, null])
const atras = { sucio: true, rutaAntes: '/admin/aroma/ajustes', rutaAhora: '/admin/aroma', idxAntes: 3, idxAhora: 2 }
caso('atrás con cambios: volver 1 hacia adelante', pasoDeRegreso(atras), 1)
caso('adelante con cambios: volver atrás', pasoDeRegreso({ ...atras, idxAhora: 4 }), -1)
caso('dos pasos', pasoDeRegreso({ ...atras, idxAhora: 1 }), 2)
caso('sin cambios, misma ruta (ancla) o sin posición: no se mete', [pasoDeRegreso({ ...atras, sucio: false }), pasoDeRegreso({ ...atras, rutaAhora: atras.rutaAntes }), pasoDeRegreso({ ...atras, idxAhora: undefined }), pasoDeRegreso({ ...atras, idxAntes: null })], [0, 0, 0, 0])
caso('las cuatro claves de color', CLAVES_COLOR, ['fondo', 'texto', 'acento', 'portada'])

console.log(`\n${total - fallos}/${total} pruebas OK`)
if (fallos > 0) process.exit(1)
