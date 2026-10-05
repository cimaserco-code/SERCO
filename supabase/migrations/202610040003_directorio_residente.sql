-- ==============================================================================
-- Migración: Soporte para Directorio Oficial de Caseta para Residentes (Público)
-- Permite a residentes y colonos consultar quiénes son los guardias en turno y
-- los números directos de caseta vía enlace o código QR sin requerir login ni cuenta.
-- ==============================================================================

-- 1. Política RLS para permitir a usuarios anónimos consultar datos básicos de servicios activos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'servicios' AND policyname = 'allow_anon_read_servicios_activos'
  ) THEN
    CREATE POLICY "allow_anon_read_servicios_activos" 
    ON public.servicios 
    FOR SELECT 
    TO anon 
    USING (LOWER(COALESCE(estado, 'activo')) <> 'suspendido');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Función segura (SECURITY DEFINER) para obtener el directorio de un servicio
CREATE OR REPLACE FUNCTION public.get_directorio_residente(p_servicio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_servicio record;
  v_guardias jsonb;
  v_telefonos jsonb;
BEGIN
  -- 1. Obtener servicio
  SELECT id, nombre, direccion, ciudad, telefono, telefono_2, estado
  INTO v_servicio
  FROM public.servicios
  WHERE id = p_servicio_id
    AND LOWER(COALESCE(estado, 'activo')) <> 'suspendido';

  IF v_servicio.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Servicio no encontrado o suspendido');
  END IF;

  -- 2. Obtener guardias asignados activos
  SELECT COALESCE(jsonb_agg(g), '[]'::jsonb)
  INTO v_guardias
  FROM (
    SELECT DISTINCT
      e.id,
      e.nombre_completo AS nombre,
      COALESCE(e.puesto, 'Guardia de Seguridad') AS puesto,
      COALESCE(at.turno, 'matutino') AS turno,
      e.foto_url,
      CASE 
        WHEN LOWER(COALESCE(at.turno, '')) LIKE '%matutino%' THEN 1
        WHEN LOWER(COALESCE(at.turno, '')) LIKE '%vespertino%' THEN 2
        WHEN LOWER(COALESCE(at.turno, '')) LIKE '%cubre%' OR LOWER(COALESCE(at.turno, '')) LIKE '%descanso%' THEN 3
        ELSE 4
      END AS orden_turno
    FROM public.empleados e
    JOIN public.asignacion_turnos at 
      ON (at.empleado_id = e.id OR LOWER(TRIM(at.empleado_nombre)) = LOWER(TRIM(e.nombre_completo)))
    WHERE at.servicio_id = p_servicio_id
      AND (
        e.fecha_baja IS NULL 
        OR (e.fecha_reingreso IS NOT NULL AND e.fecha_reingreso >= e.fecha_baja) 
        OR e.fecha_baja > CURRENT_DATE
      )
    ORDER BY orden_turno, nombre
  ) g;

  -- 3. Teléfonos de caseta
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  INTO v_telefonos
  FROM (
    SELECT DISTINCT
      rc.id,
      rc.numero_telefono AS numero,
      COALESCE(rc.nombre, 'Celular Asignado') AS etiqueta,
      COALESCE(rc.compania, 'Línea de Caseta') AS compania,
      'operativo' AS tipo
    FROM public.recargas_celular rc
    WHERE (rc.servicio_id = p_servicio_id 
       OR LOWER(TRIM(rc.servicio)) = LOWER(TRIM(v_servicio.nombre)))
      AND rc.numero_telefono IS NOT NULL AND rc.numero_telefono <> ''
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'servicio', jsonb_build_object(
      'id', v_servicio.id,
      'nombre', v_servicio.nombre,
      'direccion', v_servicio.direccion,
      'ciudad', v_servicio.ciudad,
      'telefono', v_servicio.telefono,
      'telefono_2', v_servicio.telefono_2,
      'estado', v_servicio.estado
    ),
    'guardias', v_guardias,
    'telefonos', v_telefonos
  );
END;
$$;

-- Permisos de ejecución para usuarios anónimos (residentes) y autenticados
GRANT EXECUTE ON FUNCTION public.get_directorio_residente(uuid) TO anon, authenticated;
