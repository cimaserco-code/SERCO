-- ==============================================================================
-- Migración: Soporte para Nombre de Constancia y Método de Pago en Servicios y Cobros
-- ==============================================================================

-- 1. Agregar columnas a la tabla servicios
ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS nombre_constancia text,
  ADD COLUMN IF NOT EXISTS metodo_pago text DEFAULT 'transferencia';

-- 2. Agregar columnas a la tabla cobros
ALTER TABLE public.cobros
  ADD COLUMN IF NOT EXISTS nombre_constancia text,
  ADD COLUMN IF NOT EXISTS metodo_pago text DEFAULT 'transferencia';

-- 3. Índices para agilizar consultas
CREATE INDEX IF NOT EXISTS servicios_nombre_constancia_idx ON public.servicios (nombre_constancia);
CREATE INDEX IF NOT EXISTS cobros_nombre_constancia_idx ON public.cobros (nombre_constancia);
