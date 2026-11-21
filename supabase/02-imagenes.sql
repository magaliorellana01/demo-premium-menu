-- =====================================================================
-- OESTACK · Demo Premium · Tarea 2: imágenes y destacados del local "aroma"
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se ejecuta DESPUÉS de schema.sql y se puede volver a correr sin problemas.
--
-- Las imágenes viven en public/locales/aroma/ (las sirve la propia app). En
-- imagen_url se guarda la versión de 800 px; la de 480 px se deduce por el
-- nombre (ver src/lib/imagenes.js).
-- =====================================================================

-- Logo del local (versión para fondo claro)
update public.locales
set logo_url = '/locales/aroma/logo.webp'
where slug = 'aroma';

-- Imagen de cada producto, buscando por nombre dentro del local aroma
with imagenes (nombre, archivo) as (
  values
    ('Espresso',                       'espresso'),
    ('Capuchino',                      'capuchino'),
    ('Latte artesanal',                'latte-artesanal'),
    ('Latte en vaso',                  'latte-vaso'),
    ('Moca',                           'moca'),
    ('Café frío con leche',            'cafe-frio'),
    ('Croissant',                      'croissant'),
    ('Croissant de chocolate',         'croissant-chocolate'),
    ('Carrot cake',                    'carrot-cake'),
    ('Cheesecake de frutos rojos',     'cheesecake'),
    ('Torta de chocolate',             'torta-chocolate'),
    ('Tartaleta de frutas',            'tartaleta'),
    ('Limonada con menta',             'limonada'),
    ('Jugo de naranja',                'naranja'),
    ('Mango y maracuyá',               'mango-maracuya'),
    ('Sandía, lima y menta',           'sandia'),
    ('Licuado de frutilla y frutos rojos', 'strawberry'),
    ('Licuado verde',                  'verde')
)
update public.productos p
set imagen_url = '/locales/aroma/productos/' || i.archivo || '-800.webp'
from imagenes i, public.locales l
where l.slug = 'aroma'
  and p.local_id = l.id
  and p.nombre = i.nombre;

-- Destacados: 5 productos representativos (2 cafés, 2 postres y 1 jugo).
-- El resto del local queda en false.
update public.productos p
set destacado = p.nombre in (
  'Capuchino',
  'Café frío con leche',
  'Cheesecake de frutos rojos',
  'Torta de chocolate',
  'Mango y maracuyá'
)
from public.locales l
where l.slug = 'aroma'
  and p.local_id = l.id;

-- Control: tienen que dar 18 productos, 18 con imagen y 5 destacados.
select
  count(*)                                   as productos,
  count(*) filter (where p.imagen_url is not null) as con_imagen,
  count(*) filter (where p.destacado)        as destacados
from public.productos p
join public.locales l on l.id = p.local_id
where l.slug = 'aroma';
