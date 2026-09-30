-- Agregar campo NIV (Número de Identificación Vehicular / VIN) a la tabla de automóviles
ALTER TABLE public.automoviles
  ADD COLUMN IF NOT EXISTS niv text;
