import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { Plus, Pencil, Trash2, Search, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

const emptyForm = { nombre: "", direccion: "", telefono: "" };

export default function Sedes() {
  const { user } = useAuth();
  const { canView } = usePermissions();
  const isAdmin = canView("administracion");
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    load();
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    try {
      setItems(await sercoApi.entities.Sede.list());
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter((item) =>
    (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.direccion || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      direccion: item.direccion || "",
      telefono: item.telefono || "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await sercoApi.entities.Sede.update(editing.id, form);
        toast({ title: "Sede actualizada" });
      } else {
        await sercoApi.entities.Sede.create(form);
        toast({ title: "Sede creada" });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await sercoApi.entities.Sede.delete(deleteId);
      toast({ title: "Sede eliminada" });
      setDeleteId(null);
      await load();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg">Acceso restringido</h3>
          <p className="text-muted-foreground text-sm mt-1">No tienes permiso para ver esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Sedes</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} sede(s)</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full sm:w-64" />
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay sedes registradas.</TableCell></TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{item.direccion || "—"}</TableCell>
                  <TableCell>{item.telefono || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Sede" : "Nueva Sede"}</DialogTitle>
            <DialogDescription>Completa los datos de la sede</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar sede?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}