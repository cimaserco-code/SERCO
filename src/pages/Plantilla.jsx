import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Trash2 } from "lucide-react";
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
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

const turnosConfig = [
  { key: "matutino", label: "Matutino", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "vespertino", label: "Vespertino", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "cubre_descansos", label: "Cubre Descansos", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

export default function Plantilla() {
  const { sedeFilter } = useSedeScope();
  const { canView, can } = usePermissions();
  const [servicios, setServicios] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [selectedServicio, setSelectedServicio] = useState("");
  const [loading, setLoading] = useState(true);
  const [addModalTurno, setAddModalTurno] = useState(null);
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
        const [servs, emps, seds, vacs] = await Promise.all([
          sercoApi.entities.Servicio.filter(sedeFilter),
          sercoApi.entities.Empleado.filter(sedeFilter),
          sercoApi.entities.Sede.list(),
          sercoApi.entities.Vacante.filter(sedeFilter).catch(() => []),
        ]);
        setServicios(servs);
        setEmpleados(emps);
        setSedes(seds);
        setVacantes(vacs);
        if (servs.length > 0) {
          setSelectedServicio(servs[0].id);
          setVacanteForm(prev => ({ ...prev, servicio_id: servs[0].id }));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedServicio) return;
    loadAsignaciones();
  }, [selectedServicio]);

  async function loadAsignaciones() {
    try {
      const data = await sercoApi.entities.AsignacionTurno.filter({ servicio_id: selectedServicio });
      setAsignaciones(data);
    } catch {
      setAsignaciones([]);
    }
  }

  function openAdd(turnoKey) {
    setAddModalTurno(turnoKey);
    setNewEmpleado("");
    setSearchTerm("");
  }

  async function handleAdd() {
    if (!newEmpleado) return;
    setSaving(true);
    try {
      const serv = servicios.find((s) => s.id === selectedServicio);
      await sercoApi.entities.AsignacionTurno.create({
        empleado_nombre: newEmpleado,
        servicio_id: selectedServicio,
        servicio_nombre: serv?.nombre || "",
        sede_id: serv?.sede_id || "",
        turno: addModalTurno,
      });
      setAddModalTurno(null);
      setNewEmpleado("");
      await loadAsignaciones();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await sercoApi.entities.AsignacionTurno.delete(deleteId);
    setDeleteId(null);
    await loadAsignaciones();
  }

  async function loadVacantes() {
    try {
      const data = await sercoApi.entities.Vacante.filter(sedeFilter);
      setVacantes(data);
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

  const selectedServicioObj = servicios.find((s) => s.id === selectedServicio);

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
              <div className="flex items-center gap-3 flex-wrap">
                <Label className="shrink-0">Servicio:</Label>
                <Select value={selectedServicio} onValueChange={setSelectedServicio}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Selecciona un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedServicioObj && (
                <p className="text-sm text-muted-foreground">
                  {sedes.find((s) => s.id === selectedServicioObj.sede_id)?.nombre || "Sin Sede"}
                  {selectedServicioObj.direccion ? ` · ${selectedServicioObj.direccion}` : ""}
                  {selectedServicioObj.admin_nombre ? ` · Admin: ${selectedServicioObj.admin_nombre}` : ""}
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                {turnosConfig.map((turno) => {
                  const items = asignaciones.filter((a) => a.turno === turno.key);
                  return (
                    <Card key={turno.key}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span>{turno.label}</span>
                          <Badge variant="secondary" className={turno.color}>{items.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 min-h-[100px]">
                          {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">Sin asignaciones</p>
                          ) : (
                            items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                              >
                                <span className="text-sm font-medium">{item.empleado_nombre}</span>
                                {can("turnos", "delete") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setDeleteId(item.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
                            className="w-full mt-3"
                            onClick={() => openAdd(turno.key)}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar empleado
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
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

      <Dialog open={!!addModalTurno} onOpenChange={(v) => !v && setAddModalTurno(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Asignar a {turnosConfig.find((t) => t.key === addModalTurno)?.label}
            </DialogTitle>
            <DialogDescription>Selecciona un empleado de la plantilla</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {empleados.length > 0 && (
              <div>
                <Label>Escribe el nombre del empleado</Label>
                <Input
                  type="text"
                  placeholder="Buscar empleado por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-2"
                />
                <div className="border rounded-md max-h-48 overflow-y-auto divide-y bg-background">
                  {(() => {
                    const filtered = empleados.filter((emp) =>
                      (emp.nombre_completo || "").toLowerCase().includes(searchTerm.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-muted-foreground p-3 text-center">
                          No se encontraron empleados activos
                        </p>
                      );
                    }
                    return filtered.map((emp) => {
                      const isSelected = newEmpleado === emp.nombre_completo;
                      return (
                        <div
                          key={emp.id}
                          onClick={() => setNewEmpleado(emp.nombre_completo)}
                          className={`p-2 text-sm cursor-pointer transition-colors hover:bg-muted ${
                            isSelected ? "bg-primary/10 font-medium text-primary" : ""
                          }`}
                        >
                          {emp.nombre_completo}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalTurno(null)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving || !newEmpleado}>
              {saving ? "Guardando..." : "Agregar"}
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