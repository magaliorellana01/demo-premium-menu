import { createContext } from 'react';
import { TEXTOS } from './traducciones.js';

export const ContextoIdioma = createContext({
  idioma: 'es',
  cambiarIdioma: () => {},
  t: (clave) => TEXTOS.es[clave] || clave,
});
