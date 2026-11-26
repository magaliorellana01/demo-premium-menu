// npm run alta:cliente — crea el local (inactivo), el usuario dueño y muestra la ficha.
//   npm run alta:cliente '--' --nombre "Café del Puerto" --slug cafe-del-puerto --email dueno@ejemplo.com
//   Opciones: --usuario-existente  --dry-run
import { argumentos, conectar, ejecutar, sinCortar } from './consola.mjs'
import { darDeAlta, planDeAlta } from './operaciones.mjs'
import { direcciones, fichaDeAlta } from './reglas.mjs'

await ejecutar(async (terminal) => {
  const a = argumentos({ nombre: { type: 'string' }, slug: { type: 'string' }, email: { type: 'string' }, 'usuario-existente': { type: 'boolean' } })
  const base = conectar()

  const nombre = a.nombre ?? (await terminal.preguntar('Nombre del local:'))
  const slug = a.slug ?? (await terminal.preguntar('Slug (la dirección del menú, por ejemplo cafe-del-puerto; NO se puede cambiar después):'))
  const email = a.email ?? (await terminal.preguntar('Email del dueño:'))

  const plan = await planDeAlta(base, { nombre, slug, email, usuarioExistente: Boolean(a['usuario-existente']) })
  if (plan.tipo === 'nada') {
    console.log(`\n"${plan.datos.slug}" ya está dado de alta con ${plan.datos.email} como dueño. No cambié nada.`)
    console.log('Si necesita una contraseña nueva: npm run cliente:password')
    return 0
  }

  const { menu, panel } = direcciones(process.env.VITE_PUBLIC_URL, plan.datos.slug)
  console.log(`\nResumen\n  Local:  ${plan.datos.nombre}\n  Menú:   ${menu}\n  Panel:  ${panel}\n  Dueño:  ${plan.datos.email}\n\nSe va a hacer:`)
  plan.pasos.forEach((paso, i) => console.log(`  ${i + 1}. ${paso}`))
  if (!process.env.VITE_PUBLIC_URL) console.log('\nOJO: falta VITE_PUBLIC_URL en el .env; los enlaces apuntan a tu computadora.')

  if (a['dry-run']) {
    console.log('\n--dry-run: no escribí nada.')
    return 0
  }
  if (!(await terminal.confirmar(`\n¿Confirmás? El slug "${plan.datos.slug}" queda fijo.`))) {
    console.log('Cancelado: no escribí nada.')
    return 1
  }

  const { contrasena } = await sinCortar(() => darDeAlta(base, plan))
  console.log('\nListo. El local quedó INACTIVO.')
  console.log('\nCopiá el mensaje de abajo AHORA: la contraseña no se guarda en ningún lado y no se vuelve a mostrar.')
  console.log('──────────────── FICHA DE ALTA ────────────────')
  console.log(fichaDeAlta({ ...plan.datos, contrasena, urlPublica: process.env.VITE_PUBLIC_URL }))
  console.log('───────────────────────────────────────────────')
  console.log(`\nCuando el menú esté listo, publicalo desde /admin/clientes o con: npm run cliente:estado '--' --slug ${plan.datos.slug} --activo si`)
  return 0
})
