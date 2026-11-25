// Las fotos de productos se publican en dos anchos: "<nombre>-240.webp" y
// "<nombre>-480.webp" (o ".jpg" si el navegador del panel no pudo generar WebP).
// En la base se guarda la de 480 px (imagen_url) y la de 240 px se deduce por el
// nombre. Vale igual para las fotos locales del demo y para las subidas a Storage
// desde el panel. Una imagen que no siga la convención se usa tal cual, sin srcset.
const ANCHO_480 = /-480\.(webp|jpg)$/

export const PROPORCION_PRODUCTO = { ancho: 480, alto: 600 } // 4:5

// Logo para fondos oscuros: por convención está junto al logo principal, con el
// sufijo "-claro" (ver `npm run imagenes -- logo`). Devuelve null si no se puede deducir.
export function logoClaro(url) {
  return url?.endsWith('/logo.webp') ? url.replace(/logo\.webp$/, 'logo-claro.webp') : null
}

// Devuelve { src, srcSet } para el <img>. El atributo sizes lo define cada
// componente, porque depende del ancho que ocupa la imagen en su diseño.
export function imagenProducto(url) {
  if (!url) return null
  if (!ANCHO_480.test(url)) return { src: url }
  const chica = url.replace(ANCHO_480, '-240.$1')
  return { src: url, srcSet: `${chica} 240w, ${url} 480w` }
}
