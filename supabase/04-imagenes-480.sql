-- =====================================================================
-- OESTACK · Demo Premium · Tarea 3 (ajuste): imagen_url pasa a la versión de 480 px
--
-- Pegar en Supabase > SQL Editor > New query > Run. Se puede volver a correr
-- sin problemas (solo toca las filas que todavía terminan en "-800.webp").
--
-- Las fotos de productos ahora se publican en 240 y 480 px (ya no hay de 800 px).
-- imagen_url guarda la de 480 px y la de 240 px se deduce por el nombre
-- (ver src/lib/imagenes.js).
--
-- IMPORTANTE: correr este script ANTES de abrir la versión nueva del menú, porque
-- los archivos de 800 px ya no existen en el proyecto.
-- =====================================================================

update public.productos
set imagen_url = regexp_replace(imagen_url, '-800\.webp$', '-480.webp')
where imagen_url like '%-800.webp';

-- Control: tienen que dar quedan_800 = 0, con_480 = 18 y productos = 18.
select
  count(*) filter (where p.imagen_url like '%-800.webp')  as quedan_800,
  count(*) filter (where p.imagen_url like '%-480.webp')  as con_480,
  count(*)                                                as productos
from public.productos p
join public.locales l on l.id = p.local_id
where l.slug = 'aroma';
