const CLAVE_CACHE = 'oestack_traducciones_v1';
const cache = new Map();
const enCurso = new Set();
const listeners = new Set();

try {
  const guardado = JSON.parse(window.localStorage.getItem(CLAVE_CACHE) || '{}');
  for (const [k, v] of Object.entries(guardado)) cache.set(k, v);
} catch { /* sin storage */ }

function notificar() {
  for (const fn of listeners) fn();
}

function guardarCache() {
  try {
    const obj = Object.fromEntries(Array.from(cache.entries()).slice(-400));
    window.localStorage.setItem(CLAVE_CACHE, JSON.stringify(obj));
  } catch { /* sin storage */ }
}

export function suscribirTraducciones(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function obtenerTraduccion(texto, idioma) {
  if (!texto || typeof texto !== 'string' || idioma === 'es') return texto ?? '';
  return cache.get(`${idioma}:${texto}`) ?? texto;
}

export function solicitarTraduccion(texto, idioma) {
  if (!texto || typeof texto !== 'string' || idioma === 'es') return;
  const limpio = texto.trim();
  const key = `${idioma}:${texto}`;
  if (!limpio || cache.has(key) || enCurso.has(key)) return;
  enCurso.add(key);
  const tl = idioma === 'zh' ? 'zh-CN' : idioma;
  fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${tl}&dt=t&q=${encodeURIComponent(limpio)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const trad = Array.isArray(data?.[0]) ? data[0].map((p) => p?.[0] || '').join('') : '';
      if (trad) {
        cache.set(key, trad);
        guardarCache();
        notificar();
      }
    })
    .catch(() => { /* mantener original */ })
    .finally(() => { enCurso.delete(key); });
}
