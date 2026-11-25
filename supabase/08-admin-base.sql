-- =====================================================================
-- OESTACK · Demo Premium · Tarea 8: panel de administración (base y permisos)
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas.
--
-- ANTES DE CORRERLO hay que crear a mano 2 usuarios de prueba en
-- Authentication > Users (ver README, "Usuarios del panel") y pegar sus UUID en la
-- SECCIÓN 3 (están marcados con "PEGAR-AQUI"). Si quedan sin reemplazar, el script
-- se detiene con un mensaje claro y no se aplica nada.
--
-- Qué hace
--   1. Reserva el slug "login" (junto con "admin"): /admin/login es la pantalla de ingreso y
--      un local con ese slug sería inalcanzable en el panel (/admin/:slug).
--   2. Políticas RLS: NO agrega ni cambia ninguna (ver explicación abajo).
--   3. Memberships de prueba: usuario 1 = owner de "aroma"; usuario 2 = owner SOLO de
--      "local-prueba".
--   4. Crea un segundo local de prueba, INACTIVO, con una categoría y un producto.
--   5. Comentario con cómo agregar a OESTACK como admin.
--
-- Sobre las políticas (pedido: "si falta alguna política para que un usuario autenticado
-- pueda leer sus propias filas de usuarios_locales y admins, agregala"):
--   NO falta ninguna. schema.sql ya define, y siguen vigentes:
--     usuarios_locales_lectura_propia  select, authenticated:  user_id = auth.uid()
--     admins_lectura_propia            select, authenticated:  user_id = auth.uid()
--   Cada usuario ve solo SUS filas (el panel necesita saber su local y su rol) y nada más.
--   Escribir en ambas tablas sigue siendo solo de admins (usuarios_locales_admin) o,
--   en el caso de admins, de nadie por la API (solo desde el SQL Editor). La sección 6 lista
--   las políticas vigentes para que lo compruebes.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Slugs reservados: "admin" y "login"
--    (Si algún día cambia la pantalla de ingreso, hay que actualizar esta lista.)
-- ---------------------------------------------------------------------

alter table public.locales drop constraint if exists locales_slug_check;
alter table public.locales
  add constraint locales_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
         and char_length(slug) between 2 and 60
         and slug not in ('admin', 'login'));


-- ---------------------------------------------------------------------
-- 2. Segundo local de prueba: INACTIVO (no aparece en el sitio público)
--    Sirve para comprobar el aislamiento: el usuario de prueba 2 solo puede tocar este.
--    Datos claramente ficticios. Se puede volver a correr: no duplica nada.
-- ---------------------------------------------------------------------

insert into public.locales (slug, nombre, descripcion, activo)
values ('local-prueba', 'Local de prueba', 'Local ficticio e inactivo, solo para probar permisos del panel.', false)
on conflict (slug) do nothing;

-- Siempre inactivo, aunque alguien lo haya activado por error.
update public.locales set activo = false where slug = 'local-prueba';

insert into public.categorias (local_id, nombre, orden)
select l.id, 'Categoría de prueba', 1
from public.locales l
where l.slug = 'local-prueba'
  and not exists (select 1 from public.categorias c where c.local_id = l.id);

insert into public.productos (local_id, categoria_id, nombre, descripcion, precio, orden)
select c.local_id, c.id, 'Producto de prueba', 'Producto ficticio para probar permisos.', 1000, 1
from public.categorias c
join public.locales l on l.id = c.local_id
where l.slug = 'local-prueba'
  and not exists (select 1 from public.productos p where p.local_id = l.id);


-- ---------------------------------------------------------------------
-- 3. MEMBRESÍAS DE LOS USUARIOS DE PRUEBA
--
--    ⚠️  REEMPLAZAR los dos valores "PEGAR-AQUI..." por los UUID reales:
--        Authentication > Users > columna "User UID" de cada usuario.
--
--    usuario 1 -> owner de "aroma"
--    usuario 2 -> owner SOLO de "local-prueba" (no tiene nada que ver con aroma)
-- ---------------------------------------------------------------------

