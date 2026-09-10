import React, { useEffect, useState, useMemo } from "react";
import { sercoApi } from "@/api/sercoClient";
import { ChevronLeft, ChevronRight, Check, X, Calendar, UserCheck, Palmtree, Search, Download } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import { toast } from "@/components/ui/use-toast";
import { formatPersonName } from "@/lib/userNameFormatting";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

const estadosConfig = {
  asistió: { label: "A", name: "Asistió", color: "bg-green-500 hover:bg-green-600 text-white font-bold shadow-sm" },
  falta: { label: "F", name: "Falta", color: "bg-red-500 hover:bg-red-600 text-white font-bold shadow-sm" },
  descanso: { label: "D", name: "Descanso", color: "bg-slate-400 hover:bg-slate-500 text-white font-bold shadow-sm" },
  extra: { label: "E", name: "Turno Extra", color: "bg-purple-500 hover:bg-purple-600 text-white font-bold shadow-sm" },
  descanso_laborado: { label: "DL", name: "Descanso Lab.", color: "bg-sky-500 hover:bg-sky-600 text-white font-bold shadow-sm" },
  descanso_extra: { label: "DLE", name: "Descanso Lab. + Extra", color: "bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-sm" },
  vacaciones: { label: "V", name: "Vacaciones", color: "bg-teal-500 hover:bg-teal-600 text-white font-bold shadow-sm" },
  justificada: { label: "J", name: "Justificada", color: "bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm" },
};

