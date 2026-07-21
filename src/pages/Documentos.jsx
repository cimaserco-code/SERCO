import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardHeader, CardTitle, CardContent,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";

const emptyForm = { titulo: "", tipo: "otro", contenido: "" };

const tipoLabels = {
  contrato: "Contrato",
  renuncia: "Renuncia",
  otro: "Otro",
};

const tipoColors = {
  contrato: "bg-blue-100 text-blue-700",
  renuncia: "bg-red-100 text-red-700",
  otro: "bg-gray-100 text-gray-700",
};

export default function Documentos() {
  const { canView, can } = usePermissions();
  const [items, setItems] = useState([]);
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
      const data = await base44.entities.Documento.list("-created_date");
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter((item) =>
    (item.titulo || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.tipo || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ ...emptyForm, ...item });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Documento.update(editing.id, form);
      } else {
        await base44.entities.Documento.create(form);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await base44.entities.Documento.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  if (!canView("documentos")) return <AccessRestricted />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Documentos</h2>
          <p className="text-sm text-muted-foreground mt-1">Plantillas de contratos, renuncias y más</p>
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
          {can("documentos", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No hay documentos registrados</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewItem(item)}>
              <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base leading-tight">{item.titulo}</CardTitle>
                          <Badge variant="secondary" className={`mt-1 ${tipoColors[item.tipo] || tipoColors.otro}`}>
                            {tipoLabels[item.tipo] || "Otro"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {item.contenido || "Sin contenido"}
                </p>
                <div className="flex gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                  {can("documentos", "edit") && (
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  )}
                  {can("documentos", "delete") && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Documento" : "Nuevo Documento"}</DialogTitle>
            <DialogDescription>Crea una plantilla de documento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="renuncia">Renuncia</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contenido</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[300px] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Escribe el contenido del documento aquí..."
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Puedes usar [NOMBRE], [FECHA], etc. como variables de plantilla.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.titulo}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={!!viewItem} onOpenChange={(v) => !v && setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>{viewItem?.titulo}</DialogTitle>
                <DialogDescription>
                  <Badge variant="secondary" className={`mt-1 ${tipoColors[viewItem?.tipo] || tipoColors.otro}`}>
                    {tipoLabels[viewItem?.tipo] || "Otro"}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-2 p-4 bg-muted/50 rounded-lg border whitespace-pre-wrap text-sm font-mono">
            {viewItem?.contenido || "Sin contenido"}
          </div>
          <DialogFooter>
            {can("documentos", "edit") && (
            <Button variant="outline" onClick={() => { setViewItem(null); if (viewItem) openEdit(viewItem); }}>
              <Pencil className="w-4 h-4 mr-1" /> Editar
            </Button>
            )}
            <Button onClick={() => setViewItem(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar documento?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}