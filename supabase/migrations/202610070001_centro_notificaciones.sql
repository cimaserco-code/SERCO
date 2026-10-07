CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN ('evento', 'accion_requerida', 'recordatorio')),
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL DEFAULT '',
  leida boolean NOT NULL DEFAULT false,
  estado text CHECK (estado IS NULL OR estado IN ('pendiente', 'atendida')),
  referencia_id uuid,
  referencia_tipo text,
  fecha_programada timestamptz,
  fecha_atendida timestamptz,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificaciones_accion_estado_check
    CHECK (categoria <> 'accion_requerida' OR estado IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS notificaciones_usuario_fecha_idx
  ON public.notificaciones (usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notificaciones_programadas_idx
  ON public.notificaciones (fecha_programada)
  WHERE fecha_programada IS NOT NULL;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificaciones_select_own ON public.notificaciones;
CREATE POLICY notificaciones_select_own
  ON public.notificaciones FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

REVOKE ALL ON public.notificaciones FROM anon, authenticated;
GRANT SELECT ON public.notificaciones TO authenticated;

CREATE OR REPLACE FUNCTION public.notificacion_rol_coincide(p_role text, p_destino text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_destino
    WHEN 'rh' THEN lower(btrim(coalesce(p_role, ''))) IN ('rh', 'recursos humanos')
    WHEN 'director_rh' THEN lower(btrim(coalesce(p_role, ''))) LIKE '%director%'
      AND (lower(p_role) LIKE '%rh%' OR lower(p_role) LIKE '%recursos humanos%')
    WHEN 'reclutador' THEN lower(btrim(coalesce(p_role, ''))) LIKE '%reclut%'
    WHEN 'supervisor' THEN lower(btrim(coalesce(p_role, ''))) = 'supervisor'
    WHEN 'director_supervisor' THEN lower(btrim(coalesce(p_role, ''))) LIKE '%director%'
      AND (lower(p_role) LIKE '%supervisor%' OR lower(p_role) LIKE '%supervisi%')
    WHEN 'monitorista' THEN lower(btrim(coalesce(p_role, ''))) LIKE '%monitor%'
    WHEN 'finanzas' THEN lower(btrim(coalesce(p_role, ''))) IN ('finanzas', 'financiero')
    WHEN 'director_finanzas' THEN lower(btrim(coalesce(p_role, ''))) LIKE '%director%'
      AND lower(p_role) LIKE '%finanz%'
    WHEN 'todos' THEN lower(btrim(coalesce(p_role, ''))) NOT IN ('', 'cliente')
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.notificacion_usuario_puede_ver(
  p_usuario_id uuid,
  p_modulo text,
  p_sede_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_usuario_id
      AND (
        lower(btrim(coalesce(profile.role, ''))) IN ('admin', 'administrador', 'super administrador')
        OR EXISTS (
          SELECT 1
          FROM public.roles AS role_config
          WHERE role_config.nombre = profile.role
            AND (
              role_config.permisos -> p_modulo ->> 'view' = 'true'
              OR role_config.permisos -> p_modulo ->> 'edit' = 'true'
              OR role_config.permisos -> p_modulo ->> 'create' = 'true'
            )
        )
      )
      AND (
        p_sede_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.roles AS role_config
          WHERE role_config.nombre = profile.role
            AND role_config.permisos -> 'todas_sedes' ->> 'view' = 'true'
        )
        OR CASE
          WHEN jsonb_typeof(to_jsonb(profile) -> 'sede_ids') = 'array'
            AND jsonb_array_length(to_jsonb(profile) -> 'sede_ids') > 0
            THEN (to_jsonb(profile) -> 'sede_ids') ? p_sede_id::text
          WHEN nullif(to_jsonb(profile) ->> 'sede_id', '') IS NOT NULL
            THEN to_jsonb(profile) ->> 'sede_id' = p_sede_id::text
          ELSE true
        END
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.crear_notificacion(
  p_usuario_id uuid,
  p_categoria text,
  p_tipo text,
  p_titulo text,
  p_mensaje text,
  p_estado text,
  p_referencia_tipo text,
  p_referencia_id uuid,
  p_fecha_programada timestamptz,
  p_dedupe_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notificaciones (
    usuario_id, categoria, tipo, titulo, mensaje, estado,
    referencia_tipo, referencia_id, fecha_programada, dedupe_key
  ) VALUES (
    p_usuario_id, p_categoria, p_tipo, p_titulo, coalesce(p_mensaje, ''), p_estado,
    p_referencia_tipo, p_referencia_id, p_fecha_programada, p_dedupe_key
  ) ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.notificar_roles(
  p_roles text[],
  p_modulo text,
  p_sede_id uuid,
  p_categoria text,
  p_tipo text,
  p_titulo text,
  p_mensaje text,
  p_estado text,
  p_referencia_tipo text,
  p_referencia_id uuid,
  p_fecha_programada timestamptz,
  p_dedupe_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  destinatario record;
BEGIN
  FOR destinatario IN
    SELECT profile.id
    FROM public.profiles AS profile
    WHERE EXISTS (
      SELECT 1 FROM unnest(p_roles) AS destino
      WHERE public.notificacion_rol_coincide(profile.role, destino)
    )
      AND public.notificacion_usuario_puede_ver(profile.id, p_modulo, p_sede_id)
  LOOP
    PERFORM public.crear_notificacion(
      destinatario.id, p_categoria, p_tipo, p_titulo, p_mensaje, p_estado,
      p_referencia_tipo, p_referencia_id, p_fecha_programada,
      p_dedupe_key || ':' || destinatario.id::text
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notificar_cambio_empleado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  es_baja boolean;
  baja_anterior boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    baja_anterior := OLD.fecha_baja IS NOT NULL
      AND (OLD.fecha_reingreso IS NULL OR OLD.fecha_baja > OLD.fecha_reingreso);
  END IF;
  es_baja := NEW.fecha_baja IS NOT NULL
    AND (NEW.fecha_reingreso IS NULL OR NEW.fecha_baja > NEW.fecha_reingreso);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notificar_roles(
      ARRAY['rh', 'supervisor', 'director_rh', 'director_supervisor'], 'empleados', NEW.sede_id,
      'evento', 'alta', 'Alta de personal',
      coalesce(NEW.nombre_completo, 'Se registró una nueva alta de personal.'), NULL,
      'empleado', NEW.id, NULL, 'empleado:alta:' || NEW.id::text
    );
  ELSIF NOT baja_anterior AND es_baja THEN
    PERFORM public.notificar_roles(
      ARRAY['rh', 'director_rh', 'monitorista', 'supervisor', 'director_supervisor'], 'empleados', NEW.sede_id,
      'evento', 'baja', 'Baja de personal',
      coalesce(NEW.nombre_completo, 'Se registró una baja de personal.'), NULL,
      'empleado', NEW.id, NULL, 'empleado:baja:' || NEW.id::text || ':' || NEW.fecha_baja::text
    );
    IF coalesce(NEW.seguro, false) THEN
      PERFORM public.notificar_roles(
        ARRAY['rh', 'director_rh'], 'empleados', NEW.sede_id,
        'accion_requerida', 'dar_baja_seguro', 'Dar de baja de seguro',
        'Dar de baja de seguro a ' || coalesce(NEW.nombre_completo, 'la persona'), 'pendiente',
        'empleado', NEW.id, NULL, 'empleado:seguro:' || NEW.id::text || ':' || NEW.fecha_baja::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empleados_notificaciones ON public.empleados;
CREATE TRIGGER empleados_notificaciones
  AFTER INSERT OR UPDATE OF fecha_baja, fecha_reingreso, seguro ON public.empleados
  FOR EACH ROW EXECUTE FUNCTION public.notificar_cambio_empleado();

CREATE OR REPLACE FUNCTION public.notificar_cambio_servicio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notificar_roles(
      ARRAY['todos'], 'servicios', NEW.sede_id, 'evento', 'alta_servicio', 'Alta de servicio',
      coalesce(NEW.nombre, 'Se registró un nuevo servicio.'), NULL,
      'servicio', NEW.id, NULL, 'servicio:alta:' || NEW.id::text
    );
  ELSIF lower(coalesce(OLD.estado, '')) = 'activo'
    AND lower(coalesce(NEW.estado, '')) IN ('suspendido', 'inactivo', 'baja') THEN
    PERFORM public.notificar_roles(
      ARRAY['todos'], 'servicios', NEW.sede_id, 'evento', 'baja_servicio', 'Baja de servicio',
      coalesce(NEW.nombre, 'Se registró una baja de servicio.'), NULL,
      'servicio', NEW.id, NULL, 'servicio:baja:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS servicios_notificaciones ON public.servicios;
CREATE TRIGGER servicios_notificaciones
  AFTER INSERT OR UPDATE OF estado ON public.servicios
  FOR EACH ROW EXECUTE FUNCTION public.notificar_cambio_servicio();

CREATE OR REPLACE FUNCTION public.notificar_cambio_solicitud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tipo_notificacion text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notificar_roles(
      ARRAY['finanzas', 'director_finanzas'], 'inventario', NEW.sede_id,
      'evento', 'solicitud_enviada', 'Solicitud de inventario enviada',
      coalesce(NEW.item_nombre, 'Se envió una solicitud de inventario.'), NULL,
      'solicitud_material', NEW.id, NULL, 'solicitud:enviada:' || NEW.id::text
    );
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    tipo_notificacion := CASE lower(coalesce(NEW.estado, ''))
      WHEN 'aprobado' THEN 'solicitud_aprobada'
      WHEN 'rechazado' THEN 'solicitud_rechazada'
      WHEN 'entregado' THEN 'solicitud_entregada'
      ELSE NULL
    END;
    IF tipo_notificacion IS NOT NULL THEN
      PERFORM public.crear_notificacion(
        NEW.solicitante_id, 'evento', tipo_notificacion,
        CASE tipo_notificacion
          WHEN 'solicitud_aprobada' THEN 'Solicitud aprobada'
          WHEN 'solicitud_rechazada' THEN 'Solicitud rechazada'
          ELSE 'Solicitud entregada'
        END,
        coalesce(NEW.item_nombre, 'Tu solicitud de inventario cambió de estado.'), NULL,
        'solicitud_material', NEW.id, NULL,
        'solicitud:' || tipo_notificacion || ':' || NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_inventario_notificaciones ON public.solicitudes_inventario;
CREATE TRIGGER solicitudes_inventario_notificaciones
  AFTER INSERT OR UPDATE OF estado ON public.solicitudes_inventario
  FOR EACH ROW EXECUTE FUNCTION public.notificar_cambio_solicitud();

CREATE OR REPLACE FUNCTION public.notificar_evento_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  destinatarios text[];
BEGIN
  destinatarios := CASE lower(coalesce(NEW.tipo, ''))
    WHEN 'entrevista' THEN ARRAY['rh', 'director_rh', 'reclutador']
    WHEN 'capacitacion' THEN ARRAY['rh', 'director_rh']
    WHEN 'visita_supervision' THEN ARRAY['supervisor', 'director_supervisor']
    WHEN 'reporte' THEN ARRAY['supervisor', 'director_supervisor', 'monitorista']
    ELSE NULL
  END;

  IF destinatarios IS NOT NULL THEN
    PERFORM public.notificar_roles(
      destinatarios, 'agenda', NEW.sede_id, 'evento', 'agenda_' || NEW.tipo,
      'Evento de Agenda agendado', coalesce(NEW.titulo, NEW.tipo), NULL,
      'agenda', NEW.id, NULL, 'agenda:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agenda_notificaciones ON public.agenda;
CREATE TRIGGER agenda_notificaciones
  AFTER INSERT ON public.agenda
  FOR EACH ROW EXECUTE FUNCTION public.notificar_evento_agenda();

CREATE OR REPLACE FUNCTION public.notificar_recarga_celular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dias integer;
  sede uuid;
BEGIN
  dias := CASE
    WHEN NEW.monto = 50 THEN 7
    WHEN NEW.monto = 100 THEN 14
    ELSE NULL
  END;
  IF dias IS NOT NULL THEN
    SELECT saldo.sede_id INTO sede FROM public.saldos AS saldo WHERE saldo.id = NEW.saldo_id;
    PERFORM public.notificar_roles(
      ARRAY['finanzas', 'director_finanzas'], 'egresos', sede,
      'recordatorio', 'recarga_celular', 'Recordatorio de recarga de celular',
      'Revisar la recarga de $' || NEW.monto::text || ' registrada el ' || NEW.fecha::text,
      'pendiente', 'recarga_celular', NEW.id,
      (NEW.fecha + dias)::timestamptz,
      'recarga:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recargas_celular_notificaciones ON public.recargas_celular;
CREATE TRIGGER recargas_celular_notificaciones
  AFTER INSERT ON public.recargas_celular
  FOR EACH ROW EXECUTE FUNCTION public.notificar_recarga_celular();

CREATE OR REPLACE FUNCTION public.generar_recordatorios_egresos_mensuales()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  egreso record;
  fecha_vencimiento date;
  mes_actual date := date_trunc('month', current_date)::date;
  creados_antes integer;
  creados_despues integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND (
        lower(btrim(coalesce(profile.role, ''))) IN ('admin', 'administrador', 'super administrador')
        OR EXISTS (
          SELECT 1 FROM public.roles AS role_config
          WHERE role_config.nombre = profile.role
            AND role_config.permisos -> 'egresos' ->> 'view' = 'true'
        )
      )
  ) THEN
    RAISE EXCEPTION 'No autorizado para generar recordatorios de egresos';
  END IF;

  SELECT count(*) INTO creados_antes FROM public.notificaciones;
  FOR egreso IN
    SELECT expense.*
    FROM public.egresos AS expense
    WHERE expense.mensual IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.egreso_pagos AS payment
        WHERE payment.egreso_id = expense.id
          AND payment.mes = to_char(mes_actual, 'YYYY-MM')
          AND lower(coalesce(payment.estado, '')) = 'pagado'
      )
  LOOP
    fecha_vencimiento := mes_actual + (
      least(
        greatest(coalesce(egreso.dia_vencimiento, 1), 1),
        extract(day FROM (mes_actual + interval '1 month - 1 day'))::integer
      ) - 1
    );
    PERFORM public.notificar_roles(
      ARRAY['finanzas', 'director_finanzas'], 'egresos', egreso.sede_id,
      'recordatorio', 'egreso_mensual', 'Egreso mensual por vencer',
      coalesce(egreso.concepto, 'Egreso recurrente') || ' · Vence ' || fecha_vencimiento::text,
      'pendiente', 'egreso', egreso.id,
      fecha_vencimiento::timestamptz,
      'egreso:' || egreso.id::text || ':' || to_char(mes_actual, 'YYYY-MM')
    );
  END LOOP;
  SELECT count(*) INTO creados_despues FROM public.notificaciones;
  RETURN greatest(creados_despues - creados_antes, 0)::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_notificacion_leida(p_notificacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notificaciones
  SET leida = true
  WHERE id = p_notificacion_id AND usuario_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.atender_notificacion(p_notificacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notificaciones
  SET estado = 'atendida', fecha_atendida = now()
  WHERE id = p_notificacion_id
    AND usuario_id = auth.uid()
    AND categoria = 'accion_requerida'
    AND estado = 'pendiente';
END;
$$;

REVOKE ALL ON FUNCTION public.notificacion_usuario_puede_ver(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_notificacion(uuid, text, text, text, text, text, text, uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_roles(text[], text, uuid, text, text, text, text, text, text, uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_cambio_empleado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_cambio_servicio() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_cambio_solicitud() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_evento_agenda() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_recarga_celular() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generar_recordatorios_egresos_mensuales() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_notificacion_leida(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atender_notificacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generar_recordatorios_egresos_mensuales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_notificacion_leida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atender_notificacion(uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notificaciones'
    ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones';
  END IF;
END;
$$;