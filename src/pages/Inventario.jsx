import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const emptyForm = { nombre: "", categoria: "", cantidad: "", descripcion: "", ubicacion: "", sede_id: "" };

export default function Inventario() {
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

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        sercoApi.entities.InventarioItem.filter(sedeFilter, "-created_date"),
        sercoApi.entities.Sede.list(),
      ]);
      setItems(data);
      setSedes(s);
    } finally {
      setLoading(false);
    }
  }

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const filtered = items.filter((item) =>
    (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.categoria || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.ubicacion || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ ...emptyForm, ...item, cantidad: item.cantidad ?? "" });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form, cantidad: form.cantidad === "" ? null : Number(form.cantidad) };
      if (editing) {
        await sercoApi.entities.InventarioItem.update(editing.id, payload);
      } else {
        await sercoApi.entities.InventarioItem.create(payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await sercoApi.entities.InventarioItem.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  if (!canView("inventario")) return <AccessRestricted />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Inventario</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} artículo(s)</p>
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
          {can("inventario", "create") && (
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
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay artículos en inventario</TableCell></TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                  <TableCell>{item.categoria || "—"}</TableCell>
                  <TableCell className="text-right">{item.cantidad ?? "—"}</TableCell>
                  <TableCell>{item.ubicacion || "—"}</TableCell>
                  <TableCell className="max-w-[250px] truncate">{item.descripcion || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {can("inventario", "edit") && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {can("inventario", "delete") && (
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
            <DialogTitle>{editing ? "Editar Artículo" : "Nuevo Artículo"}</DialogTitle>
            <DialogDescription>Completa los datos del artículo de inventario</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <SedeSelector value={form.sede_id} onChange={(v) => setForm({ ...form, sede_id: v })} sedes={sedes} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría</Label>
                <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar artículo?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}