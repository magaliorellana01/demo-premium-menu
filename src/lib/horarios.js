// Horarios de un local: funciones puras, sin dependencias.
//
// Todo se calcula con la ZONA HORARIA DEL LOCAL (Intl.DateTimeFormat con timeZone),
// nunca con la del dispositivo de quien mira: un turista en otro país ve si el local
// está abierto según la hora de Buenos Aires.
//
// Formato de la columna `horarios` (jsonb), documentado en el README:
//   {
//     "zona": "America/Argentina/Buenos_Aires",     (opcional; es la de por defecto)
//     "semana": {
//       "lunes":     [{ "desde": "08:00", "hasta": "13:00" }, { "desde": "16:00", "hasta": "20:00" }],
//       "sabado":    [{ "desde": "20:00", "hasta": "02:00" }],   <- "hasta" menor que "desde": cruza la medianoche
//       "domingo":   []                                          <- cerrado (también si el día falta)
//     }
//   }
// Claves de día: lunes, martes, miercoles, jueves, viernes, sabado, domingo (sin tildes).
// Horas "HH:MM" de 00:00 a 23:59; "hasta" también admite "24:00". La apertura es inclusiva
// y el cierre exclusivo: a las 20:00 en punto de un local que cierra a las 20:00, ya está cerrado.

export const ZONA_POR_DEFECTO = 'America/Argentina/Buenos_Aires'

// El índice coincide con Date#getDay(): 0 = domingo.
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const NOMBRES = {
  domingo: 'Domingo',
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
}
const ORDEN_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

const MIN_DIA = 1440
const MIN_SEMANA = 7 * MIN_DIA
const FORMATO_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/** Minutos desde las 00:00. Con `finDeDia`, "24:00" vale 1440. null si no es válida. */
function aMinutos(texto, finDeDia = false) {
  if (finDeDia && texto === '24:00') return MIN_DIA
  if (typeof texto !== 'string' || !FORMATO_HORA.test(texto)) return null
  const [horas, minutos] = texto.split(':').map(Number)
  return horas * 60 + minutos
}

/** 480 -> "8:00"; 1200 -> "20:00"; 0 -> "00:00". */
function formatearMinutos(minutos) {
  const m = ((minutos % MIN_DIA) + MIN_DIA) % MIN_DIA
  if (m === 0) return '00:00'
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** "08:00" -> "8:00"; "24:00" -> "00:00". */
function horaCorta(texto) {
  return formatearMinutos(aMinutos(texto, true) ?? 0)
}

function zonaValida(zona) {
  if (typeof zona !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona })
    return true
  } catch {
    return false
  }
}

/**
 * Valida y ordena el jsonb de la base. Devuelve { zona, dias } (dias[0] = domingo ...
 * dias[6] = sábado, cada uno con sus tramos ordenados) o null si no hay horarios
 * utilizables (vacío, formato viejo o todos los tramos inválidos). Los tramos
 * inválidos se ignoran sin romper el resto.
 */
export function normalizarHorarios(crudo) {
  if (!crudo || typeof crudo !== 'object' || !crudo.semana || typeof crudo.semana !== 'object') return null

  const dias = DIAS.map((clave) => {
    const lista = Array.isArray(crudo.semana[clave]) ? crudo.semana[clave] : []
    return lista
      .map((tramo) => {
        const inicio = aMinutos(tramo?.desde)
        const finCrudo = aMinutos(tramo?.hasta, true)
        if (inicio === null || finCrudo === null || finCrudo === inicio) return null
        // "hasta" menor que "desde": el tramo termina al día siguiente.
        const fin = finCrudo > inicio ? finCrudo : finCrudo + MIN_DIA
        return { desde: tramo.desde, hasta: tramo.hasta, inicio, fin }
      })
      .filter(Boolean)
      .sort((a, b) => a.inicio - b.inicio)
  })

  if (!dias.some((tramos) => tramos.length > 0)) return null
  return { zona: zonaValida(crudo.zona) ? crudo.zona : ZONA_POR_DEFECTO, dias }
}

// ── Hora en la zona del local ────────────────────────────────────

const formateadores = new Map()
const DIA_CORTO = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** { dia: 0-6 (domingo = 0), minutos: 0-1439 } de `fecha` en la zona indicada. */
export function ahoraEnZona(fecha, zona) {
  let formateador = formateadores.get(zona)
  if (!formateador) {
    formateador = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
    formateadores.set(zona, formateador)
  }
  const partes = formateador.formatToParts(fecha)
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value
  return {
    dia: DIA_CORTO[valor('weekday')],
    minutos: (Number(valor('hour')) % 24) * 60 + Number(valor('minute')),
  }
}

// ── Cálculo ──────────────────────────────────────────────────────

/**
 * Intervalos de apertura sobre una línea de tiempo medida en minutos desde el domingo
 * 00:00 de la semana actual. Se repite la semana anterior y la siguiente para que un
 * tramo que cruza el sábado al domingo (o el domingo a la semana que viene) funcione,
 * y se unen los que se tocan (p. ej. 20:00 a 24:00 y 00:00 a 02:00 del día siguiente).
 */
