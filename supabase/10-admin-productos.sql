-- =====================================================================
-- OESTACK · Demo Premium · Tarea 10: administración de productos
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas. No modifica datos, políticas RLS ni Storage.
--
-- Qué hace
--   1. Comprueba que los datos que YA existen cumplen los límites nuevos. Si algo no
--      cumple, se detiene con la lista de filas y no aplica nada.
--   2. Agrega límites en la base: nombres de 1 a 60 caracteres (sin contar los espacios
--      de los extremos) en categorías y productos, y precio >= 0 sin "NaN".
--   3. Crea reordenar_productos(): guarda el orden de una categoría en UNA transacción.
--
-- Límites que YA existían (no se duplican; el control final comprueba que sigan ahí):
--   * productos.precio >= 0          (schema.sql). Faltaba rechazar 'NaN', que en
--                                     Postgres cumple ">= 0": lo cubre el punto 2.
--   * máximo 4 variantes             (productos_variantes_validas, 07)
--   * máximo 8 adicionales           (categorias_adicionales_validos, 07)
--
-- CONSULTA DE VERIFICACIÓN (opcional, para mirar antes de correr; no cambia nada).
-- Tiene que devolver 0 filas:
--
--   select 'categorias' as tabla, id, nombre, null::numeric as precio from public.categorias
--    where char_length(btrim(nombre)) not between 1 and 60
--   union all
--   select 'productos', id, nombre, precio from public.productos
--    where char_length(btrim(nombre)) not between 1 and 60
--       or precio < 0 or precio = 'NaN'::numeric;
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Los datos actuales tienen que cumplir (revisa TODOS los locales)
-- ---------------------------------------------------------------------

do $$
declare
  v_malas text;
begin
  select string_agg(format('%s "%s" (precio: %s)', t.tabla, t.nombre, coalesce(t.precio::text, '-')), '; ')
  into v_malas
  from (
    select 'categoría' as tabla, nombre, null::numeric as precio
    from public.categorias
    where char_length(btrim(nombre)) not between 1 and 60
    union all
    select 'producto', nombre, precio
    from public.productos
    where char_length(btrim(nombre)) not between 1 and 60
       or precio < 0 or precio = 'NaN'::numeric
  ) as t;

  if v_malas is not null then
    raise exception 'Hay datos que no cumplen los límites nuevos. No se aplicó nada. Revisar: %', v_malas;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 2. Límites nuevos
-- ---------------------------------------------------------------------

alter table public.categorias drop constraint if exists categorias_nombre_largo;
alter table public.categorias
  add constraint categorias_nombre_largo
  check (char_length(btrim(nombre)) between 1 and 60);

alter table public.productos drop constraint if exists productos_nombre_largo;
alter table public.productos
  add constraint productos_nombre_largo
  check (char_length(btrim(nombre)) between 1 and 60);

alter table public.productos drop constraint if exists productos_precio_no_negativo;
alter table public.productos
  add constraint productos_precio_no_negativo
  check (precio >= 0 and precio <> 'NaN'::numeric);


-- ---------------------------------------------------------------------
-- 3. Reordenar los productos de UNA categoría (análoga a reordenar_categorias)
--
--   * SECURITY INVOKER: corre con los permisos de QUIEN LA LLAMA; el RLS sigue valiendo.
--   * Además comprueba es_admin() o es_miembro(local), y que la categoría sea de ese local.
--   * Exige EXACTAMENTE los productos de esa categoría (sin faltantes, repetidos ni ajenos).
--   * Bloquea las filas mientras reordena.
--   * search_path vacío. Solo "authenticated" puede ejecutarla.
-- ---------------------------------------------------------------------

