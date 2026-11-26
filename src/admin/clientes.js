// La vista de clientes (solo admins): datos, filtros y textos. Puro (scripts/probar-cuenta.mjs).
import { normalizarTexto } from '../lib/filtros.js'

export const ESTADOS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'activos', texto: 'Activos' },
  { valor: 'inactivos', texto: 'Inactivos' },
]

// El conteo viene de PostgREST como [{ count: n }].
const cantidad = (relacion) => relacion?.[0]?.count ?? 0

export const aCliente = (fila) => ({
  id: fila.id,
  slug: fila.slug,
  nombre: fila.nombre,
  activo: fila.activo === true,
  modificado: fila.updated_at ?? null,
  categorias: cantidad(fila.categorias),
  productos: cantidad(fila.productos),
})

export const ordenarClientes = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.slug.localeCompare(b.slug))

export function leerFiltrosDeClientes(params) {
  const estado = params.get('estado')
  return { texto: (params.get('q') ?? '').slice(0, 60), estado: ESTADOS.some((e) => e.valor === estado) ? estado : 'todos' }
}

export function filtrosAParams({ texto, estado }) {
  const params = new URLSearchParams()
  if (texto) params.set('q', texto)
  if (estado && estado !== 'todos') params.set('estado', estado)
  return params
}

/** Busca en nombre y slug, sin distinguir tildes ni mayúsculas; todas las palabras tienen que estar. */
export function filtrarClientes(lista, { texto = '', estado = 'todos' } = {}) {
  const palabras = normalizarTexto(texto).split(/\s+/).filter(Boolean)
  return lista.filter((c) => {
    if (estado === 'activos' && !c.activo) return false
    if (estado === 'inactivos' && c.activo) return false
    const donde = normalizarTexto(`${c.nombre} ${c.slug}`)
    return palabras.every((p) => donde.includes(p))
  })
}

export function textoDeCantidad(visibles, total) {
  if (visibles === total) return total === 1 ? '1 local' : `${total} locales`
  return `${visibles} de ${total} locales`
}

const FECHA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "25/11/2026 21:39" en hora de Buenos Aires, o "Sin datos". */
export function fechaDeCambio(iso) {
  const fecha = new Date(iso ?? '')
  if (Number.isNaN(fecha.getTime())) return 'Sin datos'
  const partes = Object.fromEntries(FECHA.formatToParts(fecha).map((p) => [p.type, p.value]))
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`
}

export function mensajeDeErrorClientes(error) {
  const codigo = String(error?.code ?? '')
  if (codigo === '42703' || codigo === 'PGRST204') return 'Falta una actualización en la base de datos (supabase/11-admin-ajustes.sql).'
  if (codigo === '42501') return 'La base no te dejó hacer ese cambio: solo un admin de OESTACK puede.'
  if (codigo === 'SIN_FILAS') return 'No se cambió nada: el local ya no existe o no tenés permiso.'
  if (codigo === 'PGRST301' || codigo === 'PGRST303') return 'Tu sesión venció. Salí y volvé a ingresar.'
  return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
}