export default function Asistencias() {
  const { canView, can } = usePermissions();
  const { sedeFilter } = useSedeScope();
  const [employees, setEmployees] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });
  const [selectedEmpSummary, setSelectedEmpSummary] = useState(null);
  
  // Single active cell state for fast floating picker
  const [activeCell, setActiveCell] = useState(null); // { employeeId, employeeName, day, currentVal, rect }
  const [secondaryAttendanceStates, setSecondaryAttendanceStates] = useState({});

  // Vacaciones Modal State
  const [vacacionesModalOpen, setVacacionesModalOpen] = useState(false);
  const [vacacionesForm, setVacacionesForm] = useState({
    empleado_id: "",
    fecha_inicio: "",
    fecha_fin: "",
  });
  const [vacacionesSaving, setVacacionesSaving] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");

  // Index asistencias by `employeeId_YYYY-MM-DD` for O(1) instant lookups
  const asistenciasMap = useMemo(() => {
    const map = new Map();
    for (const a of asistencias) {
      if (a.empleado_id && a.fecha) {
        map.set(`${a.empleado_id}_${a.fecha}`, a);
      }
    }
    return map;
  }, [asistencias]);

  useEffect(() => {
    loadData();
  }, [sedeFilter, currentMonth]);

  // Close active cell popover on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setActiveCell(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function loadData() {
    setLoading(true);
    setActiveCell(null);
    try {
      const [yearStr, monthStr] = currentMonth.split("-");
      const y = parseInt(yearStr);
      const m = parseInt(monthStr) - 1;
      const daysInM = new Date(y, m + 1, 0).getDate();
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-${String(daysInM).padStart(2, '0')}`;

      const filterObj = {
        ...sedeFilter,
        fecha: {
          '$gte': startDate,
          '$lte': endDate
        }
      };

      const [emps, asists, seds] = await Promise.all([
        sercoApi.entities.Empleado.filter(sedeFilter).catch(() => []),
        sercoApi.entities.Asistencia.filter(filterObj).catch(() => []),
        sercoApi.entities.Sede.list().catch(() => [])
      ]);
      // Only keep active employees
      const activeEmps = (emps || []).filter(e => !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja));
      setEmployees(activeEmps);
      setAsistencias(asists || []);
      setSedes(seds || []);
    } catch (e) {
      console.error("Error al cargar datos de asistencias:", e);
    } finally {
      setLoading(false);
    }
  }

  const [yearStr, monthStr] = currentMonth.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // 0-indexed

  // Days in month calculation
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Month names
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  function handleMonthChange(direction) {
    let newYear = year;
    let newMonth = month + direction;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    const mm = String(newMonth + 1).padStart(2, '0');
    setCurrentMonth(`${newYear}-${mm}`);
  }

  // Set specific attendance status with Optimistic UI updates
  const handleSetEstado = async (employeeId, day, estado) => {
    if (!can("asistencias", "edit")) {
      toast({
        title: "Sin permisos",
        description: "No tienes permiso para editar asistencias.",
        variant: "destructive"
      });
      return;
    }
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    const key = `${employeeId}_${dateStr}`;
    const previous = asistenciasMap.get(key);

    // Optimistic UI state update (Instantaneous feedback)
    setAsistencias((prev) => {
      if (estado === null) {
        return prev.filter((a) => !(a.empleado_id === employeeId && a.fecha === dateStr));
      }
      const existing = prev.find((a) => a.empleado_id === employeeId && a.fecha === dateStr);
      if (existing) {
        return prev.map((a) => (a.id === existing.id ? { ...a, estado } : a));
      } else {
        const emp = employees.find((e) => e.id === employeeId);
        return [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            empleado_id: employeeId,
            fecha: dateStr,
            estado,
            sede_id: emp?.sede_id || null,
          },
        ];
      }
    });

    try {
      const emp = employees.find((e) => e.id === employeeId);
      if (estado === null) {
        if (previous?.id && !String(previous.id).startsWith("temp-")) {
          await sercoApi.entities.Asistencia.delete(previous.id);
        }
      } else if (previous?.id && !String(previous.id).startsWith("temp-")) {
        await sercoApi.entities.Asistencia.update(previous.id, { 
          estado,
          sede_id: emp?.sede_id || null 
        });
      } else {
        const created = await sercoApi.entities.Asistencia.upsert({
          empleado_id: employeeId,
          fecha: dateStr,
          estado,
          sede_id: emp?.sede_id || null
        }, 'empleado_id,fecha');
        
        // Update temporary ID with real DB ID
        if (created?.id) {
          setAsistencias((prev) =>
            prev.map((a) =>
              a.empleado_id === employeeId && a.fecha === dateStr ? { ...a, id: created.id } : a
            )
          );
        }
      }
    } catch (e) {
      console.error("Error al guardar asistencia:", e);
      // Revert optimistic update
      setAsistencias((prev) => {
        if (!previous) {
          return prev.filter((a) => !(a.empleado_id === employeeId && a.fecha === dateStr));
        }
        return prev.map((a) => (a.empleado_id === employeeId && a.fecha === dateStr ? previous : a));
      });
      toast({
        title: "Error al actualizar asistencia",
        description: e.message || "Ocurrió un error inesperado al guardar la asistencia.",
        variant: "destructive"
      });
    }
  };

  const handleSetSecondaryEstado = (employeeId, day, estado) => {
    const key = `${employeeId}_${currentMonth}-${String(day).padStart(2, '0')}`;
    setSecondaryAttendanceStates((prev) => {
      const next = { ...prev };
      if (estado === null) {
        delete next[key];
      } else {
        next[key] = estado;
      }
      return next;
    });
  };

  // Assign vacation range
  const handleSaveVacaciones = async () => {
    if (!vacacionesForm.empleado_id || !vacacionesForm.fecha_inicio || !vacacionesForm.fecha_fin) {
      toast({
        title: "Campos incompletos",
        description: "Por favor selecciona el empleado y el rango de fechas.",
        variant: "destructive"
      });
      return;
    }

    const start = new Date(vacacionesForm.fecha_inicio + "T00:00:00");
    const end = new Date(vacacionesForm.fecha_fin + "T00:00:00");
    if (end < start) {
      toast({
        title: "Fechas inválidas",
        description: "La fecha de fin no puede ser anterior a la fecha de inicio.",
        variant: "destructive"
      });
      return;
    }

    setVacacionesSaving(true);
    const emp = employees.find(e => e.id === vacacionesForm.empleado_id);
    
    try {
      const datesToAssign = [];
      const current = new Date(start);
      while (current <= end) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        datesToAssign.push(`${yyyy}-${mm}-${dd}`);
        current.setDate(current.getDate() + 1);
      }

      // Upsert all days
      for (const dateStr of datesToAssign) {
        await sercoApi.entities.Asistencia.upsert({
          empleado_id: vacacionesForm.empleado_id,
          fecha: dateStr,
          estado: "vacaciones",
          sede_id: emp?.sede_id || null
        }, 'empleado_id,fecha');
      }

      toast({
        title: "Vacaciones asignadas",
        description: `Se registraron ${datesToAssign.length} día(s) de vacaciones para ${formatPersonName(emp?.nombre_completo) || "el empleado"}.`,
      });

      setVacacionesModalOpen(false);
      setVacacionesForm({ empleado_id: "", fecha_inicio: "", fecha_fin: "" });
      setEmpSearch("");
      await loadData();
    } catch (err) {
      console.error("Error al programar vacaciones:", err);
      toast({
        title: "Error al guardar vacaciones",
        description: err.message || "Ocurrió un error inesperado al guardar.",
        variant: "destructive"
      });
    } finally {
      setVacacionesSaving(false);
    }
  };

  const vacationDaysCount = useMemo(() => {
    if (!vacacionesForm.fecha_inicio || !vacacionesForm.fecha_fin) return 0;
    const start = new Date(vacacionesForm.fecha_inicio + "T00:00:00");
    const end = new Date(vacacionesForm.fecha_fin + "T00:00:00");
    if (end < start) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [vacacionesForm.fecha_inicio, vacacionesForm.fecha_fin]);

  // Day of week calculation
  const getDayOfWeek = (dayNum) => {
    try {
      const date = new Date(year, month, dayNum);
      const days = ["D", "L", "M", "M", "J", "V", "S"];
      return days[date.getDay()];
    } catch {
      return "";
    }
  };

  // Check if day is today
  const today = new Date();
  const isToday = (dayNum) => {
    return today.getFullYear() === year &&
           today.getMonth() === month &&
           today.getDate() === dayNum;
  };

  const filteredEmployees = useMemo(() => {
    const search = attendanceSearch.trim().toLowerCase();
    if (!search) return employees;

    return employees.filter((emp) =>
      (emp.nombre_completo || "").toLowerCase().includes(search) ||
      (emp.servicio_ubicacion || "").toLowerCase().includes(search)
    );
  }, [employees, attendanceSearch]);

  if (!canView("asistencias")) return <AccessRestricted />;

  // Group employees by servicio_ubicacion
  const groupedEmployees = filteredEmployees.reduce((groups, emp) => {
    const serviceName = emp.servicio_ubicacion || "Sin Servicio Asignado";
    if (!groups[serviceName]) {
      groups[serviceName] = [];
    }
    groups[serviceName].push(emp);
    return groups;
  }, {});

  const selectedVacationEmp = employees.find(e => e.id === vacacionesForm.empleado_id);
  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";
  const exportToExcel = () => {
    if (!employees || employees.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay empleados para exportar en este período.",
        variant: "destructive",
      });
      return;
    }

    const dayHeaders = daysArray.map((day) => `${day} (${getDayOfWeek(day)})`);
    const headers = [
      "Empleado",
      "Servicio / Ubicación",
      "Puesto",
      "Sede",
      ...dayHeaders,
      "Total Asistió (A)",
      "Total Faltas (F)",
      "Total Descansos (D)",
      "Total Extras (E)",
      "Total Desc. Lab (DL)",
      "Total Desc. Extra (DLE)",
      "Total Vacaciones (V)",
      "Total Justificadas (J)",
    ];

    const rows = employees.map((emp) => {
      let countA = 0;
      let countF = 0;
      let countD = 0;
      let countE = 0;
      let countDL = 0;
      let countDLE = 0;
      let countV = 0;
      let countJ = 0;

      const dayCells = daysArray.map((day) => {
        const dateStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
        const record = asistenciasMap.get(`${emp.id}_${dateStr}`);
        const estado = record?.estado || "";

        if (estado === "asistió") countA++;
        else if (estado === "falta") countF++;
        else if (estado === "descanso") countD++;
        else if (estado === "extra") countE++;
        else if (estado === "descanso_laborado") countDL++;
        else if (estado === "descanso_extra") countDLE++;
        else if (estado === "vacaciones") countV++;
        else if (estado === "justificada") countJ++;

        return estado ? estadosConfig[estado]?.label || estado : "";
      });

      return [
        emp.nombre_completo || "",
        emp.servicio_ubicacion || "Sin Asignar",
        emp.puesto || "",
        sedeNombre(emp.sede_id),
        ...dayCells,
        countA,
        countF,
        countD,
        countE,
        countDL,
        countDLE,
        countV,
        countJ,
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `asistencias_${currentMonth}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Control de Asistencias</h2>
          <p className="text-sm text-muted-foreground mt-1">Registra y visualiza la asistencia diaria de los guardias</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Asignar Vacaciones Button */}
          {can("asistencias", "edit") && (
            <Button
              onClick={() => {
                setVacacionesForm({
                  empleado_id: employees[0]?.id || "",
                  fecha_inicio: `${currentMonth}-01`,
                  fecha_fin: `${currentMonth}-06`,
                });
                setEmpSearch("");
                setVacacionesModalOpen(true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs sm:text-sm h-9 shadow-sm"
            >
              <Palmtree className="w-4 h-4 mr-1.5" /> Asignar Vacaciones
            </Button>
          )}

          {/* Exportar Excel Button */}
          <Button
            variant="outline"
            onClick={exportToExcel}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950 font-medium text-xs sm:text-sm h-9 shadow-sm"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" /> Exportar Excel
          </Button>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o servicio..."
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
              aria-label="Buscar asistencia por nombre o servicio"
            />
          </div>

          {/* Month Selector Carousel */}
          <div className="flex items-center gap-2 bg-card border rounded-lg p-1 self-start sm:self-auto shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => handleMonthChange(-1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 py-1 font-semibold text-sm min-w-[120px] text-center">
              {monthNames[month]} {year}
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleMonthChange(1)} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* States Legend */}
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
          {Object.entries(estadosConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-6 h-6 flex items-center justify-center rounded ${cfg.color} text-xs`}>
                {cfg.label}
              </span>
              <span>{cfg.name}</span>
            </div>
          ))}
          <div className="ml-auto text-xs text-muted-foreground self-center italic">
            * Haz clic en cualquier casilla para cambiar o alternar la asistencia.
          </div>
        </CardContent>
      </Card>

      {/* Fast Spreadsheet Grid */}
      <div className="rounded-lg border bg-card overflow-hidden shadow-sm relative">
        <div className="overflow-x-auto max-w-full">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b">
              <TableRow>
                <TableHead className="sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 min-w-[200px] border-r font-bold">
                  Empleado ({filteredEmployees.length})
                </TableHead>
                {daysArray.map((day) => {
                  const todayFlag = isToday(day);
                  return (
                    <TableHead 
                      key={day} 
                      className={`text-center font-bold px-1 py-1 min-w-[36px] text-xs ${
                        todayFlag ? "bg-primary/15 text-primary border-x border-primary/30" : ""
                      }`}
                    >
                      <div className="text-[10px] opacity-75 uppercase">{getDayOfWeek(day)}</div>
                      <div className={`text-xs ${todayFlag ? "font-black" : ""}`}>{day}</div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={daysInMonth + 1} className="text-center text-muted-foreground py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Cargando asistencias...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={daysInMonth + 1} className="text-center text-muted-foreground py-12">
                    {attendanceSearch.trim()
                      ? "No se encontraron empleados para la búsqueda."
                      : "No hay empleados activos en la sede seleccionada."}
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(groupedEmployees).map(([serviceName, groupEmps]) => (
                  <React.Fragment key={serviceName}>
                    {/* Service Group Header Row */}
                    <TableRow className="bg-slate-200/80 dark:bg-slate-800/80 border-b select-none hover:bg-slate-200/80">
                      <TableCell 
                        className="sticky left-0 bg-slate-200/95 dark:bg-slate-800/95 py-2 px-4 text-xs sm:text-sm text-foreground font-bold z-10 border-r border-b text-left min-w-[200px]"
                      >
                        {serviceName} ({groupEmps.length})
                      </TableCell>
                      <TableCell 
                        colSpan={daysInMonth} 
                        className="bg-slate-200/80 dark:bg-slate-800/80 border-b"
                      />
                    </TableRow>
                    {groupEmps.map((emp) => (
                      <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="sticky left-0 bg-card z-10 border-r font-medium py-1.5 min-w-[200px]">
                          <button
                            type="button"
                            onClick={() => setSelectedEmpSummary(emp)}
                            className="text-primary hover:underline text-left font-semibold text-xs sm:text-sm focus:outline-none truncate block max-w-[190px]"
                            title="Ver resumen mensual de asistencia"
                          >
                            {formatPersonName(emp.nombre_completo)}
                          </button>
                        </TableCell>
                        {daysArray.map((day) => {
                          const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                          const asig = asistenciasMap.get(`${emp.id}_${dateStr}`);
                          const currentVal = asig?.estado || null;
                          const todayFlag = isToday(day);
                          const cellSlots = [0, 1];

                          return (
                            <TableCell 
                              key={day} 
                              className={`p-0.5 text-center min-w-[36px] ${
                                todayFlag ? "bg-primary/5 border-x border-primary/10" : ""
                              }`}
                            >
                              <div className="flex flex-col gap-0.5">
                                {cellSlots.map((slot) => {
                                  const slotVal = slot === 1
                                    ? secondaryAttendanceStates[`${emp.id}_${dateStr}`] || null
                                    : currentVal;
                                  const cfg = slotVal ? estadosConfig[slotVal] : null;

                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setActiveCell({
                                          employeeId: emp.id,
                                          employeeName: formatPersonName(emp.nombre_completo),
                                          day,
                                          currentVal: slotVal,
                                          isSecondary: slot === 1,
                                          rect: {
                                            top: rect.top,
                                            bottom: rect.bottom,
                                            left: rect.left,
                                            right: rect.right
                                          }
                                        });
                                      }}
                                      className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto p-0 rounded flex items-center justify-center border transition-all cursor-pointer select-none text-[11px] font-bold ${
                                        cfg 
                                          ? cfg.color 
                                          : "bg-background text-muted-foreground/40 border-border/60 hover:bg-muted hover:text-foreground"
                                      }`}
                                      title={`${formatPersonName(emp.nombre_completo)} - Día ${day}: ${slotVal ? estadosConfig[slotVal]?.name : "Sin registro"}`}
                                    >
                                      <span>{cfg ? cfg.label : "-"}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Fast Single Floating Status Picker Modal */}
      {activeCell && (
        <>
          {/* Backdrop to close on click outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setActiveCell(null)} 
          />

          {/* Floating Context Card */}
          <div
            className="fixed z-50 bg-popover text-popover-foreground border rounded-xl shadow-2xl p-3 animate-in fade-in-0 zoom-in-95 w-[260px]"
            style={{
              top: Math.max(16, Math.min(window.innerHeight - 240, activeCell.rect.bottom + 6)),
              left: Math.max(16, Math.min(window.innerWidth - 276, activeCell.rect.left - 90)),
            }}
          >
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b text-xs font-semibold">
              <div className="truncate pr-1">
                <span className="text-foreground font-bold">{activeCell.employeeName}</span>
                <span className="text-muted-foreground block text-[10px]">Día {activeCell.day} de {monthNames[month]}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(estadosConfig).map(([key, cfg]) => {
                const isSelected = activeCell.currentVal === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (activeCell.isSecondary) {
                        handleSetSecondaryEstado(activeCell.employeeId, activeCell.day, key);
                      } else {
                        handleSetEstado(activeCell.employeeId, activeCell.day, key);
                      }
                      setActiveCell(null);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-transform hover:scale-105 ${cfg.color} ${
                      isSelected ? "ring-2 ring-foreground ring-offset-1 shadow-md scale-105" : ""
                    }`}
                    title={cfg.name}
                  >
                    <span className="text-xs font-black">{cfg.label}</span>
                    <span className="text-[8px] font-normal opacity-90 truncate max-w-[45px] text-center leading-none mt-0.5">
                      {cfg.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2 border-t flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (activeCell.isSecondary) {
                    handleSetSecondaryEstado(activeCell.employeeId, activeCell.day, null);
                  } else {
                    handleSetEstado(activeCell.employeeId, activeCell.day, null);
                  }
                  setActiveCell(null);
                }}
                className="w-full text-xs py-1.5 rounded-md border border-dashed text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors font-medium text-center"
              >
                - Limpiar celda
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal: Asignar Periodo de Vacaciones */}
      <Dialog open={vacacionesModalOpen} onOpenChange={setVacacionesModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-teal-700 dark:text-teal-400">
              <Palmtree className="w-5 h-5 text-teal-600" />
              Asignar Periodo de Vacaciones
            </DialogTitle>
            <DialogDescription>
              Programa los días de vacaciones para un empleado y se reflejarán automáticamente en el calendario de asistencias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Empleado Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Seleccionar Empleado</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar empleado por nombre o servicio..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              <div className="border rounded-lg max-h-40 overflow-y-auto divide-y bg-background mt-1">
                {(() => {
                  const filtered = employees.filter((emp) =>
                    (emp.nombre_completo || "").toLowerCase().includes(empSearch.toLowerCase()) ||
                    (emp.servicio_ubicacion || "").toLowerCase().includes(empSearch.toLowerCase()) ||
                    (emp.puesto || "").toLowerCase().includes(empSearch.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground p-3 text-center">
                        No se encontraron empleados activos
                      </p>
                    );
                  }
                  return filtered.map((emp) => {
                    const isSelected = vacacionesForm.empleado_id === emp.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => setVacacionesForm({ ...vacacionesForm, empleado_id: emp.id })}
                        className={`p-2 text-xs cursor-pointer transition-colors hover:bg-muted flex items-center justify-between ${
                          isSelected ? "bg-teal-500/10 font-semibold text-teal-800 dark:text-teal-300" : ""
                        }`}
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className="truncate">{formatPersonName(emp.nombre_completo)}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            {emp.servicio_ubicacion && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                                {emp.servicio_ubicacion}
                              </Badge>
                            )}
                            {emp.puesto && <span>{emp.puesto}</span>}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Date Range Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fecha de Inicio</Label>
                <Input
                  type="date"
                  value={vacacionesForm.fecha_inicio}
                  onChange={(e) => setVacacionesForm({ ...vacacionesForm, fecha_inicio: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fecha de Fin</Label>
                <Input
                  type="date"
                  value={vacacionesForm.fecha_fin}
                  onChange={(e) => setVacacionesForm({ ...vacacionesForm, fecha_fin: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Vacation Summary Badge */}
            {selectedVacationEmp && vacacionesForm.fecha_inicio && vacacionesForm.fecha_fin && (
              <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Empleado:</span>
                  <span className="font-bold text-teal-800 dark:text-teal-200 truncate max-w-[180px]">
                    {formatPersonName(selectedVacationEmp.nombre_completo)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Días a programar:</span>
                  <Badge className="bg-teal-600 text-white font-bold text-xs">
                    {vacationDaysCount} día(s)
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setVacacionesModalOpen(false)}
              disabled={vacacionesSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveVacaciones}
              disabled={vacacionesSaving || !vacacionesForm.empleado_id || vacationDaysCount === 0}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {vacacionesSaving ? "Guardando..." : "Programar Vacaciones"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Modal */}
      {selectedEmpSummary && (
        <EmployeeSummaryDialog
          employee={selectedEmpSummary}
          currentMonth={currentMonth}
          monthName={monthNames[month]}
          year={year}
          asistencias={asistencias}
          onClose={() => setSelectedEmpSummary(null)}
        />
      )}
    </div>
  );
}

// Attendance summary modal helper
const EmployeeSummaryDialog = ({ employee, currentMonth, monthName, year, asistencias, onClose }) => {
  const empAsists = asistencias.filter(a => a.empleado_id === employee.id && a.fecha.startsWith(currentMonth));
  const totalA = empAsists.filter(a => a.estado === "asistió").length;
  const totalF = empAsists.filter(a => a.estado === "falta").length;
  const totalD = empAsists.filter(a => a.estado === "descanso").length;
  const totalE = empAsists.filter(a => a.estado === "extra").length;
  const totalDL = empAsists.filter(a => a.estado === "descanso_laborado").length;
  const totalDLE = empAsists.filter(a => a.estado === "descanso_extra").length;
  const totalV = empAsists.filter(a => a.estado === "vacaciones").length;
  const totalJ = empAsists.filter(a => a.estado === "justificada").length;
  
  const divisor = totalA + totalF + totalDL + totalDLE;
  const punctuality = divisor > 0 ? Math.round(((totalA + totalDL + totalDLE) / divisor) * 100) : 100;

  return (
    <Dialog open={!!employee} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Resumen: {formatPersonName(employee.nombre_completo)}
          </DialogTitle>
          <DialogDescription>
            Detalles de asistencia correspondientes a {monthName} de {year}
          </DialogDescription>
        </DialogHeader>

        {/* KPIs Section */}
        <div className="grid grid-cols-3 gap-3 my-2">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-black text-primary">{punctuality}%</div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Asistencia</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-black text-green-600">{totalA}</div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Asistió</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-black text-purple-600">{totalE}</div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Extras</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-md border text-xs">
            <span className="text-muted-foreground">Faltas:</span>
            <span className="font-bold text-red-500">{totalF}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-md border text-xs">
            <span className="text-muted-foreground">Descansos:</span>
            <span className="font-bold text-slate-500">{totalD}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-md border text-xs">
            <span className="text-muted-foreground">Descanso Laborado (DL):</span>
            <span className="font-bold text-sky-600">{totalDL}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-md border text-xs">
            <span className="text-muted-foreground">Descanso Lab. + Extra (DLE):</span>
            <span className="font-bold text-indigo-600">{totalDLE}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-md border text-xs">
            <span className="text-muted-foreground">Vacaciones (V):</span>
            <span className="font-bold text-teal-600">{totalV}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-md border text-xs">
            <span className="text-muted-foreground">Justificaciones (J):</span>
            <span className="font-bold text-amber-600">{totalJ}</span>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={() => onClose()} className="w-full sm:w-auto">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
