-- Agrega permisos de actualizar contraseñas (por olvido) y eliminar usuarios internos
-- al rol de Coordinador Administrativo (y Admin/Administrador Total si existen en la tabla).
-- Nota: Los usuarios cliente no se eliminan manualmente; se autoeliminan al dar de baja un servicio.

UPDATE public.roles
SET permisos = jsonb_set(
  COALESCE(permisos, '{}'::jsonb),
  '{usuarios}',
  COALESCE(permisos->'usuarios', '{"view": true, "create": true, "edit": true}'::jsonb)
    || '{"delete": true, "reset_password": true}'::jsonb,
  true
)
WHERE LOWER(COALESCE(nombre, '')) LIKE '%coordinador%'
   OR LOWER(TRIM(COALESCE(nombre, ''))) IN (
     'admin',
     'administrador',
     'administrador total',
     'super administrador'
   );
