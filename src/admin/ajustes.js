// Lógica pura de los ajustes del local: formularios, validación, normalización, contraste,
// guardado sin pisar cambios ajenos y mensajes de error. Sin red ni React
// (scripts/probar-ajustes.mjs).
//
// La base impone sus propios límites (RLS, permisos por columna, un trigger y CHECKs, ver
// supabase/11-admin-ajustes.sql). Esto es para avisar antes y en español, no para reemplazarlos.
import { enlaceInstagram } from '../lib/contacto.js'
import { ZONA_POR_DEFECTO } from '../lib/horarios.js'
import { CLAVES_COLOR, COLORES_ORIGINALES, coloresDelTema, contraste, esColor, paleta } from '../lib/tema.js'

export const LIMITES = { nombre: 60, descripcion: 200, direccion: 120, whatsapp: 30, instagram: 100, frase: 80, aviso: 200 }

/** Columnas que se leen y se pueden guardar desde el panel. */
export const COLUMNAS_LECTURA = 'id, slug, nombre, descripcion, direccion, whatsapp, instagram, horarios, aviso_texto, aviso_activo, tema, logo_url, activo, updated_at'

/** id del control de un campo (para llevar el foco al primer error). */
export const idDeAjuste = (seccion, clave) => `ajuste-${seccion}-${clave}`

const unaLinea = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim()

/** JSON con las claves ordenadas: compara jsonb sin que importe el orden. */
export function estable(valor) {
  if (Array.isArray(valor)) return `[${valor.map(estable).join(',')}]`
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${estable(valor[k])}`).join(',')}}`
  }
  return JSON.stringify(valor ?? null)
}

function resultado(errores, orden, cambios) {
  const ok = orden.length === 0
  return { ok, errores, primerError: orden[0] ?? null, cambios: ok ? cambios : null }
}

function recolector() {
  const errores = {}
  const orden = []
  return {
    errores,
    orden,
    poner(campo, mensaje) {
      if (errores[campo]) return
      errores[campo] = mensaje
      orden.push(campo)
    },
  }
}

// ── WhatsApp e Instagram ────────────────────────────────────

/** Saca el "15" de un celular escrito a la antigua (área + 15 + número = 12 dígitos). */
function sinQuince(n) {
  if (n.startsWith('11')) return n.slice(2, 4) === '15' ? n.slice(0, 2) + n.slice(4) : null
  const donde = [3, 4].filter((i) => n.slice(i, i + 2) === '15')
  return donde.length === 1 ? n.slice(0, donde[0]) + n.slice(donde[0] + 2) : null
}

/**
 * Celular argentino en formato internacional: "549" + código de área + número (13 dígitos).
 * Acepta "11 5555-1234", "011 15 5555-1234", "+54 9 11 5555 1234", etc. Un número de otro
 * país solo se acepta si se escribe con "+". Devuelve { ok, valor, error } (vacío = null).
 */
export function normalizarWhatsApp(texto) {
  const crudo = String(texto ?? '').trim()
  if (!crudo) return { ok: true, valor: null, error: '' }
  const mal = (error) => ({ ok: false, valor: null, error })
  if (!/^\+?[\d\s().-]+$/.test(crudo)) return mal('Escribí solo el número (podés usar espacios, guiones, paréntesis y +).')

  let n = crudo.replace(/\D/g, '')
  let internacional = crudo.startsWith('+')
  if (n.startsWith('00')) {
    n = n.slice(2)
    internacional = true
  }
  if (internacional && !n.startsWith('54')) {
    return n.length >= 8 && n.length <= 15 && n[0] !== '0' ? { ok: true, valor: n, error: '' } : mal('Ese número internacional no está completo.')
  }
  if (n.startsWith('54') && (internacional || n.length >= 12)) {
    n = n.slice(2)
    if (n.startsWith('9') && n.length >= 11) n = n.slice(1)
  } else if (n.startsWith('9') && n.length === 11) {
    n = n.slice(1)
  }
  if (n.startsWith('0')) n = n.slice(1)
  if (n.length === 12) n = sinQuince(n) ?? n
  if (n.length !== 10 || !/^(11|[23])/.test(n)) {
    return mal('Escribí el celular con código de área, sin el 0 ni el 15. Por ejemplo 11 5555-1234.')
  }
  return { ok: true, valor: `549${n}`, error: '' }
}

