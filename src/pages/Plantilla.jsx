import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Trash2, Filter, Check, ChevronsUpDown, X, Users, Building2, MapPin } from "lucide-react";
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
import AccessRestricted from "@/components/AccessRestricted";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const turnosConfig = [
  { key: "matutino", label: "Matutino", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "vespertino", label: "Vespertino", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "cubre_descansos", label: "Cubre Descansos", color: "bg-purple-100 text-purple-700 border-purple-200" },
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

  useEffect(() => {
    async function load() {
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
          setVacanteForm(prev => ({ ...prev, servicio_id: servs[0].id }));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function loadAsignaciones() {
    try {
      const data = await sercoApi.entities.AsignacionTurno.filter(sedeFilter);
      setAsignaciones(data || []);
    } catch {
      setAsignaciones([]);
    }
  }

  function openAdd(servicioId, turnoKey) {
    setAddModalData({ servicioId, turno: turnoKey });
    setNewEmpleado("");
    setSearchTerm("");
  }

  async function handleAdd() {
    if (!newEmpleado || !addModalData?.servicioId || !addModalData?.turno) return;
    setSaving(true);
    try {
      const serv = servicios.find((s) => s.id === addModalData.servicioId);
      const currentUserName = user?.full_name || user?.nombre || (user?.email ? user.email.split('@')[0] : "Usuario");

      const now = new Date();
      const horaStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      const isoStr = now.toISOString();

      try {
        await sercoApi.entities.AsignacionTurno.create({
          empleado_nombre: newEmpleado,
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
          await sercoApi.entities.AsignacionTurno.create({
            empleado_nombre: newEmpleado,
            servicio_id: addModalData.servicioId,
            servicio_nombre: serv?.nombre || "",
            sede_id: serv?.sede_id || "",
            turno: addModalData.turno,
            usuario_asignacion: currentUserName,
            creado_por: currentUserName,
          });
        } catch {
          await sercoApi.entities.AsignacionTurno.create({
            empleado_nombre: newEmpleado,
            servicio_id: addModalData.servicioId,
            servicio_nombre: serv?.nombre || "",
            sede_id: serv?.sede_id || "",
            turno: addModalData.turno,
          });
        }
      }

      // Sincronizar automáticamente con el módulo de Empleados
      const matchedEmp = empleados.find((e) => e.nombre_completo === newEmpleado);
      if (matchedEmp) {
        try {
          await sercoApi.entities.Empleado.update(matchedEmp.id, {
            servicio_ubicacion: serv?.nombre || "",
            turno: addModalData.turno,
            usuario_modificacion: currentUserName,
          });
        } catch {
          await sercoApi.entities.Empleado.update(matchedEmp.id, {
            servicio_ubicacion: serv?.nombre || "",
          }).catch(() => {});
        }

        setEmpleados((prev) =>
          prev.map((emp) =>
            emp.id === matchedEmp.id
              ? { ...emp, servicio_ubicacion: serv?.nombre || "", turno: addModalData.turno, usuario_modificacion: currentUserName }
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
    await sercoApi.entities.AsignacionTurno.delete(deleteId);

    // Si el empleado ya no tiene asignaciones activas en este servicio, actualizar su servicio_ubicacion
    if (asigToDelete?.empleado_nombre) {
      const remaining = asignaciones.filter(
        (a) => a.id !== deleteId && a.empleado_nombre === asigToDelete.empleado_nombre
      );
      if (remaining.length === 0) {
        const matchedEmp = empleados.find((e) => e.nombre_completo === asigToDelete.empleado_nombre);
        if (matchedEmp && matchedEmp.servicio_ubicacion === asigToDelete.servicio_nombre) {
          try {
            await sercoApi.entities.Empleado.update(matchedEmp.id, {
              servicio_ubicacion: "",
            });
            setEmpleados((prev) =>
              prev.map((emp) =>
                emp.id === matchedEmp.id ? { ...emp, servicio_ubicacion: "" } : emp
              )
            );
          } catch (e) {
            console.warn("Error al actualizar empleado desasignado:", e);
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
                    const servAsignaciones = asignaciones.filter((a) => a.servicio_id === serv.id);

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

                          <Badge variant="secondary" className="self-start sm:self-center font-medium bg-slate-100 dark:bg-slate-800">
                            <Users className="w-3.5 h-3.5 mr-1" />
                            {servAsignaciones.length} guardia(s) asignado(s)
                          </Badge>
                        </div>

                        {/* 3 Turn Cards Grid */}
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                          {turnosConfig.map((turno) => {
                            const items = servAsignaciones.filter((a) => a.turno === turno.key);
                            return (
                              <Card key={turno.key} className="border shadow-none bg-background">
                                <CardHeader className="p-3.5 pb-2">
                                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                                    <span>{turno.label}</span>
                                    <Badge variant="secondary" className={turno.color}>
                                      {items.length}
                                    </Badge>
                                  </CardTitle>
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
                                            {item.empleado_nombre}
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
                      return (
                        <div
                          key={emp.id}
                          onClick={() => setNewEmpleado(emp.nombre_completo)}
                          className={`p-2.5 text-sm cursor-pointer transition-colors hover:bg-muted flex items-center justify-between ${
                            isSelected ? "bg-primary/10 font-medium text-primary" : ""
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-medium">{emp.nombre_completo}</div>
                            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                              {emp.puesto && <span>{emp.puesto}</span>}
                              {emp.servicio_ubicacion ? (
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0 h-4 font-normal ${
                                    isAssignedToThisServ
                                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {emp.servicio_ubicacion}
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