import { sercoApi } from "@/api/sercoClient";

const STORAGE_KEY = "serco_empleados_metadata";

/**
 * Obtiene el mapa completo de metadata de empleados { [empId]: { experiencia: string, observaciones: string } }
 */
export function getStoredEmpleadosMetadata() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Error leyendo serco_empleados_metadata:", e);
    return {};
  }
}

/**
 * Guarda el mapa completo de metadata de empleados y dispara evento de sincronización
 */
export function saveStoredEmpleadosMetadata(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event("serco_empleados_metadata_updated"));
  } catch (e) {
    console.warn("Error guardando serco_empleados_metadata:", e);
  }
}

/**
 * Obtiene la metadata (experiencia y observaciones) guardada para un empleado específico
 */
export function getStoredEmpleadoMeta(empId) {
  if (!empId) return { experiencia: "", observaciones: "" };
  const map = getStoredEmpleadosMetadata();
  const meta = map[empId];
  return {
    experiencia: meta?.experiencia || "",
    observaciones: meta?.observaciones || "",
  };
}

/**
 * Asigna y persiste experiencia y observaciones para un empleado específico.
 * Guarda en almacenamiento local e intenta persistir en Supabase.
 */
export async function setStoredEmpleadoMeta(empId, { experiencia, observaciones }) {
  if (!empId) return;
  const map = getStoredEmpleadosMetadata();
  const current = map[empId] || {};
  
  const newMeta = {
    experiencia: experiencia !== undefined ? (experiencia || "") : (current.experiencia || ""),
    observaciones: observaciones !== undefined ? (observaciones || "") : (current.observaciones || ""),
    updated_at: new Date().toISOString(),
  };
  
  map[empId] = newMeta;
  saveStoredEmpleadosMetadata(map);

  // Intentar persistir en Supabase si la columna existe en el esquema
  try {
    if (sercoApi?.entities?.Empleado?.update) {
      const payload = {};
      if (newMeta.experiencia) payload.experiencia = newMeta.experiencia;
      if (newMeta.observaciones) payload.observaciones = newMeta.observaciones;
      if (Object.keys(payload).length > 0) {
        await sercoApi.entities.Empleado.update(empId, payload);
      }
    }
  } catch (err) {
    // Si la columna aún no existe en Supabase, se ignora silenciosamente ya que está en el almacenamiento local
    console.warn("Persistencia remota en Supabase omitida (posible columna pendiente):", err?.message);
  }
}

/**
 * Resuelve y enriquece un empleado con su experiencia y observaciones,
 * dando prioridad a los datos de la base de datos si existen, o al almacenamiento local.
 */
export function enrichEmpleadoWithMeta(emp) {
  if (!emp) return emp;
  const stored = getStoredEmpleadoMeta(emp.id);
  return {
    ...emp,
    experiencia: emp.experiencia != null && emp.experiencia !== "" ? emp.experiencia : stored.experiencia,
    observaciones: emp.observaciones != null && emp.observaciones !== "" ? emp.observaciones : stored.observaciones,
  };
}

/**
 * Enriquecer un array completo de empleados con su metadata
 */
export function enrichEmpleadosListWithMeta(list) {
  if (!Array.isArray(list)) return [];
  const map = getStoredEmpleadosMetadata();
  return list.map((emp) => {
    if (!emp) return emp;
    const stored = map[emp.id] || {};
    return {
      ...emp,
      experiencia: emp.experiencia != null && emp.experiencia !== "" ? emp.experiencia : (stored.experiencia || ""),
      observaciones: emp.observaciones != null && emp.observaciones !== "" ? emp.observaciones : (stored.observaciones || ""),
    };
  });
}
