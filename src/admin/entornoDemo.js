// Las dos variables de la demo, leídas UNA POR UNA: así, en un despliegue sin ellas, Vite
// deja "undefined" y la contraseña no viaja en ningún archivo.
import { credencialesDemo, esUsuarioDemo } from './demo'

export const CREDENCIALES_DEMO = credencialesDemo({ email: import.meta.env.VITE_DEMO_EMAIL, password: import.meta.env.VITE_DEMO_PASSWORD })

export const esSesionDemo = (usuario) => esUsuarioDemo(usuario, import.meta.env.VITE_DEMO_EMAIL)
