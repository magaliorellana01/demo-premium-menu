import { useIdioma } from '../i18n/useIdioma.js';

export default function Pie() {
  const { t } = useIdioma();
  return (
    <footer className="pie">
      <p className="pie-credito">
        <a href="https://oestack.com" target="_blank" rel="noopener noreferrer">
          {t('credito')}
        </a>
      </p>
      <p className="pie-cta">
        <a href="https://www.oestack.com/menu-digital" target="_blank" rel="noopener noreferrer">
          {t('ctaTienda')}
        </a>
      </p>
      <div className="pie-admin-wrap">
        <a href="/admin" className="pie-admin">{t('administrar')}</a>
      </div>
    </footer>
  );
}
