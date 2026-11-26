-- =====================================================================
-- OESTACK · Demo Premium · Tarea 12: alta de clientes y vista de clientes
--
-- Pegar COMPLETO en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas. No modifica datos de ninguna fila.
-- No cambia políticas RLS, ni permisos de "anon" o "authenticated".
--
-- Qué hace
--   1. Reserva los slugs "clientes" y "cuenta" (además de "admin" y "login"): son rutas del
--      panel y un local con ese nombre no se podría abrir. Antes comprueba que ningún local
--      los use; si alguno los usa, se detiene y no aplica NADA.
--   2. Le asegura a "service_role" (la clave secreta, que SOLO usan los scripts que se corren
--      en la computadora de OESTACK) los permisos sobre las tablas. Supabase los da por defecto;
--      acá quedan escritos para que el alta no dependa de eso. La clave secreta ya saltea el
--      RLS: esto no le da nada a quien use el sitio.
--
-- La vista de clientes no necesita ninguna función: usa una sola consulta con conteos, que
-- respeta el RLS como cualquier otra.
--
-- OJO: si se vuelve a correr supabase/08-admin-base.sql, la lista de reservados vuelve a ser
-- solo "admin" y "login": correr este script después.
--
-- CONSULTA DE VERIFICACIÓN (opcional, para mirar antes de correr; tiene que venir vacía):
--
--   select slug, nombre from public.locales where slug in ('admin', 'login', 'clientes', 'cuenta');
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Slugs reservados
-- ---------------------------------------------------------------------

do $$
declare
  v_usados text;
begin
  select string_agg(format('"%s" (%s)', slug, nombre), ', ' order by slug)
  into v_usados
  from public.locales
  where slug in ('admin', 'login', 'clientes', 'cuenta');

  if v_usados is not null then
    raise exception 'Hay locales que usan un nombre reservado: %. No se aplicó nada.', v_usados;
  end if;
end $$;

alter table public.locales drop constraint if exists locales_slug_check;
alter table public.locales
  add constraint locales_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
         and char_length(slug) between 2 and 60
         and slug not in ('admin', 'login', 'clientes', 'cuenta'));


-- ---------------------------------------------------------------------
-- 2. Permisos de los scripts locales (clave secreta = rol service_role)
-- ---------------------------------------------------------------------

grant usage on schema public to service_role;
grant select, insert, update, delete
  on public.locales, public.categorias, public.productos, public.usuarios_locales, public.admins
  to service_role;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- CONTROL (el SQL Editor muestra solo este último resultado)
--   Tiene que dar UNA fila con:
--     reserva_clientes_y_cuenta  = true
--     locales_con_reservados     = 0
--     scripts_pueden             = true
--     anon_no_lee_permisos       = true
--     panel_no_escribe_admins    = true
--     politicas_locales          = 5
--     columnas_editables         = 11
--     aroma                      = activo=true; slug=aroma
-- ---------------------------------------------------------------------

select
  (select pg_get_constraintdef(c.oid) like '%clientes%' and pg_get_constraintdef(c.oid) like '%cuenta%'
     from pg_constraint c
    where c.conrelid = 'public.locales'::regclass and c.conname = 'locales_slug_check')       as reserva_clientes_y_cuenta,
  (select count(*) from public.locales where slug in ('admin', 'login', 'clientes', 'cuenta')) as locales_con_reservados,
  (select bool_and(has_table_privilege('service_role', t, p))
     from unnest(array['public.locales', 'public.categorias', 'public.productos',
                       'public.usuarios_locales', 'public.admins']) as t,
          unnest(array['select', 'insert', 'update', 'delete']) as p)                         as scripts_pueden,
  not (has_table_privilege('anon', 'public.admins', 'select')
       or has_table_privilege('anon', 'public.usuarios_locales', 'select'))                   as anon_no_lee_permisos,
  not (has_table_privilege('authenticated', 'public.admins', 'insert')
       or has_table_privilege('authenticated', 'public.admins', 'update')
       or has_table_privilege('authenticated', 'public.admins', 'delete'))                    as panel_no_escribe_admins,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'locales')    as politicas_locales,
  (select count(*) from pg_attribute a
    where a.attrelid = 'public.locales'::regclass and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update'))              as columnas_editables,
  (select format('activo=%s; slug=%s', l.activo, l.slug) from public.locales l where l.slug = 'aroma') as aroma;
