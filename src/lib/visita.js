// Datos de la sección "Visitanos": lo que falta no se muestra.
import { enlaceInstagram, enlaceMapas, enlaceWhatsApp } from './contacto'

export const ID_VISITANOS = 'visitanos'

export function datosDeVisita(local, horarios) {
  const direccion = (local.direccion ?? '').trim()
  return {
    horarios,
    direccion,
    whatsapp: enlaceWhatsApp(local.whatsapp, local.nombre),
    instagram: enlaceInstagram(local.instagram),
    mapas: enlaceMapas(direccion),
  }
}

// Si no hay ni horarios, ni dirección, ni WhatsApp, ni Instagram, la sección no se muestra.
export const hayDatosDeVisita = (datos) => Boolean(datos.horarios || datos.direccion || datos.whatsapp || datos.instagram)