/** Usuario de Instagram. Acepta "usuario", "@usuario" o la dirección https del perfil. */
export function normalizarInstagram(texto) {
  const crudo = String(texto ?? '').trim()
  if (!crudo) return { ok: true, valor: null, error: '' }
  const mal = { ok: false, valor: null, error: 'Escribí tu usuario (por ejemplo aroma.cafe) o la dirección https de tu perfil.' }
  const enlace = enlaceInstagram(crudo) // descarta otros sitios y cualquier esquema que no sea https
  if (!enlace) return mal
  const usuario = decodeURIComponent(enlace.slice('https://www.instagram.com/'.length))
  return /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? { ok: true, valor: usuario, error: '' } : mal
}

// ── Información y contacto ──────────────────────────────────

export const CAMPOS_INFO = ['nombre', 'descripcion', 'direccion', 'whatsapp', 'instagram']

export function formularioInfo(local) {
  return Object.fromEntries(CAMPOS_INFO.map((c) => [c, local?.[c] ?? '']))
}

/**
 * Solo se validan y se mandan los campos que CAMBIARON: un dato de ejemplo viejo (por ejemplo
 * el WhatsApp "TODO 000...") no impide corregir la dirección.
 */
export function validarInfo(formulario, base) {
  const { errores, orden, poner } = recolector()
  const antes = formularioInfo(base)
  const cambios = {}

  for (const campo of CAMPOS_INFO) {
    if (formulario[campo] === antes[campo]) continue
    let valor = unaLinea(formulario[campo])
    if (campo === 'whatsapp' || campo === 'instagram') {
      const revision = (campo === 'whatsapp' ? normalizarWhatsApp : normalizarInstagram)(valor)
      if (!revision.ok) {
        poner(campo, revision.error)
        continue
      }
      valor = revision.valor ?? ''
    }
    if (campo === 'nombre' && !valor) poner(campo, 'Escribí el nombre del local.')
    else if (valor.length > LIMITES[campo]) poner(campo, `Puede tener hasta ${LIMITES[campo]} caracteres (tiene ${valor.length}).`)
    if (valor !== antes[campo]) cambios[campo] = campo === 'nombre' ? valor : valor || null
  }
  return resultado(errores, orden, cambios)
}

// ── Horarios ────────────────────────────────────────────────

export const DIAS_SEMANA = [
  { clave: 'lunes', nombre: 'Lunes' },
  { clave: 'martes', nombre: 'Martes' },
  { clave: 'miercoles', nombre: 'Miércoles' },
  { clave: 'jueves', nombre: 'Jueves' },
  { clave: 'viernes', nombre: 'Viernes' },
  { clave: 'sabado', nombre: 'Sábado' },
  { clave: 'domingo', nombre: 'Domingo' },
]
export const MAX_FRANJAS = 3
/** Un horario que pasa la medianoche tiene que cerrar a más tardar a esta hora. */
const CIERRE_MAXIMO_DE_MADRUGADA = 12 * 60
const FRANJA_NUEVA = { desde: '09:00', hasta: '18:00' }
const MIN_DIA = 1440
const MIN_SEMANA = 7 * MIN_DIA
const HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const aMinutos = (texto) => {
  const [h, m] = texto.split(':').map(Number)
  return h * 60 + m
}

let contadorDeFranjas = 0
/** `clave` es solo para React (identifica la fila aunque se quiten otras). */
export const nuevaFranja = (desde = FRANJA_NUEVA.desde, hasta = FRANJA_NUEVA.hasta) => ({ clave: `f${++contadorDeFranjas}`, desde, hasta })

