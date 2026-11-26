// "Primeros pasos" de un local, deducidos de sus datos reales (sin tablas nuevas).
// Puro: se prueba con scripts/probar-cuenta.mjs.
import { enlaceInstagram, enlaceWhatsApp } from '../lib/contacto.js'
import { normalizarHorarios } from '../lib/horarios.js'

// Datos de ejemplo del demo ("TODO 00000000000"): no cuentan como cargados.
const esDeEjemplo = (valor) => /^todo[\s-]/i.test(String(valor ?? '').trim())

export function tieneContacto(fila) {
  const sirve = (valor, enlace) => !esDeEjemplo(valor) && Boolean(enlace(valor))
  return sirve(fila?.whatsapp, enlaceWhatsApp) || sirve(fila?.instagram, enlaceInstagram)
}

/**
 * La lista, siempre con los mismos ítems y en el mismo orden.
 *   datos:  { fila, categorias, productos, productosConFoto }  o null mientras carga
 *   contexto: { slug, activo, puedeEditarLocal, esAdmin }
 * Devuelve [{ clave, titulo, ayuda, hecho (true | false | null si carga), enlace: { a, texto } | null, nota }]
 */
export function primerosPasos(datos, { slug, activo, puedeEditarLocal, esAdmin }) {
  const base = `/admin/${slug}`
  const si = (condicion) => (datos ? Boolean(condicion()) : null)
  // Los datos del local los carga el dueño: a un editor no se lo manda a una pantalla de solo lectura.
  const ajuste = (seccion, texto) => (puedeEditarLocal ? { enlace: { a: `${base}/ajustes#titulo-${seccion}`, texto }, nota: '' } : { enlace: null, nota: 'Lo completa el dueño.' })
  const sinCategorias = datos ? datos.categorias === 0 : false

  return [
    { clave: 'logo', titulo: 'Cargá tu logo', ayuda: 'Se ve arriba de todo en el menú.', hecho: si(() => datos.fila.logo_url), ...ajuste('logo', 'Ir al logo') },
    { clave: 'contacto', titulo: 'Completá tu contacto', ayuda: 'WhatsApp o Instagram, para que te escriban.', hecho: si(() => tieneContacto(datos.fila)), ...ajuste('info', 'Ir al contacto') },
    { clave: 'horarios', titulo: 'Cargá tus horarios', ayuda: 'Con eso el menú muestra si estás abierto.', hecho: si(() => normalizarHorarios(datos.fila.horarios)), ...ajuste('horarios', 'Ir a los horarios') },
    { clave: 'categoria', titulo: 'Creá tu primera categoría', ayuda: 'Por ejemplo "Cafés" o "Para comer".', hecho: si(() => datos.categorias > 0), enlace: { a: `${base}/categorias`, texto: 'Ir a categorías' }, nota: '' },
    {
      clave: 'producto',
      titulo: 'Cargá un producto con foto',
      ayuda: 'Va dentro de una categoría. Con foto, la carta se ve mucho mejor.',
      hecho: si(() => datos.productosConFoto > 0),
      enlace: sinCategorias || (datos && datos.productos > 0) ? { a: `${base}/productos`, texto: 'Ir a productos' } : { a: `${base}/productos/nuevo`, texto: 'Cargar un producto' },
      nota: '',
    },
    {
      clave: 'publicar',
      titulo: 'Publicá tu menú',
      ayuda: 'El menú sigue oculto hasta que OESTACK lo activa.',
      hecho: Boolean(activo),
      enlace: esAdmin ? { a: '/admin/clientes', texto: 'Ir a clientes' } : null,
      nota: esAdmin ? '' : 'Cuando esté todo, avisanos.',
    },
  ]
}

export function resumenDePasos(pasos) {
  const hechos = pasos.filter((p) => p.hecho === true).length
  const cargando = pasos.some((p) => p.hecho === null)
  return { hechos, total: pasos.length, faltan: pasos.length - hechos, cargando, completo: !cargando && hechos === pasos.length }
}
