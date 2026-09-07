import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Search, ChevronLeft, ChevronRight, Smartphone, Car } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import SedeSelector from "@/components/SedeSelector";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import { useToast } from "@/components/ui/use-toast";

const emptyEgresoForm = { concepto: "", descripcion: "", monto: "", fecha: "", sede_id: "" };
const emptySaldoForm = {
  numero_telefono: "",
  nombre: "",
  responsable: "",
  servicio: "",
  compania: "Telcel",
  monto: "50",
  fecha: "",
  sede_id: "",
};
const emptyMantenimientoForm = { vehiculo: "", tipo_mantenimiento: "", descripcion: "", monto: "", fecha: "", kilometraje: "", sede_id: "", taller: "" };

function parseSaldoMetadata(saldo) {
  let compania = saldo.compania || "";
  let servicio = saldo.servicio || "";
  let nombre = saldo.nombre || saldo.responsable || "";

  if ((!compania || !servicio) && saldo.notas) {
    try {
      if (saldo.notas.startsWith("{") && saldo.notas.endsWith("}")) {
        const parsed = JSON.parse(saldo.notas);
        if (parsed.compania) compania = parsed.compania;
        if (parsed.servicio) servicio = parsed.servicio;
        if (parsed.nombre && !nombre) nombre = parsed.nombre;
      }
    } catch {
      // ignore
    }
  }

  return {
    ...saldo,
    nombre: nombre || "—",
    responsable: nombre || "—",
    compania: compania || "—",
    servicio: servicio || "—",
  };
}