/** jsonb de la base -> formulario: por día { modo: 'abierto' | 'cerrado' | '24h', franjas }. */
export function formularioHorarios(crudo) {
  return Object.fromEntries(
    DIAS_SEMANA.map(({ clave }) => {
      const lista = (Array.isArray(crudo?.semana?.[clave]) ? crudo.semana[clave] : []).filter(
        (f) => HORA.test(f?.desde ?? '') && (HORA.test(f?.hasta ?? '') || f?.hasta === '24:00'),
      )
      if (lista.length === 1 && lista[0].desde === '00:00' && lista[0].hasta === '24:00') return [clave, { modo: '24h', franjas: [] }]
      // El campo de hora del navegador no tiene "24:00": como cierre, "00:00" es lo mismo.
      const franjas = lista
        .map((f) => nuevaFranja(f.desde, f.hasta === '24:00' ? '00:00' : f.hasta))
        .sort((a, b) => a.desde.localeCompare(b.desde))
      return [clave, { modo: franjas.length ? 'abierto' : 'cerrado', franjas }]
    }),
  )
}

/** Formulario -> jsonb. Las franjas incompletas se omiten (la vista previa las ignora). */
export function horariosDesdeFormulario(formulario, zona = ZONA_POR_DEFECTO) {
  const semana = Object.fromEntries(
    DIAS_SEMANA.map(({ clave }) => {
      const { modo, franjas } = formulario[clave]
      if (modo === '24h') return [clave, [{ desde: '00:00', hasta: '24:00' }]]
      if (modo !== 'abierto') return [clave, []]
      return [
        clave,
        franjas
          .filter((f) => HORA.test(f.desde) && HORA.test(f.hasta) && f.desde !== f.hasta)
          .map(({ desde, hasta }) => ({ desde, hasta }))
          .sort((a, b) => a.desde.localeCompare(b.desde)),
      ]
    }),
  )
  return { zona, semana }
}

export function cambiarModo(dia, modo) {
  return { modo, franjas: modo === 'abierto' && dia.franjas.length === 0 ? [nuevaFranja()] : dia.franjas }
}

export function copiarATodos(formulario, origen) {
  const { modo, franjas } = formulario[origen]
  return Object.fromEntries(
    DIAS_SEMANA.map(({ clave }) => [
      clave,
      clave === origen ? formulario[origen] : { modo, franjas: franjas.map((f) => nuevaFranja(f.desde, f.hasta)) },
    ]),
  )
}

/** ¿La franja termina al día siguiente? */
export const cruzaMedianoche = (f) => HORA.test(f.desde) && HORA.test(f.hasta) && f.hasta < f.desde

/**
 * Claves de error: "<dia>" o "<dia>-<indice>". No admite franjas incompletas, vacías,
 * invertidas (cruzan la medianoche y cierran después del mediodía) ni superpuestas, también
 * contra las del día siguiente (y del domingo al lunes).
 */
