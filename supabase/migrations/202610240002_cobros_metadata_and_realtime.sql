-- ==============================================================================
-- SERCO: Sincronización Global de Facturación y Servicios en Tiempo Real
-- ==============================================================================

-- 1. Tabla 'cobros': Soporte para exclusiones globales y metadata (IVA, quincenas, costos, pagos parciales)
ALTER TABLE public.cobros
  ADD COLUMN IF NOT EXISTS excluida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Tabla 'servicios': Soporte para método de pago, constancia y contactos secundarios
ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS nombre_constancia text,
  ADD COLUMN IF NOT EXISTS metodo_pago text DEFAULT 'transferencia',
  ADD COLUMN IF NOT EXISTS telefono_2 text,
  ADD COLUMN IF NOT EXISTS correo_2 text;

-- 3. Permisos y seguridad
GRANT ALL ON public.cobros TO authenticated;
GRANT ALL ON public.cobros TO anon;
GRANT ALL ON public.servicios TO authenticated;
GRANT ALL ON public.servicios TO anon;

-- 4. Índices para acelerar consultas y filtrados
CREATE INDEX IF NOT EXISTS cobros_excluida_idx ON public.cobros (excluida);
CREATE INDEX IF NOT EXISTS cobros_mes_idx ON public.cobros (mes);
CREATE INDEX IF NOT EXISTS cobros_servicio_id_idx ON public.cobros (servicio_id);
CREATE INDEX IF NOT EXISTS servicios_sede_id_idx ON public.servicios (sede_id);
CREATE INDEX IF NOT EXISTS servicios_estado_idx ON public.servicios (estado);

-- 5. Publicación en Realtime (Crucial para que los cambios en PC se reflejen al instante en el móvil)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cobros'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cobros;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'servicios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.servicios;
  END IF;
END $$;
