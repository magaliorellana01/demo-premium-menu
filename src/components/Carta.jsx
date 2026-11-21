import { useMemo } from 'react'
import { etiquetasDelLocal, filtrarCategorias, hayFiltros, ID_CAMPO_BUSQUEDA } from '../lib/filtros'
import { idCategoria } from '../lib/formato'
import { normalizarHorarios } from '../lib/horarios'
import { useFiltros } from '../lib/useFiltros'
import { datosDeVisita, hayDatosDeVisita, ID_VISITANOS } from '../lib/visita'
import Busqueda from './Busqueda'
import Destacados from './Destacados'
import NavCategorias from './NavCategorias'
import Pie from './Pie'
import Portada from './Portada'
import SeccionCategoria from './SeccionCategoria'
import Visitanos from './Visitanos'

// La carta completa de un local ya cargado: portada, barra de secciones, buscador con
// filtros, destacados, categorías y "Visitanos".
export default function Carta({ local }) {
  const todas = useMemo(() => local.categorias.filter((categoria) => categoria.productos.length > 0), [local])
  const disponibles = useMemo(() => etiquetasDelLocal(todas), [todas])
  const filtros = useFiltros(disponibles.map((etiqueta) => etiqueta.clave))
  const { consulta, etiquetas } = filtros

  const activos = hayFiltros({ consulta, etiquetas })
  const { categorias, total } = useMemo(() => filtrarCategorias(todas, { consulta, etiquetas }), [todas, consulta, etiquetas])

  // Mientras se busca o se filtra, la fila de destacados se oculta: los resultados ya muestran
  // esos mismos productos en su categoría y la fila empujaría la lista hacia abajo.
  const destacados = activos ? [] : todas.flatMap((categoria) => categoria.productos.filter((producto) => producto.destacado))

  // El botón de la portada baja a la primera sección visible: los destacados o, si no hay, la primera categoría.
  const destino = destacados.length > 0 ? 'destacados' : categorias[0] && idCategoria(categorias[0])

  // Horarios con formato válido (o null) y datos de contacto: lo que falta no se muestra.
  const horarios = normalizarHorarios(local.horarios)
  const visita = datosDeVisita(local, horarios)
  const conVisita = hayDatosDeVisita(visita)

  // La barra de navegación lleva las categorías que quedan y, si existe, "Visitanos".
  const items = categorias.map((categoria) => ({ id: idCategoria(categoria), nombre: categoria.nombre }))
  if (conVisita) items.push({ id: ID_VISITANOS, nombre: 'Visitanos' })

  const limpiarDesdeVacio = () => {
    filtros.limpiarTodo()
    document.getElementById(ID_CAMPO_BUSQUEDA)?.focus() // el botón desaparece: el foco vuelve al campo
  }

  return (
    <>
      <Portada local={local} horarios={horarios} destino={destino} />
      {/* Si alguien filtra hasta que queda una sola sección, la barra no desaparece: el buscador no se corre. */}
      <NavCategorias items={items} mantener={todas.length > 1} />
      <main>
        <Busqueda filtros={filtros} disponibles={disponibles} total={total} activos={activos} />
        <Destacados productos={destacados} />
        <div className="categorias">
          {categorias.map((categoria, indice) => (
            <SeccionCategoria
              key={categoria.id}
              categoria={categoria}
              // Sin destacados, las primeras imágenes de la primera categoría son las que se ven al abrir.
              imagenesPrioritarias={indice === 0 && destacados.length === 0 ? 2 : 0}
            />
          ))}

          {total === 0 && (
            <div className="vacio">
              <p className="vacio__titulo">No encontramos productos con esos filtros</p>
              <p className="vacio__texto">Probá con otra palabra o sacá alguna etiqueta.</p>
              <button type="button" className="boton boton--oscuro" onClick={limpiarDesdeVacio}>
                Limpiar filtros
              </button>
            </div>
          )}

          {conVisita && <Visitanos datos={visita} />}

          <p className="nota-alergias">Ante alergias o intolerancias, consultá al personal.</p>
        </div>
      </main>
      <Pie />
    </>
  )
}
