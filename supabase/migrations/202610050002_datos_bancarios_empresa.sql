CREATE TABLE IF NOT EXISTS public.datos_bancarios_empresa (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  beneficiario text NOT NULL DEFAULT '',
  banco text NOT NULL DEFAULT '',
  clabe text NOT NULL DEFAULT '',
  cuenta text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.datos_bancarios_empresa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.datos_bancarios_empresa FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.datos_bancarios_empresa TO authenticated;

DROP POLICY IF EXISTS "datos_bancarios_empresa_read_authorized" ON public.datos_bancarios_empresa;
CREATE POLICY "datos_bancarios_empresa_read_authorized"
  ON public.datos_bancarios_empresa
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND (
          lower(btrim(profile.role)) = 'cliente'
          OR lower(btrim(profile.role)) IN ('admin', 'administrador', 'super administrador')
          OR EXISTS (
            SELECT 1
            FROM public.roles AS role_config
            WHERE role_config.nombre = profile.role
              AND (
                role_config.permisos -> 'cobros' ->> 'view' = 'true'
                OR role_config.permisos -> 'cobros' ->> 'edit' = 'true'
              )
          )
        )
    )
  );

DROP POLICY IF EXISTS "datos_bancarios_empresa_write_authorized" ON public.datos_bancarios_empresa;
CREATE POLICY "datos_bancarios_empresa_write_authorized"
  ON public.datos_bancarios_empresa
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND (
          lower(btrim(profile.role)) IN ('admin', 'administrador', 'super administrador')
          OR EXISTS (
            SELECT 1
            FROM public.roles AS role_config
            WHERE role_config.nombre = profile.role
              AND role_config.permisos -> 'cobros' ->> 'edit' = 'true'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND (
          lower(btrim(profile.role)) IN ('admin', 'administrador', 'super administrador')
          OR EXISTS (
            SELECT 1
            FROM public.roles AS role_config
            WHERE role_config.nombre = profile.role
              AND role_config.permisos -> 'cobros' ->> 'edit' = 'true'
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.set_datos_bancarios_empresa_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS datos_bancarios_empresa_updated_at ON public.datos_bancarios_empresa;
CREATE TRIGGER datos_bancarios_empresa_updated_at
  BEFORE UPDATE ON public.datos_bancarios_empresa
  FOR EACH ROW
  EXECUTE FUNCTION public.set_datos_bancarios_empresa_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'datos_bancarios_empresa'
    ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.datos_bancarios_empresa';
  END IF;
END;
$$;