-- 1. Agregar precio_unitario a inventario_items
ALTER TABLE public.inventario_items
  ADD COLUMN IF NOT EXISTS precio_unitario numeric DEFAULT 0;

-- 2. Agregar columnas necesarias a solicitudes_inventario para soportar pedidos y compras
ALTER TABLE public.solicitudes_inventario
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'pedido',
  ADD COLUMN IF NOT EXISTS servicio_id uuid,
  ADD COLUMN IF NOT EXISTS servicio_nombre text,
  ADD COLUMN IF NOT EXISTS articulos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fecha_entrega timestamptz,
  ADD COLUMN IF NOT EXISTS entregado_por text;

-- 3. Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS solicitudes_inventario_tipo_idx ON public.solicitudes_inventario (tipo);
CREATE INDEX IF NOT EXISTS solicitudes_inventario_solicitante_id_idx ON public.solicitudes_inventario (solicitante_id);
