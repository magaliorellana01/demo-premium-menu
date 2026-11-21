// Pruebas de src/lib/contacto.js (sin dependencias): node scripts/probar-contacto.mjs
import { enlaceInstagram, enlaceMapas, enlaceWhatsApp } from '../src/lib/contacto.js'

let total = 0
let fallos = 0
function caso(nombre, real, esperado) {
  total++
  const ok = real === esperado
  if (!ok) fallos++
  console.log(`${ok ? 'OK    ' : 'FALLÓ '} ${nombre}${ok ? '' : `\n         esperado: ${esperado}\n         obtenido: ${real}`}`)
}

console.log('— WhatsApp —')
caso('número con signos y espacios', enlaceWhatsApp('+54 9 11 5555-1234', 'Aroma'), 'https://wa.me/5491155551234?text=Hola%20Aroma%2C%20quer%C3%ADa%20hacerles%20una%20consulta.')
caso('solo dígitos', enlaceWhatsApp('5491155551234', 'Aroma')?.startsWith('https://wa.me/5491155551234?text='), true)
caso('valor de ejemplo "TODO 00000000000": se arma (solo ceros, no llega a nadie)', enlaceWhatsApp('TODO 00000000000', 'Aroma')?.startsWith('https://wa.me/00000000000?'), true)
caso('muy corto: sin enlace', enlaceWhatsApp('12345', 'Aroma'), null)
caso('demasiado largo: sin enlace', enlaceWhatsApp('1234567890123456', 'Aroma'), null)
caso('vacío o null: sin enlace', [enlaceWhatsApp('', 'A'), enlaceWhatsApp(null, 'A'), enlaceWhatsApp(undefined, 'A')].join(','), ',,')

console.log('\n— Instagram —')
caso('usuario', enlaceInstagram('aroma.cafeteria'), 'https://www.instagram.com/aroma.cafeteria')
caso('@usuario', enlaceInstagram('@aroma.cafeteria'), 'https://www.instagram.com/aroma.cafeteria')
caso('instagram.com/usuario', enlaceInstagram('instagram.com/aroma.cafeteria'), 'https://www.instagram.com/aroma.cafeteria')
caso('URL completa con barra final', enlaceInstagram('https://www.instagram.com/aroma.cafeteria/'), 'https://www.instagram.com/aroma.cafeteria')
caso('URL de otro sitio: sin enlace', enlaceInstagram('https://sitio-malo.com/aroma'), null)
caso('dominio parecido: sin enlace', enlaceInstagram('https://instagram.com.malo.com/aroma'), null)
caso('protocolo peligroso: sin enlace', enlaceInstagram('javascript:alert(1)'), null)
caso('http sin cifrar: sin enlace', enlaceInstagram('http://instagram.com/aroma'), null)
caso('valor de ejemplo "TODO-reemplazar-instagram": se arma (no es un usuario válido de Instagram)', enlaceInstagram('TODO-reemplazar-instagram'), 'https://www.instagram.com/TODO-reemplazar-instagram')
caso('vacío o solo @: sin enlace', [enlaceInstagram(''), enlaceInstagram('@'), enlaceInstagram(null)].join(','), ',,')

console.log('\n— Cómo llegar —')
caso('dirección codificada', enlaceMapas('Av. Ejemplo 1234, Buenos Aires'), 'https://www.google.com/maps/search/?api=1&query=Av.%20Ejemplo%201234%2C%20Buenos%20Aires')
caso('vacía: sin enlace', [enlaceMapas(''), enlaceMapas('   '), enlaceMapas(null)].join(','), ',,')

console.log(`\n${total - fallos}/${total} pruebas OK${fallos ? ` — ${fallos} FALLARON` : ''}`)
process.exit(fallos ? 1 : 0)
