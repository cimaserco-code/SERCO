import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
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

const turnosConfig = [
  { key: "matutino", label: "Matutino", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "vespertino", label: "Vespertino", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "cubre_descansos", label: "Cubre Descansos", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

export default function Turnos() {
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
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [servs, emps, seds] = await Promise.all([
          base44.entities.Servicio.filter(sedeFilter),
          base44.entities.Empleado.filter(sedeFilter),
          base44.entities.Sede.list(),
        ]);
        setServicios(servs);
        setEmpleados(emps);
        setSedes(seds);
        if (servs.length > 0) setSelectedServicio(servs[0].id);
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
      const data = await base44.entities.AsignacionTurno.filter({ servicio_id: selectedServicio });
      setAsignaciones(data);
    } catch {
      setAsignaciones([]);
    }
  }

  function openAdd(turnoKey) {
    setAddModalTurno(turnoKey);
    setNewEmpleado("");
  }

  async function handleAdd() {
    if (!newEmpleado) return;
    setSaving(true);
    try {
      const serv = servicios.find((s) => s.id === selectedServicio);
      await base44.entities.AsignacionTurno.create({
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
    await base44.entities.AsignacionTurno.delete(deleteId);
    setDeleteId(null);
    await loadAsignaciones();
  }

  const selectedServicioObj = servicios.find((s) => s.id === selectedServicio);

  if (!canView("turnos")) return <AccessRestricted />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-heading font-bold">Distribución de Turnos</h2>
        <p className="text-sm text-muted-foreground mt-1">Asigna empleados por turno en cada servicio</p>
      </div>

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
              {sedes.find((s) => s.id === selectedServicioObj.sede_id)?.nombre || "Sin sede"}
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

      <Dialog open={!!addModalTurno} onOpenChange={(v) => !v && setAddModalTurno(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Asignar a {turnosConfig.find((t) => t.key === addModalTurno)?.label}
            </DialogTitle>
            <DialogDescription>Selecciona un empleado o escribe el nombre</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {empleados.length > 0 && (
              <div>
                <Label>Seleccionar empleado existente</Label>
                <Select value={newEmpleado} onValueChange={setNewEmpleado}>
                  <SelectTrigger><SelectValue placeholder="Buscar..." /></SelectTrigger>
                  <SelectContent>
                    {empleados.map((emp) => (
                      <SelectItem key={emp.id} value={emp.nombre_completo}>
                        {emp.nombre_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>O escribir nombre manualmente</Label>
              <Input
                value={newEmpleado}
                onChange={(e) => setNewEmpleado(e.target.value)}
                placeholder="Nombre del empleado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalTurno(null)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving || !newEmpleado}>
              {saving ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Quitar empleado del turno?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}