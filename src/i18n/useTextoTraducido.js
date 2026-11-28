import { useEffect, useSyncExternalStore } from 'react';
import { obtenerTraduccion, solicitarTraduccion, suscribirTraducciones } from './traductorDinamico.js';
import { useIdioma } from './useIdioma.js';

export function useTextoTraducido(texto) {
  const { idioma } = useIdioma();
  const valor = useSyncExternalStore(
    suscribirTraducciones,
    () => obtenerTraduccion(texto, idioma),
    () => texto ?? '',
  );
  useEffect(() => {
    solicitarTraduccion(texto, idioma);
  }, [texto, idioma]);
  return valor;
}
