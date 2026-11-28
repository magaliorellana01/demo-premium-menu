import { useCallback, useEffect, useState } from 'react';
import { TEXTOS } from './traducciones.js';
import { ContextoIdioma } from './contextoIdioma.js';

const CLAVE_STORAGE = 'oestack_menu_idioma';

function leerIdiomaInicial() {
  try {
    const guardado = window.localStorage.getItem(CLAVE_STORAGE);
    if (guardado && TEXTOS[guardado]) return guardado;
  } catch {
    // Sin acceso a localStorage
  }
  return 'es';
}

export default function ProveedorIdioma({ children }) {
  const [idioma, setIdioma] = useState(leerIdiomaInicial);

  useEffect(() => {
    document.documentElement.lang = idioma;
    try {
      window.localStorage.setItem(CLAVE_STORAGE, idioma);
    } catch {
      // Sin acceso a localStorage
    }
  }, [idioma]);

  const cambiarIdioma = useCallback((nuevo) => {
    if (TEXTOS[nuevo]) setIdioma(nuevo);
  }, []);

  const t = useCallback((clave) => TEXTOS[idioma]?.[clave] ?? TEXTOS.es[clave] ?? clave, [idioma]);

  return (
    <ContextoIdioma.Provider value={{ idioma, cambiarIdioma, t }}>
      {children}
    </ContextoIdioma.Provider>
  );
}
