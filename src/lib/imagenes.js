// Las fotos de productos se publican en dos anchos: "<nombre>-240.webp" y
// "<nombre>-480.webp" (o ".jpg" si el navegador del panel no pudo generar WebP).
// En la base se guarda la de 480 px (imagen_url) y la de 240 px se deduce por el
// nombre. Vale igual para las fotos locales del demo y para las subidas a Storage
// desde el panel. Una imagen que no siga la convención se usa tal cual, sin srcset.
const ANCHO_480 = /-480\.(webp|jpg)$/

export const PROPORCION_PRODUCTO = { ancho: 480, alto: 600 } // 4:5

// Logo de la portada: { src, ancho, alto } o null (se muestra el nombre del local).
//   * subido desde el panel: ".../<local_id>/logo/logo-<hex>-<ancho>x<alto>.webp" (o .png). Se usa
//     tal cual; las medidas van en el nombre para reservar el lugar antes de que cargue.
//   * del demo: "/logo.webp" tiene al lado "logo-claro.webp" para la portada oscura
//     (ver `npm run imagenes -- logo`). Sobre una portada clara va el principal.
const LOGO_SUBIDO = /\/storage\/v1\/object\/public\/imagenes\/[^/]+\/logo\/logo-[0-9a-z]+-(\d{1,4})x(\d{1,4})\.(webp|png)$/

export function logoDePortada(url, clara = false) {
  const subido = LOGO_SUBIDO.exec(url ?? '')
  if (subido) return { src: url, ancho: Number(subido[1]), alto: Number(subido[2]) }
  if (!url?.endsWith('/logo.webp')) return null
  return { src: clara ? url : url.replace(/logo\.webp$/, 'logo-claro.webp'), ancho: 560, alto: 111 }
}

// Devuelve { src, srcSet } para el <img>. El atributo sizes lo define cada
// componente, porque depende del ancho que ocupa la imagen en su diseño.
export function imagenProducto(url) {
  if (!url) return null
  if (!ANCHO_480.test(url)) return { src: url }
  const chica = url.replace(ANCHO_480, '-240.$1')
  return { src: url, srcSet: `${chica} 240w, ${url} 480w` }
}