do $$
declare
  -- ⬇⬇⬇  REEMPLAZAR  ⬇⬇⬇
  v_usuario_1 text := 'PEGAR-AQUI-EL-UUID-DEL-USUARIO-1';
  v_usuario_2 text := 'PEGAR-AQUI-EL-UUID-DEL-USUARIO-2';
  -- ⬆⬆⬆  REEMPLAZAR  ⬆⬆⬆
  v_patron constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_aroma  uuid;
  v_prueba uuid;
begin
  if v_usuario_1 !~ v_patron or v_usuario_2 !~ v_patron then
    raise exception 'Falta reemplazar los UUID de los usuarios de prueba en la sección 3 de este script (buscá "PEGAR-AQUI"). No se aplicó nada.';
  end if;
  if v_usuario_1 = v_usuario_2 then
    raise exception 'El usuario 1 y el usuario 2 tienen que ser personas distintas (dos UUID diferentes).';
  end if;
  if not exists (select 1 from auth.users where id = v_usuario_1::uuid) then
    raise exception 'El UUID del usuario 1 no corresponde a ningún usuario de Authentication.';
  end if;
  if not exists (select 1 from auth.users where id = v_usuario_2::uuid) then
    raise exception 'El UUID del usuario 2 no corresponde a ningún usuario de Authentication.';
  end if;

  select id into v_aroma  from public.locales where slug = 'aroma';
  select id into v_prueba from public.locales where slug = 'local-prueba';
  if v_aroma is null then
    raise exception 'No existe el local "aroma" (corré antes supabase/schema.sql).';
  end if;

  insert into public.usuarios_locales (user_id, local_id, rol)
  values (v_usuario_1::uuid, v_aroma, 'owner')
  on conflict (user_id, local_id) do update set rol = excluded.rol;

  insert into public.usuarios_locales (user_id, local_id, rol)
  values (v_usuario_2::uuid, v_prueba, 'owner')
  on conflict (user_id, local_id) do update set rol = excluded.rol;

  -- Aislamiento: el usuario 1 no debe pertenecer al local de prueba, ni el 2 a aroma.
  -- (Si quedaron de una corrida anterior con otros UUID, no se tocan: se ven en el control.)
  delete from public.usuarios_locales where user_id = v_usuario_1::uuid and local_id = v_prueba;
  delete from public.usuarios_locales where user_id = v_usuario_2::uuid and local_id = v_aroma;
end $$;


-- ---------------------------------------------------------------------
-- 4. CÓMO AGREGAR A OESTACK COMO ADMIN (descomentá, poné tu email y corré solo esto)
--    Un admin ve y gestiona todos los locales, crea locales y asigna usuarios.
--    Tiene que existir antes el usuario en Authentication > Users.
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'TU-EMAIL@ejemplo.com'
-- on conflict (user_id) do nothing;
--
-- Para quitarlo:
-- delete from public.admins where user_id = (select id from auth.users where email = 'TU-EMAIL@ejemplo.com');
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 5. CÓMO DAR ACCESO A UN CLIENTE (plantilla; ver README, "Crear un usuario de cliente")
--
-- insert into public.usuarios_locales (user_id, local_id, rol)
-- select u.id, l.id, 'owner'                      -- o 'editor'
-- from auth.users u, public.locales l
-- where u.email = 'cliente@ejemplo.com' and l.slug = 'el-slug-del-local'
-- on conflict (user_id, local_id) do update set rol = excluded.rol;
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 6. CONTROLES
-- ---------------------------------------------------------------------

-- a) Quién pertenece a qué local (debe haber 1 fila de aroma y 1 de local-prueba, con personas distintas):
select l.slug, l.activo as local_activo, u.email, ul.rol
from public.usuarios_locales ul
join public.locales l on l.id = ul.local_id
join auth.users u on u.id = ul.user_id
order by l.slug, u.email;

-- b) El local de prueba: inactivo, con 1 categoría y 1 producto.
select l.slug, l.activo,
       (select count(*) from public.categorias c where c.local_id = l.id) as categorias,
       (select count(*) from public.productos p where p.local_id = l.id) as productos
from public.locales l
where l.slug in ('aroma', 'local-prueba')
order by l.slug;

-- c) Políticas vigentes de las dos tablas de permisos (no se tocaron):
--    usuarios_locales: lectura propia (select) + gestión solo de admins (all)
--    admins:           solo lectura propia (select)
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('usuarios_locales', 'admins')
order by tablename, policyname;
