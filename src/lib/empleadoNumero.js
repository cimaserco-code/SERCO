import { sercoApi } from "@/api/sercoClient";

const STORAGE_KEY = "serco_empleados_numeros";

/**
 * Obtiene el mapa completo de números de empleado almacenados { [empId]: number }
 */
export function getStoredEmpleadoNumeros() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Error leyendo serco_empleados_numeros:", e);
    return {};
  }
}

/**
 * Guarda el mapa completo de números de empleado
 */
export function saveStoredEmpleadoNumeros(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Error guardando serco_empleados_numeros:", e);
  }
}

/**
 * Obtiene el número guardado de un empleado específico
 */
export function getStoredEmpleadoNumero(empId) {
  if (!empId) return null;
  const map = getStoredEmpleadoNumeros();
  const num = map[empId];
  return num != null && num > 0 ? Number(num) : null;
}

/**
 * Asigna y persiste el número de empleado en el almacenamiento local
 */
export function setStoredEmpleadoNumero(empId, num) {
  if (!empId) return;
  const map = getStoredEmpleadoNumeros();
  const parsed = parseInt(num, 10);
  if (!isNaN(parsed) && parsed > 0) {
    map[empId] = parsed;
  } else {
    delete map[empId];
  }
  saveStoredEmpleadoNumeros(map);
}

/**
 * Resuelve el número de empleado dando prioridad a la BD y luego al almacenamiento local
 */
export function resolveEmpleadoNumero(emp) {
  if (!emp) return null;
  const stored = getStoredEmpleadoNumero(emp.id);
  if (stored != null && stored > 0) return stored;
  if (emp.numero_empleado != null && emp.numero_empleado !== "") {
    const parsed = parseInt(emp.numero_empleado, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * Calcula el siguiente número de empleado positivo disponible (secuencial: max + 1)
 */
export function getNextEmpleadoNumero(employees = [], excludeId = null) {
  const usedNumbers = new Set();
  const storedMap = getStoredEmpleadoNumeros();

  (employees || []).forEach((emp) => {
    if (excludeId && emp.id === excludeId) return;
    const num = resolveEmpleadoNumero(emp);
    if (num != null && num > 0) {
      usedNumbers.add(num);
    }
  });

  Object.entries(storedMap).forEach(([id, num]) => {
    if (excludeId && id === excludeId) return;
    const parsed = parseInt(num, 10);
    if (!isNaN(parsed) && parsed > 0) {
      usedNumbers.add(parsed);
    }
  });

  if (usedNumbers.size === 0) return 1;
  const max = Math.max(...Array.from(usedNumbers));
  return max + 1;
}

/**
 * Sincroniza y asigna automáticamente números positivos a los empleados que aún no tienen uno.
 * Respeta fielmente a los empleados que ya cuentan con un número asignado.
 */
export function syncAndAssignEmpleadoNumeros(employees = []) {
  if (!employees || employees.length === 0) return employees;

  const storedMap = getStoredEmpleadoNumeros();
  const usedNumbers = new Set();
  let updatedStored = false;

  // 1. Registrar los empleados que ya tienen número asignado
  employees.forEach((emp) => {
    let num = null;
    if (storedMap[emp.id]) {
      const parsed = parseInt(storedMap[emp.id], 10);
      if (!isNaN(parsed) && parsed > 0) num = parsed;
    }
    if (!num && emp.numero_empleado != null && emp.numero_empleado !== "") {
      const parsed = parseInt(emp.numero_empleado, 10);
      if (!isNaN(parsed) && parsed > 0) num = parsed;
    }

    if (num != null && num > 0) {
      usedNumbers.add(num);
      if (storedMap[emp.id] !== num) {
        storedMap[emp.id] = num;
        updatedStored = true;
      }
    }
  });

  // 2. Identificar a los empleados que NO tienen número
  const pendingEmps = employees.filter((emp) => {
    const num = resolveEmpleadoNumero(emp);
    return num == null || num <= 0;
  });

  if (pendingEmps.length === 0) {
    if (updatedStored) saveStoredEmpleadoNumeros(storedMap);
    // Asegurar que cada objeto empleado tenga numero_empleado poblado
    return employees.map((emp) => ({
      ...emp,
      numero_empleado: resolveEmpleadoNumero(emp),
    }));
  }

  // 3. Ordenar a los pendientes cronológicamente por fecha de ingreso / creación
  pendingEmps.sort((a, b) => {
    const fA = a.fecha_ingreso || a.created_date || "";
    const fB = b.fecha_ingreso || b.created_date || "";
    if (fA && fB) return fA.localeCompare(fB);
    if (fA && !fB) return -1;
    if (!fA && fB) return 1;
    return (a.nombre_completo || "").localeCompare(b.nombre_completo || "");
  });

  // 4. Asignar números secuenciales reales positivos (1, 2, 3...)
  let nextCandidate = 1;
  const assignments = [];

  pendingEmps.forEach((emp) => {
    while (usedNumbers.has(nextCandidate)) {
      nextCandidate++;
    }
    const assignedNum = nextCandidate;
    usedNumbers.add(assignedNum);
    storedMap[emp.id] = assignedNum;
    updatedStored = true;
    assignments.push({ emp, assignedNum });
    nextCandidate++;
  });

  saveStoredEmpleadoNumeros(storedMap);

  // 5. Intentar persistir en Supabase en segundo plano
  assignments.forEach(({ emp, assignedNum }) => {
    try {
      if (sercoApi?.entities?.Empleado?.update) {
        sercoApi.entities.Empleado.update(emp.id, { numero_empleado: assignedNum })
          .catch((err) => {
            console.warn(`Nota: No se pudo guardar numero_empleado directamente en DB para ${emp.id}:`, err?.message);
          });
      }
    } catch (err) {
      console.warn(`Nota: Error al invocar update para ${emp.id}:`, err?.message);
    }
  });

  // 6. Retornar los empleados con su numero_empleado asignado
  return employees.map((emp) => {
    const resolved = storedMap[emp.id] || resolveEmpleadoNumero(emp);
    return {
      ...emp,
      numero_empleado: resolved || null,
    };
  });
}
