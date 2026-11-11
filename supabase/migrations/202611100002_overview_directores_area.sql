-- Habilita el acceso al módulo Overview para los roles de dirección
-- (Director de Recursos Humanos, Director de Finanzas, Director de Supervisiones / Operativo y Director General)
-- respetando cualquier deshabilitación explícita previa (overview.view = false).

UPDATE public.roles
SET permisos = jsonb_set(
  COALESCE(permisos, '{}'::jsonb),
  '{overview}',
  '{"view": true}'::jsonb,
  true
)
WHERE LOWER(COALESCE(nombre, '')) LIKE '%director%'
  AND (permisos->'overview'->>'view') IS DISTINCT FROM 'false';
