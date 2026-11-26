import { enlaceInstagram, enlaceMapas, enlaceWhatsApp } from '../lib/contacto'
import { idDeAjuste, LIMITES, normalizarInstagram, normalizarWhatsApp } from './ajustes'
import Campo from './ui/Campo'

function Probar({ href, children }) {
  if (!href) return null
  return (
    <a className="aj-probar" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="solo-lectores"> (se abre en otra pestaña)</span>
    </a>
  )
}

// Nombre, descripción, dirección, WhatsApp e Instagram: lo que muestra el menú. El botón
// "Cómo llegar" no tiene campo propio: se arma con la dirección.
export default function CamposInfo({ valor, original, onCambiar, errores, limpiarError }) {
  const campo = (clave) => ({
    id: idDeAjuste('info', clave),
    value: valor[clave],
    error: errores[clave],
    onChange: (e) => {
      onCambiar({ ...valor, [clave]: e.target.value })
      limpiarError(clave)
    },
  })
  const cuenta = (clave) => `${valor[clave].length} de ${LIMITES[clave]} caracteres.`

  // Cómo queda lo escrito (solo si cambió: un dato viejo sin tocar no se juzga).
  const whatsapp = valor.whatsapp === original.whatsapp ? null : normalizarWhatsApp(valor.whatsapp)
  const instagram = valor.instagram === original.instagram ? null : normalizarInstagram(valor.instagram)
  const numero = whatsapp ? whatsapp.valor : valor.whatsapp
  const usuario = instagram ? instagram.valor : valor.instagram
  const pendiente = (texto) => /^todo[\s-]/i.test(texto.trim())

  return (
    <>
      <Campo etiqueta="Nombre del local" name="nombre" maxLength={LIMITES.nombre + 20} autoComplete="off" ayuda={`Obligatorio. ${cuenta('nombre')}`} {...campo('nombre')} />
      <Campo etiqueta="Descripción (opcional)" name="descripcion" multilinea rows={2} ayuda={cuenta('descripcion')} {...campo('descripcion')} />
      <div className="aj-con-enlace">
        <Campo etiqueta="Dirección (opcional)" name="direccion" autoComplete="off" ayuda="El botón “Cómo llegar” del menú busca esta dirección en Google Maps." {...campo('direccion')} />
        <Probar href={enlaceMapas(valor.direccion)}>Probar el mapa</Probar>
      </div>
      <div className="aj-con-enlace">
        <Campo
          etiqueta="WhatsApp (opcional)"
          name="whatsapp"
          inputMode="tel"
          autoComplete="off"
          ayuda={
            whatsapp?.ok && whatsapp.valor
              ? `Se guarda como +${whatsapp.valor}.`
              : pendiente(valor.whatsapp)
                ? 'Es un dato de ejemplo: cargá el número real.'
                : 'Celular con código de área. Por ejemplo 11 5555-1234.'
          }
          {...campo('whatsapp')}
        />
        <Probar href={!pendiente(numero ?? '') && enlaceWhatsApp(numero, valor.nombre)}>Probar el enlace de WhatsApp</Probar>
      </div>
      <div className="aj-con-enlace">
        <Campo
          etiqueta="Instagram (opcional)"
          name="instagram"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          ayuda={
            instagram?.ok && instagram.valor
              ? `Se guarda como @${instagram.valor}.`
              : pendiente(valor.instagram)
                ? 'Es un dato de ejemplo: cargá tu usuario real.'
                : 'Tu usuario o la dirección https de tu perfil.'
          }
          {...campo('instagram')}
        />
        <Probar href={!pendiente(usuario ?? '') && enlaceInstagram(usuario)}>Probar el enlace de Instagram</Probar>
      </div>
    </>
  )
}
