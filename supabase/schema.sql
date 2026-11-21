-- =====================================================================
-- OESTACK · Demo Premium · Esquema de Supabase (multi-tenant)
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin romper nada (es idempotente), salvo que las
-- tablas ya tengan datos reales: los datos de ejemplo solo se cargan si el
-- local "aroma" no existe.
--
-- Resumen de seguridad
--   * RLS activado en TODAS las tablas.
--   * Anónimos: solo lectura de locales activos, de sus categorías activas y de
--     TODOS sus productos (también los no disponibles: la interfaz los atenúa).
--   * Escritura: solo usuarios autenticados que pertenecen al local
--     (usuarios_locales) y los admins de OESTACK (tabla admins).
--   * Storage: bucket público de lectura; escritura solo en la carpeta del
--     propio local (<local_id>/...).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

create table if not exists public.locales (
  id          uuid primary key default gen_random_uuid(),
  -- Va en la URL (/:slug). "admin" está reservado para el panel (/admin).
  slug        text not null unique
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                     and char_length(slug) between 2 and 60
                     and slug <> 'admin'),
  nombre      text not null check (char_length(btrim(nombre)) > 0),
  descripcion text,
  logo_url    text,
  -- Colores que sobrescriben los de la marca. Ej: {"acento": "#b6784f"}
  tema        jsonb not null default '{}'::jsonb,
  whatsapp    text,
  instagram   text,
  direccion   text,
  -- Ej: {"Lunes a viernes": "8 a 20 h", "Sábados y domingos": "9 a 21 h"}
  horarios    jsonb not null default '{}'::jsonb,
  activo      boolean not null default true
);

create table if not exists public.categorias (
  id       uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales (id) on delete cascade,
  nombre   text not null check (char_length(btrim(nombre)) > 0),
  orden    integer not null default 0,
  activa   boolean not null default true,
  -- Necesario para la clave foránea compuesta de productos (ver abajo).
  unique (id, local_id)
);

create table if not exists public.productos (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references public.locales (id) on delete cascade,
  categoria_id uuid not null,
  nombre       text not null check (char_length(btrim(nombre)) > 0),
  descripcion  text,
  precio       numeric(10, 2) not null check (precio >= 0), -- ARS
  imagen_url   text,
  destacado    boolean not null default false,
  disponible   boolean not null default true,
  etiquetas    text[] not null default '{}',
  orden        integer not null default 0,
  -- Coherencia: la categoría tiene que ser del MISMO local que el producto.
  -- (Una FK compuesta lo garantiza sin triggers.) Sin "on delete cascade" a
  -- propósito: no se puede borrar una categoría que todavía tiene productos.
  foreign key (categoria_id, local_id)
    references public.categorias (id, local_id)
);

create table if not exists public.usuarios_locales (
  user_id  uuid not null references auth.users (id) on delete cascade,
  local_id uuid not null references public.locales (id) on delete cascade,
  rol      text not null check (rol in ('owner', 'editor')),
  primary key (user_id, local_id)
);

-- Superusuarios de OESTACK. Se administra desde el SQL Editor (ver el final).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Índices (slug ya tiene uno por ser unique; las PK también)
create index if not exists categorias_local_orden_idx on public.categorias (local_id, orden);
create index if not exists productos_local_idx        on public.productos (local_id);
create index if not exists productos_categoria_idx    on public.productos (categoria_id, orden);
create index if not exists usuarios_locales_local_idx on public.usuarios_locales (local_id);


-- ---------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES PARA LAS POLÍTICAS
--    SECURITY DEFINER: leen usuarios_locales/admins saltando el RLS, así las
--    políticas no se vuelven recursivas. Por eso van con search_path vacío
--    (todo calificado con esquema) y con permisos de ejecución mínimos.
-- ---------------------------------------------------------------------

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create or replace function public.es_miembro(p_local_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios_locales
    where user_id = (select auth.uid()) and local_id = p_local_id
  );
$$;

create or replace function public.es_owner(p_local_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios_locales
    where user_id = (select auth.uid()) and local_id = p_local_id and rol = 'owner'
  );
$$;

-- Solo usuarios autenticados pueden ejecutarlas (anon y público, no).
revoke all on function public.es_admin()          from public, anon, authenticated;
revoke all on function public.es_miembro(uuid)    from public, anon, authenticated;
revoke all on function public.es_owner(uuid)      from public, anon, authenticated;
grant execute on function public.es_admin()       to authenticated;
grant execute on function public.es_miembro(uuid) to authenticated;
grant execute on function public.es_owner(uuid)   to authenticated;


-- ---------------------------------------------------------------------
-- 3. PERMISOS DE TABLA (primera barrera) + RLS (segunda barrera)
--    Se parte de cero y se otorga solo lo necesario, así no dependemos de los
--    permisos por defecto de Supabase.
-- ---------------------------------------------------------------------

revoke all on public.locales, public.categorias, public.productos,
              public.usuarios_locales, public.admins
  from anon, authenticated;

-- Anónimos: solo leer el menú. Nada de usuarios_locales ni admins.
grant select on public.locales, public.categorias, public.productos to anon;

