import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search, ClipboardList, Check, X } from "lucide-react";
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
import { useAuth } from "@/lib/AuthContext";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const emptyForm = { nombre: "", categoria: "", cantidad: "", descripcion: "", ubicacion: "", sede_id: "" };

export default function Inventario() {
  const { user } = useAuth();
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView, can } = usePermissions();
  const [items, setItems] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formVariantes, setFormVariantes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState("Uniforme");

  // Requests (Solicitudes) States
  const [solicitudes, setSolicitudes] = useState([]);
  const [solicitarModalOpen, setSolicitarModalOpen] = useState(false);
  const [solicitudForm, setSolicitudForm] = useState({ inventario_item_id: "", item_nombre: "", cantidad: "1", comentarios: "", sede_id: "" });

  useEffect(() => { load(); }, []);

  async function load() {
  setLoading(true);

  try {
    const [data, vars, s, sols] = await Promise.all([
      sercoApi.entities.InventarioItem.filter(sedeFilter, "-created_date"),
      sercoApi.entities.InventarioVariante.list("-created_date"),
      sercoApi.entities.Sede.list(),
      sercoApi.entities.SolicitudInventario.list("-created_date").catch(() => []),
    ]);

    setItems(data);
    setVariantes(vars);
    setSedes(s);
    setSolicitudes(sols);
  } finally {
    setLoading(false);
  }
}
  const openSolicitar = () => {
    setSolicitudForm({
      inventario_item_id: "",
      item_nombre: "",
      cantidad: "1",
      comentarios: "",
      sede_id: defaultSedeId || (sedes[0]?.id || "")
    });
    setSolicitarModalOpen(true);
  };

  const handleSaveSolicitud = async () => {
    if (!solicitudForm.item_nombre && !solicitudForm.inventario_item_id) return;
    setSaving(true);
    try {
      let finalItemNombre = solicitudForm.item_nombre;
      if (solicitudForm.inventario_item_id) {
        const matchedItem = items.find(i => i.id === solicitudForm.inventario_item_id);
        if (matchedItem) finalItemNombre = matchedItem.nombre;
      }

      await sercoApi.entities.SolicitudInventario.create({
        inventario_item_id: solicitudForm.inventario_item_id || null,
        item_nombre: finalItemNombre,
        cantidad: Number(solicitudForm.cantidad || 1),
        comentarios: solicitudForm.comentarios,
        sede_id: solicitudForm.sede_id || defaultSedeId,
        solicitante_nombre: user?.full_name || user?.email || "Usuario",
        solicitante_id: user?.id || null,
        estado: "pendiente"
      });
      setSolicitarModalOpen(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSolicitudEstado = async (id, nuevoEstado) => {
    try {
      await sercoApi.entities.SolicitudInventario.update(id, { estado: nuevoEstado });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const filtered = items.filter((item) =>
    (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.categoria || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.ubicacion || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sede_id: defaultSedeId });
    setFormVariantes([]);
    setModalOpen(true);
  }

  function openEdit(item) {
  setEditing(item);
  setForm({ ...emptyForm, ...item, cantidad: item.cantidad ?? "" });

  const itemVariantes = variantes
    .filter((v) => v.inventario_item_id === item.id)
    .map((v) => ({
      id: v.id,
      color: v.color || "",
      talla: v.talla || "",
      cantidad: v.cantidad ?? "",
    }));

  setFormVariantes(itemVariantes);
  setModalOpen(true);
}

function agregarVariante() {
  setFormVariantes([
    ...formVariantes,
    {
      color: "",
      talla: "",
      cantidad: "",
    },
  ]);
}

function actualizarVariante(index, campo, valor) {
  const nuevasVariantes = [...formVariantes];
  nuevasVariantes[index] = {
    ...nuevasVariantes[index],
    [campo]: valor,
  };
  setFormVariantes(nuevasVariantes);
}

function eliminarVariante(index) {
  setFormVariantes(
    formVariantes.filter((_, i) => i !== index)
  );
}

  async function handleSave() {
  setSaving(true);

  try {
    const payload = {
      ...form,
      cantidad: form.cantidad === "" ? 0 : Number(form.cantidad),
    };

    let itemGuardado;

    if (editing) {
      itemGuardado = await sercoApi.entities.InventarioItem.update(
        editing.id,
        payload
      );

      // Eliminar variantes que tenía anteriormente
      await Promise.all(
        variantes
          .filter((v) => v.inventario_item_id === editing.id)
          .map((v) =>
            sercoApi.entities.InventarioVariante.delete(v.id)
          )
      );
    } else {
      itemGuardado = await sercoApi.entities.InventarioItem.create(payload);
    }

    // Guardar las variantes del artículo
    if (form.categoria === "Uniforme" && formVariantes.length > 0) {
      const variantesValidas = formVariantes.filter(
        (v) => v.color || v.talla || v.cantidad !== ""
      );

      await Promise.all(
        variantesValidas.map((v) =>
          sercoApi.entities.InventarioVariante.create({
            inventario_item_id: itemGuardado.id,
            color: v.color || null,
            talla: v.talla || null,
            cantidad:
              v.cantidad === "" ? 0 : Number(v.cantidad),
          })
        )
      );
    }

    setModalOpen(false);
    setFormVariantes([]);
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

  const tabFiltered = filtered.filter((item) => {
    const cat = (item.categoria || "").toLowerCase();
    if (activeCategoryTab === "Uniforme") {
      return cat.includes("uniforme");
    }
    if (activeCategoryTab === "Papelería") {
      return cat.includes("papeler");
    }
    // "Material extra" tab catches anything else (safety fallback)
    return !cat.includes("uniforme") && !cat.includes("papeler");
  });

  const canViewSolicitudes = ["finanzas", "ceo", "director", "admin"].includes(user?.role?.toLowerCase());

  const filteredSolicitudes = solicitudes.filter(sol => {
    if (defaultSedeId && sol.sede_id !== defaultSedeId) return false;
    if (search) {
      const q = search.toLowerCase();
      return (sol.item_nombre || "").toLowerCase().includes(q) || (sol.solicitante_nombre || "").toLowerCase().includes(q);
    }
    return true;
  });

  if (!canView("inventario")) return <AccessRestricted />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Inventario</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCategoryTab === "Solicitudes" && canViewSolicitudes ? `${filteredSolicitudes.length} solicitud(es)` : `${tabFiltered.length} artículo(s) en esta categoría`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openSolicitar}>
            <ClipboardList className="w-4 h-4 mr-1" /> Solicitar
          </Button>
          {can("inventario", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeCategoryTab} onValueChange={(v) => {
        if (v === "Solicitudes" && !canViewSolicitudes) return;
        setActiveCategoryTab(v);
      }} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-3">
          <TabsList className={`grid w-full ${canViewSolicitudes ? "sm:w-[600px] grid-cols-4" : "sm:w-[450px] grid-cols-3"}`}>
            <TabsTrigger value="Uniforme">Uniformes</TabsTrigger>
            <TabsTrigger value="Papelería">Papelería</TabsTrigger>
            <TabsTrigger value="Material extra">Material Extra</TabsTrigger>
            {canViewSolicitudes && (
              <TabsTrigger value="Solicitudes" className="relative flex items-center justify-center gap-1">
                <ClipboardList className="w-4 h-4" />
                <span>Solicitudes</span>
                {solicitudes.filter(s => s.estado === 'pendiente').length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute right-1 top-1" />
                )}
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Categories Tab Content */}
        {["Uniforme", "Papelería", "Material extra"].map((tabVal) => (
          <TabsContent key={tabVal} value={tabVal} className="mt-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    {!defaultSedeId && <TableHead>Sede</TableHead>}
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 5 : 4} className="text-center text-muted-foreground py-8">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : tabFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 5 : 4} className="text-center text-muted-foreground py-8">
                        No hay artículos en esta categoría
                      </TableCell>
                    </TableRow>
                  ) : (
                    tabFiltered.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => can("inventario", "edit") && openEdit(item)}
                      >
                        <TableCell className="font-medium">{item.nombre}</TableCell>
                        {!defaultSedeId && (
                          <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                        )}
                        <TableCell>{item.categoria || "—"}</TableCell>
                        <TableCell className="text-right">{item.cantidad ?? "—"}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{item.descripcion || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}

        {/* Requests (Solicitudes) Tab Content */}
        {canViewSolicitudes && (
          <TabsContent value="Solicitudes" className="mt-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículo / Pedido</TableHead>
                    {!defaultSedeId && <TableHead>Sede</TableHead>}
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Solicitado por</TableHead>
                    <TableHead>Comentarios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">
                        Cargando solicitudes...
                      </TableCell>
                    </TableRow>
                  ) : filteredSolicitudes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">
                        No hay solicitudes registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSolicitudes.map((sol) => (
                      <TableRow key={sol.id}>
                        <TableCell className="font-medium">{sol.item_nombre}</TableCell>
                        {!defaultSedeId && <TableCell>{sedeNombre(sol.sede_id)}</TableCell>}
                        <TableCell className="text-right font-semibold">{sol.cantidad}</TableCell>
                        <TableCell>{sol.solicitante_nombre}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={sol.comentarios}>
                          {sol.comentarios || "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            sol.estado === "aprobado" ? "bg-emerald-100 text-emerald-700" :
                            sol.estado === "rechazado" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700 animate-pulse"
                          }`}>
                            {sol.estado === "aprobado" ? "Aprobada" : sol.estado === "rechazado" ? "Rechazada" : "Pendiente"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {sol.estado === "pendiente" && (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 border-emerald-300 hover:bg-emerald-50 text-emerald-600"
                                onClick={() => handleUpdateSolicitudEstado(sol.id, "aprobado")}
                                title="Aprobar Pedido"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 border-rose-300 hover:bg-rose-50 text-rose-600"
                                onClick={() => handleUpdateSolicitudEstado(sol.id, "rechazado")}
                                title="Rechazar Pedido"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog: Create/Edit Inventory Item */}
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
              {!defaultSedeId && (
                <SedeSelector
                  value={form.sede_id}
                  onChange={(v) => setForm({ ...form, sede_id: v })}
                  sedes={sedes}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Uniforme">Uniforme</SelectItem>
                    <SelectItem value="Papelería">Papelería</SelectItem>
                    <SelectItem value="Material extra">Material extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            {form.categoria === "Uniforme" && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label>Variantes</Label>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={agregarVariante}
      >
        <Plus className="w-4 h-4 mr-1" />
        Agregar variante
      </Button>
    </div>

    {formVariantes.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No hay variantes agregadas.
      </p>
    ) : (
      <div className="space-y-2">
        {formVariantes.map((variante, index) => (
          <div
            key={variante.id || index}
            className="grid grid-cols-[1fr_1fr_100px_auto] gap-2 items-end"
          >
            <div>
              <Label className="text-xs">Color</Label>
              <Input
                value={variante.color}
                onChange={(e) =>
                  actualizarVariante(index, "color", e.target.value)
                }
                placeholder="Ej. Azul"
              />
            </div>

            <div>
              <Label className="text-xs">Talla</Label>
              <Input
                value={variante.talla}
                onChange={(e) =>
                  actualizarVariante(index, "talla", e.target.value)
                }
                placeholder="Ej. M"
              />
            </div>

            <div>
              <Label className="text-xs">Cantidad</Label>
              <Input
                type="number"
                min="0"
                value={variante.cantidad}
                onChange={(e) =>
                  actualizarVariante(index, "cantidad", e.target.value)
                }
                placeholder="0"
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => eliminarVariante(index)}
              title="Eliminar variante"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
          </div>
          <DialogFooter className="flex justify-between items-center w-full gap-2">
            {editing && can("inventario", "delete") && (
              <Button variant="destructive" onClick={() => { setModalOpen(false); setDeleteId(editing.id); }} className="mr-auto">
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 justify-end ml-auto">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.nombre || !form.sede_id}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Solicitar / Request Stock */}
      <Dialog open={solicitarModalOpen} onOpenChange={setSolicitarModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hacer Pedido de Inventario</DialogTitle>
            <DialogDescription>
              Solicita artículos existentes o describe un material nuevo. Le llegará al equipo de Finanzas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Seleccionar Artículo Existente (Opcional)</Label>
              <Select
                value={solicitudForm.inventario_item_id}
                onValueChange={(v) => {
                  const matched = items.find(i => i.id === v);
                  setSolicitudForm({
                    ...solicitudForm,
                    inventario_item_id: v,
                    item_nombre: matched ? matched.nombre : solicitudForm.item_nombre
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Seleccionar del Inventario --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Escribir artículo personalizado --</SelectItem>
                  {items.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.nombre} ({i.categoria})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(!solicitudForm.inventario_item_id || solicitudForm.inventario_item_id === "none") && (
              <div>
                <Label>Nombre del Artículo / Material *</Label>
                <Input
                  value={solicitudForm.item_nombre}
                  onChange={(e) => setSolicitudForm({ ...solicitudForm, item_nombre: e.target.value, inventario_item_id: "" })}
                  placeholder="Ej. Uniforme Talla M, Plumas, Carpetas..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cantidad *</Label>
                <Input
                  type="number"
                  min="1"
                  value={solicitudForm.cantidad}
                  onChange={(e) => setSolicitudForm({ ...solicitudForm, cantidad: e.target.value })}
                />
              </div>
              {!defaultSedeId && (
                <div>
                  <Label>Sede</Label>
                  <Select
                    value={solicitudForm.sede_id}
                    onValueChange={(v) => setSolicitudForm({ ...solicitudForm, sede_id: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sedes.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label>Comentarios / Requisitos</Label>
              <Input
                value={solicitudForm.comentarios}
                onChange={(e) => setSolicitudForm({ ...solicitudForm, comentarios: e.target.value })}
                placeholder="Indica el motivo del pedido, urgencia, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolicitarModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSolicitud} disabled={saving || (!solicitudForm.item_nombre && !solicitudForm.inventario_item_id)}>
              {saving ? "Enviando..." : "Enviar Solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ConfirmDialog: Delete Item */}
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