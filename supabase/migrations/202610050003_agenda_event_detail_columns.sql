ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS tema_reunion text,
  ADD COLUMN IF NOT EXISTS participantes_reunion text,
  ADD COLUMN IF NOT EXISTS lugar_reunion text,
  ADD COLUMN IF NOT EXISTS enlace_reunion text,
  ADD COLUMN IF NOT EXISTS fecha_arranque date,
  ADD COLUMN IF NOT EXISTS elementos_requeridos text,
  ADD COLUMN IF NOT EXISTS detalles_inauguracion text;