-- Autenticados: el RLS decide qué filas puede tocar cada uno.
grant select, insert, update, delete on public.locales, public.categorias,
                                         public.productos, public.usuarios_locales
  to authenticated;
grant select on public.admins to authenticated;

alter table public.locales          enable row level security;
alter table public.categorias       enable row level security;
alter table public.productos        enable row level security;
alter table public.usuarios_locales enable row level security;
alter table public.admins           enable row level security;


-- ---------------------------------------------------------------------
-- 4. POLÍTICAS
-- ---------------------------------------------------------------------

-- ── locales ──────────────────────────────────────────────────────────
drop policy if exists locales_lectura_publica   on public.locales;
drop policy if exists locales_lectura_miembros  on public.locales;
drop policy if exists locales_alta_admin        on public.locales;
drop policy if exists locales_edicion           on public.locales;
drop policy if exists locales_baja_admin        on public.locales;

-- Público: solo locales activos.
create policy locales_lectura_publica on public.locales
  for select to anon, authenticated
  using (activo);

-- Miembros y admins ven su local aunque esté inactivo (para el panel).
create policy locales_lectura_miembros on public.locales
  for select to authenticated
  using (public.es_admin() or public.es_miembro(id));

-- Crear y borrar locales: solo OESTACK.
create policy locales_alta_admin on public.locales
  for insert to authenticated
  with check (public.es_admin());

create policy locales_baja_admin on public.locales
  for delete to authenticated
  using (public.es_admin());

-- Editar los datos del local: admins y owners (los editors no).
create policy locales_edicion on public.locales
  for update to authenticated
  using (public.es_admin() or public.es_owner(id))
  with check (public.es_admin() or public.es_owner(id));

-- ── categorias ───────────────────────────────────────────────────────
drop policy if exists categorias_lectura_publica on public.categorias;
drop policy if exists categorias_gestion         on public.categorias;

-- Público: categorías activas de locales activos.
create policy categorias_lectura_publica on public.categorias
  for select to anon, authenticated
  using (
    activa
    and exists (select 1 from public.locales l where l.id = categorias.local_id and l.activo)
  );

-- Miembros y admins: leer y escribir todo lo de su local (también lo inactivo).
create policy categorias_gestion on public.categorias
  for all to authenticated
  using (public.es_admin() or public.es_miembro(local_id))
  with check (public.es_admin() or public.es_miembro(local_id));

-- ── productos ────────────────────────────────────────────────────────
drop policy if exists productos_lectura_publica on public.productos;
drop policy if exists productos_gestion         on public.productos;

-- Público: TODOS los productos (incluso disponible = false) mientras su
-- categoría esté activa y su local activo. Lo "no disponible" lo muestra la
-- interfaz atenuado; la política no lo oculta.
create policy productos_lectura_publica on public.productos
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.categorias c
      join public.locales l on l.id = c.local_id
      where c.id = productos.categoria_id and c.activa and l.activo
    )
  );

create policy productos_gestion on public.productos
  for all to authenticated
  using (public.es_admin() or public.es_miembro(local_id))
  with check (public.es_admin() or public.es_miembro(local_id));

-- ── usuarios_locales ─────────────────────────────────────────────────
drop policy if exists usuarios_locales_lectura_propia on public.usuarios_locales;
drop policy if exists usuarios_locales_admin          on public.usuarios_locales;

-- Cada usuario ve sus propias membresías (el panel necesita saber su local).
create policy usuarios_locales_lectura_propia on public.usuarios_locales
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Asignar usuarios a locales: solo OESTACK.
create policy usuarios_locales_admin on public.usuarios_locales
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ── admins ───────────────────────────────────────────────────────────
drop policy if exists admins_lectura_propia on public.admins;

-- Cada usuario puede saber si él mismo es admin. Nadie escribe por la API:
-- los admins se cargan desde el SQL Editor.
create policy admins_lectura_propia on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 5. STORAGE: bucket "imagenes" (productos y logos)
--    Convención de rutas: <local_id>/productos/<archivo>  y  <local_id>/logo.<ext>
-- ---------------------------------------------------------------------

-- Público: cualquiera puede VER las imágenes por su URL. Solo webp, jpeg y png,
-- máximo 2 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No hay política de lectura para anónimos: las URLs públicas funcionan igual,
-- pero nadie anónimo puede listar ni explorar el bucket.

drop policy if exists imagenes_gestion_miembros on storage.objects;

-- Subir, reemplazar y borrar: solo admins y miembros del local dueño de la
-- carpeta (el primer tramo de la ruta es el local_id).
create policy imagenes_gestion_miembros on storage.objects
  for all to authenticated
  using (
    bucket_id = 'imagenes'
    and (
      public.es_admin()
      or (storage.foldername(name))[1] in (
        select ul.local_id::text from public.usuarios_locales ul
        where ul.user_id = (select auth.uid())
      )
    )
  )
  with check (
    bucket_id = 'imagenes'
    and (
      public.es_admin()
      or (storage.foldername(name))[1] in (
        select ul.local_id::text from public.usuarios_locales ul
        where ul.user_id = (select auth.uid())
      )
    )
  );


