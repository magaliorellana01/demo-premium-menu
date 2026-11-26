-- =====================================================================
-- OESTACK · Demo Premium · Tarea 11: ajustes del local desde el panel
--
-- Pegar COMPLETO en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas. No modifica datos de ninguna fila.
-- No toca las tablas ni las políticas de categorías y productos, ni las políticas RLS
-- de locales (quién puede escribir sigue igual: dueños y admins).
--
-- Qué hace
--   1. Crea las funciones que validan `tema` y `horarios`.
--   2. Comprueba que los datos que YA existen (todos los locales) cumplen los límites
--      nuevos. Si algo no cumple, se detiene con la lista y no aplica NADA (el SQL Editor
--      corre el script en una sola transacción).
--   3. Agrega esos límites (CHECKs) en public.locales.
--   4. Agrega `updated_at`, para no pisar cambios hechos desde otro equipo.
--   5. Protege las columnas: RLS decide QUÉ FILAS se editan, pero no qué columnas.
--        a) permisos por columna: desde la API ya no se puede actualizar id, slug ni
--           updated_at (tampoco un admin: el slug está impreso en los códigos QR);
--        b) un trigger: `activo` solo lo cambia un admin de OESTACK, y cualquier columna
--           que se agregue en el futuro queda protegida hasta que se la habilite acá.
--   6. Storage: la carpeta <local_id>/logo/ solo la escriben el dueño y los admins
--      (antes también un editor podía subir o borrar ahí).
--
-- CONSULTA DE VERIFICACIÓN (opcional, para mirar antes de correr; no cambia nada):
--
--   select slug,
--          char_length(btrim(nombre))   as nombre,       -- 1 a 60
--          char_length(descripcion)     as descripcion,  -- hasta 200
--          char_length(direccion)       as direccion,    -- hasta 120
--          whatsapp,                                     -- hasta 30, sin : / < >
--          instagram,                                    -- hasta 100; si es enlace, https://instagram.com/...
--          logo_url,                                     -- /locales/<slug>/<archivo> o Storage propio
--          tema,                                         -- solo frase, fondo, texto, acento, portada
--          horarios                                      -- {} o {"zona": ..., "semana": {...}}
--     from public.locales
--    order by slug;
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Funciones de validación (puras: solo miran el valor que reciben)
-- ---------------------------------------------------------------------

