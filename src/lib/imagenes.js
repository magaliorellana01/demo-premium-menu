// Las fotos de productos se publican en dos anchos: "<nombre>-240.webp" y
// "<nombre>-480.webp". En la base se guarda la de 480 px (imagen_url) y la de
// 240 px se deduce por el nombre. Si la imagen no sigue esa convención (por
// ejemplo, una subida desde el panel), se usa tal cual, sin srcset.
const ANCHO_480 = /-480\.webp$/

export const PROPORCION_PRODUCTO = { ancho: 480, alto: 600 } // 4:5

// Devuelve { src, srcSet } para el <img>. El atributo sizes lo define cada
// componente, porque depende del ancho que ocupa la imagen en su diseño.
export function imagenProducto(url) {
  if (!url) return null
  if (!ANCHO_480.test(url)) return { src: url }
  const chica = url.replace(ANCHO_480, '-240.webp')
  return { src: url, srcSet: `${chica} 240w, ${url} 480w` }
}
