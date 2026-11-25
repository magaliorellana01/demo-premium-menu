-- =====================================================================
-- OESTACK · Demo Premium · Tarea 7: variantes de producto y adicionales por categoría
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas: las columnas y la función se crean solo
-- si faltan o se reemplazan, las restricciones se recrean y los datos de ejemplo de
-- "aroma" quedan siempre como figuran acá.
--
-- Qué agrega
--   productos.variantes    jsonb, default '[]'. Hasta 4 objetos {"nombre", "precio"}.
--                          Ej.: [{"nombre":"Chico","precio":4800},{"nombre":"Grande","precio":6000}]
--   categorias.adicionales jsonb, default '[]'. Hasta 8 objetos {"nombre", "precio"}.
--                          Ej.: [{"nombre":"Leche vegetal","precio":600}]
--                          Es información para el cliente (no es un carrito ni se suma a nada).
--
-- Regla del precio base
--   Si un producto tiene variantes, el menú muestra los precios de las variantes y
--   productos.precio (que sigue siendo obligatorio) debe valer IGUAL que el precio MÁS BAJO
--   de sus variantes. Lo mantiene el panel de administración; acá NO se fuerza con una
--   restricción (obligaría a cambiar precio y variantes siempre en la misma operación).
--   El menú público toma el precio "desde" de las propias variantes, así que no depende de
--   que coincidan. Al final de este archivo hay una consulta que lista los que no coinciden.
--
-- Permisos y RLS: NO cambia nada.
--   La lectura anónima está dada por TABLA (grant select on locales, categorias, productos
--   to anon en schema.sql), no por columna: las columnas nuevas ya son legibles y no hace
--   falta otorgar nada. Ninguna política RLS se toca; escribir sigue siendo de los miembros
--   del local y de los admins.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------

alter table public.productos  add column if not exists variantes   jsonb not null default '[]'::jsonb;
alter table public.categorias add column if not exists adicionales jsonb not null default '[]'::jsonb;


-- ---------------------------------------------------------------------
-- 2. Validación (función simple, sin acceso a tablas, con search_path fijado)
--    Es válida si es un arreglo JSON de hasta `maximo` objetos y cada uno tiene
--    "nombre" de texto (1 a 40 caracteres sin contar espacios de los extremos) y
--    "precio" numérico entre 0 y 99.999.999,99 (como numeric(10, 2) de productos.precio).
--    Los CASE garantizan el orden de evaluación: nunca se intenta leer un elemento
--    de algo que no es un arreglo ni convertir a número algo que no lo es.
-- ---------------------------------------------------------------------

create or replace function public.lista_precios_valida(lista jsonb, maximo integer)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when jsonb_typeof(lista) is distinct from 'array' then false
    when jsonb_array_length(lista) > maximo then false
    else not exists (
      select 1
      from jsonb_array_elements(lista) as e
      where not (
        case
          when jsonb_typeof(e) <> 'object' then false
          when jsonb_typeof(e -> 'nombre') is distinct from 'string' then false
          when char_length(btrim(e ->> 'nombre')) not between 1 and 40 then false
          when jsonb_typeof(e -> 'precio') is distinct from 'number' then false
          else (e ->> 'precio')::numeric between 0 and 99999999.99
        end
      )
    )
  end
$$;


-- ---------------------------------------------------------------------
-- 3. Restricciones: 4 variantes por producto y 8 adicionales por categoría
-- ---------------------------------------------------------------------

alter table public.productos drop constraint if exists productos_variantes_validas;
alter table public.productos
  add constraint productos_variantes_validas
  check (public.lista_precios_valida(variantes, 4));

alter table public.categorias drop constraint if exists categorias_adicionales_validos;
alter table public.categorias
  add constraint categorias_adicionales_validos
  check (public.lista_precios_valida(adicionales, 8));


-- ---------------------------------------------------------------------
-- 4. Datos de DEMOSTRACIÓN para el local "aroma" (precios inventados)
--    La primera variante vale lo mismo que el precio actual (productos.precio);
--    la grande, un 25 % más, redondeado a la centena.
-- ---------------------------------------------------------------------

update public.productos p
set variantes = v.variantes::jsonb
from (values
  ('Espresso',        '[{"nombre":"Simple","precio":3200},{"nombre":"Doble","precio":4200}]'),
  ('Capuchino',       '[{"nombre":"Chico","precio":4800},{"nombre":"Grande","precio":6000}]'),
  ('Latte artesanal', '[{"nombre":"Chico","precio":5200},{"nombre":"Grande","precio":6500}]'),
  ('Latte en vaso',   '[{"nombre":"Chico","precio":5400},{"nombre":"Grande","precio":6800}]'),
  ('Moca',            '[{"nombre":"Chico","precio":5600},{"nombre":"Grande","precio":7000}]')
) as v(nombre, variantes)
where p.nombre = v.nombre
  and p.local_id = (select id from public.locales where slug = 'aroma');

-- Los demás productos de aroma quedan sin variantes.
update public.productos
set variantes = '[]'::jsonb
where local_id = (select id from public.locales where slug = 'aroma')
  and nombre not in ('Espresso', 'Capuchino', 'Latte artesanal', 'Latte en vaso', 'Moca');

-- Adicionales de la categoría Cafés.
update public.categorias
set adicionales = '[
  {"nombre":"Leche vegetal","precio":600},
  {"nombre":"Shot extra","precio":800},
  {"nombre":"Jarabe de vainilla","precio":500}
]'::jsonb
where nombre = 'Cafés'
  and local_id = (select id from public.locales where slug = 'aroma');

-- Las otras categorías de aroma quedan sin adicionales.
update public.categorias
set adicionales = '[]'::jsonb
where nombre <> 'Cafés'
  and local_id = (select id from public.locales where slug = 'aroma');


-- ---------------------------------------------------------------------
-- 5. Control
--    Debe dar: con_variantes = 5, categorias_con_adicionales = 1, y la segunda
--    consulta no debe devolver filas (precio base = variante más baja).
-- ---------------------------------------------------------------------

select
  (select count(*) from public.productos
     where local_id = l.id and jsonb_array_length(variantes) > 0)  as con_variantes,
  (select count(*) from public.categorias
     where local_id = l.id and jsonb_array_length(adicionales) > 0) as categorias_con_adicionales
from public.locales l
where l.slug = 'aroma';

-- Productos cuyo precio base NO coincide con su variante más barata (debería estar vacío):
select p.nombre, p.precio as precio_base, min((v ->> 'precio')::numeric) as variante_mas_barata
from public.productos p, jsonb_array_elements(p.variantes) as v
where jsonb_array_length(p.variantes) > 0
group by p.id, p.nombre, p.precio
having p.precio <> min((v ->> 'precio')::numeric);
