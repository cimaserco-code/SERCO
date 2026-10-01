-- ==============================================================================
-- Migración: Soporte para Reportes y Evidencias Fotográficas en Agenda
-- ==============================================================================

-- 1. Agregar columnas necesarias a la tabla agenda
ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS tipo_reporte text,
  ADD COLUMN IF NOT EXISTS descripcion_reporte text,
  ADD COLUMN IF NOT EXISTS fotos_evidencia jsonb DEFAULT '[]'::jsonb;

-- 2. Índices para acelerar consultas y filtrado
CREATE INDEX IF NOT EXISTS agenda_tipo_idx ON public.agenda (tipo);
CREATE INDEX IF NOT EXISTS agenda_servicio_id_idx ON public.agenda (servicio_id);
CREATE INDEX IF NOT EXISTS agenda_responsable_id_idx ON public.agenda (responsable_id);
