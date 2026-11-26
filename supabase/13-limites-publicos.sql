-- =====================================================================
-- OESTACK · Demo Premium · Tarea 13: límites a lo que se publica en el menú
--
-- Pegar COMPLETO en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas. No modifica datos de ninguna fila.
-- No cambia políticas RLS ni permisos.
--
-- Por qué (docs/seguridad.md, hallazgos H2 y H3): quien puede editar un menú (también la
-- cuenta demo, que es pública) puede saltear el panel y escribir directo en la API:
--   * productos.imagen_url aceptaba cualquier texto, incluida una imagen de OTRO sitio, que
--     el celular de cada visitante iba a pedir (ese sitio ve su IP);
--   * locales.logo_url se validaba por la forma de la ruta, pero aceptaba cualquier dominio;
--   * la descripción y las etiquetas de un producto no tenían límite de tamaño.
-- Ninguna de esas cosas permite ejecutar código en el menú.
--
-- Qué hace
--   1. Comprueba que los datos que YA existen (todos los locales) cumplen. Si algo no cumple,
--      se detiene con la lista y no aplica NADA (el SQL Editor usa una sola transacción).
--   2. imagen_url: vacío, una foto de la app (/locales/...) o una foto de Supabase Storage en
--      la carpeta de productos de ESE local.
--   3. logo_url: lo mismo que antes, pero solo en un dominio *.supabase.co.
--   4. Descripción de producto: hasta 200 caracteres (lo mismo que el panel). Etiquetas: hasta
--      12, y 300 caracteres entre todas.
--
-- OJO: si algún día el proyecto usa un dominio propio para Supabase, hay que sumarlo acá.
-- Y si se vuelve a correr 11-admin-ajustes.sql, el logo vuelve a la regla anterior: correr
-- este script después.
--
-- CONSULTA DE VERIFICACIÓN (opcional, para mirar antes de correr; no cambia nada).
-- Tiene que devolver 0 filas:
--
--   select p.id, p.nombre, p.imagen_url from public.productos p
--    where char_length(p.descripcion) > 200
--       or cardinality(p.etiquetas) > 12
--       or char_length(array_to_string(p.etiquetas, '')) > 300
--       or not (p.imagen_url is null
--           or p.imagen_url ~ '^/locales/[a-z0-9-]+/productos/[A-Za-z0-9_-]+\.(webp|png|jpg)$'
--           or p.imagen_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/imagenes/'
--                              || p.local_id::text || '/productos/[A-Za-z0-9_-]+\.(webp|png|jpg)$'));
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Los datos actuales tienen que cumplir
-- ---------------------------------------------------------------------

do $$
declare
  v_malos text;
begin
  select string_agg(format('%s "%s": %s', t.que, t.nombre, t.campos), '; ')
  into v_malos
  from (
    select 'producto' as que, p.nombre,
      concat_ws(', ',
        case when char_length(p.descripcion) > 200 then 'descripcion' end,
        case when cardinality(p.etiquetas) > 12 or char_length(array_to_string(p.etiquetas, '')) > 300 then 'etiquetas' end,
        case when char_length(p.imagen_url) > 500
               or not (p.imagen_url ~ '^/locales/[a-z0-9-]+/productos/[A-Za-z0-9_-]+\.(webp|png|jpg)$'
                       or p.imagen_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/imagenes/'
                                          || p.local_id::text || '/productos/[A-Za-z0-9_-]+\.(webp|png|jpg)$'))
             then 'imagen_url' end
      ) as campos
    from public.productos p
    union all
    select 'local', l.slug,
      case when not (l.logo_url ~ '^/locales/[a-z0-9-]+/[A-Za-z0-9_-]+\.(webp|png|jpg)$'
                     or l.logo_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/imagenes/'
                                      || l.id::text || '/logo/[A-Za-z0-9_-]+\.(webp|png)$'))
           then 'logo_url' else '' end
    from public.locales l
  ) as t
  where t.campos <> '';

  if v_malos is not null then
    raise exception 'Hay datos que no cumplen los límites nuevos. No se aplicó nada. Revisar: %', v_malos;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 2 a 4. Límites. Un valor null (campo vacío) siempre vale.
-- ---------------------------------------------------------------------

alter table public.productos drop constraint if exists productos_imagen_url_valida;
alter table public.productos
  add constraint productos_imagen_url_valida
  check (
    char_length(imagen_url) <= 500
    and (
      imagen_url ~ '^/locales/[a-z0-9-]+/productos/[A-Za-z0-9_-]+\.(webp|png|jpg)$'
      or imagen_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/imagenes/'
                       || local_id::text || '/productos/[A-Za-z0-9_-]+\.(webp|png|jpg)$')
    )
  );

alter table public.locales drop constraint if exists locales_logo_url_valido;
alter table public.locales
  add constraint locales_logo_url_valido
  check (
    char_length(logo_url) <= 500
    and (
      logo_url ~ '^/locales/[a-z0-9-]+/[A-Za-z0-9_-]+\.(webp|png|jpg)$'
      or logo_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/imagenes/'
                     || id::text || '/logo/[A-Za-z0-9_-]+\.(webp|png)$')
    )
  );

alter table public.productos drop constraint if exists productos_descripcion_largo;
alter table public.productos
  add constraint productos_descripcion_largo
  check (char_length(descripcion) <= 200);

alter table public.productos drop constraint if exists productos_etiquetas_limite;
alter table public.productos
  add constraint productos_etiquetas_limite
  check (cardinality(etiquetas) <= 12 and char_length(array_to_string(etiquetas, '')) <= 300);


-- ---------------------------------------------------------------------
-- CONTROL (el SQL Editor muestra solo este último resultado)
--   Tiene que dar UNA fila con:
--     limites_nuevos        = 4
--     rechaza_otro_sitio    = true
--     aroma_categorias      = 3
--     aroma_productos       = 18
-- ---------------------------------------------------------------------

select
  (select count(*) from pg_constraint
    where contype = 'c'
      and conrelid in ('public.productos'::regclass, 'public.locales'::regclass)
      and conname in ('productos_imagen_url_valida', 'locales_logo_url_valido',
                      'productos_descripcion_largo', 'productos_etiquetas_limite'))            as limites_nuevos,
  (select bool_and(pg_get_constraintdef(c.oid) like '%supabase%')
     from pg_constraint c
    where c.conname in ('productos_imagen_url_valida', 'locales_logo_url_valido'))             as rechaza_otro_sitio,
  (select count(*) from public.categorias c join public.locales l on l.id = c.local_id where l.slug = 'aroma') as aroma_categorias,
  (select count(*) from public.productos p join public.locales l on l.id = p.local_id where l.slug = 'aroma')  as aroma_productos;
