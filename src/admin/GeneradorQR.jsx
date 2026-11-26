// El generador del QR: dibujo, descargas e impresión. Se carga con React.lazy solo en
// /admin/:slug/qr, junto con la librería "uqr".
//
// A propósito NO importa nada del panel (los componentes le llegan por props): cuando lo hacía,
// el empaquetador agregaba código de enlace en el archivo principal, el que descarga el
// menú público.
import { useMemo, useState } from 'react'
import { COLOR_FONDO, COLOR_MODULO, formatoDe, FORMATOS, FRASE_TARJETA, matrizQR, nombreDeArchivo, pixelesDelQR, svgDelQR, trazoDelQR, urlParaTipear } from './qr'
import estilos from './qr.css?inline'

// El QR dibujado como SVG dentro de la página (sin imágenes ni data: URLs).
function DibujoQR({ matriz, etiqueta }) {
  return (
    <svg className="qr-dibujo" viewBox={`0 0 ${matriz.lado} ${matriz.lado}`} shapeRendering="crispEdges" {...(etiqueta ? { role: 'img', 'aria-label': etiqueta } : { 'aria-hidden': true })}>
      <rect width={matriz.lado} height={matriz.lado} fill={COLOR_FONDO} />
      <path fill={COLOR_MODULO} d={trazoDelQR(matriz)} />
    </svg>
  )
}

// La tarjeta de mesa. Las medidas internas son relativas a su ancho: la vista previa y el
// papel salen iguales.
function TarjetaDeMesa({ nombre, url, matriz, etiqueta }) {
  return (
    <div className="qr-tarjeta">
      <div className="qr-tarjeta__interior">
        <p className="qr-tarjeta__nombre">{nombre}</p>
        <p className="qr-tarjeta__frase">{FRASE_TARJETA}</p>
        <DibujoQR matriz={matriz} etiqueta={etiqueta} />
        <p className="qr-tarjeta__url">{urlParaTipear(url)}</p>
      </div>
    </div>
  )
}

function bajar(blob, nombre) {
  const direccion = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = direccion
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  // Un rato de margen: algunos navegadores leen el archivo después del clic.
  setTimeout(() => URL.revokeObjectURL(direccion), 30000)
}

/** El PNG: los píxeles se calculan en qr.js; el navegador solo los comprime. */
function pngDelQR(matriz) {
  const { datos, ancho } = pixelesDelQR(matriz)
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = ancho
  const contexto = lienzo.getContext('2d')
  if (!contexto) return Promise.reject(new Error('Sin canvas'))
  contexto.putImageData(new ImageData(datos, ancho, ancho), 0, 0)
  return new Promise((listo, error) => lienzo.toBlob((blob) => (blob ? listo(blob) : error(new Error('No se pudo crear el PNG'))), 'image/png'))
}

// `avisar`: { exito(texto), error(texto) }. `alUsar`: se descargó o se mandó a imprimir.
export default function GeneradorQR({ nombre: nombreDelLocal, slug, url, avisar, alUsar, Boton, Tarjeta }) {
  const matriz = useMemo(() => matrizQR(url), [url])
  const [formato, setFormato] = useState('a6')
  const elegido = formatoDe(formato)

  async function descargar(tipo) {
    try {
      const blob = tipo === 'svg' ? new Blob([svgDelQR(matriz, url)], { type: 'image/svg+xml' }) : await pngDelQR(matriz)
      const archivo = nombreDeArchivo(slug, tipo)
      bajar(blob, archivo)
      alUsar()
      avisar.exito(`Descargamos ${archivo}.`)
    } catch {
      avisar.error('No pudimos crear el archivo. Probá de nuevo o con otro navegador.')
    }
  }

  function imprimir() {
    alUsar()
    window.print()
  }

  return (
    <>
      <style>{estilos}</style>
      <Tarjeta como="section" className="adm-bloque" aria-labelledby="titulo-codigo">
        <h2 id="titulo-codigo" className="adm-subtitulo">
          Tu código
        </h2>
        <div className="qr-codigo">
          <DibujoQR matriz={matriz} etiqueta={`Código QR del menú: ${url}`} />
        </div>
        <p className="qr-direccion">
          Lleva a <strong>{url}</strong>
        </p>
        <div className="ui-acciones">
          <Boton variante="primario" onClick={() => descargar('png')}>
            Descargar PNG
          </Boton>
          <Boton onClick={() => descargar('svg')}>Descargar SVG</Boton>
        </div>
        <p className="adm-texto--suave">El PNG sirve para pantallas e impresoras comunes. Para una imprenta, mandá el SVG: se agranda sin perder nitidez.</p>
      </Tarjeta>

      <Tarjeta como="section" className="adm-bloque" aria-labelledby="titulo-tarjeta">
        <h2 id="titulo-tarjeta" className="adm-subtitulo">
          Tarjeta para la mesa
        </h2>
        <div className="qr-previa">
          <TarjetaDeMesa nombre={nombreDelLocal} url={url} matriz={matriz} />
        </div>
        <fieldset className="qr-formatos">
          <legend>Tamaño de la hoja</legend>
          {FORMATOS.map((f) => (
            <label key={f.clave} className="qr-formato">
              <input type="radio" name="formato" value={f.clave} checked={formato === f.clave} onChange={() => setFormato(f.clave)} />
              {f.nombre}
            </label>
          ))}
        </fieldset>
        <div className="ui-acciones">
          <Boton variante="primario" onClick={imprimir}>
            Imprimir tarjeta
          </Boton>
        </div>
        <p className="adm-texto--suave">En la ventana de impresión elegí el mismo tamaño de papel, escala 100 % y sin márgenes agregados. Antes de imprimir muchas, probá una con la cámara del celular.</p>
      </Tarjeta>

      {/* El tamaño de la hoja depende de lo elegido. Se va junto con la pantalla. */}
      <style>{`@page { size: ${elegido.pagina}; margin: 0; }`}</style>
      {/* Lo único que sale en el papel (también con Ctrl+P). */}
      <div className="qr-impresion" data-formato={elegido.clave} aria-hidden="true">
        {Array.from({ length: elegido.copias }, (_, i) => (
          <TarjetaDeMesa key={i} nombre={nombreDelLocal} url={url} matriz={matriz} />
        ))}
      </div>
    </>
  )
}
