import { resumenSemana } from '../lib/horarios'
import { useAhora } from '../lib/useAhora'
import { useAparecer } from '../lib/useAparecer'
import { ID_VISITANOS } from '../lib/visita'

function Externo({ href, claro = false, children }) {
  return (
    <a className={`boton ${claro ? 'boton--contorno' : 'boton--oscuro'}`} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="solo-lectores"> (se abre en otra pestaña)</span>
    </a>
  )
}

// Horarios de toda la semana (con hoy resaltado), dirección y botones de contacto.
export default function Visitanos({ datos }) {
  const ahora = useAhora()
  const tituloRef = useAparecer()
  const semana = datos.horarios ? resumenSemana(datos.horarios, ahora) : null
  const hayBotones = datos.whatsapp || datos.instagram || datos.mapas

  return (
    <section id={ID_VISITANOS} className="seccion visitanos" aria-labelledby="titulo-visitanos">
      <h2 id="titulo-visitanos" ref={tituloRef} className="seccion__titulo aparece">
        Visitanos
      </h2>

      <div className="visitanos__cuerpo">
        {semana && (
          <div className="visitanos__bloque">
            <h3 className="visitanos__subtitulo">Horarios</h3>
            <dl className="semana">
              {semana.map((dia) => (
                <div key={dia.clave} className={`semana__fila${dia.esHoy ? ' semana__fila--hoy' : ''}`} aria-current={dia.esHoy ? 'date' : undefined}>
                  <dt className="semana__dia">
                    {dia.nombre}
                    {dia.esHoy && <span className="semana__hoy">Hoy</span>}
                  </dt>
                  <dd className={`semana__tramos${dia.cerrado ? ' semana__tramos--cerrado' : ''}`}>{dia.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {(datos.direccion || hayBotones) && (
          <div className="visitanos__bloque">
            {datos.direccion && (
              <>
                <h3 className="visitanos__subtitulo">Dónde estamos</h3>
                <p className="visitanos__direccion">{datos.direccion}</p>
              </>
            )}

            {hayBotones && (
              <div className="visitanos__acciones">
                {datos.whatsapp && <Externo href={datos.whatsapp}>Escribinos por WhatsApp</Externo>}
                {datos.instagram && (
                  <Externo href={datos.instagram} claro>
                    Instagram
                  </Externo>
                )}
                {datos.mapas && (
                  <Externo href={datos.mapas} claro>
                    Cómo llegar
                  </Externo>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
