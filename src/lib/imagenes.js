// Las fotos de productos se publican en dos anchos: "<nombre>-480.webp" y
// "<nombre>-800.webp". En la base se guarda la de 800 px (imagen_url) y la de
// 480 px se deduce por el nombre. Si la imagen no sigue esa convención (por
// ejemplo, una subida desde el panel), se usa tal cual, sin srcset.
const ANCHO_GRANDE = /-800\.webp$/

export const PROPORCION_PRODUCTO = { ancho: 800, alto: 1000 } // 4:5

export function imagenProducto(url) {
  if (!url) return null
  if (!ANCHO_GRANDE.test(url)) return { src: url }
  const chica = url.replace(ANCHO_GRANDE, '-480.webp')
  return { src: url, srcSet: `${chica} 480w, ${url} 800w` }
}
