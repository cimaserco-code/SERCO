import React, { useEffect, useState, useCallback } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Trash2, Filter, Check, ChevronsUpDown, X, Users, Building2, MapPin, Settings2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import { useAuth } from "@/lib/AuthContext";
import { formatUserDisplayName } from "@/lib/userNameFormatting";
import AccessRestricted from "@/components/AccessRestricted";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const turnosConfig = [
  { key: "matutino", label: "Matutino", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "vespertino", label: "Vespertino", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "cubre_descansos", label: "Cubreturnos", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

export default function Plantilla() {
  const { user } = useAuth();
  const { sedeFilter } = useSedeScope();
  const { canView, can } = usePermissions();
  const [servicios, setServicios] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [serviceFilterOpen, setServiceFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modal for adding employee to a specific service + turno
  const [addModalData, setAddModalData] = useState(null); // { servicioId, turno }
  const [newEmpleado, setNewEmpleado] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  
  const [activeModuleTab, setActiveModuleTab] = useState("plantilla");
  const [vacantes, setVacantes] = useState([]);
  const [vacanteModalOpen, setVacanteModalOpen] = useState(false);
  const [vacanteForm, setVacanteForm] = useState({ servicio_id: "", puesto: "Guardia de Seguridad", turno: "matutino", cantidad: "1", requisitos: "", estado: "abierta" });
  const [deleteVacanteId, setDeleteVacanteId] = useState(null);

  // Modal para configurar cupos de guardia requeridos por turno
  const [cuposModalOpen, setCuposModalOpen] = useState(false);
  const [cuposModalServicio, setCuposModalServicio] = useState(null);
  const [cuposForm, setCuposForm] = useState({ matutino: 0, vespertino: 0, cubre_descansos: 0 });
  const [savingCupos, setSavingCupos] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [servs, emps, seds, vacs, asigs] = await Promise.all([
        sercoApi.entities.Servicio.filter(sedeFilter),
        sercoApi.entities.Empleado.filter(sedeFilter),
        sercoApi.entities.Sede.list(),
        sercoApi.entities.Vacante.filter(sedeFilter).catch(() => []),
        sercoApi.entities.AsignacionTurno.filter(sedeFilter).catch(() => []),
      ]);
      setServicios(servs || []);
      setEmpleados(emps || []);
      setSedes(seds || []);
      setVacantes(vacs || []);
      setAsignaciones(asigs || []);
      if (servs?.length > 0) {
        setVacanteForm(prev => ({ ...prev, servicio_id: prev.servicio_id || servs[0].id }));
      }
    } finally {
      setLoading(false);
    }
  }, [sedeFilter]);

  const loadAsignaciones = useCallback(async () => {
    try {
      const data = await sercoApi.entities.AsignacionTurno.filter(sedeFilter);
      setAsignaciones(data || []);
    } catch {
      setAsignaciones([]);
    }
  }, [sedeFilter]);

  const loadEmpleados = useCallback(async () => {
    try {
      const emps = await sercoApi.entities.Empleado.filter(sedeFilter);
      setEmpleados(emps || []);
    } catch {
      setEmpleados([]);
    }
  }, [sedeFilter]);

  useEffect(() => {
    loadData();

    const unsubAsig = sercoApi.entities.AsignacionTurno.subscribe(() => {
      loadAsignaciones();
    });
    const unsubEmp = sercoApi.entities.Empleado.subscribe(() => {
      loadEmpleados();
      loadAsignaciones();
    });
    const unsubServ = sercoApi.entities.Servicio.subscribe(() => {
      loadData();
    });

    return () => {
      unsubAsig?.();
      unsubEmp?.();
      unsubServ?.();
    };
  }, [loadData, loadAsignaciones, loadEmpleados]);

  // Resolver nombre de empleado en tiempo real desde la lista de empleados
  const resolveEmployeeName = useCallback((assignedName, asig) => {
    if (asig?.empleado_id) {
      const byId = empleados.find((e) => e.id === asig.empleado_id);
      if (byId?.nombre_completo) return byId.nombre_completo;
    }
    if (!assignedName) return "";
    const clean = assignedName.trim().toLowerCase();
    const matched = empleados.find(
      (e) => (e.nombre_completo || "").trim().toLowerCase() === clean
    );
    if (matched?.nombre_completo) return matched.nombre_completo;

    const partial = empleados.find((e) => {
      const n = (e.nombre_completo || "").trim().toLowerCase();
      return n.includes(clean) || clean.includes(n);
    });
    return partial?.nombre_completo || assignedName;
  }, [empleados]);

  function openAdd(servicioId, turnoKey) {
    setAddModalData({ servicioId, turno: turnoKey });
    setNewEmpleado("");
    setSearchTerm("");
  }

  function getGuardiasRequeridos(serv, turnoKey) {
    if (!serv) return 0;
    let config = serv.guardias_por_turno;
    if (typeof config === "string") {
      try { config = JSON.parse(config); } catch {}
    }
    if (!config && serv.turnos_autorizados) {
      try { config = JSON.parse(serv.turnos_autorizados); } catch {}
    }
    if (config && typeof config === "object") {
      return Math.max(0, parseInt(config[turnoKey]) || 0);
    }
    return 0;
  }

  function handleOpenCupos(serv) {
    setCuposModalServicio(serv);
    setCuposForm({
      matutino: getGuardiasRequeridos(serv, "matutino"),
      vespertino: getGuardiasRequeridos(serv, "vespertino"),
      cubre_descansos: getGuardiasRequeridos(serv, "cubre_descansos"),
    });
    setCuposModalOpen(true);
  }

  async function handleSaveCupos() {
    if (!cuposModalServicio) return;
    setSavingCupos(true);
    try {
      const updatedCupos = {
        matutino: Math.max(0, parseInt(cuposForm.matutino) || 0),
        vespertino: Math.max(0, parseInt(cuposForm.vespertino) || 0),
        cubre_descansos: Math.max(0, parseInt(cuposForm.cubre_descansos) || 0),
      };

      try {
        await sercoApi.entities.Servicio.update(cuposModalServicio.id, {
          guardias_por_turno: updatedCupos,
        });
      } catch {
        await sercoApi.entities.Servicio.update(cuposModalServicio.id, {
          turnos_autorizados: JSON.stringify(updatedCupos),
        }).catch(() => {});
      }

      setServicios((prev) =>
        prev.map((s) =>
          s.id === cuposModalServicio.id
            ? { ...s, guardias_por_turno: updatedCupos }
            : s
        )
      );

      setCuposModalOpen(false);
      setCuposModalServicio(null);
    } finally {
      setSavingCupos(false);
    }
  }

  async function handleAdd() {
    if (!newEmpleado || !addModalData?.servicioId || !addModalData?.turno) return;
    setSaving(true);
    try {
      const serv = servicios.find((s) => s.id === addModalData.servicioId);
      const currentUserName = (user?.full_name && user.full_name.trim() !== "" && user.full_name !== "Yo")
        ? user.full_name
        : (user?.nombre && user.nombre.trim() !== "" && user.nombre !== "Prueba1" && user.nombre !== "Usuario")
          ? user.nombre
          : (user?.email ? user.email.split('@')[0] : "Personal Autorizado");

      const now = new Date();
      const horaStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      const isoStr = now.toISOString();

      const cleanEmpName = newEmpleado.trim();
      const isTurnoCubre = addModalData.turno === "cubre_descansos";

      // Manejo de unicidad y excepción para Cubreturnos:
      if (isTurnoCubre) {
        // En cubreturnos: Puede estar en múltiples servicios.
        // Solo eliminamos asignación previa en ESTE mismo servicio para evitar duplicarlo dentro del mismo cliente.
        setAsignaciones((prev) =>
          prev.filter(
            (a) =>
              !(
                (a.empleado_nombre || "").trim().toLowerCase() === cleanEmpName.toLowerCase() &&
                a.servicio_id === addModalData.servicioId
              )
          )
        );

        try {
          const inThisServ = asignaciones.filter(
            (a) =>
              (a.empleado_nombre || "").trim().toLowerCase() === cleanEmpName.toLowerCase() &&
              a.servicio_id === addModalData.servicioId
          );
          for (const oldAsig of inThisServ) {
            await sercoApi.entities.AsignacionTurno.delete(oldAsig.id).catch(() => {});
          }
        } catch (cleanErr) {
          console.warn("Error al limpiar asignación previa en este servicio:", cleanErr);
        }
      } else {
        // En guardias ordinarios (matutino / vespertino):
        // NO puede existir en 2 servicios a la vez. Quitar de cualquier otro servicio anterior.
        setAsignaciones((prev) =>
          prev.filter((a) => (a.empleado_nombre || "").trim().toLowerCase() !== cleanEmpName.toLowerCase())
        );

        try {
          const existingInState = asignaciones.filter(
            (a) => (a.empleado_nombre || "").trim().toLowerCase() === cleanEmpName.toLowerCase()
          );
          for (const oldAsig of existingInState) {
            await sercoApi.entities.AsignacionTurno.delete(oldAsig.id).catch(() => {});
          }
          const existingInDb = await sercoApi.entities.AsignacionTurno.filter({ empleado_nombre: cleanEmpName }).catch(() => []);
          for (const oldAsig of existingInDb) {
            await sercoApi.entities.AsignacionTurno.delete(oldAsig.id).catch(() => {});
          }
        } catch (cleanErr) {
          console.warn("Error al limpiar asignaciones anteriores:", cleanErr);
        }
      }

      let createdRecord = null;
      try {
        createdRecord = await sercoApi.entities.AsignacionTurno.create({
          empleado_nombre: cleanEmpName,
          servicio_id: addModalData.servicioId,
          servicio_nombre: serv?.nombre || "",
          sede_id: serv?.sede_id || "",
          turno: addModalData.turno,
          usuario_asignacion: currentUserName,
          creado_por: currentUserName,
          hora: horaStr,
          fecha_asignacion: isoStr,
        });
      } catch {
        try {
          createdRecord = await sercoApi.entities.AsignacionTurno.create({
            empleado_nombre: cleanEmpName,
            servicio_id: addModalData.servicioId,
            servicio_nombre: serv?.nombre || "",
            sede_id: serv?.sede_id || "",
            turno: addModalData.turno,
            usuario_asignacion: currentUserName,
            creado_por: currentUserName,
          });
        } catch {
          createdRecord = await sercoApi.entities.AsignacionTurno.create({
            empleado_nombre: cleanEmpName,
            servicio_id: addModalData.servicioId,
            servicio_nombre: serv?.nombre || "",
            sede_id: serv?.sede_id || "",
            turno: addModalData.turno,
          });
        }
      }

      if (createdRecord) {
        setAsignaciones((prev) => [
          ...prev.filter((a) => {
            const matchName = (a.empleado_nombre || "").trim().toLowerCase() === cleanEmpName.toLowerCase();
            if (!matchName) return true;
            if (isTurnoCubre) {
              return a.servicio_id !== addModalData.servicioId;
            }
            return false;
          }),
          createdRecord,
        ]);
      }

      // Sincronizar automáticamente con el módulo de Empleados
      const matchedEmp = empleados.find((e) => (e.nombre_completo || "").trim().toLowerCase() === cleanEmpName.toLowerCase());
      if (matchedEmp) {
        // Si fue asignado a cubreturnos, su servicio queda marcado como "Cubreturnos"
        const nuevoServicio = isTurnoCubre ? "Cubreturnos" : (serv?.nombre || "");
        const nuevoTurno = isTurnoCubre ? "cubre_descansos" : addModalData.turno;

        try {
          await sercoApi.entities.Empleado.update(matchedEmp.id, {
            servicio_ubicacion: nuevoServicio,
            turno: nuevoTurno,
          });
        } catch {
          await sercoApi.entities.Empleado.update(matchedEmp.id, {
            servicio_ubicacion: nuevoServicio,
          }).catch(() => {});
        }

        setEmpleados((prev) =>
          prev.map((emp) =>
            emp.id === matchedEmp.id
              ? { ...emp, servicio_ubicacion: nuevoServicio, turno: nuevoTurno, usuario_modificacion: currentUserName }
              : emp
          )
        );
      }

      setAddModalData(null);
      setNewEmpleado("");
      await loadAsignaciones();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const asigToDelete = asignaciones.find((a) => a.id === deleteId);
    setAsignaciones((prev) => prev.filter((a) => a.id !== deleteId));
    await sercoApi.entities.AsignacionTurno.delete(deleteId);

    if (asigToDelete?.empleado_nombre) {
      const cleanName = (asigToDelete.empleado_nombre || "").trim().toLowerCase();
      const remaining = asignaciones.filter(
        (a) => a.id !== deleteId && (a.empleado_nombre || "").trim().toLowerCase() === cleanName
      );
      const matchedEmp = empleados.find((e) => (e.nombre_completo || "").trim().toLowerCase() === cleanName);

      if (matchedEmp) {
        const wasCubre =
          asigToDelete.turno === "cubre_descansos" ||
          (matchedEmp.servicio_ubicacion || "").toLowerCase().includes("cubre");

        if (wasCubre) {
          // Si era cubreturnos y ya no le quedan asignaciones en ningún servicio, limpiar servicio_ubicacion
          if (remaining.length === 0) {
            try {
              await sercoApi.entities.Empleado.update(matchedEmp.id, {
                servicio_ubicacion: "",
              });
              setEmpleados((prev) =>
                prev.map((e) => (e.id === matchedEmp.id ? { ...e, servicio_ubicacion: "" } : e))
              );
            } catch {}
          }
        } else {
          // Era guardia ordinario de un servicio
          if (remaining.length === 0) {
            if (matchedEmp.servicio_ubicacion === asigToDelete.servicio_nombre) {
              try {
                await sercoApi.entities.Empleado.update(matchedEmp.id, {
                  servicio_ubicacion: "",
                });
                setEmpleados((prev) =>
                  prev.map((e) => (e.id === matchedEmp.id ? { ...e, servicio_ubicacion: "" } : e))
                );
              } catch {}
            }
          }
        }
      }
    }

    setDeleteId(null);
    await loadAsignaciones();
  }

  async function loadVacantes() {
    try {
      const data = await sercoApi.entities.Vacante.filter(sedeFilter);
      setVacantes(data || []);
    } catch {
      setVacantes([]);
    }
  }

  async function handleAddVacante() {
    if (!vacanteForm.servicio_id || !vacanteForm.puesto) return;
    setSaving(true);
    try {
      const serv = servicios.find(s => s.id === vacanteForm.servicio_id);
      await sercoApi.entities.Vacante.create({
        ...vacanteForm,
        cantidad: Number(vacanteForm.cantidad || 1),
        sede_id: serv?.sede_id || ""
      });
      setVacanteModalOpen(false);
      setVacanteForm({ 
        servicio_id: servicios[0]?.id || "", 
        puesto: "Guardia de Seguridad", 
        turno: "matutino", 
        cantidad: "1", 
        requisitos: "", 
        estado: "abierta" 
      });
      await loadVacantes();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVacante() {
    await sercoApi.entities.Vacante.delete(deleteVacanteId);
    setDeleteVacanteId(null);
    await loadVacantes();
  }

  const toggleServiceFilter = (id) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const selectAllServices = () => {
    setSelectedServiceIds([]);
  };

  const displayedServicios = selectedServiceIds.length === 0
    ? servicios
    : servicios.filter((s) => selectedServiceIds.includes(s.id));

  const targetServicioObj = addModalData ? servicios.find((s) => s.id === addModalData.servicioId) : null;
  const targetTurnoObj = addModalData ? turnosConfig.find((t) => t.key === addModalData.turno) : null;

  if (!canView("turnos")) return <AccessRestricted />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold">Plantilla y Vacantes</h2>
          <p className="text-sm text-muted-foreground mt-1">Organiza la plantilla de turnos y registra vacantes para cada servicio</p>
        </div>
      </div>

      <Tabs value={activeModuleTab} onValueChange={setActiveModuleTab} className="w-full">
        <TabsList className="grid w-64 grid-cols-2">
          <TabsTrigger value="plantilla">Plantilla</TabsTrigger>
          <TabsTrigger value="vacantes">Vacantes ({vacantes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plantilla" className="mt-4 space-y-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Cargando...</div>
          ) : servicios.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No hay servicios registrados. Crea un servicio primero.
            </div>
          ) : (
            <>
              {/* Filter Controls Bar */}
              <div className="bg-card border rounded-lg p-3.5 space-y-2.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-primary" /> Filtrar Servicios:
                    </Label>

                    {/* Popover Filter with Checkboxes */}
                    <Popover open={serviceFilterOpen} onOpenChange={setServiceFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={serviceFilterOpen}
                          className="h-9 justify-between font-normal text-xs sm:text-sm min-w-[220px]"
                        >
                          <span className="truncate">
                            {selectedServiceIds.length === 0
                              ? `Todos los servicios (${servicios.length})`
                              : `${selectedServiceIds.length} servicio(s) seleccionado(s)`}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar servicio en filtro..." />
                          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 text-xs">
                            <button
                              type="button"
                              onClick={selectAllServices}
                              className="text-primary hover:underline font-medium"
                            >
                              Mostrar todos
                            </button>
                            {selectedServiceIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedServiceIds([])}
                                className="text-muted-foreground hover:underline"
                              >
                                Limpiar filtro
                              </button>
                            )}
                          </div>
                          <CommandList>
                            <CommandEmpty>No se encontraron servicios.</CommandEmpty>
                            <CommandGroup>
                              {servicios.map((s) => {
                                const isChecked = selectedServiceIds.includes(s.id);
                                return (
                                  <CommandItem
                                    key={s.id}
                                    value={s.nombre}
                                    onSelect={() => toggleServiceFilter(s.id)}
                                    className="cursor-pointer flex items-center justify-between py-2"
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleServiceFilter(s.id)}
                                      />
                                      <span className="truncate font-medium text-sm">{s.nombre}</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground shrink-0 ml-1">
                                      {sedes.find((sede) => sede.id === s.sede_id)?.nombre || ""}
                                    </span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {selectedServiceIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllServices}
                        className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                      >
                        Ver todos
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground font-medium">
                    Mostrando {displayedServicios.length} de {servicios.length} servicio(s)
                  </p>
                </div>

                {/* Active Filter Chips */}
                {selectedServiceIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
                    <span className="text-xs text-muted-foreground mr-1">Filtrando:</span>
                    {servicios
                      .filter((s) => selectedServiceIds.includes(s.id))
                      .map((s) => (
                        <Badge
                          key={s.id}
                          variant="secondary"
                          className="pl-2 pr-1 py-0.5 text-xs font-normal flex items-center gap-1 bg-primary/10 text-primary border border-primary/20"
                        >
                          {s.nombre}
                          <button
                            type="button"
                            onClick={() => toggleServiceFilter(s.id)}
                            className="hover:bg-primary/20 rounded p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                  </div>
                )}
              </div>

              {/* Services List Display */}
              {displayedServicios.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground space-y-2">
                  <p>No hay servicios que coincidan con el filtro seleccionado.</p>
                  <Button variant="outline" size="sm" onClick={selectAllServices}>
                    Mostrar todos los servicios
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {displayedServicios.map((serv) => {
                    const servSede = sedes.find((s) => s.id === serv.sede_id);
                    const rawServAsignaciones = asignaciones.filter((a) => a.servicio_id === serv.id);
                    const seenInServ = new Set();
                    const servAsignaciones = rawServAsignaciones.filter((a) => {
                      const resolved = resolveEmployeeName(a.empleado_nombre, a);
                      const key = (resolved || a.empleado_nombre || "").trim().toLowerCase();
                      if (!key || seenInServ.has(key)) return false;

                      // Si el empleado está registrado en empleados y tiene otro servicio asignado o es baja, quitarlo de inmediato
                      const matchedEmp = empleados.find(
                        (e) => (e.nombre_completo || "").trim().toLowerCase() === key
                      );
                      if (matchedEmp) {
                        const isBaja = Boolean(
                          matchedEmp.fecha_baja && (!matchedEmp.fecha_reingreso || matchedEmp.fecha_baja > matchedEmp.fecha_reingreso)
                        );
                        if (isBaja) return false;

                        const isCubreTurnos =
                          a.turno === "cubre_descansos" ||
                          (matchedEmp.servicio_ubicacion || "").toLowerCase().includes("cubre") ||
                          (matchedEmp.puesto || "").toLowerCase().includes("cubre");

                        // Si NO es cubreturnos, verificar que su servicio coincida
                        if (!isCubreTurnos) {
                          if (matchedEmp.servicio_ubicacion && matchedEmp.servicio_ubicacion.trim().toLowerCase() !== (serv.nombre || "").trim().toLowerCase()) {
                            return false;
                          }
                        }
                      }

                      seenInServ.add(key);
                      return true;
                    });

                    return (
                      <div
                        key={serv.id}
                        className="border rounded-xl bg-card/60 dark:bg-card/40 p-4 sm:p-5 shadow-sm space-y-4 hover:shadow transition-shadow"
                      >
                        {/* Service Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-primary" />
                                {serv.nombre}
                              </h3>
                              {servSede && (
                                <Badge variant="outline" className="text-xs font-medium">
                                  {servSede.nombre}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {serv.direccion && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" /> {serv.direccion}
                                </span>
                              )}
                              {serv.admin_nombre && (
                                <span>· Admin: <strong className="text-foreground">{serv.admin_nombre}</strong></span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-medium bg-slate-100 dark:bg-slate-800">
                              <Users className="w-3.5 h-3.5 mr-1 text-primary" />
                              {servAsignaciones.length}
                              {(() => {
                                const totalReq = getGuardiasRequeridos(serv, "matutino") + getGuardiasRequeridos(serv, "vespertino") + getGuardiasRequeridos(serv, "cubre_descansos");
                                return totalReq > 0 ? ` / ${totalReq}` : "";
                              })()} guardia(s) asignado(s)
                            </Badge>

                            {can("turnos", "create") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenCupos(serv)}
                                className="h-7 text-xs font-medium border-dashed hover:border-solid gap-1"
                                title="Configurar cuántos guardias se ocupan en cada turno de este servicio"
                              >
                                <Settings2 className="w-3.5 h-3.5 text-primary" />
                                Configurar Cupos
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* 3 Turn Cards Grid */}
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                          {turnosConfig.map((turno) => {
                            const items = servAsignaciones.filter((a) => a.turno === turno.key);
                            const reqCount = getGuardiasRequeridos(serv, turno.key);
                            const isFull = reqCount > 0 && items.length >= reqCount;
                            const isIncomplete = reqCount > 0 && items.length > 0 && items.length < reqCount;
                            const isVacant = reqCount > 0 && items.length === 0;

                            return (
                              <Card
                                key={turno.key}
                                className={cn(
                                  "border shadow-none bg-background transition-colors",
                                  isVacant && "border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10"
                                )}
                              >
                                <CardHeader className="p-3.5 pb-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-0.5">
                                      <span className="text-sm font-semibold text-foreground">{turno.label}</span>
                                      {reqCount > 0 && (
                                        <p className="text-[11px] text-muted-foreground">
                                          Requeridos: <strong className="text-foreground">{reqCount}</strong>
                                        </p>
                                      )}
                                    </div>

                                    {reqCount > 0 ? (
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "text-xs font-medium px-2 py-0.5 border flex items-center gap-1",
                                          isFull && "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300",
                                          isIncomplete && "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300",
                                          isVacant && "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300"
                                        )}
                                      >
                                        {isFull && "✓ "}
                                        {isIncomplete && "⚠ "}
                                        {isVacant && "✕ "}
                                        {items.length} / {reqCount}
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className={turno.color}>
                                        {items.length}
                                      </Badge>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent className="p-3.5 pt-0">
                                  <div className="space-y-1.5 min-h-[90px] max-h-[220px] overflow-y-auto">
                                    {items.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-6 text-center">
                                        Sin guardias en este turno
                                      </p>
                                    ) : (
                                      items.map((item) => (
                                        <div
                                          key={item.id}
                                          className="flex items-center justify-between p-2 rounded-md bg-muted/60 text-xs hover:bg-muted transition-colors"
                                        >
                                          <span className="font-medium text-foreground truncate pr-2">
                                            {resolveEmployeeName(item.empleado_nombre, item)}
                                          </span>
                                          {can("turnos", "delete") && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                              onClick={() => setDeleteId(item.id)}
                                              title="Remover de turno"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  {can("turnos", "create") && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full mt-2.5 text-xs h-8"
                                      onClick={() => openAdd(serv.id, turno.key)}
                                    >
                                      <Plus className="w-3.5 h-3.5 mr-1" /> Asignar guardia
                                    </Button>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="vacantes" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Vacantes Operativas</h3>
            {can("turnos", "create") && (
              <Button onClick={() => setVacanteModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Registrar Vacante
              </Button>
            )}
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead>Requisitos</TableHead>
                  <TableHead>Estado</TableHead>
                  {can("turnos", "delete") && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>
                ) : vacantes.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay vacantes registradas</TableCell></TableRow>
                ) : (
                  vacantes.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">
                        {servicios.find(s => s.id === v.servicio_id)?.nombre || "—"}
                      </TableCell>
                      <TableCell>
                        {sedes.find(s => s.id === v.sede_id)?.nombre || "—"}
                      </TableCell>
                      <TableCell>{v.puesto}</TableCell>
                      <TableCell className="capitalize">{v.turno}</TableCell>
                      <TableCell className="text-center font-bold">{v.cantidad}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={v.requisitos}>
                        {v.requisitos || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={v.estado === "abierta" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                          {v.estado === "abierta" ? "Abierta" : "Cubierta"}
                        </Badge>
                      </TableCell>
                      {can("turnos", "delete") && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteVacanteId(v.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog for Adding Employee to specific service and turn */}
      <Dialog open={!!addModalData} onOpenChange={(v) => !v && setAddModalData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Asignar a {targetTurnoObj?.label || "Turno"}
            </DialogTitle>
            <DialogDescription>
              {targetServicioObj ? `Servicio: ${targetServicioObj.nombre}` : "Selecciona un empleado para asignar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {targetTurnoObj?.key === "cubre_descansos" ? (
              <div className="p-2.5 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-800 dark:text-purple-300">
                ℹ <strong>Cubreturnos:</strong> Los guardias en este turno pueden estar asignados a más de un servicio para cubrir descansos. En su ficha de empleado quedará registrado como <strong>"Cubreturnos"</strong>.
              </div>
            ) : (
              <div className="p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                ℹ <strong>Guardia de Turno Fijo:</strong> Un empleado solo puede pertenecer a un servicio a la vez. Si ya está en otro servicio, se transferirá automáticamente a este.
              </div>
            )}

            {empleados.length > 0 ? (
              <div>
                <Label>Escribe o busca el nombre del empleado</Label>
                <Input
                  type="text"
                  placeholder="Buscar empleado por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-2 mt-1"
                />
                <div className="border rounded-md max-h-48 overflow-y-auto divide-y bg-background">
                  {(() => {
                    const activeEmps = empleados.filter(
                      (emp) => !emp.fecha_baja || (emp.fecha_reingreso && emp.fecha_reingreso >= emp.fecha_baja)
                    );
                    const listToFilter = activeEmps.length > 0 ? activeEmps : empleados;
                    const filtered = listToFilter.filter((emp) =>
                      (emp.nombre_completo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (emp.puesto || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (emp.servicio_ubicacion || "").toLowerCase().includes(searchTerm.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-muted-foreground p-3 text-center">
                          No se encontraron empleados activos
                        </p>
                      );
                    }
                    // Prioritize employees whose current servicio matches or who are unassigned
                    const sorted = [...filtered].sort((a, b) => {
                      const aMatches = targetServicioObj && a.servicio_ubicacion === targetServicioObj.nombre ? 1 : 0;
                      const bMatches = targetServicioObj && b.servicio_ubicacion === targetServicioObj.nombre ? 1 : 0;
                      return bMatches - aMatches;
                    });

                    return sorted.map((emp) => {
                      const isSelected = newEmpleado === emp.nombre_completo;
                      const isAssignedToThisServ = targetServicioObj && emp.servicio_ubicacion === targetServicioObj.nombre;
                      const isCubreEmp = (emp.servicio_ubicacion || "").toLowerCase().includes("cubre") || (emp.puesto || "").toLowerCase().includes("cubre");
                      const isAnotherServ = emp.servicio_ubicacion && !isAssignedToThisServ && !isCubreEmp;

                      return (
                        <div
                          key={emp.id}
                          onClick={() => setNewEmpleado(emp.nombre_completo)}
                          className={`p-2.5 text-sm cursor-pointer transition-colors hover:bg-muted flex items-center justify-between ${
                            isSelected ? "bg-primary/10 font-medium text-primary" : ""
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-medium">{formatUserDisplayName(emp.nombre_completo, user?.role)}</div>
                            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                              {emp.puesto && <span>{emp.puesto}</span>}
                              {isCubreEmp ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 font-normal bg-purple-100 text-purple-700 border border-purple-200"
                                >
                                  Cubreturnos
                                </Badge>
                              ) : isAssignedToThisServ ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 font-normal bg-emerald-100 text-emerald-700 border border-emerald-300"
                                >
                                  {emp.servicio_ubicacion}
                                </Badge>
                              ) : isAnotherServ ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 font-normal bg-amber-100 text-amber-700 border border-amber-300"
                                >
                                  En {emp.servicio_ubicacion} {targetTurnoObj?.key !== "cubre_descansos" ? "(se transferirá)" : ""}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Sin servicio</span>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No hay empleados registrados</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalData(null)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving || !newEmpleado}>
              {saving ? "Guardando..." : "Asignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para configurar cupos por turno del servicio */}
      <Dialog open={cuposModalOpen} onOpenChange={(v) => !v && setCuposModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Guardias Requeridos por Turno
            </DialogTitle>
            <DialogDescription>
              {cuposModalServicio?.nombre ? `Servicio: ${cuposModalServicio.nombre}` : "Define cuántos guardias se ocupan en cada turno."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="cupo-matutino" className="flex items-center justify-between text-sm">
                <span className="font-semibold text-amber-700 dark:text-amber-400">Turno Matutino</span>
                <span className="text-xs text-muted-foreground">Guardias necesarios</span>
              </Label>
              <Input
                id="cupo-matutino"
                type="number"
                min="0"
                placeholder="Ej. 2"
                value={cuposForm.matutino}
                onChange={(e) => setCuposForm({ ...cuposForm, matutino: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cupo-vespertino" className="flex items-center justify-between text-sm">
                <span className="font-semibold text-blue-700 dark:text-blue-400">Turno Vespertino</span>
                <span className="text-xs text-muted-foreground">Guardias necesarios</span>
              </Label>
              <Input
                id="cupo-vespertino"
                type="number"
                min="0"
                placeholder="Ej. 2"
                value={cuposForm.vespertino}
                onChange={(e) => setCuposForm({ ...cuposForm, vespertino: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cupo-cubre" className="flex items-center justify-between text-sm">
                <span className="font-semibold text-purple-700 dark:text-purple-400">Cubreturnos</span>
                <span className="text-xs text-muted-foreground">Guardias necesarios</span>
              </Label>
              <Input
                id="cupo-cubre"
                type="number"
                min="0"
                placeholder="Ej. 1"
                value={cuposForm.cubre_descansos}
                onChange={(e) => setCuposForm({ ...cuposForm, cubre_descansos: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCuposModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCupos} disabled={savingCupos}>
              {savingCupos ? "Guardando..." : "Guardar Cupos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vacanteModalOpen} onOpenChange={setVacanteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Nueva Vacante</DialogTitle>
            <DialogDescription>Completa la información para la vacante operativa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Servicio *</Label>
              <Select 
                value={vacanteForm.servicio_id} 
                onValueChange={(v) => setVacanteForm({ ...vacanteForm, servicio_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona un servicio" /></SelectTrigger>
                <SelectContent>
                  {servicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Puesto / Título *</Label>
              <Input 
                value={vacanteForm.puesto} 
                onChange={(e) => setVacanteForm({ ...vacanteForm, puesto: e.target.value })} 
                placeholder="Ej. Guardia de Seguridad"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Turno</Label>
                <Select 
                  value={vacanteForm.turno} 
                  onValueChange={(v) => setVacanteForm({ ...vacanteForm, turno: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="cubre_descansos">Cubre Descansos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad de Vacantes</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={vacanteForm.cantidad} 
                  onChange={(e) => setVacanteForm({ ...vacanteForm, cantidad: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Requisitos / Comentarios</Label>
              <Input 
                value={vacanteForm.requisitos} 
                onChange={(e) => setVacanteForm({ ...vacanteForm, requisitos: e.target.value })} 
                placeholder="Ej. Documentación completa, experiencia..."
              />
            </div>
            <div>
              <Label>Estado de Vacante</Label>
              <Select 
                value={vacanteForm.estado} 
                onValueChange={(v) => setVacanteForm({ ...vacanteForm, estado: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierta">Abierta</SelectItem>
                  <SelectItem value="cubierta">Cubierta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVacanteModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddVacante} disabled={saving || !vacanteForm.servicio_id || !vacanteForm.puesto}>
              {saving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Quitar empleado de la plantilla?"
        description="Esta acción removerá al empleado de este turno en el servicio."
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!deleteVacanteId}
        onOpenChange={(v) => !v && setDeleteVacanteId(null)}
        title="¿Eliminar vacante registrada?"
        description="Esta acción eliminará el registro de vacante de manera permanente."
        onConfirm={handleDeleteVacante}
      />
    </div>
  );
}
