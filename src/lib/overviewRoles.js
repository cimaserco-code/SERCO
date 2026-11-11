export function normalizeRoleName(role) {
  return (role || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const FULL_OVERVIEW_ROLES = new Set([
  "admin",
  "administrador",
  "super administrador",
  "super_admin",
  "superadmin",
  "ceo",
  "director",
  "director general",
  "director_general",
  "gerente general",
]);

/**
 * Classifies a user's role into an Overview access scope:
 * - "full": Admin, CEO, Director General / Director (or custom non-area role with overview permission)
 * - "rh": Director de Recursos Humanos / RH
 * - "finanzas": Director de Finanzas
 * - "operativo": Director Operativo / Operaciones / Supervisiones
 */
export function getOverviewScope(role) {
  const norm = normalizeRoleName(role);
  if (!norm) return "full";
  if (FULL_OVERVIEW_ROLES.has(norm) || norm.includes("director general")) {
    return "full";
  }

  if (norm.includes("director")) {
    if (
      norm.includes("recursos humanos") ||
      norm.includes("capital humano") ||
      norm.includes("talento") ||
      /\brh\b/.test(norm)
    ) {
      return "rh";
    }
    if (norm.includes("finanz")) {
      return "finanzas";
    }
    if (
      norm.includes("operativ") ||
      norm.includes("operacion") ||
      norm.includes("supervis")
    ) {
      return "operativo";
    }
  }

  return "full";
}

export function isAreaDirectorRole(role) {
  const scope = getOverviewScope(role);
  return scope === "rh" || scope === "finanzas" || scope === "operativo";
}

export const OVERVIEW_SCOPE_CONFIG = {
  full: {
    scope: "full",
    label: "Vista Ejecutiva Completa",
    subtitle: "Indicadores operativos, financieros y estructura consolidada",
    showTalento: true,
    showEntrevistas: true,
    showPersonalCard: true,
    showAsistencias: true,
    showServicios: true,
    showMorosidad: true,
    showCobranza: true,
    showFacturasCard: true,
    showEgresosCard: true,
    showNominasCard: true,
    showInventarioFinanzas: true,
    showInventarioCard: true,
    showSupervision: true,
  },
  rh: {
    scope: "rh",
    label: "Director de Recursos Humanos",
    subtitle: "Indicadores de talento humano, reclutamiento, cobertura IMSS y asistencias",
    showTalento: true,
    showEntrevistas: true,
    showPersonalCard: true,
    showAsistencias: true,
    showServicios: false,
    showMorosidad: false,
    showCobranza: false,
    showFacturasCard: false,
    showEgresosCard: false,
    showNominasCard: false,
    showInventarioFinanzas: false,
    showInventarioCard: false,
    showSupervision: false,
  },
  finanzas: {
    scope: "finanzas",
    label: "Director de Finanzas",
    subtitle: "Indicadores de facturación, cobranza, morosidad, egresos, nóminas e inversión",
    showTalento: false,
    showEntrevistas: false,
    showPersonalCard: false,
    showAsistencias: false,
    showServicios: true,
    showMorosidad: true,
    showCobranza: true,
    showFacturasCard: true,
    showEgresosCard: true,
    showNominasCard: true,
    showInventarioFinanzas: true,
    showInventarioCard: true,
    showSupervision: false,
  },
  operativo: {
    scope: "operativo",
    label: "Director Operativo",
    subtitle: "Indicadores de operación en campo, servicios activos, supervisión, asistencias e insumos",
    showTalento: false,
    showEntrevistas: false,
    showPersonalCard: false,
    showAsistencias: true,
    showServicios: true,
    showMorosidad: false,
    showCobranza: false,
    showFacturasCard: false,
    showEgresosCard: false,
    showNominasCard: false,
    showInventarioFinanzas: false,
    showInventarioCard: true,
    showSupervision: true,
  },
};

export function getOverviewScopeConfig(role) {
  return OVERVIEW_SCOPE_CONFIG[getOverviewScope(role)] || OVERVIEW_SCOPE_CONFIG.full;
}
