import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  DollarSign,
  TrendingDown,
  Package,
  FileText,
  CheckCircle2,
  Clock,
  Calculator,
  Smartphone,
  Car,
  ShieldCheck,
  ClipboardList
} from "lucide-react";

export default function Overview() {
  const navigate = useNavigate();
  const { isSuperAdmin, userSedeIds, showSedeSelector, sedeFilter } = useSedeScope();
  const { canView } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
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
    rondines: [],
    reportes: [],
    solicitudes: []
  });

  useEffect(() => {
    load();
  }, [currentMonth, sedeFilter]);

  async function load() {
    setLoading(true);
    try {
      const [emp, serv, inv, docs, cobros, egresos, saldos, mantenimientos, asistencias, noms, rondines, reportes, sols, seds] = await Promise.all([
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
        (canView("supervisiones") && sercoApi.entities.Rondin ? sercoApi.entities.Rondin.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("supervisiones") && sercoApi.entities.ReporteSupervision ? sercoApi.entities.ReporteSupervision.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
        (canView("inventario") && sercoApi.entities.SolicitudInventario ? sercoApi.entities.SolicitudInventario.list() : Promise.resolve([])).catch(() => []),
        sercoApi.entities.Sede.list().catch(() => [])
      ]);

      setRawData({
        emp,
        serv,
        inv,
        docs,
        cobros,
        egresos,
        saldos,
        mantenimientos,
        asistencias,
        nominas: noms,
        rondines,
        reportes,
        solicitudes: sols
      });
      setSedes(seds);
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
    const mm = String(month + 1).padStart(2, '0');
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

  // Filter lists based on selectedSedeId (if not "all")
  const filteredEmp = selectedSedeId === "all" ? rawData.emp : rawData.emp.filter(e => e.sede_id === selectedSedeId);
  const filteredServ = selectedSedeId === "all" ? rawData.serv : rawData.serv.filter(s => s.sede_id === selectedSedeId);
  const filteredInv = selectedSedeId === "all" ? rawData.inv : rawData.inv.filter(i => i.sede_id === selectedSedeId);
  const filteredCobros = selectedSedeId === "all" ? rawData.cobros : rawData.cobros.filter(c => c.sede_id === selectedSedeId);
  const filteredEgresos = selectedSedeId === "all" ? rawData.egresos : rawData.egresos.filter(e => e.sede_id === selectedSedeId);
  const filteredSaldos = selectedSedeId === "all" ? rawData.saldos : rawData.saldos.filter(s => s.sede_id === selectedSedeId);
  const filteredMantenimientos = selectedSedeId === "all" ? rawData.mantenimientos : rawData.mantenimientos.filter(m => m.sede_id === selectedSedeId);
  const filteredAsistencias = selectedSedeId === "all" ? rawData.asistencias : rawData.asistencias.filter(a => a.sede_id === selectedSedeId);
  const filteredNominas = selectedSedeId === "all" ? rawData.nominas : (rawData.nominas || []).filter(n => n.sede_id === selectedSedeId);
  const filteredRondines = selectedSedeId === "all" ? rawData.rondines : rawData.rondines.filter(r => r.sede_id === selectedSedeId);
  const filteredReportes = selectedSedeId === "all" ? rawData.reportes : rawData.reportes.filter(r => r.sede_id === selectedSedeId);
  const filteredSolicitudes = selectedSedeId === "all" ? rawData.solicitudes : rawData.solicitudes.filter(s => s.sede_id === selectedSedeId);

  // Stats calculation
  const empActivos = filteredEmp.filter(e => !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja)).length;
  const empBajas = filteredEmp.filter(e => e.fecha_baja && e.fecha_baja.slice(0, 7) === currentMonth && (!e.fecha_reingreso || e.fecha_baja > e.fecha_reingreso)).length;
  const empAltas = filteredEmp.filter(e => 
    (e.fecha_ingreso && e.fecha_ingreso.slice(0, 7) === currentMonth) || 
    (e.fecha_reingreso && e.fecha_reingreso.slice(0, 7) === currentMonth)
  ).length;
  const empConSeguro = filteredEmp.filter(e => e.seguro && (!e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja))).length;

  const servActivos = filteredServ.filter(s => (s.estado || "activo").toLowerCase() === "activo").length;
  const servInactivos = filteredServ.filter(s => 
    ((s.estado || "activo").toLowerCase() === "suspendido" || (s.estado || "activo").toLowerCase() === "inactivo") &&
    s.fecha_inicio && s.fecha_inicio.slice(0, 7) === currentMonth
  ).length;

  const monthlyCobros = filteredCobros.filter(c => c.mes === currentMonth);
  const totalCobrado = monthlyCobros.filter(c => c.estado === 'pagado').reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const totalPendiente = monthlyCobros.filter(c => c.estado !== 'pagado').reduce((sum, c) => sum + (Number(c.monto) || 0), 0);

  // Egresos breakdown
  const monthlyEgresos = filteredEgresos.filter(e => (e.mes === currentMonth || (e.fecha && e.fecha.slice(0, 7) === currentMonth)));
  const totalEgresosDirectos = monthlyEgresos.reduce((sum, e) => sum + (Number(e.monto) || 0), 0);

  const monthlySaldos = filteredSaldos.filter(s => (s.mes === currentMonth || (s.fecha && s.fecha.slice(0, 7) === currentMonth)));
  const totalSaldos = monthlySaldos.reduce((sum, s) => sum + (Number(s.monto) || 0), 0);

  const monthlyMantenimientos = filteredMantenimientos.filter(m => (m.mes === currentMonth || (m.fecha && m.fecha.slice(0, 7) === currentMonth)));
  const totalMantenimientos = monthlyMantenimientos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  const totalEgresosCombinado = totalEgresosDirectos + totalSaldos + totalMantenimientos;

  const inventarioItems = filteredInv.length;
  const inventarioTotalStock = filteredInv.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0);
  const solsPendientes = filteredSolicitudes.filter(s => s.estado === 'pendiente').length;

  const monthlyAsistencias = filteredAsistencias.filter(a => a.fecha && a.fecha.slice(0, 7) === currentMonth);
  const asistOk = monthlyAsistencias.filter(a => a.estado === "A" || a.estado === "E").length;
  const asistFaltas = monthlyAsistencias.filter(a => a.estado === "F").length;

  const netBalance = totalCobrado - totalEgresosCombinado;

  const monthlyNominas = filteredNominas.filter(n => n.mes && n.mes.startsWith(currentMonth));
  const totalNominasPagadas = monthlyNominas.reduce((sum, n) => sum + (Number(n.total_pagado) || 0), 0);
  const totalNominasEmpleados = new Set(monthlyNominas.map(n => n.empleado_id)).size;

  const monthlyRondines = filteredRondines.filter(r => (r.fecha && r.fecha.slice(0, 7) === currentMonth) || (r.created_date && r.created_date.slice(0, 7) === currentMonth)).length;
  const monthlyReportes = filteredReportes.filter(r => (r.fecha && r.fecha.slice(0, 7) === currentMonth) || (r.created_date && r.created_date.slice(0, 7) === currentMonth)).length;

  const availableSedes = isSuperAdmin
    ? sedes
    : sedes.filter((s) => userSedeIds.includes(s.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold">Resumen de Operaciones</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Indicadores clave de rendimiento para todos los módulos
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Sede selector */}
          {showSedeSelector && (
            <div className="w-52">
              <Select value={selectedSedeId} onValueChange={setSelectedSedeId}>
                <SelectTrigger>
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

          {/* Month carousel */}
          <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg border">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[120px] text-center">
              {formatMes(currentMonth)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid containing module KPIs */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Facturas */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/facturas")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" /> Facturas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1 mb-2 bg-muted p-0.5 rounded-md text-[10px] w-fit" onClick={(e) => e.stopPropagation()}>
              <button
                className={`px-2 py-0.5 rounded-sm transition-all ${facturasKpiView === "total" ? "bg-background shadow-sm font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setFacturasKpiView("total")}
              >
                Normal + IVA
              </button>
              <button
                className={`px-2 py-0.5 rounded-sm transition-all ${facturasKpiView === "normal" ? "bg-background shadow-sm font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setFacturasKpiView("normal")}
              >
                Normal
              </button>
              <button
                className={`px-2 py-0.5 rounded-sm transition-all ${facturasKpiView === "iva" ? "bg-background shadow-sm font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}
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
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Facturado</span>
              <span className="font-bold text-blue-600">
                ${loading ? "—" : Math.round((totalCobrado + totalPendiente) * (facturasKpiView === "total" ? 1.16 : facturasKpiView === "iva" ? 0.16 : 1.0)).toLocaleString("es-MX")}
              </span>
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
                <Smartphone className="w-3.5 h-3.5" /> Saldos (Celulares)
              </span>
              <span className="font-semibold text-slate-700">${loading ? "—" : totalSaldos.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Car className="w-3.5 h-3.5" /> Mantenimiento (Carros)
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

        {/* Empleados */}
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
              <span className="font-semibold text-sky-600">{loading ? "—" : empAltas}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bajas del Mes</span>
              <span className="font-semibold text-muted-foreground">{loading ? "—" : empBajas}</span>
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
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Suspendidos / Inactivos</span>
              <span className="font-semibold text-muted-foreground">{loading ? "—" : servInactivos}</span>
            </div>
          </CardContent>
        </Card>

        {/* Supervisiones (Rondines y Reportes) */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/supervisiones")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" /> Supervisiones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Rondines del Mes
              </span>
              <span className="font-semibold text-amber-600">{loading ? "—" : monthlyRondines}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5" /> Reportes de Supervisión
              </span>
              <span className="font-semibold text-indigo-600">{loading ? "—" : monthlyReportes}</span>
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

        {/* Inventario & Almacén */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/inventario")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-500" /> Almacén e Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Artículos en Catálogo</span>
              <span className="font-semibold text-violet-600">{loading ? "—" : inventarioItems}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Stock Total de Insumos</span>
              <span className="font-semibold text-violet-600">{loading ? "—" : inventarioTotalStock}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Solicitudes Pendientes</span>
              <span className={`font-semibold ${solsPendientes > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {loading ? "—" : `${solsPendientes} pendiente(s)`}
              </span>
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

        {/* Documentos */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/documentos")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-600" /> Documentos y Plantillas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Documentos Registrados</span>
              <span className="font-semibold text-cyan-600">{loading ? "—" : rawData.docs.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Acceso rápido</span>
              <span className="text-xs text-primary font-medium">Ver repositorio →</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
