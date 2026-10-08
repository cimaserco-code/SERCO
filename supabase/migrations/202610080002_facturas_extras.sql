-- ==============================================================================
-- Migración: Tabla para Facturas Extras (Cargos Independientes por Servicio)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.facturas_extras (
  id text PRIMARY KEY,
  servicio_id uuid REFERENCES public.servicios(id) ON DELETE CASCADE,
  servicio_nombre text,
  sede_id uuid,
  cobro_id uuid,
  mes text,
  concepto text NOT NULL,
  monto_base numeric NOT NULL DEFAULT 0,
  calcular_iva boolean NOT NULL DEFAULT true,
  iva numeric NOT NULL DEFAULT 0,
  monto_total numeric NOT NULL DEFAULT 0,
  fecha text,
  estado text NOT NULL DEFAULT 'pendiente',
  fecha_pago text,
  metodo_pago text DEFAULT 'transferencia',
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para agilizar consultas
CREATE INDEX IF NOT EXISTS facturas_extras_servicio_id_idx ON public.facturas_extras (servicio_id);
CREATE INDEX IF NOT EXISTS facturas_extras_mes_idx ON public.facturas_extras (mes);
CREATE INDEX IF NOT EXISTS facturas_extras_estado_idx ON public.facturas_extras (estado);

-- Seguridad RLS
ALTER TABLE public.facturas_extras ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.facturas_extras TO anon, authenticated;

DROP POLICY IF EXISTS "facturas_extras_full_access" ON public.facturas_extras;
CREATE POLICY "facturas_extras_full_access"
  ON public.facturas_extras
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
