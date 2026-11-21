import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Completa __URL_PUBLICA__ en index.html con VITE_PUBLIC_URL (sin barra final),
// porque las etiquetas Open Graph necesitan URLs absolutas. Si no está definida
// queda vacío (rutas relativas): sirve en desarrollo, pero para publicar hay que definirla.
function urlPublica(env) {
  return {
    name: 'url-publica',
    transformIndexHtml: (html) => html.replaceAll('__URL_PUBLICA__', (env.VITE_PUBLIC_URL ?? '').replace(/\/$/, '')),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), urlPublica(loadEnv(mode, process.cwd(), 'VITE_'))],
}))
