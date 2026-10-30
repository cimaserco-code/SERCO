/**
 * Utilidades para vigencia de recargas telefónicas y cálculo de fechas de vencimiento.
 * Reglas de vigencia estándar en telefonía móvil (Telcel, AT&T, Movistar, Bait, Oxxo Cel):
 * - <= $30: 3 días
 * - $50: 7 días
 * - $100: 15 días (regla estándar y solicitada)
 * - $150: 26 días
 * - >= $200: 30 días
 */

export function getRecargaVigenciaDias(monto) {
  const m = Number(monto) || 0;
  if (m <= 30) return 3;
  if (m < 100) return 7;
  if (m < 150) return 15;
  if (m < 200) return 26;
  return 30;
}

export function getFechaVencimientoRecarga(fecha, monto) {
  if (!fecha) return null;
  const dias = getRecargaVigenciaDias(monto);
  const parts = String(fecha).slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
