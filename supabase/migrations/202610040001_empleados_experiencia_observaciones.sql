-- ==============================================================================
-- Migración: Columnas de Experiencia y Observaciones en Empleados
-- ==============================================================================

ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS observaciones text,
  ADD COLUMN IF NOT EXISTS experiencia text;
