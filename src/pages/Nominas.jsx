import React, { useEffect, useState, useMemo } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import { useAuth } from "@/lib/AuthContext";
import AccessRestricted from "@/components/AccessRestricted";
import { 
  ChevronLeft, ChevronRight, Calculator, FileText, Save, Calendar, 
  Download, Search, SlidersHorizontal, DollarSign, ArrowUpRight, 
  ArrowDownRight, Eye, CheckCircle, Info
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatUserDisplayName } from "@/lib/userNameFormatting";

export default function Nominas() {
  const { user } = useAuth();
  const { canView, can } = usePermissions();
  const { sedeFilter } = useSedeScope();
  const { toast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [nominasPersistidas, setNominasPersistidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("resumen");

  // Selected employee for breakdown modal
  const [selectedEmpForModal, setSelectedEmpForModal] = useState(null);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  // Period Configuration
  const [periodType, setPeriodType] = useState("quincenal"); // "quincenal" | "semanal"
  const [periodSub, setPeriodSub] = useState("1"); // "1" | "2"

  // Local state to store granular user modifications per employee
  const [modificaciones, setModificaciones] = useState({});

  const [yearStr, monthStr] = currentMonth.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get start and end days for the selected period
  const getPeriodDays = () => {
    const sub = parseInt(periodSub);
    if (periodType === "mensual") {
      return { start: 1, end: daysInMonth };
    } else if (periodType === "quincenal") {
      if (sub === 1) {
        return { start: 1, end: 15 };
      } else {
        return { start: 16, end: daysInMonth };
      }
    } else if (periodType === "semanal") {
      if (sub === 1) return { start: 1, end: 7 };
      if (sub === 2) return { start: 8, end: 14 };
      if (sub === 3) return { start: 15, end: 21 };
      if (sub === 4) return { start: 22, end: 28 };
      return { start: 29, end: daysInMonth };
    }
    return { start: 1, end: daysInMonth };
  };

  const { start: startDay, end: endDay } = getPeriodDays();

  const getPeriodKey = () => {
    if (periodType === "mensual") return `${currentMonth}-M`;
    if (periodType === "quincenal") return `${currentMonth}-Q${periodSub}`;
    return `${currentMonth}-W${periodSub}`;
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const getPeriodLabel = () => {
    const monthName = monthNames[month];
    if (periodType === "mensual") {
      return `Mes Completo de ${monthName} ${year}`;
    }
    if (periodType === "quincenal") {
      return `${periodSub === "1" ? "1ra Quincena" : "2da Quincena"} de ${monthName} ${year} (${startDay} al ${endDay})`;
    }
    return `Semana ${periodSub} de ${monthName} ${year} (${startDay} al ${endDay})`;
  };

  const getQuincenaName = () => {
    if (periodType === "quincenal") {
      return periodSub === "1" ? "1ra Quincena" : "2da Quincena";
    }
    if (periodType === "semanal") {
      return `Semana ${periodSub}`;
    }
    return "Mensual";
  };

  useEffect(() => {
    loadData();
  }, [sedeFilter, currentMonth, periodType, periodSub]);

  async function loadData() {
    setLoading(true);
    try {
      const [emps, asists, noms, seds] = await Promise.all([
        sercoApi.entities.Empleado.filter(sedeFilter).catch(() => []),
        sercoApi.entities.Asistencia.list().catch(() => []),
        sercoApi.entities.Nominas ? sercoApi.entities.Nominas.list().catch(() => []) : Promise.resolve([]),
        sercoApi.entities.Sede ? sercoApi.entities.Sede.list().catch(() => []) : Promise.resolve([])
      ]);

      const monthStartStr = `${currentMonth}-01`;
      const activeEmps = emps.filter(e => {
        if (!e.fecha_baja) return true;
        return e.fecha_baja >= monthStartStr;
      });

      setEmployees(activeEmps);
      setAsistencias(asists || []);
      setNominasPersistidas(noms || []);
      setSedes(seds || []);

      // Load cached breakdown from localStorage for this period
      const periodKey = getPeriodKey();
      let cachedBreakdowns = {};
      try {
        const raw = localStorage.getItem(`serco_nominas_detalles_${periodKey}`);
        if (raw) cachedBreakdowns = JSON.parse(raw);
      } catch (err) {
        console.warn("Could not read local nominas storage:", err);
      }

      const initialMods = {};
      activeEmps.forEach(emp => {
        const saved = (noms || []).find(n => n.empleado_id === emp.id && n.mes === periodKey);
        const cached = cachedBreakdowns[emp.id] || {};

        initialMods[emp.id] = {
          // Percepciones
          ajuste_quincenal: cached.ajuste_quincenal ?? 0,
          fecha_hora_extra: cached.fecha_hora_extra ?? "",
          horas_extras: cached.horas_extras ?? 0,
          fecha_extra: cached.fecha_extra ?? "",
          turnos_extra: cached.turnos_extra ?? (saved ? Number(saved.extras || 0) : 0),
          festivos: cached.festivos ?? 0,
          prima_vacacional: cached.prima_vacacional ?? 0,
          comidas_horas_extra: cached.comidas_horas_extra ?? 0,
          bono_encargo: cached.bono_encargo ?? (saved && !cached.bono_encargo ? Number(saved.bonos || 0) : 0),
          comision: cached.comision ?? 0,

          // Deducciones
          fecha_falta: cached.fecha_falta ?? "",
          faltas: cached.faltas ?? (saved ? Number(saved.faltas || 0) : 0),
          fecha_hora_retardo: cached.fecha_hora_retardo ?? "",
          retardos: cached.retardos ?? 0,
          prestamo_personal: cached.prestamo_personal ?? 0,
          adelanto_nomina: cached.adelanto_nomina ?? 0,
          uniforme: cached.uniforme ?? 0,
          botas_seguridad: cached.botas_seguridad ?? 0,
          reparacion_equipo: cached.reparacion_equipo ?? 0,
          reposicion_equipo: cached.reposicion_equipo ?? 0,
          sancion_administrativa: cached.sancion_administrativa ?? 0,
          otro_descuento: cached.otro_descuento ?? 0,
          descuentos: cached.descuentos ?? (saved && !cached.descuentos ? Number(saved.deducciones || 0) : 0),

          // Metadatos y Generales
          forma_pago: cached.forma_pago ?? (emp.banco ? `Transferencia (${emp.banco})` : "Transferencia"),
          observaciones: cached.observaciones ?? ""
        };
      });

      setModificaciones(initialMods);
    } catch (e) {
      console.error("Error al cargar datos de nóminas:", e);
    } finally {
      setLoading(false);
    }
  }

  // Carousel handlers
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

  // Helper to get Sede name
  const getSedeName = (emp) => {
    if (emp.sede_id) {
      const found = sedes.find(s => s.id === emp.sede_id);
      if (found?.nombre) return found.nombre;
    }
    return emp.sede || "Matriz";
  };

  // Calculations for each employee
  const calculatePayroll = (emp, index = 0) => {
    const mods = modificaciones[emp.id] || {};
    const salarioMensual = Number(emp.sueldo) || 0;
    const sueldoDiario = salarioMensual / 30;
    const sueldoQuincenal = salarioMensual / 2;

    const totalDaysInPeriod = (endDay - startDay) + 1;
    let sueldoPeriodoBase = sueldoQuincenal;
    if (periodType === "mensual") {
      sueldoPeriodoBase = salarioMensual;
    } else if (periodType === "semanal") {
      sueldoPeriodoBase = sueldoDiario * totalDaysInPeriod;
    }

    // Filter attendance records of this employee for the selected days range
    const empAsists = asistencias.filter(a => {
      if (a.empleado_id !== emp.id || !a.fecha || a.fecha.slice(0, 7) !== currentMonth) return false;
      const dayVal = parseInt(a.fecha.slice(8, 10));
      return dayVal >= startDay && dayVal <= endDay;
    });

    const faltasAsistencia = empAsists.filter(a => a.estado === "falta");
    const extrasAsistencia = empAsists.filter(a => a.estado === "extra" || a.estado === "descanso_extra");
    const countAsistio = empAsists.filter(a => a.estado === "asistió" || a.estado === "descanso_laborado").length;

    // Automatic date strings formatted as "DD/MM"
    const autoFechasFalta = faltasAsistencia.map(a => `${a.fecha.slice(8, 10)}/${a.fecha.slice(5, 7)}`).join(", ");
    const autoFechasExtra = extrasAsistencia.map(a => `${a.fecha.slice(8, 10)}/${a.fecha.slice(5, 7)}`).join(", ");

    const fechaFaltaFinal = mods.fecha_falta !== undefined && mods.fecha_falta !== "" ? mods.fecha_falta : autoFechasFalta;
    const fechaExtraFinal = mods.fecha_extra !== undefined && mods.fecha_extra !== "" ? mods.fecha_extra : autoFechasExtra;

    // Percepciones
    const ajusteQuincenal = Number(mods.ajuste_quincenal || 0);
    const horasExtras = Number(mods.horas_extras || 0);
    // Turnos extra: if user entered custom amount, use it, else default to (extras count * sueldoDiario)
    const turnosExtraCount = extrasAsistencia.length;
    const turnosExtraMonto = mods.turnos_extra !== undefined && mods.turnos_extra !== 0 
      ? Number(mods.turnos_extra) 
      : (turnosExtraCount * sueldoDiario);

    const festivos = Number(mods.festivos || 0);
    const primaVacacional = Number(mods.prima_vacacional || 0);
    const comidasHorasExtra = Number(mods.comidas_horas_extra || 0);
    const bonoEncargo = Number(mods.bono_encargo || 0);
    const comision = Number(mods.comision || 0);

    const totalPercepciones = sueldoPeriodoBase 
      + ajusteQuincenal 
      + horasExtras 
      + turnosExtraMonto 
      + festivos 
      + primaVacacional 
      + comidasHorasExtra 
      + bonoEncargo 
      + comision;

    // Deducciones
    const faltasCount = faltasAsistencia.length;
    const faltasMonto = mods.faltas !== undefined && mods.faltas !== 0 
      ? Number(mods.faltas) 
      : (faltasCount * sueldoDiario);

    const retardos = Number(mods.retardos || 0);
    const prestamoPersonal = Number(mods.prestamo_personal || 0);
    const adelantoNomina = Number(mods.adelanto_nomina || 0);
    const uniforme = Number(mods.uniforme || 0);
    const botasSeguridad = Number(mods.botas_seguridad || 0);
    const reparacionEquipo = Number(mods.reparacion_equipo || 0);
    const reposicionEquipo = Number(mods.reposicion_equipo || 0);
    const sancionAdministrativa = Number(mods.sancion_administrativa || 0);
    const otroDescuento = Number(mods.otro_descuento || 0);
    const descuentos = Number(mods.descuentos || 0);

    const totalDeducciones = faltasMonto 
      + retardos 
      + prestamoPersonal 
      + adelantoNomina 
      + uniforme 
      + botasSeguridad 
      + reparacionEquipo 
      + reposicionEquipo 
      + sancionAdministrativa 
      + otroDescuento 
      + descuentos;

    const totalAPagar = Math.max(0, totalPercepciones - totalDeducciones);

    return {
      // 1. Sede
      sedeNombre: getSedeName(emp),
      // 2. Numero
      numero: emp.numero_empleado || (index + 1),
      // 3. Nombre
      nombre: emp.nombre_completo,
      // 4. Servicio
      servicio: emp.servicio_ubicacion || "Sin asignar",
      // 5. Turno
      turno: emp.turno || "12x12",
      // 6. Salario Mensual
      salarioMensual,
      // 7. Fecha de Ingreso
      fechaIngreso: emp.fecha_ingreso || "—",
      // 8. Puesto
      puesto: emp.puesto || "Guardia",
      // 9. Sueldo Quincenal
      sueldoQuincenal,
      // 10. Sueldo Diario
      sueldoDiario,
      // 11. Ajuste Quincenal
      ajusteQuincenal,
      // 12. Fecha/Hora Extra
      fechaHoraExtra: mods.fecha_hora_extra || "",
      // 13. Horas Extras
      horasExtras,
      // 14. Fecha Extra
      fechaExtra: fechaExtraFinal,
      // 15. Turnos Extra
      turnosExtra: turnosExtraMonto,
      turnosExtraCount,
      // 16. Festivos
      festivos,
      // 17. Prima Vacacional
      primaVacacional,
      // 18. Comidas por Horas Extra
      comidasHorasExtra,
      // 19. Bono por Encargo
      bonoEncargo,
      // 20. Comision
      comision,
      // 21. Total Percepciones
      totalPercepciones,
      // 22. Fecha Falta
      fechaFalta: fechaFaltaFinal,
      // 23. Faltas
      faltas: faltasMonto,
      faltasCount,
      // 24. Fecha/Hora Retardo
      fechaHoraRetardo: mods.fecha_hora_retardo || "",
      // 25. Retardos
      retardos,
      // 26. Prestamo Personal
      prestamoPersonal,
      // 27. Adelanto de Nomina
      adelantoNomina,
      // 28. Uniforme
      uniforme,
      // 29. Botas de Seguridad
      botasSeguridad,
      // 30. Reparacion Equipo de Trabajo
      reparacionEquipo,
      // 31. Reposicion de Equipo de Trabajo
      reposicionEquipo,
      // 32. Sancion Administrativa
      sancionAdministrativa,
      // 33. Otro Descuento
      otroDescuento,
      // 34. Total Deducciones
      totalDeducciones,
      // 35. Total a Pagar
      totalAPagar,
      // 36. Observaciones
      observaciones: mods.observaciones || "",
      // 37. Quincena
      quincena: getQuincenaName(),
      // 38. Forma Pago
      formaPago: mods.forma_pago || (emp.banco ? `Transferencia (${emp.banco})` : "Transferencia"),
      // 39. Descuentos
      descuentos,

      // Context
      sueldoPeriodoBase,
      countAsistio
    };
  };

  const handleModifierChange = (empId, field, val) => {
    let finalVal = val;
    // Keep numbers for monetary/count fields
    if (!["fecha_hora_extra", "fecha_extra", "fecha_falt", "fecha_falta", "fecha_hora_retardo", "observaciones", "forma_pago"].includes(field)) {
      finalVal = val === "" ? 0 : Number(val);
    }
    setModificaciones(prev => {
      const updated = {
        ...prev,
        [empId]: {
          ...(prev[empId] || {}),
          [field]: finalVal
        }
      };
      // Auto cache to localStorage
      try {
        const periodKey = getPeriodKey();
        localStorage.setItem(`serco_nominas_detalles_${periodKey}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Error caching nominas to localStorage:", e);
      }
      return updated;
    });
  };

  const handleSaveAll = async () => {
    if (!can("comunicados", "create")) {
      toast({
        title: "Permisos insuficientes",
        description: "No tienes permiso para guardar o editar las nóminas.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (!sercoApi.entities.Nominas) {
        throw new Error("El servicio de base de datos para nóminas no está disponible.");
      }

      const periodKey = getPeriodKey();

      // Persist full detailed breakdown in localStorage
      try {
        localStorage.setItem(`serco_nominas_detalles_${periodKey}`, JSON.stringify(modificaciones));
      } catch (e) {
        console.warn("Storage warning:", e);
      }

      // Save each employee's payroll aggregated into Supabase schema
      const promises = employees.map(async (emp, idx) => {
        const calc = calculatePayroll(emp, idx);
        const saved = nominasPersistidas.find(n => n.empleado_id === emp.id && n.mes === periodKey);

        const bonosExtraTotal = calc.totalPercepciones - calc.sueldoPeriodoBase;

        const payload = {
          empleado_id: emp.id,
          mes: periodKey,
          sueldo_base: Math.round(calc.sueldoPeriodoBase * 100) / 100,
          asistencias: calc.countAsistio,
          faltas: calc.faltasCount,
          extras: calc.turnosExtraCount,
          bonos: Math.round(bonosExtraTotal * 100) / 100,
          deducciones: Math.round(calc.totalDeducciones * 100) / 100,
          total_pagado: Math.round(calc.totalAPagar * 100) / 100,
          sede_id: emp.sede_id || null
        };

        if (saved) {
          return sercoApi.entities.Nominas.update(saved.id, payload);
        } else {
          return sercoApi.entities.Nominas.create(payload);
        }
      });

      await Promise.all(promises);
      toast({
        title: "Nómina Guardada",
        description: `Todos los campos y cálculos de ${getPeriodLabel()} fueron guardados exitosamente.`
      });
      await loadData();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al guardar nómina",
        description: e.message || "Ocurrió un error al persistir los datos de nómina.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Export to Excel/CSV with all 39 requested columns
  const handleExportCSV = () => {
    if (employees.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay empleados registrados para exportar en el periodo actual.",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      "Sede",
      "Número",
      "Nombre",
      "Servicio",
      "Turno",
      "Salario Mensual",
      "Fecha de Ingreso",
      "Puesto",
      "Sueldo Quincenal",
      "Sueldo Diario",
      "Ajuste Quincenal",
      "Fecha/Hora Extra",
      "Horas Extras",
      "Fecha Extra",
      "Turnos Extra",
      "Festivos",
      "Prima Vacacional",
      "Comidas por Horas Extra",
      "Bono por Encargo",
      "Comisión",
      "Total Percepciones",
      "Fecha Falta",
      "Faltas",
      "Fecha/Hora Retardo",
      "Retardos",
      "Préstamo Personal",
      "Adelanto de Nómina",
      "Uniforme",
      "Botas de Seguridad",
      "Reparación Equipo de Trabajo",
      "Reposición de Equipo de Trabajo",
      "Sanción Administrativa",
      "Otro Descuento",
      "Total Deducciones",
      "Total a Pagar",
      "Observaciones",
      "Quincena",
      "Forma Pago",
      "Descuentos"
    ];

    const rows = employees.map((emp, idx) => {
      const calc = calculatePayroll(emp, idx);
      return [
        calc.sedeNombre,
        calc.numero,
        calc.nombre,
        calc.servicio,
        calc.turno,
        calc.salarioMensual.toFixed(2),
        calc.fechaIngreso,
        calc.puesto,
        calc.sueldoQuincenal.toFixed(2),
        calc.sueldoDiario.toFixed(2),
        calc.ajusteQuincenal.toFixed(2),
        calc.fechaHoraExtra,
        calc.horasExtras.toFixed(2),
        calc.fechaExtra,
        calc.turnosExtra.toFixed(2),
        calc.festivos.toFixed(2),
        calc.primaVacacional.toFixed(2),
        calc.comidasHorasExtra.toFixed(2),
        calc.bonoEncargo.toFixed(2),
        calc.comision.toFixed(2),
        calc.totalPercepciones.toFixed(2),
        calc.fechaFalta,
        calc.faltas.toFixed(2),
        calc.fechaHoraRetardo,
        calc.retardos.toFixed(2),
        calc.prestamoPersonal.toFixed(2),
        calc.adelantoNomina.toFixed(2),
        calc.uniforme.toFixed(2),
        calc.botasSeguridad.toFixed(2),
        calc.reparacionEquipo.toFixed(2),
        calc.reposicionEquipo.toFixed(2),
        calc.sancionAdministrativa.toFixed(2),
        calc.otroDescuento.toFixed(2),
        calc.totalDeducciones.toFixed(2),
        calc.totalAPagar.toFixed(2),
        calc.observaciones,
        calc.quincena,
        calc.formaPago,
        calc.descuentos.toFixed(2)
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const periodKey = getPeriodKey();
    link.setAttribute("download", `Nomina_SERCO_${periodKey}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Archivo descargado",
      description: "La nómina completa con los 39 campos fue exportada exitosamente para Excel."
    });
  };

  if (!canView("inicio")) return <AccessRestricted />;

  // Filtered employees for search
  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return (
      (emp.nombre_completo || "").toLowerCase().includes(query) ||
      (emp.servicio_ubicacion || "").toLowerCase().includes(query) ||
      (emp.puesto || "").toLowerCase().includes(query) ||
      String(emp.numero_empleado || "").toLowerCase().includes(query)
    );
  });

  // Calculate global totals for cards
  let sumBasePeriodo = 0;
  let sumPercepciones = 0;
  let sumDeducciones = 0;
  let sumTotalAPagar = 0;

  employees.forEach((emp, idx) => {
    const calc = calculatePayroll(emp, idx);
    sumBasePeriodo += calc.sueldoPeriodoBase;
    sumPercepciones += calc.totalPercepciones;
    sumDeducciones += calc.totalDeducciones;
    sumTotalAPagar += calc.totalAPagar;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" /> Cálculo de Nóminas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión completa de nómina con percepciones, deducciones y exportación oficial a Excel/CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start xl:self-auto">
          {/* Period Type Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Periodo:</span>
            <Select 
              value={periodType} 
              onValueChange={(val) => {
                setPeriodType(val);
                setPeriodSub("1");
              }}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Tipo Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quincenal">Quincenal</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Period Selection */}
          {periodType !== "mensual" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Quincena/Semana:</span>
              <Select 
                value={periodSub} 
                onValueChange={(val) => setPeriodSub(val)}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {periodType === "quincenal" ? (
                    <>
                      <SelectItem value="1">1ra Quincena (1-15)</SelectItem>
                      <SelectItem value="2">2da Quincena (16-{daysInMonth})</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="1">Semana 1 (1-7)</SelectItem>
                      <SelectItem value="2">Semana 2 (8-14)</SelectItem>
                      <SelectItem value="3">Semana 3 (15-21)</SelectItem>
                      <SelectItem value="4">Semana 4 (22-28)</SelectItem>
                      {daysInMonth >= 29 && <SelectItem value="5">Semana 5 (29-{daysInMonth})</SelectItem>}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Month Carousel */}
          <div className="flex items-center gap-1 bg-card border rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[100px] text-center">
              {monthNames[month]} {year}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Action buttons */}
          <Button 
            variant="outline"
            onClick={handleExportCSV} 
            disabled={loading || employees.length === 0} 
            className="gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Exportar a Excel (39 Campos)
          </Button>

          <Button 
            onClick={handleSaveAll} 
            disabled={saving || employees.length === 0} 
            className="gap-1.5 font-semibold shadow-sm"
          >
            <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar Nómina"}
          </Button>
        </div>
      </div>

      {/* Selected Period Badge / Alert */}
      <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Periodo de Nómina</span>
            <span className="text-sm font-bold text-foreground">{getPeriodLabel()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800 py-1 px-3 border shadow-sm">
            {employees.length} Colaboradores en nómina
          </Badge>
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary py-1 px-3 border-primary/30">
            {getQuincenaName()}
          </Badge>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              <span>Sueldo Base Periodo</span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">
              ${loading ? "—" : sumBasePeriodo.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Salario base correspondiente a la quincena/periodo</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/20 shadow-sm">
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase flex items-center justify-between">
              <span>Total Percepciones</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              +${loading ? "—" : sumPercepciones.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-emerald-700/70 mt-1">Base + Ajustes + Extras + Bonos + Comisiones</p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/20 shadow-sm">
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-rose-700 uppercase flex items-center justify-between">
              <span>Total Deducciones</span>
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              -${loading ? "—" : sumDeducciones.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-rose-700/70 mt-1">Faltas + Retardos + Préstamos + Uniformes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary bg-primary/5 shadow-sm">
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-primary uppercase flex items-center justify-between">
              <span>Total Neto a Dispersar</span>
              <CheckCircle className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">
              ${loading ? "—" : sumTotalAPagar.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-primary/80 mt-1 font-medium">Monto final a transferir / pagar en el periodo</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card with Tabs */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Search & Tabs Header */}
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid grid-cols-4 w-full md:w-auto">
              <TabsTrigger value="resumen" className="text-xs sm:text-sm">Resumen</TabsTrigger>
              <TabsTrigger value="percepciones" className="text-xs sm:text-sm">Percepciones</TabsTrigger>
              <TabsTrigger value="deducciones" className="text-xs sm:text-sm">Deducciones</TabsTrigger>
              <TabsTrigger value="todos" className="text-xs sm:text-sm">Todos los Campos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, puesto o servicio..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto max-w-full">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b">
              {activeTab === "resumen" && (
                <TableRow>
                  <TableHead className="font-bold w-12 text-center">#</TableHead>
                  <TableHead className="font-bold min-w-[200px]">Colaborador</TableHead>
                  <TableHead className="font-bold min-w-[120px]">Sede</TableHead>
                  <TableHead className="font-bold min-w-[140px]">Servicio</TableHead>
                  <TableHead className="text-center font-bold">Turno</TableHead>
                  <TableHead className="text-right font-bold">Sueldo Quincenal</TableHead>
                  <TableHead className="text-right font-bold text-emerald-600">Total Percepciones</TableHead>
                  <TableHead className="text-right font-bold text-rose-600">Total Deducciones</TableHead>
                  <TableHead className="text-right font-bold text-primary">Total a Pagar</TableHead>
                  <TableHead className="font-bold min-w-[140px]">Forma de Pago</TableHead>
                  <TableHead className="text-center font-bold min-w-[120px]">Acciones</TableHead>
                </TableRow>
              )}

              {activeTab === "percepciones" && (
                <TableRow>
                  <TableHead className="font-bold w-12 text-center">#</TableHead>
                  <TableHead className="font-bold min-w-[180px]">Nombre</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Sueldo Quincenal</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Ajuste Quincenal</TableHead>
                  <TableHead className="font-bold min-w-[130px]">Fecha/Hora Extra</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Horas Extras ($)</TableHead>
                  <TableHead className="font-bold min-w-[110px]">Fecha Extra</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Turnos Extra ($)</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Festivos ($)</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Prima Vacacional</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Comidas Horas Extra</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Bono Encargo</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Comisión</TableHead>
                  <TableHead className="text-right font-bold text-emerald-700 min-w-[130px]">Total Percepciones</TableHead>
                  <TableHead className="text-center font-bold">Desglose</TableHead>
                </TableRow>
              )}

              {activeTab === "deducciones" && (
                <TableRow>
                  <TableHead className="font-bold w-12 text-center">#</TableHead>
                  <TableHead className="font-bold min-w-[180px]">Nombre</TableHead>
                  <TableHead className="font-bold min-w-[120px]">Fecha Falta</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Faltas ($)</TableHead>
                  <TableHead className="font-bold min-w-[130px]">Fecha/Hora Retardo</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Retardos ($)</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Préstamo Personal</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Adelanto Nómina</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Uniforme</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Botas Seguridad</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Reparación Equipo</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Reposición Equipo</TableHead>
                  <TableHead className="text-right font-bold min-w-[130px]">Sanción Admin.</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Otro Descuento</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Descuentos</TableHead>
                  <TableHead className="text-right font-bold text-rose-700 min-w-[130px]">Total Deducciones</TableHead>
                  <TableHead className="text-center font-bold">Desglose</TableHead>
                </TableRow>
              )}

              {activeTab === "todos" && (
                <TableRow>
                  <TableHead className="font-bold sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 w-10 text-center">#</TableHead>
                  <TableHead className="font-bold sticky left-10 bg-slate-50 dark:bg-slate-900 z-10 min-w-[180px]">Nombre</TableHead>
                  <TableHead className="font-bold min-w-[100px]">Sede</TableHead>
                  <TableHead className="font-bold min-w-[120px]">Servicio</TableHead>
                  <TableHead className="font-bold text-center">Turno</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Salario Mensual</TableHead>
                  <TableHead className="font-bold min-w-[110px]">Fecha Ingreso</TableHead>
                  <TableHead className="font-bold min-w-[110px]">Puesto</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Sueldo Quincenal</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Sueldo Diario</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Ajuste Quincenal</TableHead>
                  <TableHead className="font-bold min-w-[130px]">Fecha/Hora Extra</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Horas Extras</TableHead>
                  <TableHead className="font-bold min-w-[110px]">Fecha Extra</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Turnos Extra</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Festivos</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Prima Vacacional</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Comidas Horas Extra</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Bono Encargo</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Comisión</TableHead>
                  <TableHead className="text-right font-bold text-emerald-600 min-w-[130px]">Total Percepciones</TableHead>
                  <TableHead className="font-bold min-w-[110px]">Fecha Falta</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Faltas</TableHead>
                  <TableHead className="font-bold min-w-[130px]">Fecha/Hora Retardo</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Retardos</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Préstamo Personal</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Adelanto Nómina</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Uniforme</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Botas Seguridad</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Reparación Equipo</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Reposición Equipo</TableHead>
                  <TableHead className="text-right font-bold min-w-[120px]">Sanción Admin.</TableHead>
                  <TableHead className="text-right font-bold min-w-[110px]">Otro Descuento</TableHead>
                  <TableHead className="text-right font-bold min-w-[100px]">Descuentos</TableHead>
                  <TableHead className="text-right font-bold text-rose-600 min-w-[130px]">Total Deducciones</TableHead>
                  <TableHead className="text-right font-bold text-primary min-w-[130px]">Total a Pagar</TableHead>
                  <TableHead className="font-bold min-w-[140px]">Observaciones</TableHead>
                  <TableHead className="font-bold min-w-[110px]">Quincena</TableHead>
                  <TableHead className="font-bold min-w-[130px]">Forma Pago</TableHead>
                  <TableHead className="text-center font-bold min-w-[100px]">Acciones</TableHead>
                </TableRow>
              )}
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={20} className="text-center text-muted-foreground py-12">
                    Cargando nómina y calculando periodos...
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={20} className="text-center text-muted-foreground py-12">
                    {searchTerm ? "No se encontraron empleados con ese criterio de búsqueda." : "No hay empleados registrados en el periodo y sede seleccionados."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp, index) => {
                  const calc = calculatePayroll(emp, index);
                  return (
                    <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors">
                      {/* VISTA RESUMEN */}
                      {activeTab === "resumen" && (
                        <>
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {calc.numero}
                          </TableCell>
                          <TableCell className="font-semibold">
                            <div className="text-sm text-foreground">{calc.nombre}</div>
                            <div className="text-xs text-muted-foreground">{calc.puesto}</div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {calc.sedeNombre}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {calc.servicio}
                          </TableCell>
                          <TableCell className="text-center text-xs font-medium">
                            {calc.turno}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            ${calc.sueldoQuincenal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 text-sm">
                            +${calc.totalPercepciones.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-rose-600 text-sm">
                            -${calc.totalDeducciones.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-black text-primary text-base">
                            ${calc.totalAPagar.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {calc.formaPago}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-1 text-xs font-medium"
                              onClick={() => setSelectedEmpForModal({ emp, index })}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Desglose
                            </Button>
                          </TableCell>
                        </>
                      )}

                      {/* VISTA PERCEPCIONES */}
                      {activeTab === "percepciones" && (
                        <>
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {calc.numero}
                          </TableCell>
                          <TableCell className="font-semibold">
                            <div className="text-sm">{calc.nombre}</div>
                            <div className="text-xs text-muted-foreground">{calc.servicio}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-xs">
                            ${calc.sueldoQuincenal.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.ajuste_quincenal ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "ajuste_quincenal", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="text"
                              className="h-8 w-28 text-xs p-1"
                              value={modificaciones[emp.id]?.fecha_hora_extra ?? ""}
                              placeholder="Ej: 05/08 2h"
                              onChange={(e) => handleModifierChange(emp.id, "fecha_hora_extra", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.horas_extras ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "horas_extras", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="text"
                              className="h-8 w-28 text-xs p-1"
                              value={modificaciones[emp.id]?.fecha_extra ?? calc.fechaExtra}
                              placeholder="Ej: 10/08"
                              onChange={(e) => handleModifierChange(emp.id, "fecha_extra", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.turnos_extra ?? (calc.turnosExtra > 0 ? calc.turnosExtra : "")}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "turnos_extra", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.festivos ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "festivos", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.prima_vacacional ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "prima_vacacional", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.comidas_horas_extra ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "comidas_horas_extra", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.bono_encargo ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "bono_encargo", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto"
                              value={modificaciones[emp.id]?.comision ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "comision", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 text-sm">
                            ${calc.totalPercepciones.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setSelectedEmpForModal({ emp, index })}
                            >
                              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </>
                      )}

                      {/* VISTA DEDUCCIONES */}
                      {activeTab === "deducciones" && (
                        <>
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {calc.numero}
                          </TableCell>
                          <TableCell className="font-semibold">
                            <div className="text-sm">{calc.nombre}</div>
                            <div className="text-xs text-muted-foreground">{calc.servicio}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="text"
                              className="h-8 w-28 text-xs p-1"
                              value={modificaciones[emp.id]?.fecha_falta ?? calc.fechaFalta}
                              placeholder="Ej: 04/08"
                              onChange={(e) => handleModifierChange(emp.id, "fecha_falta", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600 font-medium"
                              value={modificaciones[emp.id]?.faltas ?? (calc.faltas > 0 ? calc.faltas : "")}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "faltas", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="text"
                              className="h-8 w-28 text-xs p-1"
                              value={modificaciones[emp.id]?.fecha_hora_retardo ?? ""}
                              placeholder="Ej: 08/08 15m"
                              onChange={(e) => handleModifierChange(emp.id, "fecha_hora_retardo", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.retardos ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "retardos", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.prestamo_personal ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "prestamo_personal", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.adelanto_nomina ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "adelanto_nomina", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.uniforme ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "uniforme", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.botas_seguridad ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "botas_seguridad", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.reparacion_equipo ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "reparacion_equipo", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.reposicion_equipo ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "reposicion_equipo", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.sancion_administrativa ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "sancion_administrativa", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.otro_descuento ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "otro_descuento", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right text-xs p-1 ml-auto text-rose-600"
                              value={modificaciones[emp.id]?.descuentos ?? ""}
                              placeholder="0.00"
                              onChange={(e) => handleModifierChange(emp.id, "descuentos", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right font-bold text-rose-600 text-sm">
                            -${calc.totalDeducciones.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setSelectedEmpForModal({ emp, index })}
                            >
                              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </>
                      )}

                      {/* VISTA TODOS LOS CAMPOS */}
                      {activeTab === "todos" && (
                        <>
                          <TableCell className="text-center font-bold text-xs sticky left-0 bg-card z-10">
                            {calc.numero}
                          </TableCell>
                          <TableCell className="font-semibold text-xs sticky left-10 bg-card z-10">
                            <div>{calc.nombre}</div>
                          </TableCell>
                          <TableCell className="text-xs">{calc.sedeNombre}</TableCell>
                          <TableCell className="text-xs">{calc.servicio}</TableCell>
                          <TableCell className="text-xs text-center">{calc.turno}</TableCell>
                          <TableCell className="text-right text-xs font-medium">${calc.salarioMensual.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{calc.fechaIngreso}</TableCell>
                          <TableCell className="text-xs">{calc.puesto}</TableCell>
                          <TableCell className="text-right text-xs font-medium">${calc.sueldoQuincenal.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs font-medium">${calc.sueldoDiario.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${calc.ajusteQuincenal.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{calc.fechaHoraExtra || "—"}</TableCell>
                          <TableCell className="text-right text-xs">${calc.horasExtras.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{calc.fechaExtra || "—"}</TableCell>
                          <TableCell className="text-right text-xs">${calc.turnosExtra.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${calc.festivos.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${calc.primaVacacional.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${calc.comidasHorasExtra.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${calc.bonoEncargo.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${calc.comision.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">${calc.totalPercepciones.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{calc.fechaFalta || "—"}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.faltas.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{calc.fechaHoraRetardo || "—"}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.retardos.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.prestamoPersonal.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.adelantoNomina.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.uniforme.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.botasSeguridad.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.reparacionEquipo.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.reposicionEquipo.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.sancionAdministrativa.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.otroDescuento.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-rose-600">${calc.descuentos.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-rose-600">${calc.totalDeducciones.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs font-black text-primary">${calc.totalAPagar.toFixed(2)}</TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]">{calc.observaciones || "—"}</TableCell>
                          <TableCell className="text-xs">{calc.quincena}</TableCell>
                          <TableCell className="text-xs">{calc.formaPago}</TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs px-2"
                              onClick={() => setSelectedEmpForModal({ emp, index })}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-primary" /> Ver
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal Desglose Completo de Colaborador */}
      {selectedEmpForModal && (
        <DetalleNominaModal
          emp={selectedEmpForModal.emp}
          index={selectedEmpForModal.index}
          calc={calculatePayroll(selectedEmpForModal.emp, selectedEmpForModal.index)}
          mods={modificaciones[selectedEmpForModal.emp.id] || {}}
          onUpdateField={(field, val) => handleModifierChange(selectedEmpForModal.emp.id, field, val)}
          onClose={() => setSelectedEmpForModal(null)}
        />
      )}
    </div>
  );
}

// Modal component to view and adjust each employee's complete 39 fields
function DetalleNominaModal({ emp, index, calc, mods, onUpdateField, onClose }) {
  const [activeTab, setActiveTab] = useState("percepciones");

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" /> Desglose de Nómina
              </DialogTitle>
              <DialogDescription className="mt-1">
                Ajuste y consulta de los 39 campos de nómina para {formatUserDisplayName(emp.nombre_completo, user?.role)}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
              Empleado #{calc.numero}
            </Badge>
          </div>
        </DialogHeader>

        {/* Employee Summary Card */}
        <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block font-medium">Sede</span>
            <span className="font-bold text-foreground">{calc.sedeNombre}</span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Servicio</span>
            <span className="font-bold text-foreground truncate block">{calc.servicio}</span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Puesto</span>
            <span className="font-bold text-foreground">{calc.puesto}</span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Turno</span>
            <span className="font-bold text-foreground">{calc.turno}</span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Salario Mensual</span>
            <span className="font-bold text-foreground">${calc.salarioMensual.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Sueldo Quincenal</span>
            <span className="font-bold text-foreground">${calc.sueldoQuincenal.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Sueldo Diario</span>
            <span className="font-bold text-foreground">${calc.sueldoDiario.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Fecha Ingreso</span>
            <span className="font-bold text-foreground">{calc.fechaIngreso}</span>
          </div>
        </div>

        {/* Tabs for editing fields */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="percepciones" className="text-xs sm:text-sm font-semibold text-emerald-700">
              Percepciones (+${calc.totalPercepciones.toFixed(2)})
            </TabsTrigger>
            <TabsTrigger value="deducciones" className="text-xs sm:text-sm font-semibold text-rose-700">
              Deducciones (-${calc.totalDeducciones.toFixed(2)})
            </TabsTrigger>
            <TabsTrigger value="generales" className="text-xs sm:text-sm font-semibold">
              Datos Generales & Pago
            </TabsTrigger>
          </TabsList>

          {/* TAB PERCEPCIONES */}
          <TabsContent value="percepciones" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Ajuste Quincenal ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.ajuste_quincenal ?? ""}
                  onChange={(e) => onUpdateField("ajuste_quincenal", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Fecha / Hora Extra</label>
                <Input
                  type="text"
                  placeholder="Ej: 05/08 18:00 - 22:00"
                  value={mods.fecha_hora_extra ?? ""}
                  onChange={(e) => onUpdateField("fecha_hora_extra", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Horas Extras ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.horas_extras ?? ""}
                  onChange={(e) => onUpdateField("horas_extras", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Fecha Extra (Turno Extra)</label>
                <Input
                  type="text"
                  placeholder="Ej: 12/08, 14/08"
                  value={mods.fecha_extra ?? calc.fechaExtra}
                  onChange={(e) => onUpdateField("fecha_extra", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Turnos Extra ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.turnos_extra ?? (calc.turnosExtra > 0 ? calc.turnosExtra : "")}
                  onChange={(e) => onUpdateField("turnos_extra", e.target.value)}
                />
                <span className="text-[11px] text-muted-foreground">
                  Autocalculado por asistencias: {calc.turnosExtraCount} turno(s)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Festivos ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.festivos ?? ""}
                  onChange={(e) => onUpdateField("festivos", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Prima Vacacional ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.prima_vacacional ?? ""}
                  onChange={(e) => onUpdateField("prima_vacacional", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Comidas por Horas Extra ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.comidas_horas_extra ?? ""}
                  onChange={(e) => onUpdateField("comidas_horas_extra", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Bono por Encargo ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.bono_encargo ?? ""}
                  onChange={(e) => onUpdateField("bono_encargo", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Comisión ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={mods.comision ?? ""}
                  onChange={(e) => onUpdateField("comision", e.target.value)}
                />
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center text-sm">
              <span className="font-semibold text-emerald-800">Total Percepciones Calculado:</span>
              <span className="font-black text-emerald-700 text-lg">${calc.totalPercepciones.toFixed(2)}</span>
            </div>
          </TabsContent>

          {/* TAB DEDUCCIONES */}
          <TabsContent value="deducciones" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Fecha Falta</label>
                <Input
                  type="text"
                  placeholder="Ej: 04/08, 09/08"
                  value={mods.fecha_falta ?? calc.fechaFalta}
                  onChange={(e) => onUpdateField("fecha_falta", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Faltas ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600 font-medium"
                  value={mods.faltas ?? (calc.faltas > 0 ? calc.faltas : "")}
                  onChange={(e) => onUpdateField("faltas", e.target.value)}
                />
                <span className="text-[11px] text-muted-foreground">
                  Autocalculado por asistencias: {calc.faltasCount} falta(s)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Fecha / Hora Retardo</label>
                <Input
                  type="text"
                  placeholder="Ej: 08/08 08:25"
                  value={mods.fecha_hora_retardo ?? ""}
                  onChange={(e) => onUpdateField("fecha_hora_retardo", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Retardos ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.retardos ?? ""}
                  onChange={(e) => onUpdateField("retardos", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Préstamo Personal ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.prestamo_personal ?? ""}
                  onChange={(e) => onUpdateField("prestamo_personal", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Adelanto de Nómina ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.adelanto_nomina ?? ""}
                  onChange={(e) => onUpdateField("adelanto_nomina", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Uniforme ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.uniforme ?? ""}
                  onChange={(e) => onUpdateField("uniforme", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Botas de Seguridad ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.botas_seguridad ?? ""}
                  onChange={(e) => onUpdateField("botas_seguridad", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Reparación Equipo de Trabajo ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.reparacion_equipo ?? ""}
                  onChange={(e) => onUpdateField("reparacion_equipo", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Reposición Equipo de Trabajo ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.reposicion_equipo ?? ""}
                  onChange={(e) => onUpdateField("reposicion_equipo", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Sanción Administrativa ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.sancion_administrativa ?? ""}
                  onChange={(e) => onUpdateField("sancion_administrativa", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Otro Descuento ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.otro_descuento ?? ""}
                  onChange={(e) => onUpdateField("otro_descuento", e.target.value)}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Descuentos Generales ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-rose-600"
                  value={mods.descuentos ?? ""}
                  onChange={(e) => onUpdateField("descuentos", e.target.value)}
                />
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex justify-between items-center text-sm">
              <span className="font-semibold text-rose-800">Total Deducciones Calculado:</span>
              <span className="font-black text-rose-700 text-lg">-${calc.totalDeducciones.toFixed(2)}</span>
            </div>
          </TabsContent>

          {/* TAB GENERALES & PAGO */}
          <TabsContent value="generales" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Quincena / Periodo</label>
                <Input
                  type="text"
                  disabled
                  value={calc.quincena}
                  className="bg-muted text-muted-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Forma de Pago</label>
                <Input
                  type="text"
                  placeholder="Ej: Transferencia Santander, Efectivo..."
                  value={mods.forma_pago ?? calc.formaPago}
                  onChange={(e) => onUpdateField("forma_pago", e.target.value)}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Observaciones de la Nómina</label>
                <Input
                  type="text"
                  placeholder="Notas, justificaciones, aclaraciones de turno o dispersión..."
                  value={mods.observaciones ?? ""}
                  onChange={(e) => onUpdateField("observaciones", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Footer with Net Total */}
        <DialogFooter className="border-t pt-4 mt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-xs text-muted-foreground block">Neto a Dispersar:</span>
              <span className="text-2xl font-black text-primary">${calc.totalAPagar.toFixed(2)}</span>
            </div>
          </div>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Aceptar y Cerrar Desglose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