-- tema: objeto con, como mucho, "frase" (hasta 80) y cuatro colores #RRGGBB. Los colores
-- terminan escritos en variables de CSS: no se admite ningún otro texto.
create or replace function public.tema_valido(p_tema jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tema is null or jsonb_typeof(p_tema) <> 'object' then false
    else not exists (
      select 1 from jsonb_each(p_tema) as e
      where not coalesce(
        case
          when e.key in ('fondo', 'texto', 'acento', 'portada')
            then jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^#[0-9a-fA-F]{6}$'
          when e.key = 'frase'
            then jsonb_typeof(e.value) = 'string' and char_length(e.value #>> '{}') <= 80
          else false
        end, false)
    )
  end;
$$;

-- horarios: {} o { "zona"?: "Area/Ciudad", "semana": { "lunes": [ {desde, hasta} ], ... } }.
-- Hasta 3 franjas por día. "hasta" menor que "desde" cruza la medianoche y tiene que cerrar
-- a más tardar a las 12:00 (si no, las horas están al revés). Sin superposiciones.
create or replace function public.horarios_validos(p_horarios jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  c_dias constant text[] := array['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  v_clave   text;
  v_lista   jsonb;
  v_franja  jsonb;
  v_desde   text;
  v_hasta   text;
  v_ini     integer;
  v_fin     integer;
  v_base    integer;
  v_inicios integer[] := '{}';
  v_finales integer[] := '{}';
  i         integer;
  j         integer;
begin
  if p_horarios is null or jsonb_typeof(p_horarios) <> 'object' then return false; end if;
  if p_horarios = '{}'::jsonb then return true; end if;
  if (p_horarios - array['zona', 'semana']) <> '{}'::jsonb then return false; end if;
  if p_horarios ? 'zona' and (
       jsonb_typeof(p_horarios -> 'zona') <> 'string'
       or char_length(p_horarios ->> 'zona') > 64
       or (p_horarios ->> 'zona') !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){1,2}$'
     ) then
    return false;
  end if;
  if jsonb_typeof(p_horarios -> 'semana') is distinct from 'object' then return false; end if;
  if ((p_horarios -> 'semana') - c_dias) <> '{}'::jsonb then return false; end if;

  for v_clave, v_lista in select key, value from jsonb_each(p_horarios -> 'semana') loop
    if jsonb_typeof(v_lista) <> 'array' then return false; end if;
    if jsonb_array_length(v_lista) > 3 then return false; end if;
    v_base := (array_position(c_dias, v_clave) - 1) * 1440;

    for v_franja in select value from jsonb_array_elements(v_lista) loop
      if jsonb_typeof(v_franja) <> 'object' then return false; end if;
      if (v_franja - array['desde', 'hasta']) <> '{}'::jsonb then return false; end if;
      if jsonb_typeof(v_franja -> 'desde') is distinct from 'string'
         or jsonb_typeof(v_franja -> 'hasta') is distinct from 'string' then
        return false;
      end if;
      v_desde := v_franja ->> 'desde';
      v_hasta := v_franja ->> 'hasta';
      if v_desde !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
      if v_hasta !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then return false; end if;
      v_ini := split_part(v_desde, ':', 1)::integer * 60 + split_part(v_desde, ':', 2)::integer;
      v_fin := split_part(v_hasta, ':', 1)::integer * 60 + split_part(v_hasta, ':', 2)::integer;
      if v_fin = v_ini then return false; end if;
      if v_fin < v_ini then
        if v_fin > 720 then return false; end if;
        v_fin := v_fin + 1440;
      end if;
      v_inicios := v_inicios || (v_base + v_ini);
      v_finales := v_finales || (v_base + v_fin);
    end loop;
  end loop;

  -- Superposiciones, también del domingo (fin de semana) con el lunes.
  for i in 1 .. coalesce(array_length(v_inicios, 1), 0) loop
    for j in 1 .. array_length(v_inicios, 1) loop
      continue when i = j;
      if (v_inicios[j] >= v_inicios[i] and v_inicios[j] < v_finales[i])
         or (v_inicios[j] >= v_inicios[i] - 10080 and v_inicios[j] < v_finales[i] - 10080) then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

-- Las usan los CHECKs, que se evalúan con los permisos de quien guarda.
revoke all on function public.tema_valido(jsonb)      from public, anon, authenticated;
revoke all on function public.horarios_validos(jsonb) from public, anon, authenticated;
grant execute on function public.tema_valido(jsonb)      to authenticated, service_role;
grant execute on function public.horarios_validos(jsonb) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2. Los datos actuales tienen que cumplir (revisa TODOS los locales)
-- ---------------------------------------------------------------------

do $$
declare
  v_malas text;
begin
  select string_agg(format('local "%s": %s', t.slug, t.campos), '; ' order by t.slug)
  into v_malas
  from (
    select l.slug, concat_ws(', ',
      case when char_length(btrim(l.nombre)) not between 1 and 60 then 'nombre' end,
      case when char_length(l.descripcion) > 200 then 'descripcion' end,
      case when char_length(l.direccion) > 120 then 'direccion' end,
      case when char_length(l.whatsapp) > 30 or l.whatsapp ~ '[:/<>]' then 'whatsapp' end,
      case when char_length(l.instagram) > 100
             or not (l.instagram ~* '^https://(www\.)?instagram\.com/[^[:space:]<>"]*$' or l.instagram !~ '[:<>"[:space:]]')
           then 'instagram' end,
      case when char_length(l.logo_url) > 500
             or not (l.logo_url ~ '^/locales/[a-z0-9-]+/[A-Za-z0-9_-]+\.(webp|png|jpg)$'
                     or l.logo_url ~ ('^https://[a-z0-9-]+(\.[a-z0-9-]+)+/storage/v1/object/public/imagenes/'
                                      || l.id::text || '/logo/[A-Za-z0-9_-]+\.(webp|png)$'))
           then 'logo_url' end,
      case when not public.tema_valido(l.tema) then 'tema' end,
      case when not public.horarios_validos(l.horarios) then 'horarios' end
    ) as campos
    from public.locales l
  ) as t
  where t.campos <> '';

  if v_malas is not null then
    raise exception 'Hay datos que no cumplen los límites nuevos. No se aplicó nada. Revisar: % (mirá la consulta de verificación en el encabezado del script).', v_malas;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. Límites. Un valor null (campo vacío) siempre vale.
--    El aviso ya tenía su límite de 200 (locales_aviso_texto_largo, 05).
-- ---------------------------------------------------------------------

alter table public.locales drop constraint if exists locales_nombre_largo;
alter table public.locales add constraint locales_nombre_largo
  check (char_length(btrim(nombre)) between 1 and 60);

alter table public.locales drop constraint if exists locales_descripcion_largo;
alter table public.locales add constraint locales_descripcion_largo
  check (char_length(descripcion) <= 200);

alter table public.locales drop constraint if exists locales_direccion_largo;
alter table public.locales add constraint locales_direccion_largo
  check (char_length(direccion) <= 120);

-- Sin ':' ni '/': no puede esconder un enlace. El formato argentino lo exige el panel
-- (acá no, para no romper el dato de ejemplo de la demo).
alter table public.locales drop constraint if exists locales_whatsapp_valido;
alter table public.locales add constraint locales_whatsapp_valido
  check (char_length(whatsapp) <= 30 and whatsapp !~ '[:/<>]');

-- Un usuario, o la dirección https de un perfil. Ningún otro esquema (javascript:, data:...).
alter table public.locales drop constraint if exists locales_instagram_valido;
alter table public.locales add constraint locales_instagram_valido
  check (
    char_length(instagram) <= 100
    and (instagram ~* '^https://(www\.)?instagram\.com/[^[:space:]<>"]*$' or instagram !~ '[:<>"[:space:]]')
  );

-- Un archivo de la app (demo) o un logo en la carpeta de Storage de ESTE local, por https.
alter table public.locales drop constraint if exists locales_logo_url_valido;
alter table public.locales add constraint locales_logo_url_valido
  check (
    char_length(logo_url) <= 500
    and (
      logo_url ~ '^/locales/[a-z0-9-]+/[A-Za-z0-9_-]+\.(webp|png|jpg)$'
      or logo_url ~ ('^https://[a-z0-9-]+(\.[a-z0-9-]+)+/storage/v1/object/public/imagenes/'
                     || id::text || '/logo/[A-Za-z0-9_-]+\.(webp|png)$')
    )
  );

alter table public.locales drop constraint if exists locales_tema_valido;
alter table public.locales add constraint locales_tema_valido
  check (public.tema_valido(tema));

alter table public.locales drop constraint if exists locales_horarios_validos;
alter table public.locales add constraint locales_horarios_validos
  check (public.horarios_validos(horarios));


-- ---------------------------------------------------------------------
-- 4 y 5. updated_at y protección de columnas
-- ---------------------------------------------------------------------

alter table public.locales add column if not exists updated_at timestamptz not null default now();

create or replace function public.proteger_local()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_editables constant text[] := array[
    'nombre', 'descripcion', 'direccion', 'whatsapp', 'instagram', 'horarios',
    'aviso_texto', 'aviso_activo', 'tema', 'logo_url', 'updated_at'
  ];
begin
  -- Solo para pedidos que llegan por la API. Desde el SQL Editor se puede todo.
  if current_user in ('anon', 'authenticated') then
    -- Se compara TODO lo que no está en la lista: incluye columnas futuras.
    if (to_jsonb(new) - c_editables) is distinct from (to_jsonb(old) - c_editables) then
      if not public.es_admin() then
        raise exception 'Solo OESTACK puede cambiar esos datos del local.' using errcode = '42501';
      end if;
      if (to_jsonb(new) - c_editables - 'activo') is distinct from (to_jsonb(old) - c_editables - 'activo') then
        raise exception 'Ese dato del local no se puede cambiar desde la aplicación.' using errcode = '42501';
      end if;
    end if;
  end if;
  -- clock_timestamp: cambia en cada guardado, aun dentro de una misma transacción.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.proteger_local() from public, anon, authenticated;

drop trigger if exists locales_proteccion on public.locales;
create trigger locales_proteccion
  before update on public.locales
  for each row execute function public.proteger_local();

-- Permisos por columna: se saca el UPDATE de toda la tabla y se otorga columna por columna.
-- `activo` está porque los admins también entran como "authenticated": el trigger de arriba
-- es el que impide que lo cambie un dueño.
-- (Si se volviera a correr schema.sql, devuelve el UPDATE de tabla: correr este script después.
--  Aun así el trigger sigue protegiendo.)
revoke update on public.locales from anon, authenticated;
grant update (nombre, descripcion, direccion, whatsapp, instagram, horarios,
              aviso_texto, aviso_activo, tema, logo_url, activo)
  on public.locales to authenticated;


-- ---------------------------------------------------------------------
-- 6. Storage: la carpeta del logo, solo dueño y admin
--    Políticas RESTRICTIVAS: se SUMAN a imagenes_gestion_miembros (que no se toca) y solo
--    pueden recortar. No afectan a las fotos de productos.
-- ---------------------------------------------------------------------

drop policy if exists imagenes_logo_alta   on storage.objects;
drop policy if exists imagenes_logo_cambio on storage.objects;
drop policy if exists imagenes_logo_baja   on storage.objects;

create policy imagenes_logo_alta on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'imagenes'
    or name !~ '^[^/]+/logo[./]'
    or public.es_admin()
    or (storage.foldername(name))[1] in (
      select ul.local_id::text from public.usuarios_locales ul
      where ul.user_id = (select auth.uid()) and ul.rol = 'owner'
    )
  );

create policy imagenes_logo_cambio on storage.objects
  as restrictive for update to authenticated
  using (
    bucket_id <> 'imagenes'
    or name !~ '^[^/]+/logo[./]'
    or public.es_admin()
    or (storage.foldername(name))[1] in (
      select ul.local_id::text from public.usuarios_locales ul
      where ul.user_id = (select auth.uid()) and ul.rol = 'owner'
    )
  )
  with check (
    bucket_id <> 'imagenes'
    or name !~ '^[^/]+/logo[./]'
    or public.es_admin()
    or (storage.foldername(name))[1] in (
      select ul.local_id::text from public.usuarios_locales ul
      where ul.user_id = (select auth.uid()) and ul.rol = 'owner'
    )
  );

create policy imagenes_logo_baja on storage.objects
  as restrictive for delete to authenticated
  using (
    bucket_id <> 'imagenes'
    or name !~ '^[^/]+/logo[./]'
    or public.es_admin()
    or (storage.foldername(name))[1] in (
      select ul.local_id::text from public.usuarios_locales ul
      where ul.user_id = (select auth.uid()) and ul.rol = 'owner'
    )
  );


-- Que la API vea la columna y los permisos nuevos enseguida.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- CONTROL (el SQL Editor muestra solo este último resultado)
--   Tiene que dar UNA fila con:
--     columnas_editables    = activo, aviso_activo, aviso_texto, descripcion, direccion,
--                             horarios, instagram, logo_url, nombre, tema, whatsapp
--     update_de_tabla       = false
--     anon_puede_actualizar = false
--     trigger_proteccion    = 1
--     limites               = 9
--     politicas_logo        = 3
--     politicas_locales     = 5
--     rechaza_css           = true
--     rechaza_superpuestos  = true
--     locales_cumplen       = true
--     aroma                 = activo=true; frase=menos prisa, más aroma.
-- ---------------------------------------------------------------------

select
  (select string_agg(a.attname, ', ' order by a.attname) from pg_attribute a
    where a.attrelid = 'public.locales'::regclass and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update'))                as columnas_editables,
  has_table_privilege('authenticated', 'public.locales', 'update')                              as update_de_tabla,
  has_any_column_privilege('anon', 'public.locales', 'update')                                  as anon_puede_actualizar,
  (select count(*) from pg_trigger
    where tgrelid = 'public.locales'::regclass and tgname = 'locales_proteccion' and tgenabled <> 'D') as trigger_proteccion,
  (select count(*) from pg_constraint
    where contype = 'c' and conrelid = 'public.locales'::regclass
      and conname in ('locales_nombre_largo', 'locales_descripcion_largo', 'locales_direccion_largo',
                      'locales_whatsapp_valido', 'locales_instagram_valido', 'locales_logo_url_valido',
                      'locales_tema_valido', 'locales_horarios_validos', 'locales_aviso_texto_largo')) as limites,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and permissive = 'RESTRICTIVE'
      and policyname in ('imagenes_logo_alta', 'imagenes_logo_cambio', 'imagenes_logo_baja'))   as politicas_logo,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'locales')      as politicas_locales,
  not public.tema_valido('{"acento": "red; background:url(x)"}'::jsonb)                         as rechaza_css,
  not public.horarios_validos(
    '{"semana": {"lunes": [{"desde": "08:00", "hasta": "13:00"}, {"desde": "12:00", "hasta": "20:00"}]}}'::jsonb) as rechaza_superpuestos,
  (select bool_and(public.tema_valido(l.tema) and public.horarios_validos(l.horarios)) from public.locales l) as locales_cumplen,
  (select format('activo=%s; frase=%s', l.activo, l.tema ->> 'frase') from public.locales l where l.slug = 'aroma') as aroma;