-- ---------------------------------------------------------------------
-- 6. DATOS DE EJEMPLO: local demo "Aroma" (cafetería ficticia)
--    Sin imágenes todavía (imagen_url y logo_url quedan en null).
-- ---------------------------------------------------------------------

do $$
declare
  v_local   uuid;
  v_cafes   uuid;
  v_postres uuid;
  v_jugos   uuid;
begin
  if exists (select 1 from public.locales where slug = 'aroma') then
    return; -- ya cargado
  end if;

  insert into public.locales (slug, nombre, descripcion, tema, whatsapp, instagram, direccion, horarios, activo)
  values (
    'aroma',
    'Aroma',
    'Cafetería de especialidad. Un café, un ritual.',
    '{}'::jsonb,
    '5491100000000',
    'aroma.demo',
    'Av. de Mayo 1234, Buenos Aires',
    '{"Lunes a viernes": "8 a 20 h", "Sábados y domingos": "9 a 21 h"}'::jsonb,
    true
  )
  returning id into v_local;

  insert into public.categorias (local_id, nombre, orden) values (v_local, 'Cafés', 1)
    returning id into v_cafes;
  insert into public.categorias (local_id, nombre, orden) values (v_local, 'Postres', 2)
    returning id into v_postres;
  insert into public.categorias (local_id, nombre, orden) values (v_local, 'Jugos y licuados', 3)
    returning id into v_jugos;

  insert into public.productos
    (local_id, categoria_id, nombre, descripcion, precio, destacado, disponible, etiquetas, orden)
  values
    -- Cafés
    (v_local, v_cafes, 'Espresso',               'Café de origen único, corto e intenso.',                    3200, false, true,  '{}',        1),
    (v_local, v_cafes, 'Capuchino',              'Espresso doble con leche texturizada y espuma cremosa.',    4800, true,  true,  '{}',        2),
    (v_local, v_cafes, 'Latte artesanal',        'Espresso con leche vaporizada y arte en la espuma.',        5200, false, true,  '{}',        3),
    (v_local, v_cafes, 'Latte en vaso',          'Leche, espresso y espuma en capas, servido en vaso.',       5400, false, true,  '{}',        4),
    (v_local, v_cafes, 'Moca',                   'Espresso, chocolate y leche vaporizada con cacao.',         5600, false, true,  '{}',        5),
    (v_local, v_cafes, 'Café frío con leche',    'Café de filtro helado con leche y hielo.',                  5800, false, true,  '{nuevo}',   6),
    -- Postres
    (v_local, v_postres, 'Croissant',            'De manteca, horneado todos los días.',                      3600, false, true,  '{}',        1),
    (v_local, v_postres, 'Croissant de chocolate', 'Masa hojaldrada con barra de chocolate semiamargo.',      4200, false, true,  '{}',        2),
    (v_local, v_postres, 'Carrot cake',          'Bizcocho de zanahoria y nueces con crema de queso.',        6200, false, true,  '{}',        3),
    (v_local, v_postres, 'Cheesecake de frutos rojos', 'Base de galleta, crema suave y salsa de frutos rojos.', 6800, true,  true,  '{}',        4),
    (v_local, v_postres, 'Torta de chocolate',   'Bizcocho húmedo con relleno y cobertura de ganache.',       6500, false, true,  '{}',        5),
    (v_local, v_postres, 'Tartaleta de frutas',  'Masa sablée, crema pastelera y frutas frescas.',            5900, false, false, '{}',        6),
    -- Jugos y licuados
    (v_local, v_jugos, 'Limonada con menta',     'Limón exprimido, menta fresca y hielo.',                    4800, false, true,  '{}',        1),
    (v_local, v_jugos, 'Jugo de naranja',        'Exprimido en el momento.',                                  4500, false, true,  '{}',        2),
    (v_local, v_jugos, 'Mango y maracuyá',       'Pulpa de fruta, hielo y un toque de menta.',                5200, true,  true,  '{}',        3),
    (v_local, v_jugos, 'Sandía, lima y menta',   'Refrescante, con hielo y lima.',                            5000, false, true,  '{}',        4),
    (v_local, v_jugos, 'Licuado de frutilla y frutos rojos', 'Frutilla, arándanos y frambuesas licuados.',    5800, false, true,  '{}',        5),
    (v_local, v_jugos, 'Licuado verde',          'Manzana, pepino y espinaca.',                               5800, false, true,  '{}',        6);
end $$;


-- ---------------------------------------------------------------------
-- 7. USUARIOS (manual, después de crearlos en Authentication > Users)
--    Se completa más adelante, con el panel (Tarea 4). Ejemplos:
--
--    -- Hacer admin de OESTACK a un usuario:
--    -- insert into public.admins (user_id) values ('<uuid-del-usuario>');
--
--    -- Dar acceso a un usuario al local Aroma como dueño:
--    -- insert into public.usuarios_locales (user_id, local_id, rol)
--    -- select '<uuid-del-usuario>', id, 'owner' from public.locales where slug = 'aroma';
-- ---------------------------------------------------------------------
