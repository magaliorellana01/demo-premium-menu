import { Route, Routes } from 'react-router-dom'
import estilos from './admin.css?inline'
import InicioAdmin from './InicioAdmin'
import LocalLayout from './LocalLayout'
import LoginPage from './LoginPage'
import PaginaCategorias from './PaginaCategorias'
import PantallaAviso from './PantallaAviso'
import Proximamente from './Proximamente'
import Resumen from './Resumen'
import RutaProtegida from './RutaProtegida'
import SesionProvider from './SesionProvider'
import { adminConfigurado } from './datos'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'

function PaginaNoEncontrada() {
  return (
    <Tarjeta como="section" className="adm-bloque">
      <h1 className="adm-titulo">No encontramos esta página</h1>
      <div className="ui-acciones">
        <Boton variante="primario" to="/admin">
          Volver al panel
        </Boton>
      </div>
    </Tarjeta>
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
        <PantallaAviso titulo="El panel no está configurado">
          <p>Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).</p>
        </PantallaAviso>
      ) : (
        <SesionProvider>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<RutaProtegida />}>
              <Route index element={<InicioAdmin />} />
              <Route path=":slug" element={<LocalLayout />}>
                <Route index element={<Resumen />} />
                <Route path="categorias" element={<PaginaCategorias />} />
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
