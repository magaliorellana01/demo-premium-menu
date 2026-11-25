-- =====================================================================
-- OESTACK · Demo Premium · Tarea 9: reordenar categorías de forma atómica
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas. No modifica tablas, datos ni políticas RLS:
-- solo crea UNA función y da permiso para ejecutarla a los usuarios con sesión.
--
-- ¿Por qué una función?
--   Reordenar son varios UPDATE (uno por categoría). Hechos desde el panel, si uno
--   falla (red, sesión vencida) quedarían órdenes repetidos o a medias. Dentro de una
--   función es UNA sola transacción: o se aplica todo o nada.
--
-- Seguridad
--   * SECURITY INVOKER (lo normal): corre con los permisos de QUIEN LA LLAMA, así que
--     el RLS de categorias sigue valiendo. No saltea nada.
--   * Además comprueba explícitamente es_admin() o es_miembro(local) y falla con un
--     error claro (en vez de "no pasó nada").
--   * Exige que la lista sea EXACTAMENTE el conjunto de categorías de ese local (sin
--     faltantes, sin repetidas y sin ids de otro local).
--   * Bloquea las filas mientras reordena (dos personas a la vez no se mezclan).
--   * search_path vacío (todo calificado con esquema).
--   * Solo "authenticated" puede ejecutarla; el público y los anónimos, no.
-- =====================================================================

create or replace function public.reordenar_categorias(p_local_id uuid, p_ids uuid[])
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
    raise exception 'No tenés permiso para ordenar las categorías de este local.' using errcode = '42501';
  end if;

  -- Bloquea las categorías del local hasta terminar la transacción.
  perform 1 from public.categorias where local_id = p_local_id order by id for update;

  select count(*) into v_total from public.categorias where local_id = p_local_id;

  if p_ids is null
     or cardinality(p_ids) <> v_total
     or (select count(distinct x) from unnest(p_ids) as x) <> cardinality(p_ids)
     or exists (
          select 1 from unnest(p_ids) as x
          where not exists (select 1 from public.categorias c where c.id = x and c.local_id = p_local_id)
        )
  then
    raise exception 'La lista de categorías cambió. Recargá la página y probá de nuevo.' using errcode = '22023';
  end if;

  -- La posición en la lista pasa a ser el orden (1, 2, 3...).
  update public.categorias c
  set orden = t.posicion
  from unnest(p_ids) with ordinality as t(id, posicion)
  where c.id = t.id and c.local_id = p_local_id;

  get diagnostics v_actualizadas = row_count;
  if v_actualizadas <> v_total then
    raise exception 'No se pudo guardar el orden completo.' using errcode = '42501';
  end if;
end;
$$;

-- Permisos mínimos: se parte de cero y se otorga solo a usuarios con sesión.
revoke all on function public.reordenar_categorias(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reordenar_categorias(uuid, uuid[]) to authenticated;

-- Que la API vea la función nueva enseguida.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- CONTROL
--   Debe dar UNA fila:
--     security_definer = false   (es SECURITY INVOKER)
--     anon_puede       = false
--     con_sesion_puede = true
-- ---------------------------------------------------------------------

select p.proname                                                                      as funcion,
       p.prosecdef                                                                    as security_definer,
       has_function_privilege('anon', p.oid, 'execute')                               as anon_puede,
       has_function_privilege('authenticated', p.oid, 'execute')                      as con_sesion_puede
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reordenar_categorias';
