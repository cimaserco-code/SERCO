-- ==============================================================================
-- Migración: Tabla de Reportes de Clientes para el Módulo de Atención
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reportes_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL UNIQUE,
  servicio_id uuid REFERENCES public.servicios(id) ON DELETE SET NULL,
  servicio_nombre text,
  sede_id uuid REFERENCES public.sedes(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'Incidencia Operativa',
  titulo text NOT NULL,
  descripcion text NOT NULL,
  prioridad text NOT NULL DEFAULT 'Normal',
  estado text NOT NULL DEFAULT 'Recibido',
  fecha text,
  hora text,
  creado_por text,
  cliente_email text,
  cliente_telefono text,
  respuesta text,
  atendido_por text,
  fecha_respuesta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para optimizar consultas, orden y filtrado
CREATE INDEX IF NOT EXISTS reportes_cliente_servicio_id_idx ON public.reportes_cliente (servicio_id);
CREATE INDEX IF NOT EXISTS reportes_cliente_sede_id_idx ON public.reportes_cliente (sede_id);
CREATE INDEX IF NOT EXISTS reportes_cliente_estado_idx ON public.reportes_cliente (estado);
CREATE INDEX IF NOT EXISTS reportes_cliente_prioridad_idx ON public.reportes_cliente (prioridad);
CREATE INDEX IF NOT EXISTS reportes_cliente_created_at_idx ON public.reportes_cliente (created_at DESC);

-- Permisos directos para la aplicación (anon y authenticated)
GRANT ALL ON public.reportes_cliente TO anon, authenticated;

-- Políticas RLS permisivas si RLS está habilitado en la tabla
DO $$
BEGIN
  ALTER TABLE public.reportes_cliente ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reportes_cliente' AND policyname = 'reportes_cliente_access_all'
  ) THEN
    CREATE POLICY "reportes_cliente_access_all" 
    ON public.reportes_cliente 
    FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
