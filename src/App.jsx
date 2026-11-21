import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MenuPage from './pages/MenuPage'
import NoEncontrado from './pages/NoEncontrado'

// /admin (panel) se agrega en la Tarea 4, antes de /:slug.
// Por eso "admin" es un slug reservado en la base (ver supabase/schema.sql).
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:slug" element={<MenuPage />} />
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
    </BrowserRouter>
  )
}
