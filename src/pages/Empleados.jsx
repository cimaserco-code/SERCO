import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Search, FileText } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import SedeSelector from "@/components/SedeSelector";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";

const emptyForm = {
  nombre_completo: "",
  fecha_ingreso: "",
  sueldo: "",
  servicio_ubicacion: "",
  puesto: "",
  telefono: "",
  email: "",
  curp: "",
  rfc: "",
  nss: "",
  sede_id: "",
  fecha_baja: "",
  actas_administrativas: "0",
  uniformes: ""
};

export default function Empleados() {
  const { canView, can } = usePermissions();
  const canAccess = canView("empleados");
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const [items, setItems] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState("activos");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        base44.entities.Empleado.filter(sedeFilter, "-created_date"),
        base44.entities.Sede.list(),
      ]);
      setItems(data);
      setSedes(s);
    } finally {
      setLoading(false);
    }
  }

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const filtered = items.filter((item) =>
    (item.nombre_completo || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.puesto || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.servicio_ubicacion || "").toLowerCase().includes(search.toLowerCase())
  );

  // Divide into Active and Bajas
  const activos = filtered.filter(item => !item.fecha_baja);
  const bajas = filtered.filter(item => item.fecha_baja);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ 
      ...emptyForm, 
      ...item, 
      sueldo: item.sueldo ?? "",
      actas_administrativas: String(item.actas_administrativas ?? 0),
      fecha_baja: item.fecha_baja || "",
      uniformes: item.uniformes || ""
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        sueldo: form.sueldo === "" ? null : Number(form.sueldo),
        actas_administrativas: Number(form.actas_administrativas || 0),
        fecha_baja: form.fecha_baja || null,
        uniformes: form.uniformes || null
      };
      if (editing) {
        await base44.entities.Empleado.update(editing.id, payload);
      } else {
        await base44.entities.Empleado.create(payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await base44.entities.Empleado.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  // Finiquito estimation helper
  function getFiniquitoEstimation(ingreso, baja, sueldo) {
    if (!ingreso || !baja || !sueldo) return null;
    const start = new Date(ingreso);
    const end = new Date(baja);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Simple estimation (e.g. 15 days of aguinaldo per year, 6 days of vacation per year)
    const dailySueldo = sueldo / 30;
    const estimatedAguinaldo = (diffDays / 365) * 15 * dailySueldo;
    const estimatedVacacion = (diffDays / 365) * 6 * dailySueldo;
    const total = estimatedAguinaldo + estimatedVacacion;
    
    return {
      days: diffDays,
      total: Math.round(total)
    };
  }

  if (!canAccess) {
    return <AccessRestricted />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Empleados</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activos.length} activos · {bajas.length} bajas
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          {can("empleados", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-64 grid-cols-2">
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="bajas">Bajas</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Fecha Ingreso</TableHead>
                  <TableHead className="text-right">Sueldo</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Uniformes</TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : activos.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No hay empleados activos</TableCell></TableRow>
                ) : (
                  activos.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nombre_completo}</TableCell>
                      <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                      <TableCell>{item.puesto || "—"}</TableCell>
                      <TableCell>{item.fecha_ingreso || "—"}</TableCell>
                      <TableCell className="text-right">
                        {item.sueldo != null ? `$${Number(item.sueldo).toLocaleString("es-MX")}` : "—"}
                      </TableCell>
                      <TableCell>{item.servicio_ubicacion || "—"}</TableCell>
                      <TableCell className="truncate max-w-[150px]">{item.uniformes || "Ninguno"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.actas_administrativas > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {item.actas_administrativas || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {can("empleados", "edit") && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {can("empleados", "delete") && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="bajas" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Fecha Ingreso</TableHead>
                  <TableHead>Fecha Baja</TableHead>
                  <TableHead>Días Laborados</TableHead>
                  <TableHead className="text-right">Finiquito Est.</TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : bajas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay registros de bajas</TableCell></TableRow>
                ) : (
                  bajas.map((item) => {
                    const est = getFiniquitoEstimation(item.fecha_ingreso, item.fecha_baja, item.sueldo);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.nombre_completo}</TableCell>
                        <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                        <TableCell>{item.fecha_ingreso || "—"}</TableCell>
                        <TableCell className="text-destructive font-semibold">{item.fecha_baja || "—"}</TableCell>
                        <TableCell>{est ? `${est.days} días` : "—"}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {est ? `$${est.total.toLocaleString("es-MX")}` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700`}>
                            {item.actas_administrativas || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {can("empleados", "edit") && (
                              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {can("empleados", "delete") && (
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
            <DialogDescription>Completa los datos del empleado</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2">
              <Label>Nombre Completo *</Label>
              <Input value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <SedeSelector value={form.sede_id} onChange={(v) => setForm({ ...form, sede_id: v })} sedes={sedes} />
            </div>
            <div>
              <Label>Puesto</Label>
              <Input value={form.puesto} onChange={(e) => setForm({ ...form, puesto: e.target.value })} />
            </div>
            <div>
              <Label>Fecha de Ingreso</Label>
              <Input type="date" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
            </div>
            <div>
              <Label>Sueldo Mensual</Label>
              <Input type="number" value={form.sueldo} onChange={(e) => setForm({ ...form, sueldo: e.target.value })} />
            </div>
            <div>
              <Label>Servicio / Ubicación</Label>
              <Input value={form.servicio_ubicacion} onChange={(e) => setForm({ ...form, servicio_ubicacion: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>CURP</Label>
              <Input value={form.curp} onChange={(e) => setForm({ ...form, curp: e.target.value })} />
            </div>
            <div>
              <Label>RFC</Label>
              <Input value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
            </div>
            <div>
              <Label>NSS</Label>
              <Input value={form.nss} onChange={(e) => setForm({ ...form, nss: e.target.value })} />
            </div>
            <div>
              <Label>Fecha de Baja (Dejar vacío si está activo)</Label>
              <Input type="date" value={form.fecha_baja} onChange={(e) => setForm({ ...form, fecha_baja: e.target.value })} />
            </div>
            <div>
              <Label>Actas Administrativas</Label>
              <Input type="number" value={form.actas_administrativas} onChange={(e) => setForm({ ...form, actas_administrativas: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Uniformes Asignados</Label>
              <Textarea placeholder="Ej: 2 camisas talla M, 1 pantalón talla 32, botas #27" value={form.uniformes} onChange={(e) => setForm({ ...form, uniformes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre_completo || !form.sede_id}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar empleado?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}