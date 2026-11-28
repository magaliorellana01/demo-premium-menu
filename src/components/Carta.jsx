import { useMemo } from 'react'
import { useIdioma } from '../i18n/useIdioma'
import { etiquetasDelLocal, filtrarCategorias, hayFiltros, ID_CAMPO_BUSQUEDA } from '../lib/filtros'
import { idCategoria } from '../lib/formato'
import { normalizarHorarios } from '../lib/horarios'
import { useFiltros } from '../lib/useFiltros'
import { useTema } from '../lib/useTema'
import { datosDeVisita, hayDatosDeVisita, ID_VISITANOS } from '../lib/visita'
import Busqueda from './Busqueda'
import Destacados from './Destacados'
import NavCategorias from './NavCategorias'
import Pie from './Pie'
import Portada from './Portada'
import SeccionCategoria from './SeccionCategoria'
import Visitanos from './Visitanos'

export default function Carta({ local }) {
  useTema(local.tema)
  const { t } = useIdioma()
  const todas = useMemo(() => local.categorias.filter((categoria) => categoria.productos.length > 0), [local])
  const disponibles = useMemo(() => etiquetasDelLocal(todas), [todas])
  const filtros = useFiltros(disponibles.map((etiqueta) => etiqueta.clave))
  const { consulta, etiquetas } = filtros

  const activos = hayFiltros({ consulta, etiquetas })
  const { categorias, total } = useMemo(() => filtrarCategorias(todas, { consulta, etiquetas }), [todas, consulta, etiquetas])
  const destacados = activos ? [] : todas.flatMap((categoria) => categoria.productos.filter((producto) => producto.destacado))
  const destino = destacados.length > 0 ? 'destacados' : categorias[0] && idCategoria(categorias[0])

  const horarios = normalizarHorarios(local.horarios)
  const visita = datosDeVisita(local, horarios)
  const conVisita = hayDatosDeVisita(visita)

  const items = categorias.map((categoria) => ({ id: idCategoria(categoria), nombre: categoria.nombre }))
  if (conVisita) items.push({ id: ID_VISITANOS, nombre: t('visitanos'), esFijo: true })

  const limpiarDesdeVacio = () => {
    filtros.limpiarTodo()
    document.getElementById(ID_CAMPO_BUSQUEDA)?.focus()
  }

  return (
    <>
      <Portada local={local} horarios={horarios} destino={destino} />
      <NavCategorias items={items} mantener={todas.length > 1} />
      <main>
        <Busqueda filtros={filtros} disponibles={disponibles} total={total} activos={activos} />
        <Destacados productos={destacados} />
        <div className="categorias">
          {categorias.map((categoria, indice) => (
            <SeccionCategoria
              key={categoria.id}
              categoria={categoria}
              imagenesPrioritarias={indice === 0 && destacados.length === 0 ? 2 : 0}
            />
          ))}

          {total === 0 && (
            <div className="vacio">
              <p className="vacio__titulo">{t('sinResultadosTitulo')}</p>
              <p className="vacio__texto">{t('sinResultadosTexto')}</p>
              <button type="button" className="boton boton--oscuro" onClick={limpiarDesdeVacio}>
                {t('limpiarFiltros')}
              </button>
            </div>
          )}

          {conVisita && <Visitanos datos={visita} />}

          <p className="nota-alergias">{t('notaAlergias')}</p>
        </div>
      </main>
      <Pie />
    </>
  )
}
