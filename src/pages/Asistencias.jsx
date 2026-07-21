import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
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

const estadosConfig = {
  asistió: { label: "A", color: "bg-green-500 hover:bg-green-600 text-white font-bold" },
  falta: { label: "F", color: "bg-red-500 hover:bg-red-600 text-white font-bold" },
  descanso: { label: "D", color: "bg-slate-400 hover:bg-slate-500 text-white font-bold" },
  extra: { label: "E", color: "bg-purple-500 hover:bg-purple-600 text-white font-bold" },
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

  useEffect(() => {
    loadData();
  }, [sedeFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [emps, asists] = await Promise.all([
        base44.entities.Empleado.filter(sedeFilter),
        base44.entities.Asistencia.list()
      ]);
      // Only keep active employees (who didn't get given "baja" or got "baja" in the future)
      const activeEmps = emps.filter(e => !e.fecha_baja || new Date(e.fecha_baja) >= new Date());
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
      if (found) {
        if (estado === null) {
          await base44.entities.Asistencia.delete(found.id);
        } else {
          await base44.entities.Asistencia.update(found.id, { estado });
        }
      } else if (estado !== null) {
        await base44.entities.Asistencia.create({
          empleado_id: employeeId,
          fecha: dateStr,
          estado
        });
      }
      // Reload from DB to verify sync
      const updatedAsists = await base44.entities.Asistencia.list();
      setAsistencias(updatedAsists);
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la asistencia.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canView("asistencias")) return <AccessRestricted />;

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
            <span className="w-6 h-6 flex items-center justify-center rounded bg-purple-500 text-white font-bold">E</span>
            <span>Turno Extra</span>
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
                {daysArray.map((day) => (
                  <TableHead key={day} className="text-center font-bold px-1 py-2 min-w-[36px]">
                    {day}
                  </TableHead>
                ))}
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
                employees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/50">
                    <TableCell className="sticky left-0 bg-card z-10 border-r font-medium py-2 min-w-[200px]">
                      {emp.nombre_completo}
                    </TableCell>
                    {daysArray.map((day) => {
                      const currentVal = getAsistenciaEstado(emp.id, day);
                      return (
                        <TableCell key={day} className="p-1 text-center">
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
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
