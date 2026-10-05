-- ==============================================================================
-- Migración: Habilitar acceso RLS y tabla recargas_celular
-- ==============================================================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.recargas_celular (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saldo_id uuid NOT NULL REFERENCES public.saldos(id) ON DELETE CASCADE,
  monto numeric NOT NULL,
  fecha date NOT NULL,
  mes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Asegurar que las políticas RLS permitan lectura y escritura tanto para usuarios autenticados como anon
ALTER TABLE public.recargas_celular ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recargas_celular_access_all" ON public.recargas_celular;
CREATE POLICY "recargas_celular_access_all"
  ON public.recargas_celular
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Índices para acelerar el filtrado de recargas por saldo y por mes
CREATE INDEX IF NOT EXISTS recargas_celular_saldo_id_idx ON public.recargas_celular (saldo_id);
CREATE INDEX IF NOT EXISTS recargas_celular_mes_idx ON public.recargas_celular (mes);
