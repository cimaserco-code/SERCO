import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { ChevronLeft, ChevronRight, Check, X, Calendar, UserCheck } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

const estadosConfig = {
  asistió: { label: "A", color: "bg-green-500 hover:bg-green-600 text-white font-bold" },
  falta: { label: "F", color: "bg-red-500 hover:bg-red-600 text-white font-bold" },
  descanso: { label: "D", color: "bg-slate-400 hover:bg-slate-500 text-white font-bold" },
  extra: { label: "E", color: "bg-purple-500 hover:bg-purple-600 text-white font-bold" },
  descanso_laborado: { label: "DL", color: "bg-sky-500 hover:bg-sky-600 text-white font-bold" },
  descanso_extra: { label: "DLE", color: "bg-indigo-500 hover:bg-indigo-600 text-white font-bold" },
};

export default function Asistencias() {
  const { canView, can } = usePermissions();
  const { sedeFilter } = useSedeScope();
  const [employees, setEmployees] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });
  const [selectedEmpSummary, setSelectedEmpSummary] = useState(null);

  useEffect(() => {
    loadData();
  }, [sedeFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [emps, asists] = await Promise.all([
        sercoApi.entities.Empleado.filter(sedeFilter).catch(() => []),
        sercoApi.entities.Asistencia.list().catch(() => [])
      ]);
      // Only keep active employees (who didn't get given "baja" or did a re-entry after their last baja)
      const activeEmps = emps.filter(e => !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja));
      setEmployees(activeEmps);
      setAsistencias(asists);
    } catch (e) {
      console.error(e);
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

  // Get specific attendance status
  const getAsistenciaEstado = (employeeId, day) => {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    const found = asistencias.find(
      (a) => a.empleado_id === employeeId && a.fecha === dateStr
    );
    return found?.estado || null;
  };

  // Set specific attendance status
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
    const found = asistencias.find(
      (a) => a.empleado_id === employeeId && a.fecha === dateStr
    );

    setSaving(true);
    try {
      const emp = employees.find(e => e.id === employeeId);
      if (found) {
        if (estado === null) {
          await sercoApi.entities.Asistencia.delete(found.id);
        } else {
          await sercoApi.entities.Asistencia.update(found.id, { 
            estado,
            sede_id: emp?.sede_id || null 
          });
        }
      } else if (estado !== null) {
        await sercoApi.entities.Asistencia.create({
          empleado_id: employeeId,
          fecha: dateStr,
          estado,
          sede_id: emp?.sede_id || null
        });
      }
      // Reload from DB to verify sync
      const updatedAsists = await sercoApi.entities.Asistencia.list();
      setAsistencias(updatedAsists);
    } catch (e) {
      console.error("Error al guardar asistencia:", e);
      toast({
        title: "Error al actualizar asistencia",
        description: e.message || "Ocurrió un error inesperado al guardar la asistencia.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

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

  if (!canView("asistencias")) return <AccessRestricted />;

  // Group employees by servicio_ubicacion
  const groupedEmployees = employees.reduce((groups, emp) => {
    const serviceName = emp.servicio_ubicacion || "Sin Servicio Asignado";
    if (!groups[serviceName]) {
      groups[serviceName] = [];
    }
    groups[serviceName].push(emp);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Control de Asistencias</h2>
          <p className="text-sm text-muted-foreground mt-1">Registra y visualiza la asistencia diaria de los guardias</p>
        </div>
        
        {/* Month Selector Carousel */}
        <div className="flex items-center gap-2 bg-card border rounded-lg p-1 self-start sm:self-auto">
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

      {/* States Legend */}
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-green-500 text-white font-bold">A</span>
            <span>Asistió</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-red-500 text-white font-bold">F</span>
            <span>Falta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-slate-400 text-white font-bold">D</span>
            <span>Descanso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-purple-500 text-white font-bold text-[10px]">E</span>
            <span>Turno Extra</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-sky-500 text-white font-bold text-[10px]">DL</span>
            <span>Descanso Lab.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-indigo-500 text-white font-bold text-[10px]">DLE</span>
            <span>Descanso Lab. + Extra</span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground self-center italic">
            * Haz clic en cualquier casilla para cambiar o alternar la asistencia.
          </div>
        </CardContent>
      </Card>

      {/* Spreadsheet grid */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b">
              <TableRow>
                <TableHead className="sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 min-w-[200px] border-r font-bold">
                  Empleado
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
                  <TableCell colSpan={daysInMonth + 1} className="text-center text-muted-foreground py-12">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={daysInMonth + 1} className="text-center text-muted-foreground py-12">
                    No hay empleados activos en la sede seleccionada.
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(groupedEmployees).map(([serviceName, groupEmps]) => (
                  <React.Fragment key={serviceName}>
                    {/* Service Group Header Row */}
                    <TableRow className="bg-slate-200 dark:bg-slate-800 border-b select-none hover:bg-slate-200">
                      <TableCell 
                        className="sticky left-0 bg-slate-200 dark:bg-slate-800 py-2.5 px-4 text-sm text-foreground font-bold z-10 border-r border-b text-left min-w-[200px]"
                      >
                        {serviceName}
                      </TableCell>
                      <TableCell 
                        colSpan={daysInMonth} 
                        className="bg-slate-200 dark:bg-slate-800 border-b"
                      />
                    </TableRow>
                    {groupEmps.map((emp) => (
                      <TableRow key={emp.id} className="hover:bg-muted/50">
                        <TableCell className="sticky left-0 bg-card z-10 border-r font-medium py-2 min-w-[200px]">
                          <button
                            type="button"
                            onClick={() => setSelectedEmpSummary(emp)}
                            className="text-primary hover:underline text-left font-semibold focus:outline-none"
                          >
                            {emp.nombre_completo}
                          </button>
                        </TableCell>
                        {daysArray.map((day) => {
                          const currentVal = getAsistenciaEstado(emp.id, day);
                          const todayFlag = isToday(day);
                          return (
                            <TableCell 
                              key={day} 
                              className={`p-1 text-center ${
                                todayFlag ? "bg-primary/5 border-x border-primary/10" : ""
                              }`}
                            >
                              <Select
                                value={currentVal || "none"}
                                onValueChange={(val) => handleSetEstado(emp.id, day, val === "none" ? null : val)}
                              >
                                <SelectTrigger className={`w-8 h-8 p-0 rounded flex items-center justify-center border transition-all ${
                                  currentVal ? estadosConfig[currentVal].color : "bg-card text-muted-foreground border-border hover:bg-muted"
                                }`}>
                                  <span className="text-xs uppercase font-bold">
                                    {currentVal ? estadosConfig[currentVal].label : "-"}
                                  </span>
                                </SelectTrigger>
                                <SelectContent className="min-w-[100px]">
                                  <SelectItem value="none">- Limpiar</SelectItem>
                                  <SelectItem value="asistió">Asistió</SelectItem>
                                  <SelectItem value="falta">Falta</SelectItem>
                                  <SelectItem value="descanso">Descanso</SelectItem>
                                  <SelectItem value="extra">Extra</SelectItem>
                                  <SelectItem value="descanso_laborado">Descanso Laborado</SelectItem>
                                  <SelectItem value="descanso_extra">Descanso Lab. + Extra</SelectItem>
                                </SelectContent>
                              </Select>
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
  
  const divisor = totalA + totalF + totalDL + totalDLE;
  const punctuality = divisor > 0 ? Math.round(((totalA + totalDL + totalDLE) / divisor) * 100) : 100;

  return (
    <Dialog open={!!employee} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Resumen: {employee.nombre_completo}
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
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={() => onClose()} className="w-full sm:w-auto">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