create or replace function public.reordenar_productos(p_local_id uuid, p_categoria_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total        integer;
  v_actualizadas integer;
begin
  if not (public.es_admin() or public.es_miembro(p_local_id)) then
    raise exception 'No tenés permiso para ordenar los productos de este local.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.categorias c where c.id = p_categoria_id and c.local_id = p_local_id) then
    raise exception 'La lista de productos cambió. Recargá la página y probá de nuevo.' using errcode = '22023';
  end if;

  -- Bloquea los productos de la categoría hasta terminar la transacción.
  perform 1 from public.productos
  where local_id = p_local_id and categoria_id = p_categoria_id
  order by id for update;

  select count(*) into v_total from public.productos
  where local_id = p_local_id and categoria_id = p_categoria_id;

  if p_ids is null
     or cardinality(p_ids) <> v_total
     or (select count(distinct x) from unnest(p_ids) as x) <> cardinality(p_ids)
     or exists (
          select 1 from unnest(p_ids) as x
          where not exists (
            select 1 from public.productos p
            where p.id = x and p.local_id = p_local_id and p.categoria_id = p_categoria_id
          )
        )
  then
    raise exception 'La lista de productos cambió. Recargá la página y probá de nuevo.' using errcode = '22023';
  end if;

  -- La posición en la lista pasa a ser el orden (1, 2, 3...).
  update public.productos p
  set orden = t.posicion
  from unnest(p_ids) with ordinality as t(id, posicion)
  where p.id = t.id and p.local_id = p_local_id and p.categoria_id = p_categoria_id;

  get diagnostics v_actualizadas = row_count;
  if v_actualizadas <> v_total then
    raise exception 'No se pudo guardar el orden completo.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.reordenar_productos(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reordenar_productos(uuid, uuid, uuid[]) to authenticated;

-- Que la API vea la función nueva enseguida.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- CONTROL (el SQL Editor muestra solo este último resultado)
--   Tiene que dar UNA fila con:
--     security_definer   = false
--     anon_puede         = false
--     con_sesion_puede   = true
--     limites            = 6
--     bucket_max_bytes   = 2097152
--     bucket_tipos       = image/jpeg, image/png, image/webp
--     politicas_storage  = 1
--     aroma_categorias   = 3
--     aroma_productos    = 18
-- ---------------------------------------------------------------------

select
  p.prosecdef                                                 as security_definer,
  has_function_privilege('anon', p.oid, 'execute')            as anon_puede,
  has_function_privilege('authenticated', p.oid, 'execute')   as con_sesion_puede,
  (select count(*) from pg_constraint
    where contype = 'c'
      and conrelid in ('public.categorias'::regclass, 'public.productos'::regclass)
      and conname in ('categorias_nombre_largo', 'productos_nombre_largo', 'productos_precio_no_negativo',
                      'productos_precio_check', 'productos_variantes_validas', 'categorias_adicionales_validos')) as limites,
  (select file_size_limit from storage.buckets where id = 'imagenes')                                             as bucket_max_bytes,
  (select string_agg(t, ', ' order by t) from storage.buckets b, unnest(b.allowed_mime_types) as t
    where b.id = 'imagenes')                                                                                     as bucket_tipos,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'imagenes_gestion_miembros')           as politicas_storage,
  (select count(*) from public.categorias c join public.locales l on l.id = c.local_id where l.slug = 'aroma')   as aroma_categorias,
  (select count(*) from public.productos x join public.locales l on l.id = x.local_id where l.slug = 'aroma')    as aroma_productos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reordenar_productos';


-- ---------------------------------------------------------------------
-- MANTENIMIENTO (correr aparte, cuando quieras; solo lee)
-- Fotos de productos en Storage que ningún producto usa ("huérfanas"): pueden quedar si
-- se corta la conexión en medio de un guardado. Para borrarlas, usar Storage en el panel
-- de Supabase (no se borran con SQL).
--
--   select o.name, (o.metadata ->> 'size')::bigint as bytes, o.created_at
--   from storage.objects o
--   where o.bucket_id = 'imagenes'
--     and o.name like '%/productos/%'
--     and not exists (
--       select 1 from public.productos p
--       where p.imagen_url like '%/storage/v1/object/public/imagenes/'
--             || regexp_replace(o.name, '-(240|480)\.(webp|jpg)$', '') || '-480.%'
--     )
--   order by o.created_at;
-- ---------------------------------------------------------------------
