import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search, DollarSign, CheckCircle, Clock4, FileText, ChevronLeft, ChevronRight } from "lucide-react";
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
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

function getMonthsBetween(start, end) {
  const result = [];
  let [startY, startM] = start.split("-").map(Number);
  const [endY, endM] = end.split("-").map(Number);
  
  while (startY < endY || (startY === endY && startM <= endM)) {
    const mm = String(startM).padStart(2, '0');
    result.push(`${startY}-${mm}`);
    startM++;
    if (startM > 12) {
      startM = 1;
      startY++;
    }
  }
  return result;
}

const emptyForm = {
  servicio_id: "", servicio_nombre: "", mes: "", fecha_factura: "",
  monto: "", estado: "pendiente", fecha_limite_pago: "", fecha_pago: "", sede_id: "",
};

export default function Cobros() {
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView, can } = usePermissions();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  useEffect(() => { load(); }, [currentMonth, sedeFilter]);

  async function load() {
    setLoading(true);
    try {
      const [allCobros, allServicios, allSedes] = await Promise.all([
        sercoApi.entities.Cobro.filter(sedeFilter, "-created_date"),
        sercoApi.entities.Servicio.filter(sedeFilter, "-created_date"),
        sercoApi.entities.Sede.list(),
      ]);

      const activeServicios = allServicios.filter(s => {
        if ((s.estado || 'activo') !== 'activo') return false;
        if (!s.fecha_inicio) return true;
        const [curYear, curMonth] = currentMonth.split("-").map(Number);
        const [startYear, startMonth] = s.fecha_inicio.split("-").map(Number);
        if (startYear < curYear) return true;
        if (startYear === curYear && startMonth <= curMonth) return true;
        return false;
      });

      const allPendingCreates = [];
      
      activeServicios.forEach(s => {
        const startMonth = s.fecha_inicio ? s.fecha_inicio.substring(0, 7) : currentMonth;
        if (startMonth <= currentMonth) {
          const targetMonths = getMonthsBetween(startMonth, currentMonth);
          targetMonths.forEach(m => {
            const exists = allCobros.some(c => c.servicio_id === s.id && c.mes === m);
            if (!exists) {
              allPendingCreates.push({
                servicio_id: s.id,
                servicio_nombre: s.nombre,
                mes: m,
                fecha_factura: null,
                monto: 0,
                estado: "pendiente",
                fecha_limite_pago: null,
                fecha_pago: null,
                sede_id: s.sede_id,
              });
            }
          });
        }
      });

      if (allPendingCreates.length > 0) {
        await Promise.all(
          allPendingCreates.map(payload => sercoApi.entities.Cobro.create(payload))
        );
        const updatedCobros = await sercoApi.entities.Cobro.filter(sedeFilter, "-created_date");
        setItems(updatedCobros);
      } else {
        setItems(allCobros);
      }

      setServicios(allServicios);
      setSedes(allSedes);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al cargar cobros",
        description: e.message || "Ocurrió un error inesperado al procesar cobros automáticos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleMonthChange = (direction) => {
    const [yearStr, monthStr] = currentMonth.split("-");
    let year = parseInt(yearStr);
    let month = parseInt(monthStr) - 1;
    month += direction;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    const mm = String(month + 1).padStart(2, '0');
    setCurrentMonth(`${year}-${mm}`);
  };

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const monthlyItems = items.filter((item) => item.mes === currentMonth);

  const filtered = monthlyItems.filter((item) =>
    (item.servicio_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.fecha_factura || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalFacturado = monthlyItems.reduce((sum, i) => sum + (i.monto || 0), 0);
  const totalCobrado = monthlyItems.filter((i) => i.estado === "pagado").reduce((sum, i) => sum + (i.monto || 0), 0);
  const totalPendiente = monthlyItems.filter((i) => i.estado !== "pagado").reduce((sum, i) => sum + (i.monto || 0), 0);
  const facturasPendientes = monthlyItems.filter((i) => i.estado !== "pagado").length;

  const kpiCards = [
    { label: "Total Facturado", value: `$${totalFacturado.toLocaleString("es-MX")}`, icon: DollarSign, color: "bg-blue-500" },
    { label: "Total Cobrado", value: `$${totalCobrado.toLocaleString("es-MX")}`, icon: CheckCircle, color: "bg-emerald-500" },
    { label: "Total Pendiente", value: `$${totalPendiente.toLocaleString("es-MX")}`, icon: Clock4, color: "bg-amber-500" },
    { label: "Facturas Pendientes", value: facturasPendientes, icon: FileText, color: "bg-red-500" },
  ];

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, mes: currentMonth, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ ...emptyForm, ...item, monto: item.monto ?? "" });
    setModalOpen(true);
  }

  function handleServicioChange(servicioId) {
    const servicio = servicios.find((s) => s.id === servicioId);
    setForm({
      ...form,
      servicio_id: servicioId,
      servicio_nombre: servicio?.nombre || "",
      sede_id: servicio?.sede_id || form.sede_id,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        monto: form.monto === "" ? null : Number(form.monto),
        fecha_pago: form.estado === "pagado" ? form.fecha_pago : null,
      };
      if (editing) {
        await sercoApi.entities.Cobro.update(editing.id, payload);
      } else {
        await sercoApi.entities.Cobro.create(payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await sercoApi.entities.Cobro.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  if (!canView("cobros")) return <AccessRestricted />;

  const formatMes = (mes) => {
    if (!mes) return "—";
    try {
      return new Date(mes + "-01T00:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    } catch {
      return mes;
    }
  };

  const estadoBadge = (estado) => {
    switch (estado) {
      case "pagado":
        return <Badge className="bg-emerald-100 text-emerald-700">Pagado</Badge>;
      case "vencido":
        return <Badge variant="secondary" className="bg-red-100 text-red-700">Vencido</Badge>;
      default:
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold truncate">{card.value}</div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-heading font-bold">Cobros</h2>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} cobro(s)</p>
          </div>
          <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg border">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[120px] text-center">
              {formatMes(currentMonth)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
          {can("cobros", "create") && (
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
              <TableHead>Servicio</TableHead>
              <TableHead>Mes</TableHead>
              <TableHead>Fecha Factura</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha Límite</TableHead>
              <TableHead>Fecha Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay cobros registrados</TableCell></TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow 
                  key={item.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => can("cobros", "edit") && openEdit(item)}
                >
                  <TableCell className="font-medium">{item.servicio_nombre || "—"}</TableCell>
                  <TableCell className="capitalize">{formatMes(item.mes)}</TableCell>
                  <TableCell>{item.fecha_factura || "—"}</TableCell>
                  <TableCell className="text-right">
                    {item.monto != null ? `$${Number(item.monto).toLocaleString("es-MX")}` : "—"}
                  </TableCell>
                  <TableCell>{estadoBadge(item.estado)}</TableCell>
                  <TableCell>{item.fecha_limite_pago || "—"}</TableCell>
                  <TableCell>{item.fecha_pago || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cobro" : "Nuevo Cobro"}</DialogTitle>
            <DialogDescription>Registra un cobro asociado a un servicio</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div>
              <Label>Servicio *</Label>
              <Select value={form.servicio_id} onValueChange={handleServicioChange}>
                <SelectTrigger><SelectValue placeholder="Selecciona un servicio" /></SelectTrigger>
                <SelectContent>
                  {servicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mes *</Label>
              <Input type="month" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} />
            </div>
            <div>
              <Label>Fecha de Factura</Label>
              <Input type="date" value={form.fecha_factura} onChange={(e) => setForm({ ...form, fecha_factura: e.target.value })} />
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha Límite de Pago</Label>
              <Input type="date" value={form.fecha_limite_pago} onChange={(e) => setForm({ ...form, fecha_limite_pago: e.target.value })} />
            </div>
            {form.estado === "pagado" && (
              <div>
                <Label>Fecha de Pago</Label>
                <Input type="date" value={form.fecha_pago} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.servicio_id || !form.mes}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar cobro?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}