export function validarHorarios(formulario, base = null) {
  const { errores, orden, poner } = recolector()
  const intervalos = []

  DIAS_SEMANA.forEach(({ clave, nombre }, dia) => {
    const { modo, franjas } = formulario[clave]
    if (modo === '24h') intervalos.push({ ini: dia * MIN_DIA, fin: (dia + 1) * MIN_DIA, clave: `${clave}`, nombre })
    if (modo !== 'abierto') return
    if (franjas.length === 0) poner(clave, 'Agregá un horario o marcá el día como cerrado.')
    if (franjas.length > MAX_FRANJAS) poner(clave, `Podés cargar hasta ${MAX_FRANJAS} horarios por día.`)
    franjas.forEach((f, i) => {
      const campo = `${clave}-${i}`
      if (!HORA.test(f.desde) || !HORA.test(f.hasta)) return poner(campo, 'Completá la hora de apertura y la de cierre.')
      if (f.desde === f.hasta) return poner(campo, 'La apertura y el cierre no pueden ser la misma hora.')
      const ini = aMinutos(f.desde)
      let fin = aMinutos(f.hasta)
      if (fin < ini) {
        if (fin > CIERRE_MAXIMO_DE_MADRUGADA) {
          return poner(campo, 'Parece que las horas están al revés. Si cerrás al día siguiente, puede ser hasta las 12:00.')
        }
        fin += MIN_DIA
      }
      intervalos.push({ ini: dia * MIN_DIA + ini, fin: dia * MIN_DIA + fin, clave: campo, nombre })
    })
  })

  for (let i = 0; i < intervalos.length; i++) {
    for (let j = 0; j < intervalos.length; j++) {
      if (i === j) continue
      const a = intervalos[i]
      const b = intervalos[j]
      // ¿b empieza mientras a sigue abierto? (-MIN_SEMANA: lo del domingo que sigue el lunes)
      const empiezaDentro = [0, -MIN_SEMANA].some((d) => {
        const ini = a.ini + d
        const fin = a.fin + d
        return b.ini >= ini && b.ini < fin && !(b.ini === ini && j < i)
      })
      if (empiezaDentro) poner(b.clave, a.nombre === b.nombre ? 'Este horario se superpone con otro del mismo día.' : `Este horario se superpone con el del ${a.nombre.toLowerCase()}.`)
    }
  }

  // Los errores salen en el orden en que se ven los campos.
  const posicion = (clave) => {
    const [dia, indice = -1] = clave.split('-')
    return DIAS_SEMANA.findIndex((d) => d.clave === dia) * 10 + Number(indice)
  }
  orden.sort((a, b) => posicion(a) - posicion(b))

  return resultado(errores, orden, { horarios: horariosDesdeFormulario(formulario, base?.horarios?.zona ?? ZONA_POR_DEFECTO) })
}

export const todoCerrado = (formulario) => DIAS_SEMANA.every(({ clave }) => formulario[clave].modo === 'cerrado')

// ── Aviso ───────────────────────────────────────────────────

export function formularioAviso(local) {
  return { texto: local?.aviso_texto ?? '', activo: local?.aviso_activo === true }
}

export function validarAviso(formulario) {
  const { errores, orden, poner } = recolector()
  const texto = unaLinea(formulario.texto)
  if (texto.length > LIMITES.aviso) poner('texto', `El aviso puede tener hasta ${LIMITES.aviso} caracteres (tiene ${texto.length}).`)
  else if (formulario.activo && !texto) poner('texto', 'Escribí el aviso o apagalo.')
  return resultado(errores, orden, { aviso_texto: texto || null, aviso_activo: Boolean(formulario.activo) })
}

// ── Apariencia ──────────────────────────────────────────────

export const CAMPOS_COLOR = [
  { clave: 'fondo', nombre: 'Fondo', ayuda: 'El fondo de la carta.' },
  { clave: 'texto', nombre: 'Texto', ayuda: 'Nombres, descripciones y precios.' },
  { clave: 'acento', nombre: 'Acento', ayuda: 'Botones, detalles y la frase de la portada.' },
  { clave: 'portada', nombre: 'Portada', ayuda: 'La franja de arriba, detrás del logo.' },
]

export function formularioApariencia(local) {
  return { frase: typeof local?.tema?.frase === 'string' ? local.tema.frase : '', ...coloresDelTema(local?.tema) }
}

/** El tema a guardar: la frase y solo los colores distintos de los originales. */
export function temaDesdeFormulario(formulario) {
  const tema = {}
  const frase = unaLinea(formulario.frase)
  if (frase) tema.frase = frase
  for (const clave of CLAVES_COLOR) {
    const color = String(formulario[clave] ?? '').trim().toLowerCase()
    if (esColor(color) && color !== COLORES_ORIGINALES[clave]) tema[clave] = color
  }
  return tema
}

export const coloresOriginales = (formulario) => ({ ...formulario, ...COLORES_ORIGINALES })

const legible = (ratio) => `${(Math.floor(ratio * 100) / 100).toFixed(2).replace('.', ',')}:1`

