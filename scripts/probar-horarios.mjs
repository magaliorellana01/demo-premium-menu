// Pruebas de src/lib/horarios.js (sin dependencias): node scripts/probar-horarios.mjs
//
// Verifica los casos límite: justo a la apertura y al cierre, día cerrado, tramo que cruza
// la medianoche, dos tramos en el mismo día, local en otra zona horaria y, sobre todo, que
// el resultado NO dependa de la zona horaria del dispositivo (se vuelve a correr el script
// con TZ de Tokio, Los Ángeles, UTC y la isla Kiritimati y se compara).
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  describirEstado,
  cierraPronto,
  estaAbierto,
  horaDeCierre,
  horarioDeHoy,
  normalizarHorarios,
  proximaApertura,
  resumenSemana,
} from '../src/lib/horarios.js'

// Instante a partir de una hora de pared de Buenos Aires (UTC-3, sin horario de verano).
// 23/11/2026 es lunes; 24 martes ... 27 viernes, 28 sábado, 29 domingo.
const ba = (dia, hora) => new Date(`2026-11-${dia}T${hora}:00-03:00`)
const LUN = 23, MAR = 24, VIE = 27, SAB = 28, DOM = 29

const tramo = (desde, hasta) => [{ desde, hasta }]
const semana = (extra = {}) => ({
  zona: 'America/Argentina/Buenos_Aires',
  semana: {
    lunes: tramo('08:00', '20:00'), martes: tramo('08:00', '20:00'), miercoles: tramo('08:00', '20:00'),
    jueves: tramo('08:00', '20:00'), viernes: tramo('08:00', '20:00'),
    sabado: tramo('09:00', '21:00'), domingo: tramo('09:00', '14:00'),
    ...extra,
  },
})
const H = (crudo) => normalizarHorarios(crudo)

// Casos que se repiten con la zona del dispositivo cambiada (mismo resultado esperado en todas).
const INSTANTES_CLAVE = [
  ba(LUN, '10:00'), ba(LUN, '19:45'), ba(LUN, '20:00'), ba(LUN, '23:30'),
  ba(SAB, '21:00'), ba(DOM, '14:00'), ba(DOM, '02:30'),
]
const firmaClave = () =>
  INSTANTES_CLAVE.map((f) => {
    const h = H(semana())
    return [describirEstado(h, f).texto, estaAbierto(h, f), horaDeCierre(h, f), horarioDeHoy(h, f).dia].join(' | ')
  })

// ── Modo "hijo": solo imprime la firma, para comparar entre zonas del dispositivo ──
if (process.argv.includes('--hijo')) {
  console.log(JSON.stringify({ firma: firmaClave(), horaLocalDelDispositivo: new Date(ba(LUN, '10:00')).getHours() }))
  process.exit(0)
}

