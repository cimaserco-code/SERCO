import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search, } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import SedeSelector from "@/components/SedeSelector";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const emptyForm = {
  nombre: "", direccion: "", admin_nombre: "", telefono: "",correo:"",fecha_inicio: "", estado: "activo", sede_id: "",
};

export default function Servicios() {
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView, can } = usePermissions();
  const [items, setItems] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewItem, setViewItem] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
    console.log("sedeFilter completo:", JSON.stringify(sedeFilter));

    const [data, s] = await Promise.all([
      sercoApi.entities.Servicio.filter(sedeFilter),
      sercoApi.entities.Sede.list(),
    ]);

    console.log("servicios encontrados:", data);

      console.log("DATOS SERVICIOS:", data);
      setItems(data);
      setSedes(s);
    } finally {
      setLoading(false);
    }
  }

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const filtered = items.filter((item) =>
    (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.admin_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.direccion || "").toLowerCase().includes(search.toLowerCase())
  );

  
  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ ...emptyForm, ...item, estado: item.estado || "activo" });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        await sercoApi.entities.Servicio.update(editing.id, payload);
      } else {
        await sercoApi.entities.Servicio.create(payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await sercoApi.entities.Servicio.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  if (!canView("servicios")) return <AccessRestricted />;

  const estadoBadge = (estado) => {
    switch (estado) {
      case "suspendido":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Suspendido</Badge>;
      case "inactivo":
        return <Badge variant="secondary" className="bg-red-100 text-red-700">Inactivo</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>;
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Servicios</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} servicio(s)</p>
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
          {can("servicios", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Administrador</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay servicios registrados</TableCell></TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setViewItem(item)}
                >
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{item.direccion || "—"}</TableCell>
                  <TableCell>{item.admin_nombre || "—"}</TableCell>
                  <TableCell>{estadoBadge(item.estado)}</TableCell>
                  <TableCell className="text-right">
                    <div
                     className="flex justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {can("servicios", "edit") && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {can("servicios", "delete") && (
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
            <DialogDescription>Completa los datos operativos del servicio</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div>
              <Label>Nombre del Servicio *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <SedeSelector value={form.sede_id} onChange={(v) => setForm({ ...form, sede_id: v })} sedes={sedes} />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <Label>Administrador</Label>
              <Input value={form.admin_nombre} onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Correo</Label>
              <Input
                type="email"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
              />
            </div>
            <div>
              <div>
                <Label>Fecha de inicio</Label>
                <Input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                />
              </div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="suspendido">Suspendido</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre || !form.sede_id}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            <Dialog open={!!viewItem} onOpenChange={(v) => !v && setViewItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{viewItem?.nombre}</DialogTitle>
            <DialogDescription>
              Información del servicio
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">

            <div>
              <Label>Dirección</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.direccion || "—"}
              </p>
            </div>

            <div>
              <Label>Administrador</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.admin_nombre || "—"}
              </p>
            </div>

            <div>
              <Label>Teléfono</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.telefono || "—"}
              </p>
            </div>

            <div>
              <Label>Correo</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.correo || "—"}
              </p>
            </div>

            <div>
              <Label>Fecha de inicio</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.fecha_inicio || "—"}
              </p>
            </div>

            <div>
              <Label>Estado</Label>
              <div className="mt-1">
                {estadoBadge(viewItem?.estado)}
              </div>
            </div>

          </div>

          <DialogFooter>
            {can("servicios", "edit") && (
              <Button
                variant="outline"
                onClick={() => {
                  setViewItem(null);
                  openEdit(viewItem);
                }}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}

            <Button onClick={() => setViewItem(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar servicio?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}