function intervalos(horarios) {
  const lista = []
  horarios.dias.forEach((tramos, dia) => {
    for (const tramo of tramos) {
      for (const desplazamiento of [-MIN_SEMANA, 0, MIN_SEMANA]) {
        lista.push([dia * MIN_DIA + tramo.inicio + desplazamiento, dia * MIN_DIA + tramo.fin + desplazamiento])
      }
    }
  })
  lista.sort((a, b) => a[0] - b[0])

  const unidos = []
  for (const [inicio, fin] of lista) {
    const ultimo = unidos[unidos.length - 1]
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fin)
    else unidos.push([inicio, fin])
  }
  return unidos
}

function situacion(horarios, fecha) {
  const { dia, minutos } = ahoraEnZona(fecha, horarios.zona)
  const t = dia * MIN_DIA + minutos
  const todos = intervalos(horarios)
  const actual = todos.find(([inicio, fin]) => inicio <= t && t < fin)

  if (actual) {
    const siempreAbierto = actual[1] - actual[0] >= MIN_SEMANA
    return { dia, t, abierto: true, siempreAbierto, finalizaEn: actual[1] - t, cierre: actual[1] }
  }
  const siguiente = todos.find(([inicio]) => inicio > t)
  return { dia, t, abierto: false, siguiente: siguiente ? siguiente[0] : null }
}

/** ¿Está abierto en este momento (hora del local)? */
export function estaAbierto(horarios, fecha = new Date()) {
  return situacion(horarios, fecha).abierto
}

/** Hora de cierre ("20:00") del tramo en curso, o null si está cerrado o abre las 24 horas. */
export function horaDeCierre(horarios, fecha = new Date()) {
  const s = situacion(horarios, fecha)
  return s.abierto && !s.siempreAbierto ? formatearMinutos(s.cierre) : null
}

/**
 * Próxima apertura si está cerrado: { enDias, dia, hora } (enDias 0 = hoy, 1 = mañana;
 * `dia` es la clave del día, p. ej. "lunes"). null si está abierto o no vuelve a abrir.
 */
export function proximaApertura(horarios, fecha = new Date()) {
  const s = situacion(horarios, fecha)
  if (s.abierto || s.siguiente === null) return null
  const diaAbsoluto = Math.floor(s.siguiente / MIN_DIA)
  return {
    enDias: diaAbsoluto - Math.floor(s.t / MIN_DIA),
    dia: DIAS[((diaAbsoluto % 7) + 7) % 7],
    hora: formatearMinutos(s.siguiente),
  }
}

/** ¿Cierra en `minutos` o menos (por defecto 30)? Solo si está abierto. */
export function cierraPronto(horarios, fecha = new Date(), minutos = 30) {
  const s = situacion(horarios, fecha)
  return s.abierto && !s.siempreAbierto && s.finalizaEn <= minutos
}

/**
 * Tramos propios del día de hoy (hora del local): { dia, cerrado, tramos: [{ desde, hasta }] }.
 * Ojo: un tramo de ayer que cruza la medianoche cuenta para "está abierto" pero no figura acá.
 */
export function horarioDeHoy(horarios, fecha = new Date()) {
  const { dia } = ahoraEnZona(fecha, horarios.zona)
  const tramos = horarios.dias[dia].map(({ desde, hasta }) => ({ desde, hasta }))
  return { dia: DIAS[dia], cerrado: tramos.length === 0, tramos }
}

function textoTramos(tramos) {
  if (tramos.length === 0) return 'Cerrado'
  return tramos.map(({ desde, hasta }) => `${horaCorta(desde)} a ${horaCorta(hasta)}`).join(' y ')
}

/** Lunes a domingo, para la lista de horarios: [{ clave, nombre, texto, cerrado, esHoy }]. */
export function resumenSemana(horarios, fecha = new Date()) {
  const hoy = horarioDeHoy(horarios, fecha).dia
  return ORDEN_SEMANA.map((clave) => {
    const tramos = horarios.dias[DIAS.indexOf(clave)]
    return { clave, nombre: NOMBRES[clave], texto: textoTramos(tramos), cerrado: tramos.length === 0, esHoy: clave === hoy }
  })
}

/**
 * Estado listo para mostrar: { texto, tono } con tono "abierto" | "pronto" | "cerrado".
 *   "Abierto ahora · hasta las 20:00"   "Cierra pronto · hasta las 20:00"
 *   "Cerrado · abre hoy a las 16:00"    "Cerrado · abre mañana a las 8:00"
 *   "Cerrado · abre el lunes a las 8:00"
 */
export function describirEstado(horarios, fecha = new Date()) {
  const s = situacion(horarios, fecha)

  if (s.abierto) {
    if (s.siempreAbierto) return { texto: 'Abierto las 24 horas', tono: 'abierto' }
    const hasta = formatearMinutos(s.cierre)
    return s.finalizaEn <= 30
      ? { texto: `Cierra pronto · hasta las ${hasta}`, tono: 'pronto' }
      : { texto: `Abierto ahora · hasta las ${hasta}`, tono: 'abierto' }
  }

  const proxima = proximaApertura(horarios, fecha)
  if (!proxima) return { texto: 'Cerrado', tono: 'cerrado' }
  let cuando
  if (proxima.enDias === 0) cuando = 'hoy'
  else if (proxima.enDias === 1) cuando = 'mañana'
  else if (proxima.enDias >= 7) cuando = `el próximo ${NOMBRES[proxima.dia].toLowerCase()}`
  else cuando = `el ${NOMBRES[proxima.dia].toLowerCase()}`
  return { texto: `Cerrado · abre ${cuando} a las ${proxima.hora}`, tono: 'cerrado' }
}
