import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Search, ChevronLeft, ChevronRight, Smartphone, Car, Fuel } from "lucide-react";
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

const emptyEgresoForm = { concepto: "", descripcion: "", monto: "", fecha: "", dia_vencimiento: "", mensual: false, estado: "pendiente", sede_id: "" };
const emptySaldoForm = {
  numero_telefono: "",
  nombre: "",
  servicio: "",
  compania: "Telcel",
  saldo_actual: "0",
  sede_id: "",
};
const emptyMantenimientoForm = { automovil_id: "", vehiculo: "", tipo_mantenimiento: "", descripcion: "", monto: "", fecha: "", kilometraje: "", sede_id: "", taller: "" };
const emptyGasolinaForm = { automovil_id: "", vehiculo: "", fecha: "", litros: "", precio_litro: "", monto: "", kilometraje: "", gasolinera: "", sede_id: "" };
const emptyAutomovilForm = { nombre: "", marca: "", modelo: "", anio: "", placas: "", numero_economico: "", sede_id: "" };

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
  const [automovilTab, setAutomovilTab] = useState("vehiculos");

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
  const [recargas, setRecargas] = useState([]);
  const [recargaModalOpen, setRecargaModalOpen] = useState(false);
  const [recargaEditing, setRecargaEditing] = useState(null);
  const [recargaForm, setRecargaForm] = useState({ monto: "50", fecha: "" });
  const [recargaSaving, setRecargaSaving] = useState(false);

  // Mantenimiento state
  const [mantenimientos, setMantenimientos] = useState([]);
  const [mantenimientoLoading, setMantenimientoLoading] = useState(true);
  const [mantenimientoSearch, setMantenimientoSearch] = useState("");
  const [mantenimientoModalOpen, setMantenimientoModalOpen] = useState(false);
  const [mantenimientoEditing, setMantenimientoEditing] = useState(null);
  const [mantenimientoForm, setMantenimientoForm] = useState(emptyMantenimientoForm);
  const [mantenimientoSaving, setMantenimientoSaving] = useState(false);
  const [mantenimientoDeleteId, setMantenimientoDeleteId] = useState(null);

  // Gasolina state
  const [gasolinas, setGasolinas] = useState([]);
  const [gasolinaLoading, setGasolinaLoading] = useState(true);
  const [gasolinaSearch, setGasolinaSearch] = useState("");
  const [gasolinaModalOpen, setGasolinaModalOpen] = useState(false);
  const [gasolinaEditing, setGasolinaEditing] = useState(null);
  const [gasolinaForm, setGasolinaForm] = useState(emptyGasolinaForm);
  const [gasolinaSaving, setGasolinaSaving] = useState(false);
  const [gasolinaDeleteId, setGasolinaDeleteId] = useState(null);

  // Automoviles state
  const [automoviles, setAutomoviles] = useState([]);
  const [automovilLoading, setAutomovilLoading] = useState(true);
  const [automovilSearch, setAutomovilSearch] = useState("");
  const [automovilModalOpen, setAutomovilModalOpen] = useState(false);
  const [automovilEditing, setAutomovilEditing] = useState(null);
  const [automovilForm, setAutomovilForm] = useState(emptyAutomovilForm);
  const [automovilSaving, setAutomovilSaving] = useState(false);
  const [automovilDeleteId, setAutomovilDeleteId] = useState(null);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  useEffect(() => {
    loadEgresos();
    loadSaldos();
    loadMantenimientos();
    loadGasolina();
    loadAutomoviles();
  }, [currentMonth, sedeFilter]);

  // ── Egresos ──
  async function loadEgresos() {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        sercoApi.entities.Egreso.filter(sedeFilter, "-fecha"),
        sercoApi.entities.Sede.list(),
      ]);
      setItems((data || [])
        .filter((item) => item.mensual === true || item.mes === currentMonth)
        .map((item) => ({
          ...item,
          fecha: item.mensual ? `${currentMonth}-${String(item.dia_vencimiento || item.fecha?.slice(8, 10) || 1).padStart(2, "0")}` : item.fecha,
        })));
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
        sercoApi.entities.Saldo.filter(sedeFilter, "-created_date").catch(() => []),
        sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
      ]);
      setSaldos(data || []);
      let rechargeData = null;
      if (sercoApi.entities.RecargaCelular) {
        rechargeData = await sercoApi.entities.RecargaCelular
          .filter({ saldo_id: { $in: (data || []).map((saldo) => saldo.id) } })
          .catch(() => null);
      }
      setRecargas(rechargeData || (data || []).filter((saldo) => saldo.monto && (saldo.fecha || saldo.mes)).map((saldo) => ({
        id: `legacy-${saldo.id}`,
        saldo_id: saldo.id,
        monto: saldo.monto,
        fecha: saldo.fecha,
        mes: saldo.mes || saldo.fecha?.slice(0, 7),
      })));
      if (sv) setServicios(sv);
    } catch {
      setSaldos([]);
    } finally {
      setSaldoLoading(false);
    }
  }

  async function loadGasolina() {
    setGasolinaLoading(true);
    try {
      const data = sercoApi.entities.Gasolina
        ? await sercoApi.entities.Gasolina.filter({ ...sedeFilter, mes: currentMonth }, "-fecha").catch(() => [])
        : [];
      setGasolinas(data || []);
    } finally {
      setGasolinaLoading(false);
    }
  }

  async function loadAutomoviles() {
    setAutomovilLoading(true);
    try {
      const data = sercoApi.entities.Automovil
        ? await sercoApi.entities.Automovil.filter(sedeFilter, "nombre").catch(() => [])
        : [];
      setAutomoviles(data || []);
    } finally {
      setAutomovilLoading(false);
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
  const automovilNombre = (automovilId, legacyName) => automoviles.find((automovil) => automovil.id === automovilId)?.nombre || legacyName || "—";

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
    (s.servicio || "").toLowerCase().includes(saldoSearch.toLowerCase()) ||
    (s.compania || "").toLowerCase().includes(saldoSearch.toLowerCase())
  );
  const filteredRecargas = recargas.filter((r) => r.mes === currentMonth);
  const totalSaldos = filteredRecargas.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
  const ultimaRecarga = (saldoId) => {
    const recharge = recargas
      .filter((recarga) => recarga.saldo_id === saldoId)
      .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))[0];
    return recharge?.fecha || "Sin recargas";
  };

  // ── Mantenimientos Filtered ──
  const filteredMantenimientos = mantenimientos.filter((m) =>
    (m.vehiculo || "").toLowerCase().includes(mantenimientoSearch.toLowerCase()) ||
    (m.tipo_mantenimiento || "").toLowerCase().includes(mantenimientoSearch.toLowerCase()) ||
    (m.taller || "").toLowerCase().includes(mantenimientoSearch.toLowerCase())
  );
  const totalMantenimientos = filteredMantenimientos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  const filteredGasolinas = gasolinas.filter((g) =>
    (g.vehiculo || "").toLowerCase().includes(gasolinaSearch.toLowerCase()) ||
    (g.gasolinera || "").toLowerCase().includes(gasolinaSearch.toLowerCase())
  );
  const totalGasolina = filteredGasolinas.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);
  const filteredAutomoviles = automoviles.filter((automovil) =>
    [automovil.nombre, automovil.marca, automovil.modelo, automovil.placas, automovil.numero_economico]
      .some((value) => (value || "").toLowerCase().includes(automovilSearch.toLowerCase()))
  );

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
        mes,
        mensual: Boolean(form.mensual),
        dia_vencimiento: form.mensual ? Number(form.dia_vencimiento || form.fecha?.slice(8, 10) || 1) : null,
        estado: form.estado || "pendiente",
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
      saldo_actual: "0",
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
      servicio: parsed.servicio !== "—" ? parsed.servicio : "",
      compania: parsed.compania !== "—" ? parsed.compania : "Telcel",
      saldo_actual: String(item.saldo_actual ?? item.monto ?? "0"),
    });
    setSaldoModalOpen(true);
  }

  async function handleSaldoSave() {
    setSaldoSaving(true);
    try {
      const metadataNotas = JSON.stringify({
        compania: saldoForm.compania || "Telcel",
        servicio: saldoForm.servicio || "",
        nombre: saldoForm.nombre || "",
      });

      const fullPayload = {
        ...saldoForm,
        saldo_actual: Number(saldoForm.saldo_actual) || 0,
        monto: Number(saldoForm.saldo_actual) || 0,
        fecha: new Date().toISOString().slice(0, 10),
        mes: currentMonth,
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
            responsable: saldoForm.nombre,
            monto: Number(saldoForm.saldo_actual) || 0,
            fecha: new Date().toISOString().slice(0, 10),
            mes: currentMonth,
            sede_id: saldoForm.sede_id || null,
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

  function openRecarga(item) {
    setRecargaEditing(item);
    setRecargaForm({ monto: "50", fecha: new Date().toISOString().slice(0, 10) });
    setRecargaModalOpen(true);
  }

  async function handleRecargaSave() {
    setRecargaSaving(true);
    try {
      const monto = Number(recargaForm.monto) || 0;
      const mes = recargaForm.fecha.slice(0, 7);
      await sercoApi.entities.RecargaCelular.create({ saldo_id: recargaEditing.id, monto, fecha: recargaForm.fecha, mes });
      setRecargaModalOpen(false);
      await loadSaldos();
      toast({ title: "Recarga registrada" });
    } catch (e) {
      toast({ title: "Error al registrar recarga", description: e?.message || "No se pudo registrar", variant: "destructive" });
    } finally {
      setRecargaSaving(false);
    }
  }

  function openGasolinaCreate() {
    setGasolinaEditing(null);
    setGasolinaForm({ ...emptyGasolinaForm, fecha: new Date().toISOString().slice(0, 10), sede_id: defaultSedeId });
    setGasolinaModalOpen(true);
  }

  function openAutomovilCreate() {
    setAutomovilEditing(null);
    setAutomovilForm({ ...emptyAutomovilForm, sede_id: defaultSedeId });
    setAutomovilModalOpen(true);
  }

  function openAutomovilEdit(item) {
    setAutomovilEditing(item);
    setAutomovilForm({ ...emptyAutomovilForm, ...item, anio: item.anio ?? "" });
    setAutomovilModalOpen(true);
  }

  async function handleAutomovilSave() {
    setAutomovilSaving(true);
    try {
      const payload = { ...automovilForm, anio: automovilForm.anio === "" ? null : Number(automovilForm.anio) };
      if (automovilEditing) await sercoApi.entities.Automovil.update(automovilEditing.id, payload);
      else await sercoApi.entities.Automovil.create(payload);
      setAutomovilModalOpen(false);
      await loadAutomoviles();
      toast({ title: "Automóvil guardado" });
    } catch (e) {
      toast({ title: "Error al guardar automóvil", description: e?.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setAutomovilSaving(false);
    }
  }

  async function handleAutomovilDelete() {
    await sercoApi.entities.Automovil.delete(automovilDeleteId);
    setAutomovilDeleteId(null);
    await loadAutomoviles();
  }

  function openGasolinaEdit(item) {
    setGasolinaEditing(item);
    setGasolinaForm({ ...emptyGasolinaForm, ...item, automovil_id: item.automovil_id || automoviles.find((automovil) => automovil.nombre === item.vehiculo)?.id || "" });
    setGasolinaModalOpen(true);
  }

  async function handleGasolinaSave() {
    setGasolinaSaving(true);
    try {
      const litros = Number(gasolinaForm.litros) || 0;
      const precio = Number(gasolinaForm.precio_litro) || 0;
      const selectedAutomovil = automoviles.find((automovil) => automovil.id === gasolinaForm.automovil_id);
      const payload = { ...gasolinaForm, vehiculo: selectedAutomovil?.nombre || gasolinaForm.vehiculo || null, litros, precio_litro: precio, monto: litros * precio, mes: gasolinaForm.fecha.slice(0, 7), kilometraje: gasolinaForm.kilometraje === "" ? null : Number(gasolinaForm.kilometraje) };
      if (gasolinaEditing) await sercoApi.entities.Gasolina.update(gasolinaEditing.id, payload);
      else await sercoApi.entities.Gasolina.create(payload);
      setGasolinaModalOpen(false);
      await loadGasolina();
      toast({ title: "Carga de gasolina guardada" });
    } catch (e) {
      toast({ title: "Error al guardar gasolina", description: e?.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setGasolinaSaving(false);
    }
  }

  async function handleGasolinaDelete() {
    await sercoApi.entities.Gasolina.delete(gasolinaDeleteId);
    setGasolinaDeleteId(null);
    await loadGasolina();
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
    setMantenimientoForm({ ...emptyMantenimientoForm, ...item, automovil_id: item.automovil_id || automoviles.find((automovil) => automovil.nombre === item.vehiculo)?.id || "", monto: item.monto ?? "", kilometraje: item.kilometraje ?? "" });
    setMantenimientoModalOpen(true);
  }

  async function handleMantenimientoSave() {
    setMantenimientoSaving(true);
    try {
      const mes = mantenimientoForm.fecha ? mantenimientoForm.fecha.slice(0, 7) : currentMonth;
      const selectedAutomovil = automoviles.find((automovil) => automovil.id === mantenimientoForm.automovil_id);
      const payload = {
        ...mantenimientoForm,
        vehiculo: selectedAutomovil?.nombre || mantenimientoForm.vehiculo || null,
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
        <TabsList className="grid w-full sm:w-[520px] grid-cols-3">
          <TabsTrigger value="egresos">Egresos</TabsTrigger>
          <TabsTrigger value="saldos" className="flex items-center gap-1">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Celulares</span>
          </TabsTrigger>
          <TabsTrigger value="mantenimiento" className="flex items-center gap-1">
            <Car className="h-3.5 w-3.5" />
            <span>Automóviles</span>
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
                  <TableHead>Vencimiento</TableHead>
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
                <p className="text-xs text-muted-foreground mt-1">{filteredRecargas.length} recarga(s) en {formatMes(currentMonth)}</p>
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
                  <Plus className="w-4 h-4 mr-1" /> Agregar Celular
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
                  <TableHead>Última Recarga</TableHead>
                  <TableHead>Acción</TableHead>
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
                      <TableCell className="font-medium">{s.nombre || "—"}</TableCell>
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
                      <TableCell>{ultimaRecarga(s.id)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {can("egresos", "edit") && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); openRecarga(s); }}>Recarga</Button>}
                      </TableCell>
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
          <Tabs value={automovilTab} onValueChange={setAutomovilTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="vehiculos" className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> Automóviles</TabsTrigger>
              <TabsTrigger value="gasolina" className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5" /> Gasolina</TabsTrigger>
              <TabsTrigger value="mantenimiento">Mantenimiento</TabsTrigger>
            </TabsList>
            <TabsContent value="vehiculos">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <p className="text-sm text-muted-foreground">{filteredAutomoviles.length} automóvil(es) registrado(s)</p>
                <div className="flex gap-2">
                  <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar automóvil..." value={automovilSearch} onChange={(e) => setAutomovilSearch(e.target.value)} className="pl-9 w-full sm:w-64" /></div>
                  {can("egresos", "create") && <Button onClick={openAutomovilCreate}><Plus className="w-4 h-4 mr-1" /> Agregar Automóvil</Button>}
                </div>
              </div>
              <div className="rounded-lg border bg-card overflow-hidden"><Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Marca</TableHead><TableHead>Modelo</TableHead><TableHead>Año</TableHead><TableHead>Placas</TableHead><TableHead>Número económico</TableHead>{!defaultSedeId && <TableHead>Sede</TableHead>}</TableRow></TableHeader><TableBody>
                {automovilLoading ? <TableRow><TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow> : filteredAutomoviles.length === 0 ? <TableRow><TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">No hay automóviles registrados</TableCell></TableRow> : filteredAutomoviles.map((automovil) => <TableRow key={automovil.id} className="cursor-pointer hover:bg-muted/50" onClick={() => can("egresos", "edit") && openAutomovilEdit(automovil)}><TableCell className="font-medium">{automovil.nombre}</TableCell><TableCell>{automovil.marca || "—"}</TableCell><TableCell>{automovil.modelo || "—"}</TableCell><TableCell>{automovil.anio || "—"}</TableCell><TableCell>{automovil.placas || "—"}</TableCell><TableCell>{automovil.numero_economico || "—"}</TableCell>{!defaultSedeId && <TableCell>{sedeNombre(automovil.sede_id)}</TableCell>}</TableRow>)}
              </TableBody></Table></div>
            </TabsContent>
            <TabsContent value="gasolina">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                <Card><CardContent className="p-4"><h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total gasolina ({formatMes(currentMonth)})</h3><div className="text-2xl font-bold mt-1">${totalGasolina.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div></CardContent></Card>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <p className="text-sm text-muted-foreground">{filteredGasolinas.length} registro(s)</p>
                <div className="flex gap-2">
                  <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar vehículo o gasolinera..." value={gasolinaSearch} onChange={(e) => setGasolinaSearch(e.target.value)} className="pl-9 w-full sm:w-64" /></div>
                  {can("egresos", "create") && <Button onClick={openGasolinaCreate}><Plus className="w-4 h-4 mr-1" /> Agregar</Button>}
                </div>
              </div>
              <div className="rounded-lg border bg-card overflow-hidden"><Table><TableHeader><TableRow><TableHead>Vehículo</TableHead><TableHead>Fecha</TableHead><TableHead>Litros</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Km</TableHead><TableHead>Gasolinera</TableHead>{!defaultSedeId && <TableHead>Sede</TableHead>}</TableRow></TableHeader><TableBody>
                {gasolinaLoading ? <TableRow><TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow> : filteredGasolinas.length === 0 ? <TableRow><TableCell colSpan={!defaultSedeId ? 7 : 6} className="text-center text-muted-foreground py-8">No hay cargas registradas</TableCell></TableRow> : filteredGasolinas.map((g) => <TableRow key={g.id} className="cursor-pointer hover:bg-muted/50" onClick={() => can("egresos", "edit") && openGasolinaEdit(g)}><TableCell className="font-medium">{automovilNombre(g.automovil_id, g.vehiculo)}</TableCell><TableCell>{g.fecha || "—"}</TableCell><TableCell>{g.litros ? `${Number(g.litros).toLocaleString()} L` : "—"}</TableCell><TableCell className="text-right font-medium">${(Number(g.monto) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell><TableCell>{g.kilometraje ? `${Number(g.kilometraje).toLocaleString()} km` : "—"}</TableCell><TableCell>{g.gasolinera || "—"}</TableCell>{!defaultSedeId && <TableCell>{sedeNombre(g.sede_id)}</TableCell>}</TableRow>)}
              </TableBody></Table></div>
            </TabsContent>
            <TabsContent value="mantenimiento">
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
                      <TableCell className="font-medium">{automovilNombre(m.automovil_id, m.vehiculo)}</TableCell>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>¿Es mensual?</Label>
                <Select value={form.mensual ? "si" : "no"} onValueChange={(value) => setForm({ ...form, mensual: value === "si" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="si">Sí</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.mensual ? "Día de vencimiento" : "Estado"}</Label>
                {form.mensual ? (
                  <Input type="number" min="1" max="31" value={form.dia_vencimiento} onChange={(e) => setForm({ ...form, dia_vencimiento: e.target.value })} />
                ) : (
                  <Select value={form.estado || "pendiente"} onValueChange={(value) => setForm({ ...form, estado: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="pagado">Pagado</SelectItem></SelectContent>
                  </Select>
                )}
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

      {/* ════════════════════════════ CELULAR MODAL ════════════════════════════ */}
      <Dialog open={saldoModalOpen} onOpenChange={setSaldoModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{saldoEditing ? "Editar Celular" : "Nuevo Celular"}</DialogTitle>
            <DialogDescription>Administra el catálogo de teléfonos de la empresa</DialogDescription>
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
                  value={saldoForm.nombre || ""}
                  onChange={(e) => setSaldoForm({ ...saldoForm, nombre: e.target.value })}
                  placeholder="Persona, área o ubicación"
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
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
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
                  !saldoForm.nombre ||
                  (!defaultSedeId && !saldoForm.sede_id)
                }
              >
                {saldoSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recargaModalOpen} onOpenChange={setRecargaModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Recargar celular</DialogTitle><DialogDescription>Registra la recarga del celular.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Monto *</Label><Select value={String(recargaForm.monto)} onValueChange={(value) => setRecargaForm({ ...recargaForm, monto: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50">$50.00 MXN</SelectItem><SelectItem value="100">$100.00 MXN</SelectItem><SelectItem value="150">$150.00 MXN</SelectItem></SelectContent></Select></div>
            <div><Label>Fecha *</Label><Input type="date" value={recargaForm.fecha} onChange={(event) => setRecargaForm({ ...recargaForm, fecha: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRecargaModalOpen(false)}>Cancelar</Button><Button onClick={handleRecargaSave} disabled={recargaSaving || !recargaForm.monto || !recargaForm.fecha}>{recargaSaving ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={automovilModalOpen} onOpenChange={setAutomovilModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{automovilEditing ? "Editar Automóvil" : "Nuevo Automóvil"}</DialogTitle><DialogDescription>Registra los datos permanentes del vehículo.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nombre o identificación *</Label><Input value={automovilForm.nombre} onChange={(event) => setAutomovilForm({ ...automovilForm, nombre: event.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4"><div><Label>Marca</Label><Input value={automovilForm.marca} onChange={(event) => setAutomovilForm({ ...automovilForm, marca: event.target.value })} /></div><div><Label>Modelo</Label><Input value={automovilForm.modelo} onChange={(event) => setAutomovilForm({ ...automovilForm, modelo: event.target.value })} /></div></div>
            <div className="grid grid-cols-2 gap-4"><div><Label>Año</Label><Input type="number" value={automovilForm.anio} onChange={(event) => setAutomovilForm({ ...automovilForm, anio: event.target.value })} /></div><div><Label>Placas</Label><Input value={automovilForm.placas} onChange={(event) => setAutomovilForm({ ...automovilForm, placas: event.target.value })} /></div></div>
            <div><Label>Número económico</Label><Input value={automovilForm.numero_economico} onChange={(event) => setAutomovilForm({ ...automovilForm, numero_economico: event.target.value })} /></div>
            {!defaultSedeId && <SedeSelector value={automovilForm.sede_id} onChange={(value) => setAutomovilForm({ ...automovilForm, sede_id: value })} sedes={sedes} />}
          </div>
          <DialogFooter className="flex justify-between"><div>{automovilEditing && can("egresos", "delete") && <Button variant="destructive" onClick={() => { setAutomovilModalOpen(false); setAutomovilDeleteId(automovilEditing.id); }}>Eliminar</Button>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => setAutomovilModalOpen(false)}>Cancelar</Button><Button onClick={handleAutomovilSave} disabled={automovilSaving || !automovilForm.nombre || (!defaultSedeId && !automovilForm.sede_id)}>{automovilSaving ? "Guardando..." : "Guardar"}</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gasolinaModalOpen} onOpenChange={setGasolinaModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{gasolinaEditing ? "Editar gasolina" : "Nueva carga de gasolina"}</DialogTitle><DialogDescription>El monto se calcula con litros por precio.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4"><div><Label>Automóvil *</Label><Select value={gasolinaForm.automovil_id || "none"} onValueChange={(value) => setGasolinaForm({ ...gasolinaForm, automovil_id: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Selecciona automóvil" /></SelectTrigger><SelectContent><SelectItem value="none">Selecciona automóvil</SelectItem>{automoviles.map((automovil) => <SelectItem key={automovil.id} value={automovil.id}>{automovil.nombre}</SelectItem>)}</SelectContent></Select></div><div><Label>Fecha *</Label><Input type="date" value={gasolinaForm.fecha} onChange={(event) => setGasolinaForm({ ...gasolinaForm, fecha: event.target.value })} /></div></div>
            <div className="grid grid-cols-2 gap-4"><div><Label>Litros *</Label><Input type="number" step="0.01" value={gasolinaForm.litros} onChange={(event) => setGasolinaForm({ ...gasolinaForm, litros: event.target.value })} /></div><div><Label>Precio por litro *</Label><Input type="number" step="0.01" value={gasolinaForm.precio_litro} onChange={(event) => setGasolinaForm({ ...gasolinaForm, precio_litro: event.target.value })} /></div></div>
            <div className="grid grid-cols-2 gap-4"><div><Label>Monto total</Label><Input value={(Number(gasolinaForm.litros || 0) * Number(gasolinaForm.precio_litro || 0)).toFixed(2)} readOnly /></div><div><Label>Kilometraje</Label><Input type="number" value={gasolinaForm.kilometraje} onChange={(event) => setGasolinaForm({ ...gasolinaForm, kilometraje: event.target.value })} /></div></div>
            <div><Label>Gasolinera</Label><Input value={gasolinaForm.gasolinera} onChange={(event) => setGasolinaForm({ ...gasolinaForm, gasolinera: event.target.value })} /></div>
            {!defaultSedeId && <SedeSelector value={gasolinaForm.sede_id} onChange={(value) => setGasolinaForm({ ...gasolinaForm, sede_id: value })} sedes={sedes} />}
          </div>
          <DialogFooter className="flex justify-between"><div>{gasolinaEditing && can("egresos", "delete") && <Button variant="destructive" onClick={() => { setGasolinaModalOpen(false); setGasolinaDeleteId(gasolinaEditing.id); }}>Eliminar</Button>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => setGasolinaModalOpen(false)}>Cancelar</Button><Button onClick={handleGasolinaSave} disabled={gasolinaSaving || !gasolinaForm.automovil_id || !gasolinaForm.fecha || !gasolinaForm.litros || !gasolinaForm.precio_litro || (!defaultSedeId && !gasolinaForm.sede_id)}>{gasolinaSaving ? "Guardando..." : "Guardar"}</Button></div></DialogFooter>
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
                <Label>Automóvil *</Label>
                <Select value={mantenimientoForm.automovil_id || "none"} onValueChange={(value) => setMantenimientoForm({ ...mantenimientoForm, automovil_id: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Selecciona automóvil" /></SelectTrigger><SelectContent><SelectItem value="none">Selecciona automóvil</SelectItem>{automoviles.map((automovil) => <SelectItem key={automovil.id} value={automovil.id}>{automovil.nombre}</SelectItem>)}</SelectContent></Select>
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
              <Button onClick={handleMantenimientoSave} disabled={mantenimientoSaving || !mantenimientoForm.automovil_id || !mantenimientoForm.tipo_mantenimiento || !mantenimientoForm.monto || !mantenimientoForm.fecha || (!defaultSedeId && !mantenimientoForm.sede_id)}>
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
      <ConfirmDialog
        open={!!gasolinaDeleteId}
        onOpenChange={(v) => !v && setGasolinaDeleteId(null)}
        title="¿Eliminar carga de gasolina?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleGasolinaDelete}
      />
      <ConfirmDialog
        open={!!automovilDeleteId}
        onOpenChange={(v) => !v && setAutomovilDeleteId(null)}
        title="¿Eliminar automóvil?"
        description="Los movimientos asociados conservarán su información histórica."
        onConfirm={handleAutomovilDelete}
      />
    </div>
  );
}
