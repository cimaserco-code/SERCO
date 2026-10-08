import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Package,
  FileText,
  CheckCircle2,
  Clock,
  Calculator,
  Smartphone,
  Car,
  ShieldCheck,
  ClipboardList,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Sparkles,
  UserCheck,
  UserX,
  AlertCircle,
  Tag,
  Receipt,
  Calendar,
} from "lucide-react";
import { getFacturasExtrasByMes } from "@/lib/facturasExtras";
import {
  generateOverviewPDFReport,
  generateOverviewExcelReport,
} from "@/lib/overviewReportGenerator";
import { useToast } from "@/components/ui/use-toast";

export default function Overview() {
  const navigate = useNavigate();
  const { isSuperAdmin, userSedeIds, showSedeSelector, sedeFilter } = useSedeScope();
  const { canView } = usePermissions();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date());
  const [morososModalOpen, setMorososModalOpen] = useState(false);
  const [comprasModalOpen, setComprasModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    return `${today.getFullYear()}-${mm}`;
  });

  const [selectedSedeId, setSelectedSedeId] = useState("all");
  const [sedes, setSedes] = useState([]);
  const [facturasKpiView, setFacturasKpiView] = useState("total"); // "total", "iva", "normal"

  const [rawData, setRawData] = useState({
    emp: [],
    serv: [],
    inv: [],
    docs: [],
    cobros: [],
    egresos: [],
    saldos: [],
    mantenimientos: [],
    asistencias: [],
    nominas: [],
    solicitudes: [],
    agenda: [],
    reportesSupervision: [],
    facturasExtras: [],
  });

  useEffect(() => {
    load();
  }, [currentMonth, sedeFilter]);

  // Sincronización en tiempo real orientada a eventos (Event-Driven)
  useEffect(() => {
    const handleSync = () => {
      console.log("Overview: actualizando datos en tiempo real...");
      load();
    };

    window.addEventListener("serco_empleados_updated", handleSync);
    window.addEventListener("serco_empleados_metadata_updated", handleSync);
    window.addEventListener("serco_cobros_updated", handleSync);
    window.addEventListener("serco_egresos_updated", handleSync);
    window.addEventListener("serco_agenda_updated", handleSync);
    window.addEventListener("serco_facturas_extras_updated", handleSync);

    return () => {
      window.removeEventListener("serco_empleados_updated", handleSync);
      window.removeEventListener("serco_empleados_metadata_updated", handleSync);
      window.removeEventListener("serco_cobros_updated", handleSync);
      window.removeEventListener("serco_egresos_updated", handleSync);
      window.removeEventListener("serco_agenda_updated", handleSync);
      window.removeEventListener("serco_facturas_extras_updated", handleSync);
    };
  }, [currentMonth, sedeFilter]);

  async function load() {
    setLoading(true);
    try {
      const [
        emp,
        serv,
        inv,
        docs,
        cobros,
        egresos,
        saldos,
        mantenimientos,
        asistencias,
        noms,
        sols,
        seds,
        agendaEvents,
        repSuperv,
      ] = await Promise.all([
        (canView("empleados") ? sercoApi.entities.Empleado.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("servicios") ? sercoApi.entities.Servicio.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("inventario") ? sercoApi.entities.InventarioItem.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("documentos") ? sercoApi.entities.Documento.list() : Promise.resolve([])).catch(() => []),
        (canView("cobros") ? sercoApi.entities.Cobro.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("egresos") ? sercoApi.entities.Egreso.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("egresos") && sercoApi.entities.Saldo ? sercoApi.entities.Saldo.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("egresos") && sercoApi.entities.Mantenimiento ? sercoApi.entities.Mantenimiento.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("asistencias") ? sercoApi.entities.Asistencia.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (sercoApi.entities.Nominas ? sercoApi.entities.Nominas.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("inventario") && sercoApi.entities.SolicitudInventario ? sercoApi.entities.SolicitudInventario.list() : Promise.resolve([])).catch(() => []),
        sercoApi.entities.Sede.list().catch(() => []),
        (sercoApi.entities.Agenda ? sercoApi.entities.Agenda.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (sercoApi.entities.ReporteSupervision ? sercoApi.entities.ReporteSupervision.list() : Promise.resolve([])).catch(() => []),
      ]);

      const monthlyExtras = getFacturasExtrasByMes(currentMonth);

      setRawData({
        emp: emp || [],
        serv: serv || [],
        inv: inv || [],
        docs: docs || [],
        cobros: cobros || [],
        egresos: egresos || [],
        saldos: saldos || [],
        mantenimientos: mantenimientos || [],
        asistencias: asistencias || [],
        nominas: noms || [],
        solicitudes: sols || [],
        agenda: agendaEvents || [],
        reportesSupervision: repSuperv || [],
        facturasExtras: monthlyExtras || [],
      });
      setSedes(seds || []);
      setLastSyncTime(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleMonthChange = (direction) => {
    const [yearStr, monthStr] = currentMonth.split("-");
    let year = parseInt(yearStr);
    let month = parseInt(monthStr) - 1;
    month += direction;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    const mm = String(month + 1).padStart(2, "0");
    setCurrentMonth(`${year}-${mm}`);
  };

  const formatMes = (mes) => {
    if (!mes) return "—";
    try {
      return new Date(mes + "-01T00:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    } catch {
      return mes;
    }
  };

  if (!canView("overview")) return <AccessRestricted />;

  // Filtrado por sede seleccionada
  const filteredEmp = selectedSedeId === "all" ? rawData.emp : rawData.emp.filter((e) => e.sede_id === selectedSedeId);
  const filteredServ = selectedSedeId === "all" ? rawData.serv : rawData.serv.filter((s) => s.sede_id === selectedSedeId);
  const filteredInv = selectedSedeId === "all" ? rawData.inv : rawData.inv.filter((i) => i.sede_id === selectedSedeId);
  const filteredCobros = selectedSedeId === "all" ? rawData.cobros : rawData.cobros.filter((c) => c.sede_id === selectedSedeId);
  const filteredEgresos = selectedSedeId === "all" ? rawData.egresos : rawData.egresos.filter((e) => e.sede_id === selectedSedeId);
  const filteredSaldos = selectedSedeId === "all" ? rawData.saldos : rawData.saldos.filter((s) => s.sede_id === selectedSedeId);
  const filteredMantenimientos = selectedSedeId === "all" ? rawData.mantenimientos : rawData.mantenimientos.filter((m) => m.sede_id === selectedSedeId);
  const filteredAsistencias = selectedSedeId === "all" ? rawData.asistencias : rawData.asistencias.filter((a) => a.sede_id === selectedSedeId);
  const filteredNominas = selectedSedeId === "all" ? rawData.nominas : (rawData.nominas || []).filter((n) => n.sede_id === selectedSedeId);
  const filteredSolicitudes = selectedSedeId === "all" ? rawData.solicitudes : rawData.solicitudes.filter((s) => s.sede_id === selectedSedeId);
  const filteredAgenda = selectedSedeId === "all" ? rawData.agenda : rawData.agenda.filter((a) => a.sede_id === selectedSedeId);
  const filteredExtras = selectedSedeId === "all" ? rawData.facturasExtras : rawData.facturasExtras.filter((x) => !x.sede_id || x.sede_id === selectedSedeId);

  // Helper mes anterior
  const getPrevMonth = (mStr) => {
    const [y, m] = mStr.split("-").map(Number);
    let prevY = y;
    let prevM = m - 1;
    if (prevM < 1) {
      prevM = 12;
      prevY -= 1;
    }
    return `${prevY}-${String(prevM).padStart(2, "0")}`;
  };
  const prevMonth = getPrevMonth(currentMonth);

  // 1. Personal (Altas, Bajas, Activos)
  const empActivos = filteredEmp.filter((e) => !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja)).length;
  const empBajas = filteredEmp.filter((e) => e.fecha_baja && e.fecha_baja.slice(0, 7) === currentMonth && (!e.fecha_reingreso || e.fecha_baja > e.fecha_reingreso)).length;
  const empAltas = filteredEmp.filter((e) => (e.fecha_ingreso && e.fecha_ingreso.slice(0, 7) === currentMonth) || (e.fecha_reingreso && e.fecha_reingreso.slice(0, 7) === currentMonth)).length;
  const empConSeguro = filteredEmp.filter((e) => e.seguro && (!e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja))).length;

  const prevEmpBajas = filteredEmp.filter((e) => e.fecha_baja && e.fecha_baja.slice(0, 7) === prevMonth && (!e.fecha_reingreso || e.fecha_baja > e.fecha_reingreso)).length;
  const prevEmpAltas = filteredEmp.filter((e) => (e.fecha_ingreso && e.fecha_ingreso.slice(0, 7) === prevMonth) || (e.fecha_reingreso && e.fecha_reingreso.slice(0, 7) === prevMonth)).length;

  const diffAltas = empAltas - prevEmpAltas;
  const diffBajas = empBajas - prevEmpBajas;
  const varAltas = prevEmpAltas > 0 ? (diffAltas / prevEmpAltas) * 100 : null;
  const varBajas = prevEmpBajas > 0 ? (diffBajas / prevEmpBajas) * 100 : null;
  const varAltasFormatted = varAltas !== null ? `${varAltas >= 0 ? "+" : ""}${varAltas.toFixed(1)}%` : "N/D";
  const varBajasFormatted = varBajas !== null ? `${varBajas >= 0 ? "+" : ""}${varBajas.toFixed(1)}%` : "N/D";

  // 2. Reclutamiento & Entrevistas
  const monthlyEntrevistas = (filteredAgenda || []).filter(
    (a) => a.tipo === "entrevista" && a.fecha && a.fecha.startsWith(currentMonth)
  );
  const totalEntrevistas = monthlyEntrevistas.length;
  const totalContratados = empAltas;
  const tasaConversionEntrevistas =
    totalEntrevistas > 0
      ? Math.min(100, Math.round((totalContratados / totalEntrevistas) * 100))
      : totalContratados > 0
      ? 100
      : 0;

  // 3. Servicios (Altas, Bajas, Activos)
  const servActivos = filteredServ.filter((s) => (s.estado || "activo").toLowerCase() === "activo").length;
  const servAltas = filteredServ.filter((s) => s.fecha_inicio && s.fecha_inicio.slice(0, 7) === currentMonth).length;
  const servBajas = filteredServ.filter(
    (s) =>
      (s.fecha_baja && s.fecha_baja.slice(0, 7) === currentMonth) ||
      ((s.estado || "").toLowerCase() === "inactivo" && s.fecha_inicio && s.fecha_inicio.slice(0, 7) === currentMonth)
  ).length;

  // 4. Cobranza y Facturación
  const monthlyCobros = filteredCobros.filter((c) => c.mes === currentMonth);
  const totalCobrado = monthlyCobros.filter((c) => c.estado === "pagado").reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const totalPendiente = monthlyCobros.filter((c) => c.estado !== "pagado").reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const totalFacturadoActual = totalCobrado + totalPendiente;
  const efectividadCobranza = totalFacturadoActual > 0 ? Math.round((totalCobrado / totalFacturadoActual) * 100) : 0;

  // Cobros Mes Anterior
  const prevMonthlyCobros = filteredCobros.filter((c) => c.mes === prevMonth);
  const prevTotalCobrado = prevMonthlyCobros.filter((c) => c.estado === "pagado").reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const prevTotalPendiente = prevMonthlyCobros.filter((c) => c.estado !== "pagado").reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const prevTotalFacturado = prevTotalCobrado + prevTotalPendiente;
  const varFacturado = prevTotalFacturado > 0 ? ((totalFacturadoActual - prevTotalFacturado) / prevTotalFacturado) * 100 : null;

  // 5. Servicios con Pagos Fuera de Tiempo (Cartera Vencida / Morosos)
  const todayStr = new Date().toISOString().slice(0, 10);
  const serviciosMorosos = filteredCobros
    .filter((c) => {
      if (c.estado === "pagado") return false;
      const montoNum = Number(c.monto) || 0;
      if (montoNum <= 0) return false;
      if (c.fecha_limite_pago && c.fecha_limite_pago < todayStr) return true;
      if (c.mes && c.mes < currentMonth) return true;
      return false;
    })
    .map((c) => {
      const deadline = c.fecha_limite_pago || `${c.mes || currentMonth}-10`;
      const diffMs = Math.max(0, new Date() - new Date(deadline));
      const diasAtraso = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        id: c.id,
        nombre: c.servicio_nombre || "Servicio sin nombre",
        fechaLimite: c.fecha_limite_pago || "Sin fecha",
        diasAtraso: diasAtraso > 0 ? diasAtraso : 1,
        monto: Number(c.monto) || 0,
      };
    })
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  const totalMontoMoroso = serviciosMorosos.reduce((sum, s) => sum + s.monto, 0);

  // 6. Egresos y Compras de Inventario
  const monthlyEgresos = filteredEgresos.filter((e) => e.mes === currentMonth || (e.fecha && e.fecha.slice(0, 7) === currentMonth));
  const totalEgresosDirectos = monthlyEgresos.reduce((sum, e) => sum + (Number(e.monto) || 0), 0);

  const monthlySaldos = filteredSaldos.filter((s) => s.mes === currentMonth || (s.fecha && s.fecha.slice(0, 7) === currentMonth));
  const totalSaldos = monthlySaldos.reduce((sum, s) => sum + (Number(s.monto) || 0), 0);

  const monthlyMantenimientos = filteredMantenimientos.filter((m) => m.mes === currentMonth || (m.fecha && m.fecha.slice(0, 7) === currentMonth));
  const totalMantenimientos = monthlyMantenimientos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  const totalEgresosCombinado = totalEgresosDirectos + totalSaldos + totalMantenimientos;
  const netBalance = totalCobrado - totalEgresosCombinado;

  // Inversión en Compras de Inventario
  const isGastoInventario = (e) => {
    if (!e) return false;
    const combined = [
      e.concepto,
      e.descripcion,
      e.categoria,
      e.subcategoria,
      e.proveedor,
      e.observaciones,
      e.tipo,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const keywords = [
      "inventario",
      "compra",
      "uniforme",
      "material",
      "equipo",
      "insumo",
      "almacen",
      "almacén",
      "articulos",
      "artículos",
      "seguridad",
      "radio",
      "bordado",
      "zapater",
      "zapato",
      "calzado",
      "bota",
      "pantalon",
      "pantalones",
      "polo",
      "playera",
      "camisa",
      "camisola",
      "corbata",
      "saco",
      "traje",
      "cinto",
      "cinturon",
      "cinturón",
      "fornitura",
      "chaleco",
      "tactico",
      "táctico",
      "lampara",
      "lámpara",
      "gas pimienta",
      "tonfa",
      "baston",
      "bastón",
      "adosa",
      "papeleria",
      "papelería",
      "d gala",
      "milano",
    ];

    return keywords.some((kw) => combined.includes(kw));
  };

  const egresosInventario = monthlyEgresos.filter(isGastoInventario);
  const inversionInventario = egresosInventario.reduce((sum, e) => sum + (Number(e.monto) || 0), 0);

  // Métricas adicionales de inventario
  const inventarioItemsCount = (filteredInv || []).length;
  const inventarioTotalStock = (filteredInv || []).reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
  const solsPendientes = (filteredSolicitudes || []).filter(
    (s) => (s.estado || "").toLowerCase() === "pendiente"
  ).length;

  // 7. Supervisión Operativa (Supervisor Más Activo)
  const monthlySupervisionesAgenda = (filteredAgenda || []).filter(
    (a) => a.tipo === "visita_supervision" && a.fecha && a.fecha.startsWith(currentMonth)
  );
  const monthlySupervisionesReportes = (rawData.reportesSupervision || []).filter(
    (r) => (r.fecha && r.fecha.startsWith(currentMonth)) || (r.created_at && r.created_at.startsWith(currentMonth))
  );

  const supervisorCounts = {};
  monthlySupervisionesAgenda.forEach((a) => {
    const name = a.responsable_nombre?.trim() || a.responsable?.trim() || "Supervisor Asignado";
    supervisorCounts[name] = (supervisorCounts[name] || 0) + 1;
  });
  monthlySupervisionesReportes.forEach((r) => {
    const name = r.supervisor_nombre?.trim() || r.supervisor?.trim() || r.usuario?.trim() || "Supervisor Asignado";
    supervisorCounts[name] = (supervisorCounts[name] || 0) + 1;
  });

  let topSupervisorNombre = "";
  let topSupervisorVisitas = 0;
  Object.entries(supervisorCounts).forEach(([name, count]) => {
    if (count > topSupervisorVisitas) {
      topSupervisorVisitas = count;
      topSupervisorNombre = name;
    }
  });

  // Facturas Extras del Mes
  const totalFacturasExtrasMonto = filteredExtras.reduce((sum, x) => sum + (Number(x.monto_total || x.monto || 0)), 0);

  // 8. Nóminas
  const monthlyNominas = filteredNominas.filter((n) => n.mes && n.mes.startsWith(currentMonth));
  const totalNominasPagadas = monthlyNominas.reduce((sum, n) => sum + (Number(n.total_pagado) || 0), 0);
  const totalNominasEmpleados = new Set(monthlyNominas.map((n) => n.empleado_id)).size;

  // Asistencias
  const monthlyAsistencias = filteredAsistencias.filter((a) => a.fecha && a.fecha.slice(0, 7) === currentMonth);
  const asistOk = monthlyAsistencias.filter((a) => a.estado === "A" || a.estado === "E").length;
  const asistFaltas = monthlyAsistencias.filter((a) => a.estado === "F").length;

  // Paquete consolidado para generar reportes
  const consolidatedReportData = {
    mes: currentMonth,
    mesNombre: formatMes(currentMonth),
    totalFacturado: totalFacturadoActual,
    totalCobrado,
    totalPendiente,
    efectividadCobranza,
    totalEgresos: totalEgresosCombinado,
    flujoNeto: netBalance,
    inversionInventario,
    empActivos,
    empAltas,
    empBajas,
    varAltasFormatted,
    varBajasFormatted,
    totalEntrevistas,
    totalContratados,
    tasaConversionEntrevistas,
    servActivos,
    servAltas,
    servBajas,
    serviciosMorosos,
    totalMontoMoroso,
    topSupervisorNombre,
    topSupervisorVisitas,
    facturasExtras: filteredExtras,
    totalFacturasExtrasMonto,
  };

  const handleDownloadPDF = async () => {
    setGeneratingPdf(true);
    try {
      await generateOverviewPDFReport(consolidatedReportData);
      toast({
        title: "Reporte Descargado",
        description: "El informe ejecutivo mensual en PDF ha sido generado exitosamente.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al generar reporte",
        description: "No se pudo crear el archivo PDF.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadExcel = () => {
    try {
      generateOverviewExcelReport(consolidatedReportData);
      toast({
        title: "Reporte Exportado",
        description: "La matriz de estructura y resumen en CSV/Excel se descargó con éxito.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al exportar",
        description: "Ocurrió un error al generar el archivo.",
        variant: "destructive",
      });
    }
  };

  const availableSedes = isSuperAdmin ? sedes : sedes.filter((s) => userSedeIds.includes(s.id));

  return (
    <div className="space-y-6">
      {/* ══════════════════ ENCABEZADO Y CONTROLES PRINCIPALES ══════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Centro de Mando & Overview</h2>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-bold">
              En Vivo
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>Indicadores operativos, financieros y estructura consolidada</span>
            <span>•</span>
            <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Sincronizado: {lastSyncTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón de Refresco Manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="h-9 gap-1.5 text-xs font-semibold hover:border-primary"
            title="Recargar todos los datos desde la base de datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>

          {/* Selector de Sede */}
          {showSedeSelector && (
            <div className="w-44 sm:w-48">
              <Select value={selectedSedeId} onValueChange={setSelectedSedeId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Filtrar por Sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {availableSedes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Carrusel de Mes */}
          <div className="flex items-center gap-1 bg-muted/60 px-2 py-1 rounded-lg border h-9">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-semibold capitalize min-w-[110px] text-center">
              {formatMes(currentMonth)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Botones de Descarga de Reportes */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadExcel}
              className="h-9 gap-1.5 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
              title="Descargar matriz en formato Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Excel</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={generatingPdf}
              className="h-9 gap-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
              title="Generar informe ejecutivo oficial en PDF"
            >
              <Download className="w-4 h-4" />
              <span>{generatingPdf ? "Generando..." : "Reporte PDF"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ══════════════════ 1. INSIGHTS INTELIGENTES Y NARRATIVA EJECUTIVA ══════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Resumen Inteligente del Mes ({formatMes(currentMonth)})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Cálculo automatizado con cruce de todos los módulos
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Talento Humano y Reclutamiento */}
          <Card className="border shadow-xs bg-gradient-to-br from-card to-blue-50/20 dark:to-blue-950/10">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <Users className="w-4 h-4" /> Talento & Reclutamiento
                </span>
                <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200">
                  {empActivos} activos
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2.5 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Altas del mes:</span>
                  <span className="font-bold text-emerald-600">
                    +{empAltas} ({varAltasFormatted} vs ant.)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bajas del mes:</span>
                  <span className="font-bold text-rose-600">
                    -{empBajas} ({varBajasFormatted} vs ant.)
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Entrevistas agendadas:</span>
                  <span className="font-semibold">{totalEntrevistas}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Contrataciones concretadas:</span>
                  <span className="font-bold text-emerald-700">+{totalContratados}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 pt-0.5">
                  <span>Efectividad Reclutamiento:</span>
                  <span>{tasaConversionEntrevistas}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Cartera, Servicios y Morosidad */}
          <Card className="border shadow-xs bg-gradient-to-br from-card to-amber-50/20 dark:to-amber-950/10">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Briefcase className="w-4 h-4" /> Servicios & Morosidad
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    serviciosMorosos.length > 0
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {serviciosMorosos.length} moroso(s)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2.5 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Servicios Activos:</span>
                  <span className="font-bold text-foreground">{servActivos}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Movimiento de mes:</span>
                  <span className="font-medium">
                    +{servAltas} nuevos / -{servBajas} bajas
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Pagos fuera de tiempo:</span>
                  <span className="font-bold text-rose-600">${totalMontoMoroso.toLocaleString("es-MX")}</span>
                </div>

                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setMorososModalOpen(true)}
                  className="w-full h-7 text-[11px] gap-1 border-amber-300 text-amber-800 bg-amber-50/50 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 font-semibold"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Ver Cartera Vencida ({serviciosMorosos.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Cobranza & Compras de Inventario */}
          <Card className="border shadow-xs bg-gradient-to-br from-card to-emerald-50/20 dark:to-emerald-950/10">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <DollarSign className="w-4 h-4" /> Cobranza & Almacén
                </span>
                <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                  {efectividadCobranza}% Cobrado
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2.5 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cobrado Efectivo:</span>
                  <span className="font-bold text-emerald-600">${totalCobrado.toLocaleString("es-MX")}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Meta esperada facturada:</span>
                  <span className="font-semibold text-foreground">${totalFacturadoActual.toLocaleString("es-MX")}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Package className="w-3.5 h-3.5 text-violet-600" /> Inversión en Inventario:
                  </span>
                  <span className="font-bold text-xs text-violet-700 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded border border-violet-200">
                    ${inversionInventario.toLocaleString("es-MX")}
                  </span>
                </div>
                {egresosInventario.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setComprasModalOpen(true)}
                    className="w-full h-6 text-[11px] text-violet-700 hover:text-violet-800 hover:bg-violet-50 px-1 font-semibold flex items-center justify-between"
                  >
                    <span>Ver compras ({egresosInventario.length})</span>
                    <span className="underline">Desglose →</span>
                  </Button>
                )}
                {totalFacturasExtrasMonto > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-dashed">
                    <span>Facturas extras del mes:</span>
                    <span className="font-semibold text-indigo-600">
                      ${totalFacturasExtrasMonto.toLocaleString("es-MX")} ({filteredExtras.length})
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Operaciones y Supervisión en Campo */}
          <Card className="border shadow-xs bg-gradient-to-br from-card to-indigo-50/20 dark:to-indigo-950/10">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-indigo-600">
                  <ShieldCheck className="w-4 h-4" /> Supervisión Operativa
                </span>
                <Badge variant="outline" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                  {topSupervisorVisitas} visitas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2.5 text-xs">
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Supervisor más activo:</div>
                <div className="font-bold text-sm text-foreground truncate">
                  {topSupervisorNombre || "Sin registros en agenda"}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Encabezó la supervisión con <strong className="text-foreground">{topSupervisorVisitas}</strong> visitas en campo.
                </p>
              </div>

              <div className="pt-2 border-t border-dashed flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Supervisiones totales:</span>
                <span className="font-bold text-indigo-700">
                  {monthlySupervisionesAgenda.length + monthlySupervisionesReportes.length} registradas
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ══════════════════ 2. TARJETAS DE MÓDULOS OPERATIVOS Y FINANCIEROS ══════════════════ */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Facturas */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/facturas")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" /> Facturación & Cobros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1 mb-2 bg-muted p-0.5 rounded-md text-[10px] w-fit" onClick={(e) => e.stopPropagation()}>
              <button
                className={`px-2 py-0.5 rounded-sm transition-all ${
                  facturasKpiView === "total" ? "bg-background shadow-sm font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFacturasKpiView("total")}
              >
                Normal + IVA
              </button>
              <button
                className={`px-2 py-0.5 rounded-sm transition-all ${
                  facturasKpiView === "normal" ? "bg-background shadow-sm font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFacturasKpiView("normal")}
              >
                Normal
              </button>
              <button
                className={`px-2 py-0.5 rounded-sm transition-all ${
                  facturasKpiView === "iva" ? "bg-background shadow-sm font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFacturasKpiView("iva")}
              >
                IVA
              </button>
            </div>

            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Pagado</span>
              <span className="font-semibold text-emerald-600">
                ${loading ? "—" : Math.round(totalCobrado * (facturasKpiView === "total" ? 1.16 : facturasKpiView === "iva" ? 0.16 : 1.0)).toLocaleString("es-MX")}
              </span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Pendiente</span>
              <span className="font-semibold text-amber-600">
                ${loading ? "—" : Math.round(totalPendiente * (facturasKpiView === "total" ? 1.16 : facturasKpiView === "iva" ? 0.16 : 1.0)).toLocaleString("es-MX")}
              </span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Total Facturado</span>
              <span className="font-bold text-blue-600">
                ${loading ? "—" : Math.round((totalCobrado + totalPendiente) * (facturasKpiView === "total" ? 1.16 : facturasKpiView === "iva" ? 0.16 : 1.0)).toLocaleString("es-MX")}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-0.5">
              <span className="text-muted-foreground">vs Mes Anterior:</span>
              {loading ? (
                <span className="text-muted-foreground">—</span>
              ) : varFacturado !== null ? (
                <span className={`inline-flex items-center gap-0.5 font-semibold ${varFacturado >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {varFacturado >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {varFacturado >= 0 ? `+${varFacturado.toFixed(1)}%` : `${varFacturado.toFixed(1)}%`}
                </span>
              ) : (
                <span className="text-muted-foreground font-medium">Sin datos prev.</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Egresos / Gastos */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/egresos")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-500" /> Gastos y Egresos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Egresos Generales</span>
              <span className="font-semibold text-rose-600">${loading ? "—" : totalEgresosDirectos.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" /> Celulares
              </span>
              <span className="font-semibold text-slate-700">${loading ? "—" : totalSaldos.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Car className="w-3.5 h-3.5" /> Automóviles
              </span>
              <span className="font-semibold text-slate-700">${loading ? "—" : totalMantenimientos.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm font-semibold">Total Gastado</span>
              <span className="font-bold text-rose-600">${loading ? "—" : totalEgresosCombinado.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Flujo Neto (Cobrado - Gastos)</span>
              <span className={`font-bold ${netBalance >= 0 ? "text-green-600" : "text-rose-600"}`}>
                ${loading ? "—" : netBalance.toLocaleString("es-MX")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Personal */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/empleados")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Colaboradores Activos</span>
              <span className="font-semibold text-blue-600">{loading ? "—" : empActivos}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Con Seguro (IMSS)</span>
              <span className="font-semibold text-emerald-600">{loading ? "—" : empConSeguro}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Altas del Mes</span>
              <span className="font-semibold text-sky-600">{loading ? "—" : `+${empAltas}`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bajas del Mes</span>
              <span className="font-semibold text-rose-600">{loading ? "—" : `-${empBajas}`}</span>
            </div>
          </CardContent>
        </Card>

        {/* Servicios */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/servicios")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-500" /> Servicios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Activos</span>
              <span className="font-semibold text-indigo-600">{loading ? "—" : servActivos}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Nuevos en el Mes</span>
              <span className="font-semibold text-emerald-600">+{servAltas}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bajas en el Mes</span>
              <span className="font-semibold text-rose-600">-{servBajas}</span>
            </div>
          </CardContent>
        </Card>

        {/* Asistencias */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/asistencias")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-500" /> Registro de Asistencias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Asistencias Confirmadas</span>
              <span className="font-semibold text-teal-600">{loading ? "—" : asistOk}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Faltas Reportadas</span>
              <span className="font-semibold text-rose-600">{loading ? "—" : asistFaltas}</span>
            </div>
          </CardContent>
        </Card>

        {/* Nóminas */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/nominas")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" /> Nóminas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Total Dispersado</span>
              <span className="font-bold text-indigo-600">${loading ? "—" : totalNominasPagadas.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Colaboradores Calculados</span>
              <span className="font-semibold text-slate-700">{loading ? "—" : totalNominasEmpleados}</span>
            </div>
          </CardContent>
        </Card>

        {/* Almacén e Inventario */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/inventario")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-600" /> Almacén e Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Inversión Compras Mes</span>
              <span className="font-bold text-violet-700">${loading ? "—" : inversionInventario.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Artículos en Catálogo</span>
              <span className="font-semibold text-slate-700">{loading ? "—" : inventarioItemsCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Stock Total de Insumos</span>
              <span className="font-semibold text-slate-700">{loading ? "—" : `${inventarioTotalStock} pzas`}</span>
            </div>
            {solsPendientes > 0 && (
              <div className="flex justify-between items-center text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded">
                <span className="font-medium">Solicitudes pendientes</span>
                <span className="font-bold">{solsPendientes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════ MODAL DE CARTERA VENCIDA / SERVICIOS MOROSOS ══════════════════ */}
      <Dialog open={morososModalOpen} onOpenChange={setMorososModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Servicios con Pagos Fuera de Tiempo
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Detalle de clientes que no han liquidado su factura vencida para seguimiento y cobranza.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              <span className="font-semibold">Monto total vencido por cobrar:</span>
              <span className="font-bold text-sm">${totalMontoMoroso.toLocaleString("es-MX")}</span>
            </div>

            {serviciosMorosos.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                No hay servicios con pagos fuera de tiempo registrados.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden divide-y">
                {serviciosMorosos.map((sm) => (
                  <div key={sm.id} className="p-3 flex items-center justify-between gap-3 bg-card hover:bg-muted/40">
                    <div>
                      <div className="font-semibold text-foreground text-sm">{sm.nombre}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Límite: <strong className="text-foreground">{sm.fechaLimite}</strong>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-rose-600 text-sm">
                        ${sm.monto.toLocaleString("es-MX")}
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-bold mt-0.5">
                        {sm.diasAtraso} día(s) de atraso
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMorososModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setMorososModalOpen(false);
                navigate("/facturas");
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Ir a Facturas & Cobros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ MODAL DE COMPRAS DE INVENTARIO ══════════════════ */}
      <Dialog open={comprasModalOpen} onOpenChange={setComprasModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Compras e Inversión en Inventario — {formatMes(currentMonth)}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Desglose de compras de uniformes, equipo táctico, calzado y suministros registrados en egresos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-violet-50 border border-violet-200 text-violet-900">
              <span className="font-semibold">Inversión acumulada del mes:</span>
              <span className="font-bold text-base text-violet-700">
                ${inversionInventario.toLocaleString("es-MX")}
              </span>
            </div>

            {egresosInventario.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                No se encontraron compras de inventario registradas en {formatMes(currentMonth)}.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden divide-y">
                {egresosInventario.map((g, idx) => (
                  <div key={g.id || idx} className="p-3 flex items-start justify-between gap-3 bg-card hover:bg-muted/40">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                        {g.concepto || "Compra de inventario"}
                        {g.categoria && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            {g.categoria}
                          </Badge>
                        )}
                      </div>
                      {g.descripcion && (
                        <div className="text-xs text-muted-foreground">
                          {g.descripcion}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>Fecha: <strong className="text-foreground">{g.fecha || g.mes}</strong></span>
                        {g.forma_pago && <span>• Pago: {g.forma_pago}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-violet-700 text-sm">
                        ${(Number(g.monto) || 0).toLocaleString("es-MX")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setComprasModalOpen(false)}>
              Cerrar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setComprasModalOpen(false);
                  navigate("/egresos");
                }}
              >
                Ir a Egresos
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setComprasModalOpen(false);
                  navigate("/inventario");
                }}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold"
              >
                Ir a Almacén
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
