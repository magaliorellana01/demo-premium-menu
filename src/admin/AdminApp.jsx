import { Link, Route, Routes } from 'react-router-dom'
import estilos from './admin.css?inline'
import InicioAdmin from './InicioAdmin'
import LocalLayout from './LocalLayout'
import LoginPage from './LoginPage'
import Proximamente from './Proximamente'
import Resumen from './Resumen'
import RutaProtegida from './RutaProtegida'
import SesionProvider from './SesionProvider'
import { adminConfigurado } from './datos'

function PaginaNoEncontrada() {
  return (
    <section className="adm-tarjeta adm-tarjeta--aviso">
      <h1 className="adm-titulo">No encontramos esta página</h1>
      <div className="adm-acciones">
        <Link className="adm-boton adm-boton--primario" to="/admin">
          Volver al panel
        </Link>
      </div>
    </section>
  )
}

// Todo el panel (/admin/*). Se carga con React.lazy desde App.jsx: el menú público nunca descarga
// este código ni el cliente completo de Supabase.
export default function AdminApp() {
  return (
    <div className="admin">
      {/* Estilos del panel: viajan dentro de este mismo bloque de código (no hay hoja aparte). React los pasa al <head>. */}
      <style href="oestack-panel" precedence="default">
        {estilos}
      </style>
      {/* Ninguna página del panel debe aparecer en buscadores (React 19 la mueve al <head>). */}
      <meta name="robots" content="noindex" />

      {!adminConfigurado ? (
        <main className="adm-centro">
          <div className="adm-tarjeta adm-tarjeta--aviso">
            <h1 className="adm-titulo">El panel no está configurado</h1>
            <p className="adm-texto">Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).</p>
          </div>
        </main>
      ) : (
        <SesionProvider>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<RutaProtegida />}>
              <Route index element={<InicioAdmin />} />
              <Route path=":slug" element={<LocalLayout />}>
                <Route index element={<Resumen />} />
                <Route path="categorias" element={<Proximamente titulo="Categorías" />} />
                <Route path="productos" element={<Proximamente titulo="Productos" />} />
                <Route path="ajustes" element={<Proximamente titulo="Ajustes" soloDueno />} />
                <Route path="*" element={<PaginaNoEncontrada />} />
              </Route>
              <Route path="*" element={<PaginaNoEncontrada />} />
            </Route>
          </Routes>
        </SesionProvider>
      )}
    </div>
  )
}
