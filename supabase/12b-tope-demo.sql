-- =====================================================================
-- OESTACK · Demo Premium · Tarea 12b: tope de archivos en la carpeta de la demo
--
-- Pegar COMPLETO en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas. No modifica datos ni archivos.
-- No cambia tablas, políticas RLS ni permisos.
--
-- Por qué: la cuenta demo es pública y es dueña de "aroma". El bucket limita el peso y el tipo
-- de cada archivo, pero no cuántos se pueden subir, y el almacenamiento es de todo el proyecto.
--
-- Qué hace: no deja que la carpeta de "aroma" en el bucket "imagenes" tenga más de 60 archivos
-- (una foto de producto son 2 archivos; el logo, 1). Las demás carpetas no cambian.
--
-- Por qué un trigger y no una política: Storage comprueba los permisos con una escritura de
-- prueba que después deshace, y guarda la fila con un usuario que saltea el RLS; además, varias
-- subidas a la vez podrían pasar juntas una política que cuente. El trigger corre sobre la
-- escritura real, sea quien sea que la haga, y un bloqueo por carpeta las pone en fila.
-- Vale para todos, también para un admin y para los scripts.
--
-- PARA SACARLO (no hace falta ser dueño de storage.objects: se borra la función y con ella
-- el trigger):
--   drop function public.tope_carpeta_demo() cascade;
-- =====================================================================


create or replace function public.tope_carpeta_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_tope constant integer := 60;
  v_carpeta text;
  v_total   integer;
begin
  -- Primero se descarta todo lo que no es de la demo: las demás subidas no se tocan.
  if new.bucket_id is distinct from 'imagenes' then
    return new;
  end if;
  select l.id::text into v_carpeta from public.locales l where l.slug = 'aroma';
  if v_carpeta is null or split_part(new.name, '/', 1) <> v_carpeta then
    return new;
  end if;

  -- Cambios de un archivo que ya estaba en la carpeta: no suman.
  if tg_op = 'UPDATE' then
    if old.bucket_id = new.bucket_id and split_part(old.name, '/', 1) = v_carpeta then
      return new;
    end if;
  end if;

  -- De a uno por vez (hasta que termina la transacción): dos subidas a la vez no pueden
  -- contar lo mismo y pasar las dos.
  perform pg_advisory_xact_lock(hashtextextended('tope-demo:' || v_carpeta, 0));

  -- Reemplazar un archivo que ya existe tampoco suma.
  if tg_op = 'INSERT' then
    if exists (select 1 from storage.objects o where o.bucket_id = new.bucket_id and o.name = new.name) then
      return new;
    end if;
  end if;

  select count(*) into v_total
    from storage.objects o
   where o.bucket_id = 'imagenes' and starts_with(o.name, v_carpeta || '/');

  if v_total >= c_tope then
    raise exception 'La carpeta de la demo llegó al máximo de % archivos. Se libera con el próximo reinicio.', c_tope
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- No es una función para llamar: solo la usa el trigger.
revoke all on function public.tope_carpeta_demo() from public, anon, authenticated;

-- "or replace" (y no "drop"): borrar un trigger exige ser dueño de la tabla.
create or replace trigger tope_carpeta_demo
  before insert or update of bucket_id, name on storage.objects
  for each row execute function public.tope_carpeta_demo();


-- ---------------------------------------------------------------------
-- CONTROL (el SQL Editor muestra solo este último resultado)
--   Tiene que dar UNA fila con:
--     trigger_activo         = 1
--     antes_de_alta_y_cambio = true
--     funcion_definer        = true
--     tope                   = 60
--     se_puede_llamar        = false
--     politicas_storage      = 4
--     politicas_locales      = 5
--     archivos_en_aroma      = 0
-- ---------------------------------------------------------------------

select
  (select count(*) from pg_trigger t
    where t.tgrelid = 'storage.objects'::regclass and t.tgname = 'tope_carpeta_demo' and t.tgenabled <> 'D') as trigger_activo,
  -- tgtype: 1 = por fila, 2 = antes, 4 = alta, 16 = cambio
  (select t.tgtype & 23 = 23 from pg_trigger t
    where t.tgrelid = 'storage.objects'::regclass and t.tgname = 'tope_carpeta_demo')                       as antes_de_alta_y_cambio,
  (select p.prosecdef from pg_proc p where p.oid = 'public.tope_carpeta_demo()'::regprocedure)              as funcion_definer,
  (select (regexp_match(p.prosrc, 'c_tope constant integer := ([0-9]+)'))[1]::integer
     from pg_proc p where p.oid = 'public.tope_carpeta_demo()'::regprocedure)                               as tope,
  (has_function_privilege('anon', 'public.tope_carpeta_demo()', 'execute')
   or has_function_privilege('authenticated', 'public.tope_carpeta_demo()', 'execute'))                     as se_puede_llamar,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects')                  as politicas_storage,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'locales')                   as politicas_locales,
  (select count(*) from storage.objects o
    where o.bucket_id = 'imagenes'
      and starts_with(o.name, (select l.id::text from public.locales l where l.slug = 'aroma') || '/'))      as archivos_en_aroma;