/**
 * Contraste WCAG de los colores elegidos. Devuelve { filas, bloquea }.
 * Cada fila: { clave, nombre, ratio, texto, minimo, nivel: 'bien' | 'aviso' | 'ilegible', nota }.
 * Solo el texto sobre el fondo puede quedar mal: lo demás se calcula para que se lea.
 * Con menos de 4,5:1 (AA) se avisa; con menos de 3:1 es ilegible y no se puede guardar.
 */
export function revisarContraste(formulario) {
  const colores = Object.fromEntries(CLAVES_COLOR.map((c) => [c, String(formulario[c] ?? '').trim().toLowerCase()]))
  if (!CLAVES_COLOR.every((c) => esColor(colores[c]))) return { filas: [], bloquea: false }
  const p = paleta(colores)
  const fila = (clave, nombre, ratio, minimo, nota = '', puedeBloquear = false) => ({
    clave,
    nombre,
    ratio,
    texto: legible(ratio),
    minimo,
    nivel: ratio >= minimo ? 'bien' : puedeBloquear && ratio < 3 ? 'ilegible' : 'aviso',
    nota,
  })
  const enTexto = Math.min(contraste(p.texto, p.fondo), contraste(p.texto, p.fondoSuave))
  const filas = [
    fila('texto', 'Texto sobre el fondo', enTexto, 4.5, '', true),
    fila('enlaces', 'Enlaces y precios de opciones', contraste(p.acentoTexto, p.fondo), 4.5, p.acentoTexto !== p.acento ? 'Usamos un tono ajustado de tu acento para que se lea.' : ''),
    fila('portada', 'Texto de la portada', contraste(p.sobreOscuro, p.portada), 4.5, 'El color de este texto se elige solo.'),
    fila('boton', 'Texto sobre botones y aviso', contraste(p.sobreAcento, p.acento), 4.5, 'El color de este texto se elige solo.'),
    fila('acento', 'Acento sobre el fondo (detalles)', contraste(p.acento, p.fondo), 3),
  ]
  return { filas, bloquea: filas.some((f) => f.nivel === 'ilegible') }
}

export function validarApariencia(formulario) {
  const { errores, orden, poner } = recolector()
  if (unaLinea(formulario.frase).length > LIMITES.frase) poner('frase', `La frase puede tener hasta ${LIMITES.frase} caracteres.`)
  for (const { clave } of CAMPOS_COLOR) {
    if (!esColor(String(formulario[clave] ?? '').trim())) poner(clave, 'Escribí un color con # y 6 caracteres, por ejemplo #B6784F.')
  }
  if (revisarContraste(formulario).bloquea) poner('texto', 'El texto casi no se lee sobre ese fondo. Elegí colores con más diferencia.')
  return resultado(errores, orden, { tema: temaDesdeFormulario(formulario) })
}

// ── Secciones ───────────────────────────────────────────────

/** Para saber si hay cambios sin guardar: dos formularios iguales dan el mismo texto. */
export const huella = {
  info: (f) => estable(f),
  horarios: (f) => estable(Object.fromEntries(Object.entries(f).map(([d, v]) => [d, [v.modo, v.modo === 'abierto' ? v.franjas.map((x) => [x.desde, x.hasta]) : []]]))),
  aviso: (f) => estable(f),
  apariencia: (f) => estable({ ...f, ...Object.fromEntries(CLAVES_COLOR.map((c) => [c, String(f[c]).toLowerCase()])) }),
}

const sinClaves = (valor) => JSON.stringify(valor, (k, v) => (k === 'clave' ? undefined : v))

/**
 * Cuando llega una fila más nueva, lo que la persona NO tocó toma el valor nuevo: así un
 * guardado posterior no deshace lo que cambió otro equipo. `antes` y `despues` son el
 * formulario armado con la fila vieja y con la nueva.
 */
export function rebasar(borrador, antes, despues) {
  return Object.fromEntries(Object.entries(borrador).map(([k, v]) => [k, sinClaves(v) === sinClaves(antes[k]) ? despues[k] : v]))
}

/** Los cambios que de verdad modifican algo respecto de la fila cargada. */
export function cambiosReales(cambios, base) {
  return Object.fromEntries(Object.entries(cambios).filter(([columna, valor]) => estable(valor) !== estable(base?.[columna])))
}

