// Granos de café que caen despacio detrás de la portada. Decorativos: se ocultan
// a lectores de pantalla y no reciben clics. Cada grano reutiliza el mismo
// símbolo SVG (<use>) y solo anima transform y opacity (ver portada.css).
//
// Valores elegidos a mano para que la caída se vea natural y sin patrón:
//   x: posición horizontal (%)   tam: tamaño (px)      dur: duración (s)
//   ret: retraso negativo (s), para que no arranquen todos juntos
//   g0/g1: giro al empezar y al terminar (grados)       deriva: desplazamiento lateral (px)
//   y: altura de reposo (%) si hay que mostrarlos quietos (movimiento reducido)
const GRANOS = [
  { x: 6, tam: 14, dur: 34, ret: -4, g0: -20, g1: 160, deriva: 40, tono: 'cobre', opacidad: 0.3, y: 18 },
  { x: 14, tam: 22, dur: 40, ret: -22, g0: 30, g1: 220, deriva: -30, tono: 'arena', opacidad: 0.22, y: 72 },
  { x: 23, tam: 11, dur: 30, ret: -12, g0: 10, g1: 140, deriva: 25, tono: 'cobre', opacidad: 0.28, y: 40 },
  { x: 31, tam: 18, dur: 38, ret: -30, g0: -50, g1: 90, deriva: 50, tono: 'arena', opacidad: 0.26, y: 86 },
  { x: 40, tam: 26, dur: 44, ret: -8, g0: 15, g1: 200, deriva: -45, tono: 'cobre', opacidad: 0.2, y: 12 },
  { x: 49, tam: 12, dur: 32, ret: -26, g0: 60, g1: 300, deriva: 35, tono: 'arena', opacidad: 0.3, y: 58 },
  { x: 57, tam: 20, dur: 42, ret: -16, g0: -10, g1: 120, deriva: -25, tono: 'cobre', opacidad: 0.26, y: 30 },
  { x: 66, tam: 14, dur: 36, ret: -34, g0: 40, g1: 260, deriva: 30, tono: 'arena', opacidad: 0.24, y: 80 },
  { x: 74, tam: 24, dur: 46, ret: -2, g0: -35, g1: 80, deriva: 40, tono: 'cobre', opacidad: 0.18, y: 22 },
  { x: 82, tam: 12, dur: 31, ret: -20, g0: 0, g1: 180, deriva: -35, tono: 'arena', opacidad: 0.3, y: 64 },
  { x: 90, tam: 18, dur: 39, ret: -38, g0: 25, g1: 240, deriva: 30, tono: 'cobre', opacidad: 0.24, y: 46 },
  { x: 96, tam: 10, dur: 33, ret: -10, g0: -45, g1: 130, deriva: -20, tono: 'arena', opacidad: 0.26, y: 90 },
]

export default function Granos() {
  return (
    <div className="granos" aria-hidden="true">
      <svg width="0" height="0" focusable="false" className="granos__simbolo">
        <symbol id="grano-portada" viewBox="0 0 40 60">
          <ellipse cx="20" cy="30" rx="14" ry="22" fill="currentColor" />
          <path className="granos__ranura" d="M20 9 C11 23 29 37 20 51" fill="none" strokeWidth="2.4" strokeLinecap="round" />
        </symbol>
      </svg>

      {GRANOS.map((g) => (
        <span
          key={g.x}
          className={`granos__grano granos__grano--${g.tono}`}
          style={{
            '--x': `${g.x}%`,
            '--tam': `${g.tam}px`,
            '--dur': `${g.dur}s`,
            '--ret': `${g.ret}s`,
            '--g0': `${g.g0}deg`,
            '--g1': `${g.g1}deg`,
            '--deriva': `${g.deriva}px`,
            '--opacidad': g.opacidad,
            '--y': `${g.y}%`,
          }}
        >
          <svg viewBox="0 0 40 60" focusable="false">
            <use href="#grano-portada" />
          </svg>
        </span>
      ))}
    </div>
  )
}
