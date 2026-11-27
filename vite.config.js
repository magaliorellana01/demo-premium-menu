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
  plugins: [
    {
      name: 'redirigir-raiz-dev',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/aroma' });
            res.end();
            return;
          }
          next();
        });
      },
    },react(), urlPublica(loadEnv(mode, process.cwd(), 'VITE_'))],
  // Sin el polyfill de modulepreload (solo servía a navegadores muy viejos, que igual cargan los
  // módulos sin precarga): el JS del menú público es un poco más chico.
  build: { modulePreload: { polyfill: false } },
}))
