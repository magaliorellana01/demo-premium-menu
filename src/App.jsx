import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MenuPage from './pages/MenuPage'
import NoEncontrado from './pages/NoEncontrado'

// El panel (/admin) se carga solo cuando alguien entra a esas rutas: así el menú público no
// descarga el cliente completo de Supabase ni nada del panel (división de código).
// "admin" es un slug reservado en la base (ver supabase/schema.sql), por eso no choca con /:slug.
const AdminApp = lazy(() => import('./admin/AdminApp'))

// Mientras baja el código del panel: una pantalla vacía y neutra (sin el menú ni parpadeos).
function CargandoPanel() {
  return <div style={{ minHeight: '100vh', background: 'var(--color-fondo-suave)' }} role="status" aria-label="Cargando…" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<CargandoPanel />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="/:slug" element={<MenuPage />} />
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
    </BrowserRouter>
  )
}
