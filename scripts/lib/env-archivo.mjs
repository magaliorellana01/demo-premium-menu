// Agrega o saca variables de un .env sin tocar las demás líneas. Puro sobre el texto.
const lineaDe = (nombre) => new RegExp(`^[ \\t]*${nombre}[ \\t]*=.*$`)

const separar = (texto) => ({ finDeLinea: texto.includes('\r\n') ? '\r\n' : '\n', lineas: texto.split(/\r?\n/) })

/** Pone o reemplaza cada variable. El valor va entre comillas: si no, "#" empieza un comentario. */
export function ponerVariables(texto, variables) {
  const { finDeLinea, lineas } = separar(texto)
  while (lineas.length && lineas.at(-1) === '') lineas.pop()
  for (const [nombre, valor] of Object.entries(variables)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(nombre) || /["\\\r\n]/.test(valor)) throw new Error(`No se puede guardar ${nombre} en el .env.`)
    const nueva = `${nombre}="${valor}"`
    const i = lineas.findIndex((l) => lineaDe(nombre).test(l))
    if (i === -1) lineas.push(nueva)
    else lineas[i] = nueva
  }
  return `${lineas.join(finDeLinea)}${finDeLinea}`
}

export function quitarVariables(texto, nombres) {
  const { finDeLinea, lineas } = separar(texto)
  return lineas.filter((l) => !nombres.some((n) => lineaDe(n).test(l))).join(finDeLinea)
}
