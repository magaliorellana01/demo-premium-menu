// Si el local tiene logo, el logo hace de título (su texto alternativo es el
// nombre del local); si no, se muestra el nombre como texto.
export default function Encabezado({ local }) {
  return (
    <header className="encabezado">
      <h1 className="encabezado__titulo">
        {local.logo_url ? (
          <img
            className="encabezado__logo"
            src={local.logo_url}
            alt={local.nombre}
            width="560"
            height="111"
            fetchPriority="high"
          />
        ) : (
          local.nombre
        )}
      </h1>
      {local.descripcion && <p className="encabezado__descripcion">{local.descripcion}</p>}
    </header>
  )
}
