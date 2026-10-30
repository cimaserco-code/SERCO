-- ==============================================================================
-- Migración: Políticas RLS (Gasolina, Automóviles) y Alertas de Finanzas
-- (Vencimiento de recargas celulares y facturas de servicios vencidas)
-- ==============================================================================

-- 1. Políticas RLS para 'gasolina' y 'automoviles'
ALTER TABLE public.gasolina ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gasolina_access_all" ON public.gasolina;
CREATE POLICY "gasolina_access_all"
  ON public.gasolina
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.automoviles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automoviles_access_all" ON public.automoviles;
CREATE POLICY "automoviles_access_all"
  ON public.automoviles
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Actualizar función de notificación de recarga celular con vigencias exactas:
-- $50 -> 7 días, $100 -> 15 días, $150 -> 26 días, >= $200 -> 30 días
CREATE OR REPLACE FUNCTION public.notificar_recarga_celular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dias integer;
  sede uuid;
  linea_nombre text;
BEGIN
  dias := CASE
    WHEN NEW.monto <= 30 THEN 3
    WHEN NEW.monto <= 50 THEN 7
    WHEN NEW.monto <= 100 THEN 15
    WHEN NEW.monto <= 150 THEN 26
    ELSE 30
  END;

  SELECT saldo.sede_id, coalesce(saldo.nombre, saldo.numero_telefono, 'el equipo')
    INTO sede, linea_nombre
    FROM public.saldos AS saldo
   WHERE saldo.id = NEW.saldo_id;

  PERFORM public.notificar_roles(
    ARRAY['finanzas', 'director_finanzas'], 'egresos', sede,
    'recordatorio', 'recarga_celular', 'Recordatorio de saldo por agotarse',
    'El saldo de $' || NEW.monto::text || ' de ' || coalesce(linea_nombre, 'la línea') || ' se agotará el ' || (NEW.fecha + dias)::text || ' (' || dias::text || ' días de vigencia).',
    'pendiente', 'recarga_celular', NEW.id,
    (NEW.fecha + dias)::timestamptz,
    'recarga:' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recargas_celular_notificaciones ON public.recargas_celular;
CREATE TRIGGER recargas_celular_notificaciones
  AFTER INSERT ON public.recargas_celular
  FOR EACH ROW EXECUTE FUNCTION public.notificar_recarga_celular();

-- 3. Notificación a finanzas cuando un cobro supera su fecha límite de pago sin liquidarse
CREATE OR REPLACE FUNCTION public.notificar_cobro_vencido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.estado, '')) <> 'pagado'
     AND NEW.fecha_limite_pago IS NOT NULL
     AND NEW.fecha_limite_pago <= current_date THEN

    PERFORM public.notificar_roles(
      ARRAY['finanzas', 'director_finanzas'], 'cobros', NEW.sede_id,
      'accion_requerida', 'cobro_vencido', 'Factura de Servicio Vencida',
      'El servicio "' || coalesce(NEW.servicio_nombre, 'Servicio') || '" no ha liquidado su cobro (Fecha límite: ' || NEW.fecha_limite_pago::text || '). Monto: $' || coalesce(NEW.monto::text, '0'),
      'pendiente', 'cobro', NEW.id,
      now(),
      'cobro_vencido:' || NEW.id::text || ':' || NEW.fecha_limite_pago::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cobros_vencidos_notificaciones ON public.cobros;
CREATE TRIGGER cobros_vencidos_notificaciones
  AFTER INSERT OR UPDATE OF estado, fecha_limite_pago, monto ON public.cobros
  FOR EACH ROW EXECUTE FUNCTION public.notificar_cobro_vencido();
