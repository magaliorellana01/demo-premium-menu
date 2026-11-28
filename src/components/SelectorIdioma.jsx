import { IDIOMAS } from '../i18n/traducciones.js';
import { useIdioma } from '../i18n/useIdioma.js';

export default function SelectorIdioma() {
  const { idioma, cambiarIdioma, t } = useIdioma();

  return (
    <div className="selector-idioma" role="group" aria-label={t('idiomaLabel')}>
      {IDIOMAS.map((item) => {
        const activo = idioma === item.codigo;
        return (
          <button
            key={item.codigo}
            type="button"
            className={activo ? 'selector-idioma__btn is-activo' : 'selector-idioma__btn'}
            onClick={() => cambiarIdioma(item.codigo)}
            aria-pressed={activo}
            title={item.nombre}
            lang={item.codigo}
          >
            {item.corto}
          </button>
        );
      })}
    </div>
  );
}
