-- ==============================================================================
-- Migración: Soporte para Registro de Asistencias por Código QR
-- Permite a los guardias escanear un QR del servicio, seleccionar su nombre,
-- y registrar su asistencia evaluando turnos (Matutino 7:15 AM / Vespertino 7:15 PM)
-- protegiendo vacaciones y descansos.
-- ==============================================================================

-- 1. Función para obtener el personal asignado a un servicio de forma segura
CREATE OR REPLACE FUNCTION public.get_personal_servicio_qr(p_servicio_id uuid)
RETURNS TABLE (
  empleado_id uuid,
  nombre_completo text,
  turno text,
  puesto text,
  sede_id uuid
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    e.id AS empleado_id,
    e.nombre_completo,
    COALESCE(at.turno, 'matutino') AS turno,
    e.puesto,
    e.sede_id
  FROM public.empleados e
  LEFT JOIN public.asignacion_turnos at 
    ON (at.empleado_id = e.id OR LOWER(TRIM(at.empleado_nombre)) = LOWER(TRIM(e.nombre_completo)))
   AND at.servicio_id = p_servicio_id
  WHERE (at.servicio_id = p_servicio_id 
     OR e.servicio_ubicacion = (SELECT nombre FROM public.servicios WHERE id = p_servicio_id))
    AND EXISTS (
      SELECT 1 FROM public.servicios s 
      WHERE s.id = p_servicio_id 
        AND LOWER(COALESCE(s.estado, 'activo')) <> 'suspendido'
    )
    AND (
      e.fecha_baja IS NULL 
      OR (e.fecha_reingreso IS NOT NULL AND e.fecha_reingreso >= e.fecha_baja) 
      OR e.fecha_baja > CURRENT_DATE
    )
  ORDER BY e.nombre_completo;
$$;

GRANT EXECUTE ON FUNCTION public.get_personal_servicio_qr(uuid) TO anon, authenticated;

-- 2. Función para registrar la asistencia evaluando reglas y descansos/vacaciones
CREATE OR REPLACE FUNCTION public.registrar_asistencia_qr(
  p_empleado_id uuid,
  p_servicio_id uuid,
  p_fecha date,
  p_estado text,
  p_hora text,
  p_sede_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existente record;
  v_emp_sede_id uuid := p_sede_id;
BEGIN
  -- Si no se proporcionó sede_id, obtenerla del empleado
  IF v_emp_sede_id IS NULL THEN
    SELECT sede_id INTO v_emp_sede_id
    FROM public.empleados
    WHERE id = p_empleado_id;
  END IF;

  -- Verificar si ya existe registro de asistencia para esa fecha
  SELECT id, estado INTO v_existente
  FROM public.asistencias
  WHERE empleado_id = p_empleado_id AND fecha = p_fecha;

  -- Regla: Si ya tiene vacaciones o descanso programado, NO sobreescribir
  IF v_existente.id IS NOT NULL AND v_existente.estado IN ('vacaciones', 'descanso') THEN
    RETURN jsonb_build_object(
      'success', true,
      'ignored', true,
      'estado', v_existente.estado,
      'message', 'El empleado tiene ' || v_existente.estado || ' programado hoy. Se conserva sin cambios.'
    );
  END IF;

  -- Si ya registró previamente hoy como asistió o retraso
  IF v_existente.id IS NOT NULL AND v_existente.estado IN ('asistió', 'retraso') THEN
    RETURN jsonb_build_object(
      'success', true,
      'ignored', true,
      'already_registered', true,
      'estado', v_existente.estado,
      'message', 'Ya se había registrado asistencia previamente como ' || v_existente.estado || '.'
    );
  END IF;

  -- Insertar o actualizar asistencia
  INSERT INTO public.asistencias (empleado_id, fecha, estado, sede_id)
  VALUES (p_empleado_id, p_fecha, p_estado, v_emp_sede_id)
  ON CONFLICT (empleado_id, fecha)
  DO UPDATE SET 
    estado = p_estado,
    sede_id = COALESCE(public.asistencias.sede_id, EXCLUDED.sede_id);

  RETURN jsonb_build_object(
    'success', true,
    'ignored', false,
    'estado', p_estado,
    'message', 'Asistencia registrada exitosamente como ' || p_estado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_asistencia_qr(uuid, uuid, date, text, text, uuid) TO anon, authenticated;

-- 3. Habilitar inserción/actualización directa en asistencias con políticas RLS permisivas si aplica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'asistencias' AND policyname = 'asistencias_qr_anon_upsert'
  ) THEN
    CREATE POLICY "asistencias_qr_anon_upsert" 
    ON public.asistencias 
    FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
