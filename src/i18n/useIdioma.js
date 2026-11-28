import { useContext } from 'react';
import { ContextoIdioma } from './contextoIdioma.js';

export function useIdioma() {
  return useContext(ContextoIdioma);
}