/**
 * La fila que se ve en la vista previa: la guardada más lo escrito y todavía sin guardar.
 * Lo que está a medio escribir (un color incompleto, el nombre vacío) deja lo guardado.
 */
export function localParaVistaPrevia(base, { info, horarios, aviso, apariencia }) {
  const salida = { ...base }
  if (info) Object.assign(salida, { nombre: info.nombre.trim() || base.nombre, descripcion: info.descripcion.trim() })
  if (horarios) salida.horarios = horariosDesdeFormulario(horarios, base.horarios?.zona)
  if (aviso) Object.assign(salida, { aviso_texto: aviso.texto, aviso_activo: aviso.activo })
  if (apariencia) {
    const colores = Object.fromEntries(
      CLAVES_COLOR.map((c) => [c, esColor(apariencia[c]?.trim()) ? apariencia[c].trim() : coloresDelTema(base.tema)[c]]),
    )
    salida.tema = temaDesdeFormulario({ frase: apariencia.frase, ...colores })
  }
  return salida
}

// ── Guardar sin pisar cambios ajenos ────────────────────────

/**
 * Guarda solo si nadie cambió la fila desde que se cargó (columna updated_at).
 *   actualizar(cambios, updatedAt) -> fila nueva, o null si no afectó ninguna
 *   leer() -> fila actual o null
 * Si otro equipo cambió OTRAS columnas, se reintenta solo. Si cambió las MISMAS, lanza
 * { code: 'CONFLICTO', actual }. Si ya está guardado lo que se pedía (se había perdido la
 * respuesta), devuelve la fila actual.
 */
export async function guardarSinPisar({ actualizar, leer, base, cambios }) {
  const columnas = Object.keys(cambios)
  let version = base.updated_at
  for (let intento = 0; intento < 2; intento++) {
    const fila = await actualizar(cambios, version)
    if (fila) return fila
    const actual = await leer()
    if (!actual || actual.updated_at === version) break // no cambió nada: no hay permiso o no existe
    if (columnas.every((c) => estable(actual[c]) === estable(cambios[c]))) return actual
    if (!columnas.every((c) => estable(actual[c]) === estable(base[c]))) {
      throw Object.assign(new Error('Conflicto de edición'), { code: 'CONFLICTO', actual })
    }
    version = actual.updated_at
  }
  throw Object.assign(new Error('Ninguna fila afectada'), { code: 'SIN_FILAS' })
}

// ── Errores, en español ─────────────────────────────────────

/** Nunca muestra el mensaje técnico. */
export function mensajeDeErrorAjustes(error) {
  const codigo = String(error?.code ?? '')
  const texto = String(error?.message ?? '')
  if (error?.paso === 'foto') {
    if (String(error.statusCode) === '403' || /row-level security|unauthorized/i.test(texto)) return 'No tenés permiso para subir el logo de este local.'
    return 'No pudimos subir el logo. Revisá tu conexión y probá de nuevo.'
  }
  if (codigo === 'CONFLICTO') return 'Esta sección se cambió desde otro equipo mientras la editabas.'
  if (codigo === 'SIN_FILAS') return 'No se guardó: puede que no tengas permiso para cambiar estos datos. Recargá la página.'
  if (codigo === '23514') return 'La base rechazó esos datos. Revisá el formato y el largo de cada campo.'
  if (codigo === '42501' || /row-level security|permission denied/i.test(texto)) return 'No tenés permiso para hacer ese cambio.'
  if (codigo === '42703' || codigo === 'PGRST204') return 'Falta una actualización en la base de datos (supabase/11-admin-ajustes.sql). Avisale a OESTACK.'
  if (codigo === 'PGRST301' || /jwt/i.test(texto)) return 'Tu sesión venció. Volvé a ingresar.'
  if (/failed to fetch|network|load failed/i.test(texto)) return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
  return 'No pudimos guardar los cambios. Probá de nuevo en unos instantes.'
}
