-- ==============================================================================
-- Migración: Soporte para Exclusión Global de Facturas
-- ==============================================================================

ALTER TABLE public.cobros
  ADD COLUMN IF NOT EXISTS excluida boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS cobros_excluida_idx ON public.cobros (excluida);
