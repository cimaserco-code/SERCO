-- Adds period-based payment history and preserves all existing records.
ALTER TABLE public.egresos
  ADD COLUMN IF NOT EXISTS mensual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dia_vencimiento integer,
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendiente';

ALTER TABLE public.saldos
  ADD COLUMN IF NOT EXISTS saldo_actual numeric NOT NULL DEFAULT 0;

UPDATE public.saldos
SET saldo_actual = COALESCE(saldo_actual, monto, 0)
WHERE saldo_actual = 0 AND monto IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.egreso_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  egreso_id uuid NOT NULL REFERENCES public.egresos(id) ON DELETE CASCADE,
  mes text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  fecha_pago date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (egreso_id, mes)
);

CREATE TABLE IF NOT EXISTS public.recargas_celular (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saldo_id uuid NOT NULL REFERENCES public.saldos(id) ON DELETE CASCADE,
  monto numeric NOT NULL,
  fecha date NOT NULL,
  mes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve legacy saldo rows as the first known recharge in their history.
INSERT INTO public.recargas_celular (saldo_id, monto, fecha, mes)
SELECT s.id, COALESCE(s.monto, 0), COALESCE(s.fecha, CURRENT_DATE), COALESCE(s.mes, to_char(COALESCE(s.fecha, CURRENT_DATE), 'YYYY-MM'))
FROM public.saldos s
WHERE COALESCE(s.monto, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.recargas_celular r WHERE r.saldo_id = s.id
  );

CREATE TABLE IF NOT EXISTS public.gasolina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo text NOT NULL,
  fecha date NOT NULL,
  litros numeric,
  precio_litro numeric,
  monto numeric NOT NULL DEFAULT 0,
  kilometraje numeric,
  gasolinera text,
  sede_id uuid,
  mes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automoviles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  marca text,
  modelo text,
  anio integer,
  placas text,
  numero_economico text,
  sede_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gasolina
  ALTER COLUMN vehiculo DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS automovil_id uuid REFERENCES public.automoviles(id) ON DELETE SET NULL;

ALTER TABLE public.mantenimientos
  ADD COLUMN IF NOT EXISTS automovil_id uuid REFERENCES public.automoviles(id) ON DELETE SET NULL;

-- Reuse legacy movement names as catalog entries and link them without deleting data.
INSERT INTO public.automoviles (nombre, sede_id)
SELECT DISTINCT m.vehiculo, m.sede_id
FROM (
  SELECT vehiculo, sede_id FROM public.gasolina WHERE vehiculo IS NOT NULL AND vehiculo <> ''
  UNION
  SELECT vehiculo, sede_id FROM public.mantenimientos WHERE vehiculo IS NOT NULL AND vehiculo <> ''
) m
WHERE NOT EXISTS (
  SELECT 1 FROM public.automoviles a WHERE a.nombre = m.vehiculo AND a.sede_id IS NOT DISTINCT FROM m.sede_id
);

UPDATE public.gasolina g
SET automovil_id = a.id
FROM public.automoviles a
WHERE g.automovil_id IS NULL AND g.vehiculo = a.nombre AND g.sede_id IS NOT DISTINCT FROM a.sede_id;

UPDATE public.mantenimientos m
SET automovil_id = a.id
FROM public.automoviles a
WHERE m.automovil_id IS NULL AND m.vehiculo = a.nombre AND m.sede_id IS NOT DISTINCT FROM a.sede_id;

CREATE INDEX IF NOT EXISTS egreso_pagos_mes_idx ON public.egreso_pagos (mes);
CREATE INDEX IF NOT EXISTS recargas_celular_saldo_id_idx ON public.recargas_celular (saldo_id);
CREATE INDEX IF NOT EXISTS recargas_celular_mes_idx ON public.recargas_celular (mes);
CREATE INDEX IF NOT EXISTS gasolina_mes_idx ON public.gasolina (mes);
CREATE INDEX IF NOT EXISTS gasolina_automovil_id_idx ON public.gasolina (automovil_id);
CREATE INDEX IF NOT EXISTS mantenimientos_automovil_id_idx ON public.mantenimientos (automovil_id);
CREATE INDEX IF NOT EXISTS automoviles_sede_id_idx ON public.automoviles (sede_id);
