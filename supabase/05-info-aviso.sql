-- =====================================================================
-- OESTACK · Demo Premium · Tarea 5: información del local y aviso editable
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin problemas: las columnas se crean solo si faltan y
-- los datos de ejemplo del local "aroma" SOLO se cargan si el campo todavía tiene
-- el valor de ejemplo anterior (o está vacío), así que no pisa lo que ya hayas
-- reemplazado por los datos reales.
--
-- Permisos: NO cambia ninguno. La lectura anónima de public.locales está dada por
-- TABLA (grant select ... to anon en schema.sql), por eso las columnas nuevas ya
-- son legibles; y las políticas RLS siguen igual (solo locales activos para el
-- público; escribir, solo owners y admins).
--
-- Formato de la columna `horarios` (jsonb): ver "Formato de horarios" en el README.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Columnas del aviso
-- ---------------------------------------------------------------------

alter table public.locales add column if not exists aviso_texto  text;
alter table public.locales add column if not exists aviso_activo boolean not null default false;

-- El aviso es una franja fina: texto corto (máx. 200 caracteres).
alter table public.locales drop constraint if exists locales_aviso_texto_largo;
alter table public.locales
  add constraint locales_aviso_texto_largo
  check (aviso_texto is null or char_length(aviso_texto) <= 200);


-- ---------------------------------------------------------------------
-- 2. Datos de ejemplo CLARAMENTE FICTICIOS para el local "aroma"
-- ---------------------------------------------------------------------

-- Horarios: lunes a viernes de 8 a 20, sábados de 9 a 21 y domingos de 9 a 14.
-- (Solo si todavía no tiene el formato nuevo, es decir, no tiene la clave "semana".)
update public.locales
set horarios = '{
  "zona": "America/Argentina/Buenos_Aires",
  "semana": {
    "lunes":     [{ "desde": "08:00", "hasta": "20:00" }],
    "martes":    [{ "desde": "08:00", "hasta": "20:00" }],
    "miercoles": [{ "desde": "08:00", "hasta": "20:00" }],
    "jueves":    [{ "desde": "08:00", "hasta": "20:00" }],
    "viernes":   [{ "desde": "08:00", "hasta": "20:00" }],
    "sabado":    [{ "desde": "09:00", "hasta": "21:00" }],
    "domingo":   [{ "desde": "09:00", "hasta": "14:00" }]
  }
}'::jsonb
where slug = 'aroma'
  and (horarios -> 'semana') is null;

-- Dirección inventada.
update public.locales
set direccion = 'Av. Ejemplo 1234, Buenos Aires'
where slug = 'aroma'
  and (direccion is null or direccion = 'Av. de Mayo 1234, Buenos Aires');

-- TODO: REEMPLAZAR por el WhatsApp real antes de mostrar la demo.
-- El valor de ejemplo es un número claramente inválido (solo ceros): no llega a ninguna persona.
update public.locales
set whatsapp = 'TODO 00000000000'
where slug = 'aroma'
  and (whatsapp is null or whatsapp = '5491100000000');

-- TODO: REEMPLAZAR por el Instagram real antes de mostrar la demo.
-- El valor de ejemplo no es un usuario válido de Instagram (tiene guiones): el enlace no lleva a ninguna cuenta.
update public.locales
set instagram = 'TODO-reemplazar-instagram'
where slug = 'aroma'
  and (instagram is null or instagram = 'aroma.demo');

-- Aviso de ejemplo, DESACTIVADO por defecto (para verlo: aviso_activo = true).
update public.locales
set aviso_texto = 'Aviso de ejemplo: el sábado cerramos a las 18:00 por un evento privado.'
where slug = 'aroma'
  and aviso_texto is null;


-- ---------------------------------------------------------------------
-- 3. REEMPLAZAR TUS DATOS REALES (descomentá, completá y corré solo esto)
--    - whatsapp: número con código de país y sin signos. Argentina, celular: 549 + código de área + número
--      (ej. 5491155551234).
--    - instagram: el usuario, con o sin @ (ej. aroma.cafeteria), o la dirección completa del perfil.
-- ---------------------------------------------------------------------
--
-- update public.locales
-- set whatsapp  = '549XXXXXXXXXX',
--     instagram = 'tu.usuario'
-- where slug = 'aroma';
--
-- Para mostrar u ocultar el aviso:
-- update public.locales set aviso_activo = true  where slug = 'aroma';
-- update public.locales set aviso_activo = false where slug = 'aroma';


-- ---------------------------------------------------------------------
-- 4. Control
-- ---------------------------------------------------------------------

select slug, direccion, whatsapp, instagram, aviso_activo, aviso_texto,
       (horarios -> 'semana') is not null as horarios_con_formato_nuevo
from public.locales
where slug = 'aroma';
