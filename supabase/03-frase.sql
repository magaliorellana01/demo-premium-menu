-- =====================================================================
-- OESTACK · Demo Premium · Tarea 3: frase de tono del local "aroma"
--
-- Pegar en Supabase > SQL Editor > New query > Run. Se puede correr más de
-- una vez. No cambia el esquema ni las políticas: solo agrega una clave "frase"
-- al jsonb `tema` (el resto de `tema` se conserva). Si un local no tiene frase,
-- el encabezado simplemente no la muestra.
-- =====================================================================

update public.locales
set tema = tema || '{"frase": "menos prisa, más aroma."}'::jsonb
where slug = 'aroma';

select slug, tema from public.locales where slug = 'aroma';
