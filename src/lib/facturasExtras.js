import { supabase } from "@/lib/supabaseClient";

const STORAGE_KEY = "serco_facturas_extras";

/**
 * Obtiene todas las facturas extras registradas en el sistema
 */
export function getStoredFacturasExtras() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Error leyendo serco_facturas_extras:", e);
    return [];
  }
}

/**
 * Guarda el arreglo completo de facturas extras y dispara evento global
 */
export function saveStoredFacturasExtras(extras) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(extras));
    window.dispatchEvent(new CustomEvent("serco_facturas_extras_updated", { detail: extras }));
    window.dispatchEvent(new CustomEvent("serco_cobros_updated"));
  } catch (e) {
    console.warn("Error guardando serco_facturas_extras:", e);
  }
}

/**
 * Obtiene las facturas extras de un servicio específico, opcionalmente filtradas por mes
 */
export function getFacturasExtrasByServicio(servicioId, mes = null) {
  if (!servicioId) return [];
  const all = getStoredFacturasExtras();
  return all.filter((item) => {
    if (item.servicio_id !== servicioId) return false;
    if (mes && item.mes && item.mes !== mes) return false;
    return true;
  });
}

/**
 * Obtiene todas las facturas extras de un mes determinado
 */
export function getFacturasExtrasByMes(mes) {
  if (!mes) return [];
  const all = getStoredFacturasExtras();
  return all.filter((item) => item.mes === mes);
}

/**
 * Crea o actualiza una factura extra
 */
export async function saveFacturaExtra(factura) {
  const all = getStoredFacturasExtras();
  const id = factura.id || `extra-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  const montoBase = Number(factura.monto_base || factura.monto || 0);
  const calcularIva = factura.calcular_iva !== undefined ? Boolean(factura.calcular_iva) : true;
  const iva = calcularIva ? Math.round(montoBase * 0.16) : 0;
  const montoTotal = montoBase + iva;

  const itemToSave = {
    ...factura,
    id,
    monto_base: montoBase,
    calcular_iva: calcularIva,
    iva,
    monto_total: montoTotal,
    estado: factura.estado || "pendiente",
    fecha: factura.fecha || new Date().toISOString().slice(0, 10),
    mes: factura.mes || (factura.fecha ? factura.fecha.slice(0, 7) : new Date().toISOString().slice(0, 7)),
    updated_at: new Date().toISOString(),
  };

  const existingIndex = all.findIndex((x) => x.id === id);
  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...all];
    updatedList[existingIndex] = itemToSave;
  } else {
    itemToSave.created_at = new Date().toISOString();
    updatedList = [itemToSave, ...all];
  }

  saveStoredFacturasExtras(updatedList);

  // Intentar persistir en Supabase si la tabla facturas_extras existe
  try {
    if (supabase) {
      const isValidUuid = (val) =>
        typeof val === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

      const remotePayload = {
        ...itemToSave,
        servicio_id: isValidUuid(itemToSave.servicio_id) ? itemToSave.servicio_id.trim() : null,
        sede_id: isValidUuid(itemToSave.sede_id) ? itemToSave.sede_id.trim() : null,
        cobro_id: isValidUuid(itemToSave.cobro_id) ? itemToSave.cobro_id.trim() : null,
      };

      await supabase.from("facturas_extras").upsert(remotePayload).catch(() => {});
    }
  } catch {
    // Ignorar si aún no existe en Supabase
  }

  return itemToSave;
}

/**
 * Elimina una factura extra
 */
export async function deleteFacturaExtra(id) {
  if (!id) return;
  const all = getStoredFacturasExtras();
  const updatedList = all.filter((x) => x.id !== id);
  saveStoredFacturasExtras(updatedList);

  try {
    if (supabase) {
      await supabase.from("facturas_extras").delete().eq("id", id).catch(() => {});
    }
  } catch {
    // Ignorar
  }
}

/**
 * Cambia el estado de una factura extra (ej. de pendiente a pagado)
 */
export async function toggleEstadoFacturaExtra(id, nuevoEstado, fechaPago = null) {
  const all = getStoredFacturasExtras();
  const target = all.find((x) => x.id === id);
  if (!target) return null;

  const updated = {
    ...target,
    estado: nuevoEstado,
    fecha_pago: nuevoEstado === "pagado" ? (fechaPago || new Date().toISOString().slice(0, 10)) : null,
    updated_at: new Date().toISOString(),
  };

  return await saveFacturaExtra(updated);
}

/**
 * Sincroniza las facturas extras locales con los datos remotos de Supabase si la tabla existe
 */
export async function syncFacturasExtrasWithRemote() {
  try {
    if (!supabase) return;
    const { data, error } = await supabase.from("facturas_extras").select("*");
    if (!error && Array.isArray(data) && data.length > 0) {
      const local = getStoredFacturasExtras();
      const map = new Map();
      local.forEach((item) => map.set(item.id, item));
      data.forEach((item) => map.set(item.id, item));
      const merged = Array.from(map.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent("serco_facturas_extras_updated", { detail: merged }));
    }
  } catch (e) {
    // Si la tabla aún no se ha creado en Supabase, se ignora silenciosamente
  }
}
