// Esqueleto de carga: reutiliza las clases del menú real para ocupar el mismo
// espacio (portada, barra, fila de destacados y tarjetas) y evitar saltos.
function TarjetaVacia({ compacta = false }) {
  return (
    <li className={`tarjeta esq-tarjeta${compacta ? ' tarjeta--compacta' : ''}`}>
      <div className="tarjeta__imagen" />
      <div className="tarjeta__cuerpo">
        <div className="tarjeta__cabecera">
          <div className="esq esq--nombre" />
          <div className="esq esq--precio" />
        </div>
        {!compacta && <div className="esq esq--linea esq--corta" />}
      </div>
    </li>
  )
}

export default function Esqueleto() {
  return (
    <div className="esqueleto" aria-busy="true">
      <p className="solo-lectores" role="status">
        Cargando el menú…
      </p>

      <div aria-hidden="true">
        <div className="portada portada--esqueleto">
          <div className="portada__contenido">
            <div className="esq esq--logo" />
            <div className="esq esq--frase" />
            <div className="esq esq--descripcion" />
            <div className="esq esq--estado" />
            <div className="esq esq--boton" />
          </div>
        </div>

        <div className="nav esq-nav" />

        <div className="busqueda">
          <div className="busqueda__interior">
            <div className="busqueda__campo esq esq-campo" />
            <div className="filtros" />
            <div className="busqueda__estado" />
          </div>
        </div>

        <div className="destacados">
          <div className="destacados__interior">
            <div className="destacados__cabecera">
              <div className="esq esq--titulo" />
            </div>
            <ul className="destacados__fila" role="presentation">
              {[0, 1, 2, 3].map((i) => (
                <TarjetaVacia key={i} compacta />
              ))}
            </ul>
          </div>
        </div>

        <div className="categorias">
          <section className="seccion">
            <div className="esq esq--titulo esq--seccion" />
            <ul className="grilla" role="presentation">
              {[0, 1, 2].map((i) => (
                <TarjetaVacia key={i} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
