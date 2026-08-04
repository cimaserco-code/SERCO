import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import { ChevronLeft, ChevronRight, Calculator, FileText, CheckCircle, Save, Calendar, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function Nominas() {
  const { canView, can } = usePermissions();
  const { sedeFilter } = useSedeScope();
  const { toast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [nominasPersistidas, setNominasPersistidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  // Period Configuration
  const [periodType, setPeriodType] = useState("quincenal"); // "quincenal" | "semanal"
  const [periodSub, setPeriodSub] = useState("1"); // Sub-period identifier (e.g. "1" for 1st fortnight or week 1)

  // Local state to store user modifications (bonos, deducciones)
  const [modificaciones, setModificaciones] = useState({});

  useEffect(() => {
    loadData();
  }, [sedeFilter, currentMonth, periodType, periodSub]);

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
      return { start: 29, end: daysInMonth }; // Week 5 (Rest of the month)
    }
    return { start: 1, end: daysInMonth };
  };

  const { start: startDay, end: endDay } = getPeriodDays();

  // Unique identifier for the payroll block (e.g. "2026-08-Q1", "2026-08-W2", "2026-08-M")
  const getPeriodKey = () => {
    if (periodType === "mensual") return `${currentMonth}-M`;
    if (periodType === "quincenal") return `${currentMonth}-Q${periodSub}`;
    return `${currentMonth}-W${periodSub}`;
  };

  async function loadData() {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [emps, asists, noms] = await Promise.all([
        sercoApi.entities.Empleado.filter(sedeFilter).catch(() => []),
        sercoApi.entities.Asistencia.list().catch(() => []),
        sercoApi.entities.Nominas ? sercoApi.entities.Nominas.list().catch(() => []) : Promise.resolve([])
      ]);

      // Only show employees active during this month (either active, or given baja in this month/future)
      const monthStartStr = `${currentMonth}-01`;
      const activeEmps = emps.filter(e => {
        if (!e.fecha_baja) return true;
        return e.fecha_baja >= monthStartStr;
      });

      setEmployees(activeEmps);
      setAsistencias(asists);
      setNominasPersistidas(noms || []);

      // Initialize inline adjustments (bonos, deducciones) with persisted data if available for this specific period key
      const periodKey = getPeriodKey();
      const initialMods = {};
      activeEmps.forEach(emp => {
        const saved = (noms || []).find(n => n.empleado_id === emp.id && n.mes === periodKey);
        initialMods[emp.id] = {
          bonos: saved ? Number(saved.bonos) : 0,
          deducciones: saved ? Number(saved.deducciones) : 0,
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

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const getPeriodLabel = () => {
    const monthName = monthNames[month];
    if (periodType === "mensual") {
      return `Todo ${monthName} ${year}`;
    }
    if (periodType === "quincenal") {
      return `${periodSub === "1" ? "1ra Quincena" : "2da Quincena"} de ${monthName} (${startDay} al ${endDay})`;
    }
    return `Semana ${periodSub} de ${monthName} (${startDay} al ${endDay})`;
  };

  // Calculations for each employee
  const calculatePayroll = (emp) => {
    const sueldoBaseMensual = Number(emp.sueldo) || 0;
    const dailyRate = sueldoBaseMensual / 30;

    // Base salary proportional to the period duration
    let sueldoPeriodoBase = 0;
    const totalDaysInPeriod = (endDay - startDay) + 1;

    if (periodType === "mensual") {
      sueldoPeriodoBase = sueldoBaseMensual;
    } else if (periodType === "quincenal") {
      sueldoPeriodoBase = sueldoBaseMensual / 2; // Standard 15 days pay
    } else if (periodType === "semanal") {
      sueldoPeriodoBase = dailyRate * totalDaysInPeriod; // Proportional (usually 7 days)
    }

    // Filter attendance records of this employee for the selected days range
    const empAsists = asistencias.filter(a => {
      if (a.empleado_id !== emp.id || !a.fecha || a.fecha.slice(0, 7) !== currentMonth) return false;
      const dayVal = parseInt(a.fecha.slice(8, 10));
      return dayVal >= startDay && dayVal <= endDay;
    });

    const countAsistio = empAsists.filter(a => a.estado === "asistió").length;
    const countFalta = empAsists.filter(a => a.estado === "falta").length;
    const countDescanso = empAsists.filter(a => a.estado === "descanso").length;
    const countExtra = empAsists.filter(a => a.estado === "extra").length;

    // Deductions & extras based on daily rate
    const descuentoFaltas = countFalta * dailyRate;
    const pagoExtras = countExtra * dailyRate;

    const customBonos = modificaciones[emp.id]?.bonos || 0;
    const customDeducciones = modificaciones[emp.id]?.deducciones || 0;

    const totalAPagar = sueldoPeriodoBase - descuentoFaltas + pagoExtras + customBonos - customDeducciones;

    return {
      sueldoPeriodoBase,
      dailyRate,
      asistio: countAsistio,
      falta: countFalta,
      descanso: countDescanso,
      extra: countExtra,
      descuentoFaltas,
      pagoExtras,
      bonos: customBonos,
      deducciones: customDeducciones,
      totalAPagar: Math.max(0, totalAPagar)
    };
  };

  const handleModifierChange = (empId, field, val) => {
    const numericVal = val === "" ? 0 : Number(val);
    setModificaciones(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: numericVal
      }
    }));
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
        throw new Error("El servicio de base de datos para nóminas no está inicializado.");
      }

      const periodKey = getPeriodKey();

      // Save each employee's payroll
      const promises = employees.map(async (emp) => {
        const calc = calculatePayroll(emp);
        const saved = nominasPersistidas.find(n => n.empleado_id === emp.id && n.mes === periodKey);

        const payload = {
          empleado_id: emp.id,
          mes: periodKey,
          sueldo_base: calc.sueldoPeriodoBase,
          asistencias: calc.asistio,
          faltas: calc.falta,
          extras: calc.extra,
          bonos: calc.bonos,
          deducciones: calc.deducciones,
          total_pagado: calc.totalAPagar,
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
        title: "Nóminas Guardadas",
        description: `Las nóminas de ${getPeriodLabel()} han sido guardadas y finalizadas correctamente.`
      });
      await loadData();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al guardar",
        description: e.message || "Asegúrate de haber corrido el script SQL para la tabla 'nominas' en Supabase.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canView("inicio")) return <AccessRestricted />;

  // Calculate totals for summary cards
  let totalPeriodoBase = 0;
  let totalDeduccionesFaltas = 0;
  let totalBonosExtras = 0;
  let totalFinal = 0;

  employees.forEach(emp => {
    const calc = calculatePayroll(emp);
    totalPeriodoBase += calc.sueldoPeriodoBase;
    totalDeduccionesFaltas += calc.descuentoFaltas + calc.deducciones;
    totalBonosExtras += calc.pagoExtras + calc.bonos;
    totalFinal += calc.totalAPagar;
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
            Generación y cálculo automático de nóminas semanales, quincenales o mensuales.
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
                setPeriodSub("1"); // Reset sub-period on type change
              }}
            >
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Tipo Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quincenal">Quincenal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Sub-Period Selection */}
          {periodType !== "mensual" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Detalle:</span>
              <Select 
                value={periodSub} 
                onValueChange={(val) => setPeriodSub(val)}
              >
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {periodType === "quincenal" ? (
                    <>
                      <SelectItem value="1">1ra Quincena (Días 1-15)</SelectItem>
                      <SelectItem value="2">2da Quincena (Días 16-{daysInMonth})</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="1">Semana 1 (Días 1-7)</SelectItem>
                      <SelectItem value="2">Semana 2 (Días 8-14)</SelectItem>
                      <SelectItem value="3">Semana 3 (Días 15-21)</SelectItem>
                      <SelectItem value="4">Semana 4 (Días 22-28)</SelectItem>
                      {daysInMonth >= 29 && <SelectItem value="5">Semana 5 (Días 29-{daysInMonth})</SelectItem>}
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

          <Button onClick={handleSaveAll} disabled={saving || employees.length === 0} className="gap-1.5 font-semibold">
            <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar Nómina"}
          </Button>
        </div>
      </div>

      {/* Selected Period Alert / Info */}
      <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3.5 flex items-center gap-3">
        <Calendar className="w-5 h-5 text-primary shrink-0" />
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Periodo de Nómina Seleccionado</span>
          <span className="text-sm font-bold text-foreground">{getPeriodLabel()}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Sueldo Base del Periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">${loading ? "—" : totalPeriodoBase.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Suma proporcional del periodo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Descuentos y Deducciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">-${loading ? "—" : totalDeduccionesFaltas.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Faltas + Deducciones del periodo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Bonos y Extras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">+${loading ? "—" : totalBonosExtras.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Extras + Bonificaciones aplicadas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardHeader className="py-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-primary uppercase">Nómina Total a Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">${loading ? "—" : totalFinal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-primary/80 mt-1 font-medium">Monto final dispersar del periodo</p>
          </CardContent>
        </Card>
      </div>

      {/* Spreadsheet List */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b">
              <TableRow>
                <TableHead className="font-bold min-w-[200px]">Empleado</TableHead>
                <TableHead className="text-right font-bold">Base del Periodo</TableHead>
                <TableHead className="text-center font-bold">Asistencias</TableHead>
                <TableHead className="text-center font-bold">Faltas</TableHead>
                <TableHead className="text-center font-bold">Extras</TableHead>
                <TableHead className="text-right font-bold min-w-[120px]">Bonos Extra</TableHead>
                <TableHead className="text-right font-bold min-w-[120px]">Deducciones</TableHead>
                <TableHead className="text-right font-bold">Monto Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    Cargando información y cálculos...
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    No hay empleados activos en el mes y sede seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => {
                  const calc = calculatePayroll(emp);
                  return (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div>{emp.nombre_completo}</div>
                        <div className="text-xs text-muted-foreground capitalize mt-0.5">{emp.servicio_ubicacion || "Sin servicio asignado"}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${calc.sueldoPeriodoBase.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-700 font-semibold text-xs border border-green-200">
                          {calc.asistio} d
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-xs border ${
                          calc.falta > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {calc.falta} d
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-xs border ${
                          calc.extra > 0 ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {calc.extra} e
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={modificaciones[emp.id]?.bonos === 0 ? "" : modificaciones[emp.id]?.bonos}
                            onChange={(e) => handleModifierChange(emp.id, "bonos", e.target.value)}
                            placeholder="0"
                            className="h-8 w-20 text-right p-1"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={modificaciones[emp.id]?.deducciones === 0 ? "" : modificaciones[emp.id]?.deducciones}
                            onChange={(e) => handleModifierChange(emp.id, "deducciones", e.target.value)}
                            placeholder="0"
                            className="h-8 w-20 text-right p-1 text-rose-600"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        ${calc.totalAPagar.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