export default function Egresos() {
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView, can } = usePermissions();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("egresos");

  // Egresos state
  const [items, setItems] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEgresoForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // Saldos state
  const [saldos, setSaldos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [saldoLoading, setSaldoLoading] = useState(true);
  const [saldoSearch, setSaldoSearch] = useState("");
  const [saldoModalOpen, setSaldoModalOpen] = useState(false);
  const [saldoEditing, setSaldoEditing] = useState(null);
  const [saldoForm, setSaldoForm] = useState(emptySaldoForm);
  const [saldoSaving, setSaldoSaving] = useState(false);
  const [saldoDeleteId, setSaldoDeleteId] = useState(null);

  // Mantenimiento state
  const [mantenimientos, setMantenimientos] = useState([]);
  const [mantenimientoLoading, setMantenimientoLoading] = useState(true);
  const [mantenimientoSearch, setMantenimientoSearch] = useState("");
  const [mantenimientoModalOpen, setMantenimientoModalOpen] = useState(false);
  const [mantenimientoEditing, setMantenimientoEditing] = useState(null);
  const [mantenimientoForm, setMantenimientoForm] = useState(emptyMantenimientoForm);
  const [mantenimientoSaving, setMantenimientoSaving] = useState(false);
  const [mantenimientoDeleteId, setMantenimientoDeleteId] = useState(null);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  useEffect(() => {
    loadEgresos();
    loadSaldos();
    loadMantenimientos();
  }, [currentMonth]);

  // ── Egresos ──
  async function loadEgresos() {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        sercoApi.entities.Egreso.filter({ ...sedeFilter, mes: currentMonth }, "-fecha"),
        sercoApi.entities.Sede.list(),
      ]);
      setItems(data);
      setSedes(s);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // ── Saldos ──
  async function loadSaldos() {
    setSaldoLoading(true);
    try {
      const [data, sv] = await Promise.all([
        sercoApi.entities.Saldo.filter({ ...sedeFilter, mes: currentMonth }, "-fecha").catch(() => []),
        sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
      ]);
      setSaldos(data || []);
      if (sv) setServicios(sv);
    } catch {
      setSaldos([]);
    } finally {
      setSaldoLoading(false);
    }
  }

  // ── Mantenimientos ──
  async function loadMantenimientos() {
    setMantenimientoLoading(true);
    try {
      const data = await sercoApi.entities.Mantenimiento.filter({ ...sedeFilter, mes: currentMonth }, "-fecha").catch(() => []);
      setMantenimientos(data);
    } catch {
      setMantenimientos([]);
    } finally {
      setMantenimientoLoading(false);
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

  const formatMes = (mes) => {
    if (!mes) return "—";
    try {
      return new Date(mes + "-01T00:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    } catch {
      return mes;
    }
  };

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  // ── Egresos Filtered ──
  const filtered = items.filter((item) =>
    (item.concepto || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.descripcion || "").toLowerCase().includes(search.toLowerCase())
  );
  const totalGastos = filtered.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);

  // ── Saldos Filtered ──
  const filteredSaldos = saldos.map(parseSaldoMetadata).filter((s) =>
    (s.numero_telefono || "").toLowerCase().includes(saldoSearch.toLowerCase()) ||
    (s.nombre || "").toLowerCase().includes(saldoSearch.toLowerCase()) ||
    (s.responsable || "").toLowerCase().includes(saldoSearch.toLowerCase()) ||
    (s.servicio || "").toLowerCase().includes(saldoSearch.toLowerCase()) ||
    (s.compania || "").toLowerCase().includes(saldoSearch.toLowerCase())
  );
  const totalSaldos = filteredSaldos.reduce((sum, s) => sum + (Number(s.monto) || 0), 0);

  // ── Mantenimientos Filtered ──
  const filteredMantenimientos = mantenimientos.filter((m) =>
    (m.vehiculo || "").toLowerCase().includes(mantenimientoSearch.toLowerCase()) ||
    (m.tipo_mantenimiento || "").toLowerCase().includes(mantenimientoSearch.toLowerCase()) ||
    (m.taller || "").toLowerCase().includes(mantenimientoSearch.toLowerCase())
  );
  const totalMantenimientos = filteredMantenimientos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  // ── Egresos CRUD ──
  function openCreate() {
    setEditing(null);
    const today = new Date().toISOString().split("T")[0];
    setForm({ ...emptyEgresoForm, fecha: today, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ ...emptyEgresoForm, ...item, monto: item.monto ?? "" });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const mes = form.fecha ? form.fecha.slice(0, 7) : currentMonth;
      const payload = { 
        ...form, 
        monto: form.monto === "" ? 0 : Number(form.monto),
        mes: mes
      };
      if (editing) {
        await sercoApi.entities.Egreso.update(editing.id, payload);
      } else {
        await sercoApi.entities.Egreso.create(payload);
      }
      setModalOpen(false);
      await loadEgresos();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await sercoApi.entities.Egreso.delete(deleteId);
    setDeleteId(null);
    await loadEgresos();
  }

  // ── Saldos CRUD ──
  function openSaldoCreate() {
    setSaldoEditing(null);
    const today = new Date().toISOString().split("T")[0];
    setSaldoForm({
      ...emptySaldoForm,
      fecha: today,
      monto: "50",
      compania: "Telcel",
      sede_id: defaultSedeId,
    });
    setSaldoModalOpen(true);
  }

  function openSaldoEdit(item) {
    setSaldoEditing(item);
    const parsed = parseSaldoMetadata(item);
    setSaldoForm({
      ...emptySaldoForm,
      ...item,
      nombre: parsed.nombre !== "—" ? parsed.nombre : "",
      responsable: parsed.responsable !== "—" ? parsed.responsable : "",
      servicio: parsed.servicio !== "—" ? parsed.servicio : "",
      compania: parsed.compania !== "—" ? parsed.compania : "Telcel",
      monto: String(item.monto ?? "50"),
    });
    setSaldoModalOpen(true);
  }

  async function handleSaldoSave() {
    setSaldoSaving(true);
    try {
      const mes = saldoForm.fecha ? saldoForm.fecha.slice(0, 7) : currentMonth;
      const metadataNotas = JSON.stringify({
        compania: saldoForm.compania || "Telcel",
        servicio: saldoForm.servicio || "",
        nombre: saldoForm.nombre || saldoForm.responsable || "",
      });

      const fullPayload = {
        ...saldoForm,
        responsable: saldoForm.nombre || saldoForm.responsable || "",
        monto: saldoForm.monto === "" ? 50 : Number(saldoForm.monto),
        mes,
        notas: metadataNotas,
      };

      try {
        if (saldoEditing) {
          await sercoApi.entities.Saldo.update(saldoEditing.id, fullPayload);
        } else {
          await sercoApi.entities.Saldo.create(fullPayload);
        }
      } catch (err) {
        const msg = err?.message || String(err);
        if (msg.includes("Could not find the") && msg.includes("column of 'saldos'")) {
          const safePayload = {
            numero_telefono: saldoForm.numero_telefono,
            responsable: saldoForm.nombre || saldoForm.responsable || "",
            monto: Number(saldoForm.monto) || 50,
            fecha: saldoForm.fecha,
            sede_id: saldoForm.sede_id || null,
            mes,
            notas: metadataNotas,
          };
          if (saldoEditing) {
            await sercoApi.entities.Saldo.update(saldoEditing.id, safePayload);
          } else {
            await sercoApi.entities.Saldo.create(safePayload);
          }
        } else {
          throw err;
        }
      }

      setSaldoModalOpen(false);
      await loadSaldos();
      toast({ title: "Saldo guardado con éxito" });
    } catch (e) {
      toast({
        title: "Error al guardar saldo",
        description: e?.message || "Ocurrió un error al guardar",
        variant: "destructive",
      });
    } finally {
      setSaldoSaving(false);
    }
  }

  async function handleSaldoDelete() {
    try {
      await sercoApi.entities.Saldo.delete(saldoDeleteId);
      setSaldoDeleteId(null);
      await loadSaldos();
      toast({ title: "Saldo eliminado" });
    } catch (e) {
      toast({
        title: "Error al eliminar",
        description: e?.message || "No se pudo eliminar el registro",
        variant: "destructive",
      });
    }
  }

  // ── Mantenimiento CRUD ──
  function openMantenimientoCreate() {
    setMantenimientoEditing(null);
    const today = new Date().toISOString().split("T")[0];
    setMantenimientoForm({ ...emptyMantenimientoForm, fecha: today, sede_id: defaultSedeId });
    setMantenimientoModalOpen(true);
  }

  function openMantenimientoEdit(item) {
    setMantenimientoEditing(item);
    setMantenimientoForm({ ...emptyMantenimientoForm, ...item, monto: item.monto ?? "", kilometraje: item.kilometraje ?? "" });
    setMantenimientoModalOpen(true);
  }

  async function handleMantenimientoSave() {
    setMantenimientoSaving(true);
    try {
      const mes = mantenimientoForm.fecha ? mantenimientoForm.fecha.slice(0, 7) : currentMonth;
      const payload = {
        ...mantenimientoForm,
        monto: mantenimientoForm.monto === "" ? 0 : Number(mantenimientoForm.monto),
        kilometraje: mantenimientoForm.kilometraje === "" ? null : Number(mantenimientoForm.kilometraje),
        mes
      };
      if (mantenimientoEditing) {
        await sercoApi.entities.Mantenimiento.update(mantenimientoEditing.id, payload);
      } else {
        await sercoApi.entities.Mantenimiento.create(payload);
      }
      setMantenimientoModalOpen(false);
      await loadMantenimientos();
      toast({ title: "Mantenimiento guardado con éxito" });
    } catch (e) {
      toast({
        title: "Error al guardar mantenimiento",
        description: e?.message || "Ocurrió un error al guardar",
        variant: "destructive",
      });
    } finally {
      setMantenimientoSaving(false);
    }
  }

  async function handleMantenimientoDelete() {
    try {
      await sercoApi.entities.Mantenimiento.delete(mantenimientoDeleteId);
      setMantenimientoDeleteId(null);
      await loadMantenimientos();
      toast({ title: "Mantenimiento eliminado" });
    } catch (e) {
      toast({
        title: "Error al eliminar",
        description: e?.message || "No se pudo eliminar el registro",
        variant: "destructive",
      });
    }
  }

  if (!canView("egresos")) return <AccessRestricted />;

  const colCount = !defaultSedeId ? 5 : 4;

  return (
    <div className="space-y-4">
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-heading font-bold">Egresos</h2>
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full sm:w-[450px] grid-cols-3">
          <TabsTrigger value="egresos">Egresos</TabsTrigger>
          <TabsTrigger value="saldos" className="flex items-center gap-1">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Saldos</span>
          </TabsTrigger>
          <TabsTrigger value="mantenimiento" className="flex items-center gap-1">
            <Car className="h-3.5 w-3.5" />
            <span>Mantenimiento</span>
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════ EGRESOS TAB ════════════════════════════ */}
        <TabsContent value="egresos" className="mt-4">
          {/* Total Card */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total de Gastos ({formatMes(currentMonth)})</h3>
                <div className="text-2xl font-bold mt-1">${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Monto total de egresos en este mes</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>
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
              {can("egresos", "create") && (
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
                  <TableHead>Concepto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  {!defaultSedeId && <TableHead>Sede</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">No hay egresos registrados</TableCell></TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => can("egresos", "edit") && openEdit(item)}
                    >
                      <TableCell className="font-medium">{item.concepto}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{item.descripcion || "—"}</TableCell>
                      <TableCell className="text-right font-medium">${(Number(item.monto) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{item.fecha || "—"}</TableCell>
                      {!defaultSedeId && (
                        <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════════════════════════ SALDOS TAB ════════════════════════════ */}
        <TabsContent value="saldos" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total en Saldos ({formatMes(currentMonth)})</h3>
                <div className="text-2xl font-bold mt-1">${totalSaldos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Recargas de saldo en celulares</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">{filteredSaldos.length} registro(s)</p>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar teléfono, nombre o servicio..."
                  value={saldoSearch}
                  onChange={(e) => setSaldoSearch(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              {can("egresos", "create") && (
                <Button onClick={openSaldoCreate}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar Saldo
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Compañía</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  {!defaultSedeId && <TableHead>Sede</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {saldoLoading ? (
                  <TableRow><TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : filteredSaldos.length === 0 ? (
                  <TableRow><TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">No hay saldos registrados</TableCell></TableRow>
                ) : (
                  filteredSaldos.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => can("egresos", "edit") && openSaldoEdit(s)}
                    >
                      <TableCell className="font-medium">{s.numero_telefono || "—"}</TableCell>
                      <TableCell className="font-medium">{s.nombre || s.responsable || "—"}</TableCell>
                      <TableCell>{s.servicio || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            s.compania === "Telcel"
                              ? "border-blue-300 text-blue-700 bg-blue-50/50 dark:bg-blue-950/40 dark:text-blue-300 font-normal"
                              : s.compania === "AT&T"
                              ? "border-cyan-300 text-cyan-700 bg-cyan-50/50 dark:bg-cyan-950/40 dark:text-cyan-300 font-normal"
                              : "border-slate-300 text-slate-700 dark:text-slate-300 font-normal"
                          }
                        >
                          {s.compania || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        ${(Number(s.monto) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{s.fecha || "—"}</TableCell>
                      {!defaultSedeId && <TableCell>{sedeNombre(s.sede_id)}</TableCell>}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════════════════════════ MANTENIMIENTO TAB ════════════════════════════ */}
        <TabsContent value="mantenimiento" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Mantenimiento ({formatMes(currentMonth)})</h3>
                <div className="text-2xl font-bold mt-1">${totalMantenimientos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Gastos en mantenimiento vehicular</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">{filteredMantenimientos.length} registro(s)</p>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar vehículo, tipo o taller..."
                  value={mantenimientoSearch}
                  onChange={(e) => setMantenimientoSearch(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              {can("egresos", "create") && (
                <Button onClick={openMantenimientoCreate}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar Mantenimiento
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Km</TableHead>
                  <TableHead>Taller</TableHead>
                  {!defaultSedeId && <TableHead>Sede</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mantenimientoLoading ? (
                  <TableRow><TableCell colSpan={!defaultSedeId ? 8 : 7} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : filteredMantenimientos.length === 0 ? (
                  <TableRow><TableCell colSpan={!defaultSedeId ? 8 : 7} className="text-center text-muted-foreground py-8">No hay registros de mantenimiento</TableCell></TableRow>
                ) : (
                  filteredMantenimientos.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => can("egresos", "edit") && openMantenimientoEdit(m)}
                    >
                      <TableCell className="font-medium">{m.vehiculo || "—"}</TableCell>
                      <TableCell>{m.tipo_mantenimiento || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{m.descripcion || "—"}</TableCell>
                      <TableCell className="text-right font-medium">${(Number(m.monto) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{m.fecha || "—"}</TableCell>
                      <TableCell>{m.kilometraje ? `${Number(m.kilometraje).toLocaleString()} km` : "—"}</TableCell>
                      <TableCell>{m.taller || "—"}</TableCell>
                      {!defaultSedeId && <TableCell>{sedeNombre(m.sede_id)}</TableCell>}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════ EGRESO MODAL ════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Egreso" : "Nuevo Egreso"}</DialogTitle>
            <DialogDescription>Completa los datos del egreso</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div>
              <Label>Concepto *</Label>
              <Input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monto *</Label>
                <Input type="number" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
            </div>
            {!defaultSedeId && (
              <div>
                <SedeSelector
                  value={form.sede_id}
                  onChange={(v) => setForm({ ...form, sede_id: v })}
                  sedes={sedes}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center w-full gap-2">
            {editing && can("egresos", "delete") && (
              <Button variant="destructive" onClick={() => { setModalOpen(false); setDeleteId(editing.id); }} className="mr-auto">
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 justify-end ml-auto">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.concepto || !form.monto || !form.fecha || (!defaultSedeId && !form.sede_id)}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════ SALDO MODAL ════════════════════════════ */}
      <Dialog open={saldoModalOpen} onOpenChange={setSaldoModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{saldoEditing ? "Editar Saldo" : "Nuevo Saldo"}</DialogTitle>
            <DialogDescription>Registra la recarga de saldo al celular</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Número de Teléfono *</Label>
                <Input
                  value={saldoForm.numero_telefono}
                  onChange={(e) => setSaldoForm({ ...saldoForm, numero_telefono: e.target.value })}
                  placeholder="Ej: 228 123 4567"
                />
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={saldoForm.nombre || saldoForm.responsable || ""}
                  onChange={(e) => setSaldoForm({ ...saldoForm, nombre: e.target.value, responsable: e.target.value })}
                  placeholder="Nombre de la persona"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Servicio</Label>
                <Select
                  value={saldoForm.servicio || "none"}
                  onValueChange={(val) => setSaldoForm({ ...saldoForm, servicio: val === "none" ? "" : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar / General</SelectItem>
                    <SelectItem value="Cubredescansos">Cubredescansos</SelectItem>
                    <SelectItem value="Oficina">Oficina</SelectItem>
                    {servicios.map((s) => (
                      <SelectItem key={s.id} value={s.nombre}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Compañía Telefónica *</Label>
                <Select
                  value={saldoForm.compania || "Telcel"}
                  onValueChange={(val) => setSaldoForm({ ...saldoForm, compania: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona compañía" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Telcel">Telcel</SelectItem>
                    <SelectItem value="AT&T">AT&T</SelectItem>
                    <SelectItem value="Movistar">Movistar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Monto *</Label>
                <Select
                  value={String(saldoForm.monto || "50")}
                  onValueChange={(val) => setSaldoForm({ ...saldoForm, monto: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el monto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">$50.00 MXN</SelectItem>
                    <SelectItem value="100">$100.00 MXN</SelectItem>
                    <SelectItem value="150">$150.00 MXN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={saldoForm.fecha}
                  onChange={(e) => setSaldoForm({ ...saldoForm, fecha: e.target.value })}
                />
              </div>
            </div>

            {!defaultSedeId && (
              <div>
                <SedeSelector
                  value={saldoForm.sede_id}
                  onChange={(v) => setSaldoForm({ ...saldoForm, sede_id: v })}
                  sedes={sedes}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center w-full gap-2">
            {saldoEditing && can("egresos", "delete") && (
              <Button variant="destructive" onClick={() => { setSaldoModalOpen(false); setSaldoDeleteId(saldoEditing.id); }} className="mr-auto">
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 justify-end ml-auto">
              <Button variant="outline" onClick={() => setSaldoModalOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSaldoSave}
                disabled={
                  saldoSaving ||
                  !saldoForm.numero_telefono ||
                  !(saldoForm.nombre || saldoForm.responsable) ||
                  !saldoForm.monto ||
                  !saldoForm.fecha ||
                  (!defaultSedeId && !saldoForm.sede_id)
                }
              >
                {saldoSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════ MANTENIMIENTO MODAL ════════════════════════════ */}
      <Dialog open={mantenimientoModalOpen} onOpenChange={setMantenimientoModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mantenimientoEditing ? "Editar Mantenimiento" : "Nuevo Mantenimiento"}</DialogTitle>
            <DialogDescription>Registra el mantenimiento del vehículo</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vehículo *</Label>
                <Input value={mantenimientoForm.vehiculo} onChange={(e) => setMantenimientoForm({ ...mantenimientoForm, vehiculo: e.target.value })} placeholder="Ej: Nissan Versa 2020" />
              </div>
              <div>
                <Label>Tipo de Mantenimiento *</Label>
                <Input value={mantenimientoForm.tipo_mantenimiento} onChange={(e) => setMantenimientoForm({ ...mantenimientoForm, tipo_mantenimiento: e.target.value })} placeholder="Ej: Cambio de aceite" />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={mantenimientoForm.descripcion} onChange={(e) => setMantenimientoForm({ ...mantenimientoForm, descripcion: e.target.value })} placeholder="Detalles del servicio" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Monto *</Label>
                <Input type="number" step="0.01" value={mantenimientoForm.monto} onChange={(e) => setMantenimientoForm({ ...mantenimientoForm, monto: e.target.value })} />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={mantenimientoForm.fecha} onChange={(e) => setMantenimientoForm({ ...mantenimientoForm, fecha: e.target.value })} />
              </div>
              <div>
                <Label>Kilometraje</Label>
                <Input type="number" value={mantenimientoForm.kilometraje} onChange={(e) => setMantenimientoForm({ ...mantenimientoForm, kilometraje: e.target.value })} placeholder="Km" />
              </div>
            </div>
            <div>
              <Label>Taller</Label>
              <Input value={mantenimientoForm.taller} onChange={(e) => setMantenimientoForm({ ...mantenimientoForm, taller: e.target.value })} placeholder="Nombre del taller" />
            </div>
            {!defaultSedeId && (
              <div>
                <SedeSelector
                  value={mantenimientoForm.sede_id}
                  onChange={(v) => setMantenimientoForm({ ...mantenimientoForm, sede_id: v })}
                  sedes={sedes}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center w-full gap-2">
            {mantenimientoEditing && can("egresos", "delete") && (
              <Button variant="destructive" onClick={() => { setMantenimientoModalOpen(false); setMantenimientoDeleteId(mantenimientoEditing.id); }} className="mr-auto">
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 justify-end ml-auto">
              <Button variant="outline" onClick={() => setMantenimientoModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleMantenimientoSave} disabled={mantenimientoSaving || !mantenimientoForm.vehiculo || !mantenimientoForm.tipo_mantenimiento || !mantenimientoForm.monto || !mantenimientoForm.fecha || (!defaultSedeId && !mantenimientoForm.sede_id)}>
                {mantenimientoSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════ DELETE DIALOGS ════════════════════════════ */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar egreso?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!saldoDeleteId}
        onOpenChange={(v) => !v && setSaldoDeleteId(null)}
        title="¿Eliminar registro de saldo?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleSaldoDelete}
      />
      <ConfirmDialog
        open={!!mantenimientoDeleteId}
        onOpenChange={(v) => !v && setMantenimientoDeleteId(null)}
        title="¿Eliminar registro de mantenimiento?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleMantenimientoDelete}
      />
    </div>
  );
}
