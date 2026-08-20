import React, { useEffect, useMemo, useState } from "react";
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
  const { sedeFilter, defaultSedeId, userSedeIds } = useSedeScope();
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
  const [solicitudForm, setSolicitudForm] = useState({ inventario_item_id: "", item_nombre: "", cantidad: "1", comentarios: "", sede_id: "", color: "", talla: "",costo: "" });
  const [solicitudError, setSolicitudError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
  setLoading(true);

  try {
    const [data, vars, s, sols] = await Promise.all([
      sercoApi.entities.InventarioItem.filter(sedeFilter, "-created_date"),
      sercoApi.entities.InventarioVariante.list("-created_date"),
      sercoApi.entities.Sede.list(),
      sercoApi.entities.SolicitudInventario.list("-created_at").catch(() => []),
    ]);

    setItems(data);
    setVariantes(vars);
    setSedes(s);
    setSolicitudes(sols);
    console.log("SOLICITUDES RECIBIDAS:", sols);
  } finally {
    setLoading(false);
  }
}
  const openSolicitar = () => {
    setSolicitudError("");
    setSolicitudForm({
      inventario_item_id: "",
      item_nombre: "",
      cantidad: "1",
      comentarios: "",
      sede_id: defaultSedeId || (sedes[0]?.id || ""),
      color: "",
      talla: "",
      costo:""
    });
    setSolicitarModalOpen(true);
  };

  const handleSaveSolicitud = async () => {
    if (!solicitudForm.item_nombre && !solicitudForm.inventario_item_id) return;
    const selectedItem = items.find(i => i.id === solicitudForm.inventario_item_id);
    const isUniforme = selectedItem?.categoria === "Uniforme";
    const selectedVariant = variantes.find(v =>
      v.inventario_item_id === solicitudForm.inventario_item_id &&
      v.color === solicitudForm.color &&
      v.talla === solicitudForm.talla
    );

    if (isUniforme && (!selectedVariant || Number(selectedVariant.cantidad) <= 0)) {
      setSolicitudError("Selecciona un color y una talla disponibles.");
      return;
    }

    if (isUniforme && Number(solicitudForm.cantidad || 0) > Number(selectedVariant.cantidad)) {
      setSolicitudError(`Solo hay ${selectedVariant.cantidad} unidad(es) disponibles para esta combinación.`);
      return;
    }

    setSaving(true);
    setSolicitudError("");
    try {
      let finalItemNombre = selectedItem?.nombre || solicitudForm.item_nombre;
      if (isUniforme) {
        finalItemNombre = `${finalItemNombre} - ${solicitudForm.color} - Talla ${solicitudForm.talla}`;
      }

      await sercoApi.entities.SolicitudInventario.create({
        inventario_item_id: solicitudForm.inventario_item_id || null,
        item_nombre: finalItemNombre,
        cantidad: Number(solicitudForm.cantidad || 1),
        costo: solicitudForm.costo === "" ? null : Number(solicitudForm.costo),
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
      setSolicitudError(e.message || "No se pudo enviar la solicitud.");
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

  const getDisplayCantidad = (item) => {
    if (item.categoria === "Uniforme") {
      const itemVars = variantes.filter((v) => v.inventario_item_id === item.id);
      if (itemVars.length > 0) {
        return itemVars.reduce((sum, v) => sum + (Number(v.cantidad) || 0), 0);
      }
    }
    return item.cantidad ?? 0;
  };

  function openCreate() {
    setEditing(null);
    const defaultCategoria = activeCategoryTab === "Solicitudes" ? "Uniforme" : activeCategoryTab;
    setForm({ ...emptyForm, sede_id: defaultSedeId, categoria: defaultCategoria });
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
    const isUniforme = form.categoria === "Uniforme";
    const totalVariantQty = isUniforme && formVariantes.length > 0
      ? formVariantes.reduce((sum, v) => sum + (v.cantidad === "" ? 0 : Number(v.cantidad)), 0)
      : null;

    const payload = {
      ...form,
      cantidad: totalVariantQty !== null ? totalVariantQty : (form.cantidad === "" ? 0 : Number(form.cantidad)),
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

  const formColores = useMemo(
    () => [...new Set(formVariantes.map((v) => v.color.trim()).filter(Boolean))],
    [formVariantes]
  );
  const formTallas = useMemo(
    () => [...new Set(formVariantes.map((v) => v.talla.trim()).filter(Boolean))],
    [formVariantes]
  );

  function agregarColor() {
    setFormVariantes([...formVariantes, { color: "", talla: "", cantidad: "" }]);
  }

  function agregarTalla() {
    setFormVariantes([...formVariantes, { color: "", talla: "", cantidad: "" }]);
  }

  function actualizarCelda(color, talla, cantidad) {
    const index = formVariantes.findIndex((v) => v.color === color && v.talla === talla);
    if (index === -1) {
      setFormVariantes([...formVariantes, { color, talla, cantidad }]);
      return;
    }
    actualizarVariante(index, "cantidad", cantidad);
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

  const canViewSolicitudes = ["finanzas", "ceo", "director", "admin", "administrador", "super administrador", "supervisor"].includes(user?.role?.toLowerCase());

const filteredSolicitudes = solicitudes.filter(sol => {
  if (userSedeIds?.length > 0 && sol.sede_id && !userSedeIds.includes(sol.sede_id)) {
    return false;
  }

  if (search) {
    const q = search.toLowerCase();
    return (
      (sol.item_nombre || "").toLowerCase().includes(q) ||
      (sol.solicitante_nombre || "").toLowerCase().includes(q)
    );
  }

  return true;
});
  
  console.log("INVENTARIO SOLICITUDES FILTERING:", {
    raw_sols: solicitudes,
    filtered_sols: filteredSolicitudes,
    defaultSedeId,
    userSedeIds
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
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 3 : 2} className="text-center text-muted-foreground py-8">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : tabFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 3 : 2} className="text-center text-muted-foreground py-8">
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
                        <TableCell className="text-right">{getDisplayCantidad(item)}</TableCell>
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
                    <TableHead className="text-right">Costo</TableHead>
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
                        <TableCell className="text-right">
                          {sol.costo != null
                            ? `$${Number(sol.costo).toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}`
                            : "—"}
                        </TableCell>
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
            {form.categoria !== "Uniforme" && (
              <div>
                <Label>Cantidad</Label>
                <Input type="number" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            {form.categoria === "Uniforme" && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <Label>Variantes por color y talla</Label>
      <Button type="button" variant="outline" size="sm" onClick={agregarVariante}>
        <Plus className="w-4 h-4 mr-1" />
        Agregar combinación
      </Button>
    </div>

    <div className="space-y-2">
      {formVariantes.map((v, index) => (
        <div key={v.id || index} className="grid grid-cols-[1fr_1fr_100px_auto] gap-2">
          <Input
            placeholder="Color"
            value={v.color}
            onChange={(e) => actualizarVariante(index, "color", e.target.value)}
          />

          <Input
            placeholder="Talla"
            value={v.talla}
            onChange={(e) => actualizarVariante(index, "talla", e.target.value)}
          />

          <Input
            type="number"
            min="0"
            placeholder="Cantidad"
            value={v.cantidad}
            onChange={(e) => actualizarVariante(index, "cantidad", e.target.value)}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => eliminarVariante(index)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
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

  setSolicitudForm(prev => ({
    ...prev,
    inventario_item_id: v === "none" ? "" : v,
    item_nombre: matched ? matched.nombre : "",
    color: "",
    talla: "",
    cantidad: "1"
  }));
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
            {solicitudForm.inventario_item_id &&
  solicitudForm.inventario_item_id !== "none" &&
  items.find(i => i.id === solicitudForm.inventario_item_id)?.categoria === "Uniforme" && (() => {
    const variantesUniforme = variantes.filter(
      v => v.inventario_item_id === solicitudForm.inventario_item_id
    );

    const colores = [...new Set(
      variantesUniforme
        .map(v => v.color)
        .filter(Boolean)
    )];

    const tallas = [...new Set(
      variantesUniforme
        .map(v => v.talla)
        .filter(Boolean)
    )];

    const getVariante = (color, talla) =>
      variantesUniforme.find(
        v =>
          v.color === color &&
          v.talla === talla
      );

    return (
      <div className="space-y-5 rounded-lg border bg-muted/20 p-4">

        {/* COLOR */}
        <div>
          <Label className="mb-2 block">Color</Label>

          <div className="flex flex-wrap gap-2">
            {colores.map(color => {
              const seleccionado = solicitudForm.color === color;

              return (
                <Button
                  key={color}
                  type="button"
                  variant={seleccionado ? "default" : "outline"}
                  className="min-w-[90px]"
                  onClick={() =>
                    setSolicitudForm(prev => ({
                      ...prev,
                      color,
                      talla: ""
                    }))
                  }
                >
                  {color}
                </Button>
              );
            })}
          </div>
        </div>

        {/* TALLA */}
        {solicitudForm.color && (
          <div>
            <Label className="mb-2 block">Talla</Label>

            <div className="flex flex-wrap gap-2">
              {tallas.map(talla => {
                const variante = getVariante(
                  solicitudForm.color,
                  talla
                );

                const disponible =
                  variante &&
                  Number(variante.cantidad) > 0;

                const seleccionado =
                  solicitudForm.talla === talla;

                return (
                  <button
                    key={talla}
                    type="button"
                    disabled={!disponible}
                    onClick={() =>
                      setSolicitudForm(prev => ({
                        ...prev,
                        talla
                      }))
                    }
                    className={`
                      relative min-w-[52px] rounded-md border px-4 py-2 text-sm font-medium
                      transition
                      ${seleccionado
                        ? "border-primary bg-primary text-primary-foreground"
                        : disponible
                          ? "bg-background hover:bg-muted"
                          : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
                      }
                    `}
                  >
                    {talla}

                    {!disponible && (
                      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[1px] w-[calc(100%-8px)] -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] bg-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* STOCK */}
            {solicitudForm.talla && (() => {
              const variante = getVariante(
                solicitudForm.color,
                solicitudForm.talla
              );

              if (!variante) return null;

              return (
                <p className="mt-2 text-sm text-muted-foreground">
                  {Number(variante.cantidad) > 0
                    ? `${variante.cantidad} disponible(s)`
                    : "No disponible"}
                </p>
              );
            })()}
          </div>
        )}
      </div>
    );
  })()}
                        <div>
              <Label>Costo</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={solicitudForm.costo}
                onChange={(e) =>
                  setSolicitudForm({
                    ...solicitudForm,
                    costo: e.target.value
                  })
                }
                placeholder="Ej. 450.00"
              />
            </div>
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