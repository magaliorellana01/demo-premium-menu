import { lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AVISO_DOMINIO, AVISO_INACTIVO, estadoDelQR, PROBLEMAS_DE_URL } from './qrDireccion'
import { marcarQrListo } from './qrListo'
import Alerta from './ui/Alerta'
import AvisoEstado from './ui/AvisoEstado'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import { useAviso } from './ui/useAviso'

// El generador y la librería del QR van en su propio bloque: se descargan recién acá.
const GeneradorQR = lazy(() => import('./GeneradorQR'))

const URL_PUBLICA = import.meta.env.VITE_PUBLIC_URL

// /admin/:slug/qr: dueños, editores y admins (cualquiera con acceso al local). Todo se genera
// en el navegador: no se manda nada a ningún servidor.
export default function PaginaQR() {
  const { local } = useOutletContext()
  const { url, problema, inactivo } = estadoDelQR(URL_PUBLICA, local)
  const { aviso, exito, error, cerrar } = useAviso()

  return (
    <>
      <h1 className="adm-titulo">Código QR</h1>

      {inactivo && (
        <Alerta tipo="info" titulo="El local está inactivo">
          {AVISO_INACTIVO}
        </Alerta>
      )}

      {problema ? (
        <Alerta tipo="error" titulo="No podemos generar el QR todavía" role="alert">
          <p>{PROBLEMAS_DE_URL[problema]}</p>
          <p>Avisale a OESTACK: se corrige en la configuración del sitio y hay que volver a publicarlo.</p>
        </Alerta>
      ) : (
        <>
          <Alerta tipo="info" titulo={AVISO_DOMINIO}>
            Revisá que la dirección de abajo sea la definitiva antes de mandar a imprimir.
          </Alerta>
          {/* El lugar reservado ocupa la pantalla: nada salta cuando llega el código. */}
          <Suspense fallback={<div className="adm-cargando-seccion" role="status" aria-label="Preparando el código…" />}>
            <GeneradorQR nombre={local.nombre} slug={local.slug} url={url} avisar={{ exito, error }} alUsar={() => marcarQrListo(local.id)} Boton={Boton} Tarjeta={Tarjeta} />
          </Suspense>
          <AvisoEstado aviso={aviso} onCerrar={cerrar} />
        </>
      )}
    </>
  )
}
