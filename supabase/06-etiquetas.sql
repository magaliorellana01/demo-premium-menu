-- =====================================================================
-- OESTACK · Demo Premium · Tarea 6: etiquetas de ejemplo en los productos de Aroma
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas: cada corrida deja las etiquetas de los
-- 18 productos de "aroma" exactamente como figuran acá.
--
-- Son DATOS DE DEMOSTRACIÓN con criterio razonable, no una declaración real de
-- alérgenos. En un local de verdad, las etiquetas las carga el propio local y son
-- su responsabilidad.
--
-- Esquema y permisos: NO cambia nada. La columna productos.etiquetas (text[]) ya
-- existe y la lectura anónima de productos ya estaba dada.
--
-- Vocabulario (claves, ver src/lib/etiquetas.js):
--   vegano, vegetariano, sin-tacc, sin-lactosa, picante, nuevo
-- Criterio de la demo: lo vegano no repite "vegetariano".
-- "picante" queda sin usar a propósito: los filtros solo muestran las etiquetas
-- que existen en el menú.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Etiquetas por producto (por nombre, dentro del local "aroma")
-- ---------------------------------------------------------------------

update public.productos p
set etiquetas = e.etiquetas
from (values
  -- Cafés
  ('Espresso',                         array['vegano', 'sin-tacc', 'sin-lactosa']),
  ('Capuchino',                        array['vegetariano', 'sin-tacc']),
  ('Latte artesanal',                  array['vegetariano', 'sin-tacc']),
  ('Latte en vaso',                    array['vegetariano', 'sin-tacc']),
  ('Moca',                             array['vegetariano']),
  ('Café frío con leche',              array['vegetariano', 'sin-tacc', 'nuevo']),
  -- Postres
  ('Croissant',                        array['vegetariano']),
  ('Croissant de chocolate',           array['vegetariano']),
  ('Carrot cake',                      array['vegetariano']),
  ('Cheesecake de frutos rojos',       array['vegetariano']),
  ('Torta de chocolate',               array['vegetariano']),
  ('Tartaleta de frutas',              array['vegetariano']),
  -- Jugos y licuados
  ('Limonada con menta',               array['vegano', 'sin-tacc', 'sin-lactosa']),
  ('Jugo de naranja',                  array['vegano', 'sin-tacc', 'sin-lactosa']),
  ('Mango y maracuyá',                 array['vegano', 'sin-tacc', 'sin-lactosa', 'nuevo']),
  ('Sandía, lima y menta',             array['vegano', 'sin-tacc', 'sin-lactosa']),
  ('Licuado de frutilla y frutos rojos', array['vegano', 'sin-tacc', 'sin-lactosa']),
  ('Licuado verde',                    array['vegano', 'sin-tacc', 'sin-lactosa'])
) as e(nombre, etiquetas)
where p.nombre = e.nombre
  and p.local_id = (select id from public.locales where slug = 'aroma');


-- ---------------------------------------------------------------------
-- 2. Control: debe dar 18 productos y 18 con etiquetas
-- ---------------------------------------------------------------------

select count(*)                                          as productos,
       count(*) filter (where cardinality(etiquetas) > 0) as con_etiquetas,
       count(*) filter (where 'nuevo' = any(etiquetas))   as nuevos
from public.productos
where local_id = (select id from public.locales where slug = 'aroma');

-- Cuántos productos hay por etiqueta:
select etiqueta, count(*) as productos
from public.productos, unnest(etiquetas) as etiqueta
where local_id = (select id from public.locales where slug = 'aroma')
group by etiqueta
order by productos desc, etiqueta;
