import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { Plus, Pencil, Trash2, Search, Megaphone, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

const emptyForm = {
  titulo: "",
  contenido: "",
  fecha: "",
  activo: true,
};

export default function Comunicados() {
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
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    load();
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    try {
      const data = await sercoApi.entities.Comunicado.list();
      // Sort by fecha descending
      const sorted = (data || []).sort((a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha));
      setItems(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter((item) =>
    (item.titulo || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.contenido || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, fecha: today });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      titulo: item.titulo || "",
      contenido: item.contenido || "",
      fecha: item.fecha || "",
      activo: item.activo !== false,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.titulo || !form.contenido || !form.fecha) {
      toast({ title: "Campos incompletos", description: "Por favor llena los campos requeridos", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        autor_nombre: user?.full_name || "Administrador",
      };

      if (editing) {
        await sercoApi.entities.Comunicado.update(editing.id, payload);
        toast({ title: "Comunicado actualizado con éxito" });
      } else {
        await sercoApi.entities.Comunicado.create(payload);
        toast({ title: "Comunicado creado con éxito" });
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
      await sercoApi.entities.Comunicado.delete(deleteId);
      toast({ title: "Comunicado eliminado" });
      setDeleteId(null);
      await load();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <h2 className="text-xl font-bold text-muted-foreground">Acceso Restringido</h2>
        <p className="text-sm text-muted-foreground mt-2">Solo los administradores pueden gestionar comunicados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Comunicados Oficiales</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los anuncios y notificaciones para toda la organización.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar comunicado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Comunicado
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Contenido</TableHead>
              <TableHead>Publicado por</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay comunicados registrados
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{item.fecha || "—"}</TableCell>
                  <TableCell className="font-semibold">{item.titulo}</TableCell>
                  <TableCell className="max-w-xs truncate">{item.contenido}</TableCell>
                  <TableCell>{item.autor_nombre || "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.activo !== false
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {item.activo !== false ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
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

      {/* Edit/Create Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Comunicado" : "Nuevo Comunicado"}</DialogTitle>
            <DialogDescription>
              Este anuncio se mostrará de manera destacada en la página de inicio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input
                placeholder="Título del anuncio"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </div>
            <div>
              <Label>Fecha de Publicidad *</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Mensaje / Contenido *</Label>
              <Textarea
                placeholder="Escribe el comunicado aquí..."
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                rows={5}
              />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <Label className="text-sm font-semibold">Comunicado Activo</Label>
                <p className="text-xs text-muted-foreground">Si está inactivo, no se mostrará en el Inicio.</p>
              </div>
              <Switch
                checked={form.activo}
                onCheckedChange={(val) => setForm({ ...form, activo: val })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar comunicado?"
        description="Esta acción no se puede deshacer y retirará el anuncio de la vista de todos los usuarios."
        onConfirm={handleDelete}
      />
    </div>
  );
}
