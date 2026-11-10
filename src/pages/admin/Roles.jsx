import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { ShieldCheck, Plus, Pencil, Trash2, Lock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import RolePermissionEditor from "@/components/admin/RolePermissionEditor";

const roleColors = {
  admin: "bg-emerald-500",
  supervisor: "bg-blue-500",
  user: "bg-slate-500",
  "coordinador administrativo": "bg-indigo-600",
  coordinador: "bg-indigo-600",
  rh: "bg-amber-600",
  finanzas: "bg-teal-600",
  director: "bg-purple-600",
};

const emptyForm = { nombre: "", descripcion: "", permisos: {} };

export default function Roles() {
  const { user } = useAuth();
  const { canView, isAdmin: isSuperAdmin } = usePermissions();
  const isAdmin = isSuperAdmin || canView("roles");
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
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
      setRoles(await sercoApi.entities.Rol.list());
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  async function handleQuickInstallCoordinador() {
    setSaving(true);
    try {
      const coordinadorPreset = {
        nombre: "Coordinador Administrativo",
        descripcion: "Habilidades administrativas: sedes, clientes, usuarios, comunicados y reportes de atención a clientes.",
        permisos: {
          inicio: { view: true },
          overview: { view: true },
          administracion: { view: true },
          sedes: { view: true, create: true, edit: true, delete: false },
          usuarios: { view: true, create: true, edit: true, delete: false },
          comunicados: { view: true, create: true, edit: true, delete: false },
          atencion: { view: true, create: true, edit: true, delete: false },
          servicios: { view: true, create: false, edit: false, delete: false },
          todas_sedes: { view: true },
        },
      };
      await sercoApi.entities.Rol.create(coordinadorPreset);
      toast({
        title: "Rol creado",
        description: "Se configuró el nuevo rol 'Coordinador Administrativo' con éxito.",
      });
      await load();
    } catch (e) {
      toast({ title: "Error al crear rol", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(rol) {
    setEditing(rol);
    setForm({ nombre: rol.nombre || "", descripcion: rol.descripcion || "", permisos: rol.permisos || {} });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await sercoApi.entities.Rol.update(editing.id, {nombre: form.nombre, descripcion: form.descripcion, permisos: form.permisos, });;
        toast({ title: "Rol actualizado" });
      } else {
        await sercoApi.entities.Rol.create({ nombre: form.nombre, descripcion: form.descripcion, permisos: form.permisos });
        toast({ title: "Rol creado" });
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
      await sercoApi.entities.Rol.delete(deleteId);
      toast({ title: "Rol eliminado" });
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
          <h2 className="text-2xl font-heading font-bold">Roles</h2>
          <p className="text-sm text-muted-foreground mt-1">Roles y permisos del sistema</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!roles.some((r) => (r.nombre || "").toLowerCase().includes("coordinador")) && (
            <Button
              variant="outline"
              onClick={handleQuickInstallCoordinador}
              disabled={saving}
              className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 text-xs h-9"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Crear Coordinador Administrativo
            </Button>
          )}
          <Button onClick={openCreate} className="text-xs h-9">
            <Plus className="w-4 h-4 mr-1" /> Nuevo Rol
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Cargando...</p>
        ) : roles.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-8">No hay roles registrados.</p>
        ) : (
          roles.map((rol) => (
            <Card key={rol.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${roleColors[rol.nombre] || "bg-slate-500"} flex items-center justify-center`}>
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <Badge variant="secondary" className="capitalize">{rol.nombre}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(rol)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(rol.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{rol.descripcion || "Sin descripción."}</p>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    {rol.permisos
                      ? `${Object.values(rol.permisos).filter((m) => Object.values(m || {}).some(Boolean)).length} módulo(s) con permisos`
                      : "Sin permisos configurados"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Rol" : "Nuevo Rol"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modifica la descripción del rol" : "Crea un nuevo rol en el sistema"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto max-h-[calc(90vh-180px)] pr-2">
            <div>
              <Label>Nombre del Rol *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Permisos por módulo</Label>
              <RolePermissionEditor
                permissions={form.permisos}
                onChange={(permisos) => setForm({ ...form, permisos })}
                onApplyPreset={(preset) =>
                  setForm((f) => ({
                    ...f,
                    nombre: f.nombre || preset.name,
                    descripcion: f.descripcion || preset.description,
                  }))
                }
              />
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
        title="¿Eliminar rol?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}