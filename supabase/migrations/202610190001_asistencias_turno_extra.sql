-- ==============================================================================
-- Migración: Soporte para Turno Extra (Doblete) en Registro de Asistencias QR
-- Permite registrar Turno Extra ('extra' o 'descanso_extra') cuando un empleado
-- ya cuenta con asistencia previa en el turno anterior del mismo día.
-- ==============================================================================

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

  -- Regla 1: Si ya tiene vacaciones programadas, NO sobreescribir
  IF v_existente.id IS NOT NULL AND v_existente.estado = 'vacaciones' THEN
    RETURN jsonb_build_object(
      'success', true,
      'ignored', true,
      'estado', v_existente.estado,
      'message', 'El empleado tiene vacaciones programadas hoy. Se conserva sin cambios.'
    );
  END IF;

  -- Regla 2: Si tiene descanso y se registra asistencia
  IF v_existente.id IS NOT NULL AND v_existente.estado = 'descanso' THEN
    -- Promover a descanso laborado o descanso extra según corresponda
    UPDATE public.asistencias
    SET estado = CASE WHEN p_estado IN ('extra', 'descanso_extra') THEN 'descanso_extra' ELSE 'descanso_laborado' END,
        sede_id = COALESCE(public.asistencias.sede_id, v_emp_sede_id)
    WHERE id = v_existente.id;

    RETURN jsonb_build_object(
      'success', true,
      'ignored', false,
      'estado', CASE WHEN p_estado IN ('extra', 'descanso_extra') THEN 'descanso_extra' ELSE 'descanso_laborado' END,
      'message', 'Descanso laborado registrado exitosamente.'
    );
  END IF;

  -- Regla 3: Si ya registró previamente hoy como asistió o retraso
  IF v_existente.id IS NOT NULL AND v_existente.estado IN ('asistió', 'retraso', 'descanso_laborado') THEN
    IF p_estado IN ('extra', 'descanso_extra') THEN
      -- Se autoriza la promoción a Turno Extra (Doblete)
      UPDATE public.asistencias
      SET estado = p_estado,
          sede_id = COALESCE(public.asistencias.sede_id, v_emp_sede_id)
      WHERE id = v_existente.id;

      RETURN jsonb_build_object(
        'success', true,
        'ignored', false,
        'estado', p_estado,
        'message', 'Turno Extra (doblete) registrado exitosamente.'
      );
    ELSE
      -- Mismo turno o duplicado redundante sin calificar como turno extra
      RETURN jsonb_build_object(
        'success', true,
        'ignored', true,
        'already_registered', true,
        'estado', v_existente.estado,
        'message', 'Ya se había registrado asistencia previamente como ' || v_existente.estado || '.'
      );
    END IF;
  END IF;

  -- Regla 4: Si ya tiene Turno Extra registrado, proteger
  IF v_existente.id IS NOT NULL AND v_existente.estado IN ('extra', 'descanso_extra') THEN
    RETURN jsonb_build_object(
      'success', true,
      'ignored', true,
      'already_registered', true,
      'estado', v_existente.estado,
      'message', 'El empleado ya cuenta con Turno Extra registrado el día de hoy.'
    );
  END IF;

  -- Inserción estándar o actualización si no existía o estaba en falta
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
