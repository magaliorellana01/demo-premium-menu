import { traducirDiaSemana } from '../i18n/traducciones'
import { useIdioma } from '../i18n/useIdioma'
import { resumenSemana } from '../lib/horarios'
import { useAhora } from '../lib/useAhora'
import { useAparecer } from '../lib/useAparecer'
import { ID_VISITANOS } from '../lib/visita'

function Externo({ href, claro = false, nota, children }) {
  return (
    <a className={`boton ${claro ? 'boton--contorno' : 'boton--oscuro'}`} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="solo-lectores"> ({nota})</span>
    </a>
  )
}

export default function Visitanos({ datos }) {
  const ahora = useAhora()
  const tituloRef = useAparecer()
  const { idioma, t } = useIdioma()
  const semana = datos.horarios ? resumenSemana(datos.horarios, ahora).map((d) => traducirDiaSemana(d, idioma)) : null
  const hayBotones = datos.whatsapp || datos.instagram || datos.mapas

  return (
    <section id={ID_VISITANOS} className="seccion visitanos" aria-labelledby="titulo-visitanos">
      <h2 id="titulo-visitanos" ref={tituloRef} className="seccion__titulo aparece">
        {t('visitanos')}
      </h2>

      <div className="visitanos__cuerpo">
        {semana && (
          <div className="visitanos__bloque">
            <h3 className="visitanos__subtitulo">{t('horarios')}</h3>
            <dl className="semana">
              {semana.map((dia) => (
                <div key={dia.clave} className={`semana__fila${dia.esHoy ? ' semana__fila--hoy' : ''}`} aria-current={dia.esHoy ? 'date' : undefined}>
                  <dt className="semana__dia">
                    {dia.nombre}
                    {dia.esHoy && <span className="semana__hoy">{t('hoy')}</span>}
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
                <h3 className="visitanos__subtitulo">{t('dondeEstamos')}</h3>
                <p className="visitanos__direccion">{datos.direccion}</p>
              </>
            )}

            {hayBotones && (
              <div className="visitanos__acciones">
                {datos.whatsapp && <Externo href={datos.whatsapp} nota={t('abreOtraPestana')}>{t('whatsapp')}</Externo>}
                {datos.instagram && (
                  <Externo href={datos.instagram} claro nota={t('abreOtraPestana')}>
                    Instagram
                  </Externo>
                )}
                {datos.mapas && (
                  <Externo href={datos.mapas} claro nota={t('abreOtraPestana')}>
                    {t('comoLlegar')}
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