let total = 0
let fallos = 0
function caso(nombre, real, esperado) {
  total++
  const ok = JSON.stringify(real) === JSON.stringify(esperado)
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${nombre}${ok ? '' : `\n         esperado: ${JSON.stringify(esperado)}\n         obtenido: ${JSON.stringify(real)}`}`)
}
const seccion = (titulo) => console.log(`\n— ${titulo} —`)

// ───────────────────────────────────────────────────────────────
seccion('Apertura y cierre justo en punto (lunes a viernes de 8 a 20)')
const base = H(semana())
caso('lunes 08:00: ya está abierto (la apertura es inclusiva)', estaAbierto(base, ba(LUN, '08:00')), true)
caso('lunes 07:59: todavía cerrado', estaAbierto(base, ba(LUN, '07:59')), false)
caso('lunes 07:59: abre hoy a las 8:00', describirEstado(base, ba(LUN, '07:59')).texto, 'Cerrado · abre hoy a las 8:00')
caso('lunes 19:59: abierto, hasta las 20:00', horaDeCierre(base, ba(LUN, '19:59')), '20:00')
caso('lunes 20:00: ya cerró (el cierre es exclusivo)', estaAbierto(base, ba(LUN, '20:00')), false)
caso('lunes 20:00: abre mañana a las 8:00', describirEstado(base, ba(LUN, '20:00')).texto, 'Cerrado · abre mañana a las 8:00')
caso('viernes 20:00: abre mañana (sábado) a las 9:00', describirEstado(base, ba(VIE, '20:00')).texto, 'Cerrado · abre mañana a las 9:00')
caso('próxima apertura (estructura): lunes 20:00 -> { enDias: 1, dia: martes, hora: 8:00 }', proximaApertura(base, ba(LUN, '20:00')), { enDias: 1, dia: 'martes', hora: '8:00' })
caso('próxima apertura: null si está abierto', proximaApertura(base, ba(LUN, '12:00')), null)
caso('sábado 21:00: abre mañana (domingo) a las 9:00', describirEstado(base, ba(SAB, '21:00')).texto, 'Cerrado · abre mañana a las 9:00')
caso('domingo 14:00: abre mañana (lunes) a las 8:00', describirEstado(base, ba(DOM, '14:00')).texto, 'Cerrado · abre mañana a las 8:00')

seccion('Cierra pronto (30 minutos o menos)')
caso('19:29 (31 min para cerrar): todavía no', cierraPronto(base, ba(LUN, '19:29')), false)
caso('19:30 (30 min): sí, justo en el límite', cierraPronto(base, ba(LUN, '19:30')), true)
caso('19:59 (1 min): sí', cierraPronto(base, ba(LUN, '19:59')), true)
caso('20:00 (ya cerró): no', cierraPronto(base, ba(LUN, '20:00')), false)
caso('cierra pronto: texto y tono', describirEstado(base, ba(LUN, '19:45')), { texto: 'Cierra pronto · hasta las 20:00', tono: 'pronto' })
caso('abierto: texto y tono', describirEstado(base, ba(LUN, '12:00')), { texto: 'Abierto ahora · hasta las 20:00', tono: 'abierto' })

seccion('Horario de hoy y de la semana')
caso('sábado: horario de hoy', horarioDeHoy(base, ba(SAB, '12:00')), { dia: 'sabado', cerrado: false, tramos: [{ desde: '09:00', hasta: '21:00' }] })
caso('semana: lunes y domingo, y hoy resaltado', resumenSemana(base, ba(MAR, '12:00')).filter((d) => ['lunes', 'martes', 'domingo'].includes(d.clave)).map((d) => [d.nombre, d.texto, d.esHoy]),
  [['Lunes', '8:00 a 20:00', false], ['Martes', '8:00 a 20:00', true], ['Domingo', '9:00 a 14:00', false]])

seccion('Día cerrado (domingo cerrado)')
const conDomingoCerrado = H(semana({ domingo: [] }))
caso('sábado 21:30: abre el lunes a las 8:00 (salta el domingo)', describirEstado(conDomingoCerrado, ba(SAB, '21:30')).texto, 'Cerrado · abre el lunes a las 8:00')
caso('domingo 12:00: cerrado, abre mañana a las 8:00', describirEstado(conDomingoCerrado, ba(DOM, '12:00')).texto, 'Cerrado · abre mañana a las 8:00')
caso('domingo: horario de hoy cerrado', horarioDeHoy(conDomingoCerrado, ba(DOM, '12:00')).cerrado, true)
caso('domingo cerrado se muestra "Cerrado" en la lista', resumenSemana(conDomingoCerrado, ba(LUN, '12:00')).find((d) => d.clave === 'domingo').texto, 'Cerrado')
caso('un día que falta en el JSON también cuenta como cerrado', estaAbierto(H({ semana: { lunes: tramo('08:00', '20:00') } }), ba(MAR, '12:00')), false)
caso('abre en una semana: "el próximo lunes"', describirEstado(H({ semana: { lunes: tramo('08:00', '20:00') } }), ba(LUN, '21:00')).texto, 'Cerrado · abre el próximo lunes a las 8:00')
caso('miércoles se escribe con tilde', describirEstado(H({ semana: { miercoles: tramo('08:00', '20:00') } }), ba(LUN, '12:00')).texto, 'Cerrado · abre el miércoles a las 8:00')

seccion('Tramo que cruza la medianoche (viernes y sábado de 20:00 a 02:00)')
const noche = H({ semana: { lunes: tramo('08:00', '20:00'), viernes: tramo('20:00', '02:00'), sabado: tramo('20:00', '02:00') } })
caso('viernes 19:59: cerrado, abre hoy a las 20:00', describirEstado(noche, ba(VIE, '19:59')).texto, 'Cerrado · abre hoy a las 20:00')
caso('viernes 20:00: abierto hasta las 2:00', describirEstado(noche, ba(VIE, '20:00')).texto, 'Abierto ahora · hasta las 2:00')
caso('viernes 23:59: sigue abierto', estaAbierto(noche, ba(VIE, '23:59')), true)
caso('sábado 00:00 (madrugada del tramo del viernes): abierto', estaAbierto(noche, ba(SAB, '00:00')), true)
caso('sábado 01:30: abierto y cierra pronto (30 min)', [estaAbierto(noche, ba(SAB, '01:30')), cierraPronto(noche, ba(SAB, '01:30')), horaDeCierre(noche, ba(SAB, '01:30'))], [true, true, '2:00'])
caso('sábado 02:00: cerrado (cierre exclusivo)', estaAbierto(noche, ba(SAB, '02:00')), false)
caso('sábado 02:00: abre hoy a las 20:00', describirEstado(noche, ba(SAB, '02:00')).texto, 'Cerrado · abre hoy a las 20:00')
caso('domingo 01:59: abierto (el tramo del sábado cruza al domingo)', estaAbierto(noche, ba(DOM, '01:59')), true)
caso('domingo 02:00: cerrado, abre mañana a las 8:00', describirEstado(noche, ba(DOM, '02:00')).texto, 'Cerrado · abre mañana a las 8:00')
caso('el horario "de hoy" del domingo es de ese día (cerrado) aunque a la 1:00 esté abierto', [horarioDeHoy(noche, ba(DOM, '01:00')).cerrado, estaAbierto(noche, ba(DOM, '01:00'))], [true, true])
caso('un tramo hasta 00:00 equivale a la medianoche', describirEstado(H({ semana: { lunes: tramo('20:00', '00:00') } }), ba(LUN, '22:00')).texto, 'Abierto ahora · hasta las 00:00')
caso('un tramo hasta 24:00 también', describirEstado(H({ semana: { lunes: tramo('20:00', '24:00') } }), ba(LUN, '22:00')).texto, 'Abierto ahora · hasta las 00:00')
caso('lista: el tramo nocturno se muestra "20:00 a 2:00"', resumenSemana(noche, ba(LUN, '12:00')).find((d) => d.clave === 'viernes').texto, '20:00 a 2:00')
caso('tramos que se tocan (20:00-24:00 y 00:00-02:00 del día siguiente) se unen', horaDeCierre(H({ semana: { lunes: tramo('20:00', '24:00'), martes: tramo('00:00', '02:00') } }), ba(LUN, '21:00')), '2:00')

seccion('Dos tramos en el mismo día (8 a 13 y 16 a 20)')
const cortado = H(semana({ lunes: [{ desde: '16:00', hasta: '20:00' }, { desde: '08:00', hasta: '13:00' }] })) // desordenados a propósito
caso('12:59: abierto hasta las 13:00', describirEstado(cortado, ba(LUN, '12:59')).texto, 'Cierra pronto · hasta las 13:00')
caso('13:00: cerrado, abre hoy a las 16:00', describirEstado(cortado, ba(LUN, '13:00')).texto, 'Cerrado · abre hoy a las 16:00')
caso('15:59: sigue cerrado', estaAbierto(cortado, ba(LUN, '15:59')), false)
caso('16:00: abierto de nuevo hasta las 20:00', describirEstado(cortado, ba(LUN, '16:00')).texto, 'Abierto ahora · hasta las 20:00')
caso('20:00: cerrado, abre mañana a las 8:00', describirEstado(cortado, ba(LUN, '20:00')).texto, 'Cerrado · abre mañana a las 8:00')
caso('horario de hoy: los dos tramos, ordenados', horarioDeHoy(cortado, ba(LUN, '12:00')).tramos, [{ desde: '08:00', hasta: '13:00' }, { desde: '16:00', hasta: '20:00' }])
caso('lista: "8:00 a 13:00 y 16:00 a 20:00"', resumenSemana(cortado, ba(LUN, '12:00'))[0].texto, '8:00 a 13:00 y 16:00 a 20:00')

seccion('Zona horaria del LOCAL (no la del dispositivo)')
const madrid = H({ zona: 'Europe/Madrid', semana: { lunes: tramo('09:00', '18:00') } })
caso('Madrid, lunes 09:00 (08:00Z): abierto', estaAbierto(madrid, new Date('2026-11-23T08:00:00Z')), true)
caso('Madrid, lunes 08:59 (07:59Z): cerrado', estaAbierto(madrid, new Date('2026-11-23T07:59:00Z')), false)
caso('el mismo instante en Buenos Aires (05:00) sería cerrado', estaAbierto(H({ semana: { lunes: tramo('09:00', '18:00') } }), new Date('2026-11-23T08:00:00Z')), false)
caso('zona inválida: usa Buenos Aires', normalizarHorarios({ zona: 'Marte/Olympus', semana: { lunes: tramo('08:00', '20:00') } }).zona, 'America/Argentina/Buenos_Aires')
caso('sin zona: usa Buenos Aires', normalizarHorarios({ semana: { lunes: tramo('08:00', '20:00') } }).zona, 'America/Argentina/Buenos_Aires')

// Misma salida con el dispositivo en otra zona horaria
seccion('Dispositivo en otra zona horaria (se repite el script con TZ distinta)')
const firmaLocal = firmaClave()
for (const tz of ['Asia/Tokyo', 'America/Los_Angeles', 'UTC', 'Pacific/Kiritimati']) {
  const hijo = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--hijo'], { env: { ...process.env, TZ: tz }, encoding: 'utf-8' })
  const datos = JSON.parse(hijo.stdout)
  caso(`TZ=${tz} (en el dispositivo serían las ${datos.horaLocalDelDispositivo} h, no las 10): mismos resultados que en Buenos Aires`, datos.firma, firmaLocal)
  caso(`TZ=${tz}: la zona del dispositivo realmente era distinta`, datos.horaLocalDelDispositivo !== 10, true)
}

seccion('Datos inválidos o incompletos')
caso('null, vacío o formato viejo: sin horarios', [H(null), H({}), H({ 'Lunes a viernes': '8 a 20 h' })], [null, null, null])
caso('todos los días cerrados: sin horarios utilizables', H({ semana: { lunes: [], martes: [] } }), null)
caso('hora inválida (25:00) o igual a la de inicio: se ignora ese tramo', H({ semana: { lunes: [{ desde: '25:00', hasta: '26:00' }, { desde: '08:00', hasta: '08:00' }, { desde: '09:00', hasta: '17:00' }] } }).dias[1], [{ desde: '09:00', hasta: '17:00', inicio: 540, fin: 1020 }])
caso('abierto las 24 horas, todos los días', describirEstado(H({ semana: Object.fromEntries(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((d) => [d, tramo('00:00', '24:00')])) }), ba(MAR, '03:00')), { texto: 'Abierto las 24 horas', tono: 'abierto' })

console.log(`\n${total - fallos}/${total} pruebas OK${fallos ? ` — ${fallos} FALLARON` : ''}`)
process.exit(fallos ? 1 : 0)
