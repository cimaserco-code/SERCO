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

function adjustDateToMonth(prevDate, targetMonth) {
  if (!prevDate) return null;
  const day = parseInt(prevDate.substring(8, 10));
  const [targetY, targetM] = targetMonth.split("-").map(Number);
  const lastDay = new Date(targetY, targetM, 0).getDate();
  const finalDay = Math.min(day, lastDay);
  const dd = String(finalDay).padStart(2, '0');
  return `${targetMonth}-${dd}`;
}

const emptyForm = {
  servicio_id: "", servicio_nombre: "", mes: "", fecha_factura: "",
  monto: "", estado: "pendiente", fecha_limite_pago: "", fecha_pago: "", sede_id: "",
  };

function copiarFecha(fecha,mes){

  if(!fecha) return "";

  const dia=fecha.slice(8);

  return mes+"-"+dia;

  }

function formatMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getDateFromMonthKey(monthKey) {
  if (!monthKey) return new Date();
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1, 1);
}

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
  const [kpiMode, setKpiMode] = useState("total");
  const [deleteId, setDeleteId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
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

      const activeServicios = allServicios.filter((s) => {
        const isCurrentlyActive = (s.estado || "activo") === "activo";

        if (!isCurrentlyActive) {
          // If no deactivation date, exclude it completely
          if (!s.fecha_baja) return false;
          
          // Allow billing generation ONLY for months prior to or equal to the deactivation month
          const [curYear, curMonth] = currentMonth.split("-").map(Number);
          const [bajaYear, bajaMonth] = s.fecha_baja.split("-").map(Number);
          if (curYear < bajaYear) return true;
          if (curYear === bajaYear && curMonth <= bajaMonth) return true;
          return false;
        }

        if (!s.fecha_inicio) return true;
        const [curYear, curMonth] = currentMonth.split("-").map(Number);
        const [startYear, startMonth] = s.fecha_inicio.split("-").map(Number);
        if (startYear < curYear) return true;
        if (startYear === curYear && startMonth <= curMonth) return true;
        return false;
      });

      const allPendingCreates = [];

      activeServicios.forEach((s) => {
        const startMonth = s.fecha_inicio ? s.fecha_inicio.substring(0, 7) : currentMonth;
        if (startMonth <= currentMonth) {
          const targetMonths = getMonthsBetween(startMonth, currentMonth);

          let lastMonto = 0;
          let lastFechaLimite = null;

          targetMonths.forEach((m) => {
            const existing = allCobros.find((c) => c.servicio_id === s.id && c.mes === m);
            if (existing) {
              lastMonto = existing.monto ?? 0;
              lastFechaLimite = existing.fecha_limite_pago || null;
            } else {
              const adjustedFechaLimite = adjustDateToMonth(lastFechaLimite, m);
              allPendingCreates.push({
                servicio_id: s.id,
                servicio_nombre: s.nombre,
                mes: m,
                fecha_factura: null,
                monto: lastMonto,
                estado: "pendiente",
                fecha_limite_pago: adjustedFechaLimite,
                fecha_pago: null,
                sede_id: s.sede_id,
              });
              lastFechaLimite = adjustedFechaLimite;
            }
          });
        }
      });

      let nextCobros = allCobros;
      if (allPendingCreates.length > 0) {
        await Promise.all(allPendingCreates.map((payload) => sercoApi.entities.Cobro.create(payload)));
        nextCobros = await sercoApi.entities.Cobro.filter(sedeFilter, "-created_date");
      }

      const monthlyItems = nextCobros.filter((c) => c.mes === currentMonth);
      setItems(monthlyItems);
      setServicios(allServicios);
      setSedes(allSedes);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al cargar facturas",
        description: e.message || "Ocurrió un error inesperado al procesar facturas automáticas",
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

  const filtered = monthlyItems.filter((item) => {
    const txt = search.toLowerCase();
    return (
      (item.servicio_nombre || "").toLowerCase().includes(txt) ||
      (item.estado || "").toLowerCase().includes(txt) ||
      (item.fecha_factura || "").toLowerCase().includes(txt)
    );
  });


  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, mes: currentMonth, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item){

    setEditing(item);

    setForm({

    ...emptyForm,

    ...item,

    monto:item.monto??"",

    mes:item.mes

    });

    setModalOpen(true);

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

        try {
          const serviceId = editing.servicio_id;
          const editedMonth = editing.mes;
          const newMonto = payload.monto;
          const newFechaLimite = payload.fecha_limite_pago;

          const allOtherCobros = items.filter((c) => c.servicio_id === serviceId && c.id !== editing.id);
          const subsequentPendingCobros = allOtherCobros.filter((c) => c.mes > editedMonth && c.estado === "pendiente");

          if (subsequentPendingCobros.length > 0) {
            await Promise.all(
              subsequentPendingCobros.map((c) => {
                const adjustedFechaLimite = adjustDateToMonth(newFechaLimite, c.mes);
                return sercoApi.entities.Cobro.update(c.id, {
                  monto: newMonto,
                  fecha_limite_pago: adjustedFechaLimite,
                });
              })
            );
            toast({
              title: "Propagación exitosa",
              description: `Se actualizó el monto de $${newMonto} y fecha en ${subsequentPendingCobros.length} meses posteriores.`,
            });
          } else {
            toast({
              title: "Guardado sin propagación",
              description: "No se encontraron meses futuros pendientes para este servicio en esta sede.",
            });
          }
        } catch (propagateError) {
          console.error("No se pudo propagar el cambio a los meses siguientes:", propagateError);
          toast({
            title: "Advertencia de propagación",
            description: "El cobro se guardó, pero no se pudo propagar a los meses siguientes.",
            variant: "warning",
          });
        }
      } else {
        await sercoApi.entities.Cobro.create(payload);
        toast({ title: "Factura creada con éxito" });
      }

      setEditing(null);
      setForm(emptyForm);
      setModalOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al guardar factura",
        description: e.message || "Ocurrió un error inesperado al procesar",
        variant: "destructive",
      });
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
      return getDateFromMonthKey(mes).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
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

  const totalMontoNormal = filtered.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const totalIva = totalMontoNormal * 0.16;
  const totalConIva = totalMontoNormal * 1.16;

  const pagadoNormal = filtered.filter(c => c.estado === 'pagado').reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const pagadoIva = pagadoNormal * 0.16;
  const pagadoTotal = pagadoNormal * 1.16;

  const pendienteNormal = filtered.filter(c => c.estado !== 'pagado').reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const pendienteIva = pendienteNormal * 0.16;
  const pendienteTotal = pendienteNormal * 1.16;

  return (
    <div className="space-y-4">

      {/* KPI Cards Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`cursor-pointer transition-all ${kpiMode === "normal" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted/30"}`} onClick={() => setKpiMode("normal")}>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Subtotal (Normal)</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">${totalMontoNormal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</h3>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Pagado: ${pagadoNormal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
              <span>Pendiente: ${pendienteNormal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`cursor-pointer transition-all ${kpiMode === "iva" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted/30"}`} onClick={() => setKpiMode("iva")}>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase">IVA (16%)</p>
            <h3 className="text-2xl font-bold mt-1 text-amber-600">${totalIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</h3>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Pagado: ${pagadoIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
              <span>Pendiente: ${pendienteIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`cursor-pointer transition-all ${kpiMode === "total" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted/30"}`} onClick={() => setKpiMode("total")}>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total (Con IVA)</p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-600">${totalConIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</h3>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Pagado: ${pagadoTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
              <span>Pendiente: ${pendienteTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-heading font-bold">Facturas</h2>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} factura(s)</p>
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
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Servicio</TableHead>
              <TableHead>Mes</TableHead>
              <TableHead>Fecha Factura</TableHead>
              <TableHead className="text-right">Total (Con IVA)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha Límite</TableHead>
              <TableHead>Fecha Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay facturas registradas</TableCell></TableRow>
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
                  <TableCell className="text-right font-semibold">
                    {item.monto != null ? `$${Math.round(Number(item.monto) * 1.16).toLocaleString("es-MX")}` : "—"}
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
            <DialogTitle>Editar Factura</DialogTitle>
            <DialogDescription>Actualiza la información financiera del servicio.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div>
                <Label>Servicio</Label>

                <Input
                    value={form.servicio_nombre}
                    disabled
                />
            </div>
            <div>
              <Label>Mes</Label>
              <Input
                  value={formatMes(form.mes)}
                  disabled
              />              
            </div>
            <div>
              <Label>Fecha de Factura</Label>
              <Input type="date" value={form.fecha_factura} onChange={(e) => setForm({ ...form, fecha_factura: e.target.value })} />
            </div>
            <div>
              <Label>Monto Normal (Sin IVA)</Label>
              <Input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>IVA (16%)</Label>
                <Input value={form.monto ? `$${Math.round(Number(form.monto) * 0.16).toLocaleString("es-MX")}` : "$0"} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Total (Monto + IVA)</Label>
                <Input value={form.monto ? `$${Math.round(Number(form.monto) * 1.16).toLocaleString("es-MX")}` : "$0"} disabled className="bg-muted font-bold text-primary" />
              </div>
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar factura?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}