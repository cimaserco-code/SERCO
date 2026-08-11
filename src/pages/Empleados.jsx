import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search, FileText, UserX, Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const emptyForm = {
  nombre_completo: "",
  fecha_ingreso: "",
  sueldo: "",
  servicio_ubicacion: "",
  puesto: "",
  telefono: "",
  email: "",
  curp: "",
  rfc: "",
  nss: "",
  sede_id: "",
  fecha_baja: "",
  actas_administrativas: "0",
  uniformes: "",
  sexo: "",
  fecha_nacimiento: "",
  estado_civil: "",
  nivel_estudios: "",
  zona: "",
  calle: "",
  numero: "",
  colonia: "",
  codigo_postal: "",
  ciudad: "",
  fecha_reingreso: "",
  contacto_emergencia: "",
  telefono_emergencia: "",
  parentesco: "",
  infonavit: "",
  medio_reclutamiento: "",
  dia_capacitacion: "",
  fecha_montaje: "",
  hospedaje: false,
};

export default function Empleados() {
  const { user } = useAuth();
  const { canView, can } = usePermissions();
  const canAccess = canView("empleados");
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const [items, setItems] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState("activos");
  const [viewEmpleado, setViewEmpleado] = useState(null);
  const [bajaConfirmId, setBajaConfirmId] = useState(null);
  const [reingresoConfirmId, setReingresoConfirmId] = useState(null);
  const [motivoBajaInput, setMotivoBajaInput] = useState("");
  const [sortField, setSortField] = useState("nombre_completo");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [data, s, sv] = await Promise.all([
        sercoApi.entities.Empleado.filter(sedeFilter, "-created_date"),
        sercoApi.entities.Sede.list(),
        sercoApi.entities.Servicio.filter(sedeFilter),
      ]);
      setItems(data);
      setSedes(s);
      setServicios(sv);
    } finally {
      setLoading(false);
    }
  }

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const filtered = items.filter((item) =>
    (item.nombre_completo || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.puesto || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.servicio_ubicacion || "").toLowerCase().includes(search.toLowerCase())
  );

  // Divide into Active and Bajas
  const activos = filtered.filter(item => !item.fecha_baja || (item.fecha_reingreso && item.fecha_reingreso >= item.fecha_baja));
  const bajas = filtered.filter(item => item.fecha_baja && (!item.fecha_reingreso || item.fecha_baja > item.fecha_reingreso));

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />;
    return sortDirection === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 text-primary shrink-0" />
      : <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />;
  };

  const sortItems = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA == null) valA = "";
      if (valB == null) valB = "";

      if (sortField === "sueldo") {
        return sortDirection === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }

      if (sortField === "servicio_ubicacion") {
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
      }

      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();

      return sortDirection === "asc"
        ? valA.localeCompare(valB, undefined, { numeric: true })
        : valB.localeCompare(valA, undefined, { numeric: true });
    });
  };

  const sortedActivos = sortItems(activos);
  const sortedBajas = sortItems(bajas);

  const getServiceRowColor = (serviceName) => {
    if (user?.email !== "sercoseguridad45@gmail.com") return "";
    if (!serviceName) return "bg-slate-50/40 dark:bg-slate-900/10";
    
    const colors = [
      "bg-sky-50/70 hover:bg-sky-100/70 dark:bg-sky-950/20 text-sky-950 dark:text-sky-100 border-sky-100 dark:border-sky-900/50",
      "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 border-emerald-100 dark:border-emerald-900/50",
      "bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100 border-amber-100 dark:border-amber-900/50",
      "bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/20 text-rose-950 dark:text-rose-100 border-rose-100 dark:border-rose-900/50",
      "bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-100 border-indigo-100 dark:border-indigo-900/50",
      "bg-teal-50/70 hover:bg-teal-100/70 dark:bg-teal-950/20 text-teal-950 dark:text-teal-100 border-teal-100 dark:border-teal-900/50",
      "bg-violet-50/70 hover:bg-violet-100/70 dark:bg-violet-950/20 text-violet-950 dark:text-violet-100 border-violet-100 dark:border-violet-900/50",
      "bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/20 text-orange-950 dark:text-orange-100 border-orange-100 dark:border-orange-900/50",
    ];

    let hash = 0;
    for (let i = 0; i < serviceName.length; i++) {
      hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const exportToExcel = () => {
    const listToExport = activeTab === "activos" ? activos : bajas;
    const headers = [
      "Nombre Completo",
      "Sede",
      "Puesto",
      "Fecha de Ingreso",
      "Sueldo",
      "Ubicación de Servicio",
      "Uniformes",
      "Actas Administrativas",
      "Teléfono",
      "Día de Capacitación",
      "Medio de Reclutamiento",
      "Hospedaje",
      "Historial de Bajas",
      "Motivo de Baja"
    ];

    const rows = listToExport.map(emp => [
      emp.nombre_completo || "",
      sedeNombre(emp.sede_id),
      emp.puesto || "",
      emp.fecha_ingreso || "",
      emp.sueldo ? `$${emp.sueldo}` : "—",
      emp.servicio_ubicacion || "Sin Asignar",
      emp.uniformes || "Sin uniformes",
      emp.actas_administrativas || 0,
      emp.telefono || "",
      emp.dia_capacitacion || "",
      emp.medio_reclutamiento || "",
      emp.hospedaje ? "Sí" : "No",
      emp.historial_bajas || "",
      emp.motivo_baja || ""
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `empleados_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ 
      ...emptyForm, 
      ...item, 
      sueldo: item.sueldo ?? "",
      actas_administrativas: String(item.actas_administrativas ?? 0),
      fecha_baja: item.fecha_baja || "",
      uniformes: item.uniformes || "",
      hospedaje: !!item.hospedaje
    });
    setModalOpen(true);
  }

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "—";

  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);

  let edad = hoy.getFullYear() - nacimiento.getFullYear();

  const mes = hoy.getMonth() - nacimiento.getMonth();

  if (
    mes < 0 ||
    (mes === 0 && hoy.getDate() < nacimiento.getDate())
  ) {
    edad--;
  }

  return `${edad} años`;
}

function calcularDiasEnEmpresa(fechaIngreso, fechaBaja, fechaReingreso) {
  if (!fechaIngreso) return "—";
  const start = new Date(fechaIngreso);
  
  const isActive = !fechaBaja || (fechaReingreso && fechaReingreso >= fechaBaja);
  const end = isActive ? new Date() : new Date(fechaBaja);
  
  // Set times to midnight to calculate purely by calendar days
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? `${diffDays} días` : "—";
}
  
  async function handleSave() {
  console.log("ENTRÓ A GUARDAR", form);

  setSaving(true);

  try {
    const payload = {
      ...form,
      sueldo: form.sueldo === "" ? null : Number(form.sueldo),
     actas_administrativas: Number(form.actas_administrativas || 0),
     fecha_ingreso: form.fecha_ingreso || null,
     fecha_nacimiento: form.fecha_nacimiento || null,
      fecha_baja: form.fecha_baja || null,
      fecha_reingreso: form.fecha_reingreso || null,
      uniformes: form.uniformes || null,
      infonavit: form.infonavit || null,
      medio_reclutamiento: form.medio_reclutamiento || null,
      dia_capacitacion: form.dia_capacitacion || null,
      fecha_montaje: form.fecha_montaje || null,
      historial_bajas: form.historial_bajas || null,
      hospedaje: form.hospedaje ? true : false
     };

    console.log("PAYLOAD:", JSON.stringify(payload, null, 2));

    if (editing) {
      await sercoApi.entities.Empleado.update(editing.id, payload);
    } else {
      await sercoApi.entities.Empleado.create(payload);
    }

    console.log("GUARDADO CORRECTAMENTE");

    setModalOpen(false);
    await load();

  } catch (error) {
  console.error("ERROR COMPLETO:", JSON.stringify(error, null, 2));
  } finally {
    setSaving(false);
  }
}
  async function handleDelete() {
    await sercoApi.entities.Empleado.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  async function handleConfirmBaja() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const emp = items.find((e) => e.id === bajaConfirmId);
      const prevHistorial = emp?.historial_bajas ? emp.historial_bajas + ", " : "";
      const newHistorial = prevHistorial + todayStr;

      await sercoApi.entities.Empleado.update(bajaConfirmId, {
        fecha_baja: todayStr,
        fecha_reingreso: null,
        historial_bajas: newHistorial,
        motivo_baja: motivoBajaInput || null
      });
      setBajaConfirmId(null);
      setMotivoBajaInput("");
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleConfirmReingreso() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      await sercoApi.entities.Empleado.update(reingresoConfirmId, {
        fecha_reingreso: todayStr
      });
      setReingresoConfirmId(null);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  // Finiquito estimation helper
  function getFiniquitoEstimation(ingreso, baja, sueldo) {
    if (!ingreso || !baja || !sueldo) return null;
    const start = new Date(ingreso);
    const end = new Date(baja);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Simple estimation (e.g. 15 days of aguinaldo per year, 6 days of vacation per year)
    const dailySueldo = sueldo / 30;
    const estimatedAguinaldo = (diffDays / 365) * 15 * dailySueldo;
    const estimatedVacacion = (diffDays / 365) * 6 * dailySueldo;
    const total = estimatedAguinaldo + estimatedVacacion;
    
    return {
      days: diffDays,
      total: Math.round(total)
    };
  }

  if (!canAccess) {
    return <AccessRestricted />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Empleados</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activos.length} activos · {bajas.length} bajas
          </p>
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
          {can("empleados", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="w-4 h-4 mr-1" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-64 grid-cols-2">
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="bajas">Bajas</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("nombre_completo")}>
                    <div className="flex items-center gap-1.5">
                      Nombre {renderSortIcon("nombre_completo")}
                    </div>
                  </TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("fecha_ingreso")}>
                    <div className="flex items-center gap-1.5">
                      Fecha Ingreso {renderSortIcon("fecha_ingreso")}
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("sueldo")}>
                    <div className="flex items-center justify-end gap-1.5">
                      Sueldo {renderSortIcon("sueldo")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("servicio_ubicacion")}>
                    <div className="flex items-center gap-1.5">
                      Servicio {renderSortIcon("servicio_ubicacion")}
                    </div>
                  </TableHead>
                  <TableHead>Uniformes</TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : sortedActivos.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No hay empleados activos</TableCell></TableRow>
                ) : (
                  sortedActivos.map((item) => (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer ${getServiceRowColor(item.servicio_ubicacion)}`}
                      onClick={() => setViewEmpleado(item)}
                    >
                      <TableCell className="font-medium">{item.nombre_completo}</TableCell>
                      <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                      <TableCell>{item.puesto || "—"}</TableCell>
                      <TableCell>{item.fecha_ingreso || "—"}</TableCell>
                      <TableCell className="text-right">
                        {item.sueldo != null ? `$${Number(item.sueldo).toLocaleString("es-MX")}` : "—"}
                      </TableCell>
                      <TableCell>{item.servicio_ubicacion || "—"}</TableCell>
                      <TableCell className="truncate max-w-[150px]">{item.uniformes || "Ninguno"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.actas_administrativas > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {item.actas_administrativas || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="bajas" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("nombre_completo")}>
                    <div className="flex items-center gap-1.5">
                      Nombre {renderSortIcon("nombre_completo")}
                    </div>
                  </TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("fecha_ingreso")}>
                    <div className="flex items-center gap-1.5">
                      Fecha Ingreso {renderSortIcon("fecha_ingreso")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("fecha_baja")}>
                    <div className="flex items-center gap-1.5 text-destructive">
                      Fecha Baja {renderSortIcon("fecha_baja")}
                    </div>
                  </TableHead>
                  <TableHead>Días Laborados</TableHead>
                  <TableHead className="text-right">Finiquito Est.</TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : sortedBajas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay registros de bajas</TableCell></TableRow>
                ) : (
                  sortedBajas.map((item) => {
                    const est = getFiniquitoEstimation(item.fecha_ingreso, item.fecha_baja, item.sueldo);
                    return (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer ${getServiceRowColor(item.servicio_ubicacion)}`}
                        onClick={() => setViewEmpleado(item)}
                      >
                        <TableCell className="font-medium">{item.nombre_completo}</TableCell>
                        <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                        <TableCell>{item.fecha_ingreso || "—"}</TableCell>
                        <TableCell className="text-destructive font-semibold">{item.fecha_baja || "—"}</TableCell>
                        <TableCell>{est ? `${est.days} días` : "—"}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {est ? `$${est.total.toLocaleString("es-MX")}` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700`}>
                            {item.actas_administrativas || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
         <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
          <DialogDescription>
            Completa los datos del empleado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* INFORMACIÓN PERSONAL */}

          <div>
            <h3 className="font-semibold border-b pb-2 mb-4">
              Información Personal
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="sm:col-span-2">
                <Label>Nombre Completo *</Label>
                <Input
                  value={form.nombre_completo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nombre_completo: e.target.value,
                    })
                  }
                />
              </div>

              {!defaultSedeId && (
                <div className="sm:col-span-2">
                  <SedeSelector
                    value={form.sede_id}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        sede_id: v,
                      })
                    }
                    sedes={sedes}
                  />
                </div>
              )}

              <div>
                <Label>Sexo</Label>

                <Select
                  value={form.sexo}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      sexo: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                  </SelectContent>

                </Select>
              </div>

              <div>
                <Label>Fecha de Nacimiento</Label>

                <Input
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_nacimiento: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Estado Civil</Label>

                <Select
                  value={form.estado_civil}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      estado_civil: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Soltero">Soltero(a)</SelectItem>
                    <SelectItem value="Casado">Casado(a)</SelectItem>
                    <SelectItem value="Divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="Viudo">Viudo(a)</SelectItem>
                    <SelectItem value="Union Libre">Unión libre</SelectItem>
                  </SelectContent>

                </Select>
              </div>

              <div>
                <Label>Nivel de Estudios</Label>

                <Select
                  value={form.nivel_estudios}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      nivel_estudios: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Primaria">Primaria</SelectItem>
                    <SelectItem value="Secundaria">Secundaria</SelectItem>
                    <SelectItem value="Preparatoria">Preparatoria</SelectItem>
                    <SelectItem value="Carrera Técnica">Carrera técnica</SelectItem>
                    <SelectItem value="Licenciatura">Licenciatura</SelectItem>
                    <SelectItem value="Maestría">Maestría</SelectItem>
                    <SelectItem value="Doctorado">Doctorado</SelectItem>
                  </SelectContent>

                </Select>
              </div>

              <div>
                <Label>CURP</Label>

                <Input
                  value={form.curp}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      curp: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>RFC</Label>

                <Input
                  value={form.rfc}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rfc: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>NSS</Label>

                <Input
                  value={form.nss}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nss: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Infonavit</Label>
                <Input
                  value={form.infonavit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      infonavit: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Teléfono</Label>

                <Input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefono: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Email</Label>

                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                />
              </div>

            </div>
          </div>

          {/* DOMICILIO */}

          <div>

            <h3 className="font-semibold border-b pb-2 mb-4">
              Domicilio
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <Label>Zona</Label>
                <Input
                  value={form.zona}
                  onChange={(e) =>
                    setForm({ ...form, zona: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Calle</Label>
                <Input
                  value={form.calle}
                  onChange={(e) =>
                    setForm({ ...form, calle: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Número</Label>
                <Input
                  value={form.numero}
                  onChange={(e) =>
                    setForm({ ...form, numero: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Colonia</Label>
                <Input
                  value={form.colonia}
                  onChange={(e) =>
                    setForm({ ...form, colonia: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Código Postal</Label>
                <Input
                  value={form.codigo_postal}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      codigo_postal: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Ciudad</Label>
                <Input
                  value={form.ciudad}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ciudad: e.target.value,
                    })
                  }
                />
              </div>

            </div>
          </div>
              {/* CONTACTO DE EMERGENCIA */}

          <div>

            <h3 className="font-semibold border-b pb-2 mb-4">
              Contacto de Emergencia
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <Label>Contacto de Emergencia</Label>
                <Input
                  value={form.contacto_emergencia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contacto_emergencia: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Parentesco</Label>
                <Input
                  value={form.parentesco}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parentesco: e.target.value,
                    })
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <Label>Número de Contacto</Label>
                <Input
                  value={form.telefono_emergencia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefono_emergencia: e.target.value,
                    })
                  }
                />
              </div>

            </div>

          </div>

          {/* INFORMACIÓN LABORAL */}

          <div>

            <h3 className="font-semibold border-b pb-2 mb-4">
              Información Laboral
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <Label>Puesto</Label>
                <Input
                  value={form.puesto}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      puesto: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Servicio</Label>

                <Select
                  value={form.servicio_ubicacion || ""}
                  onValueChange={(val) =>
                    setForm({
                      ...form,
                      servicio_ubicacion: val === "none" ? "" : val,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un servicio..." />
                  </SelectTrigger>

                  <SelectContent>

                    <SelectItem value="none">
                      Ninguno / Sin asignar
                    </SelectItem>

                    {servicios.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.nombre}
                      >
                        {s.nombre}
                      </SelectItem>
                    ))}

                  </SelectContent>

                </Select>

              </div>

              <div>
                <Label>Fecha de Ingreso</Label>
                <Input
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_ingreso: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Sueldo Mensual</Label>
                <Input
                  type="number"
                  value={form.sueldo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sueldo: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Medio de Reclutamiento</Label>
                <Input
                  value={form.medio_reclutamiento}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      medio_reclutamiento: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Día de Capacitación</Label>
                <Input
                  type="date"
                  value={form.dia_capacitacion}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dia_capacitacion: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Fecha de Montaje</Label>
                <Input
                  type="date"
                  value={form.fecha_montaje}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_montaje: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Actas Administrativas</Label>
                <Input
                  type="number"
                  value={form.actas_administrativas}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      actas_administrativas: e.target.value,
                    })
                  }
                />
              </div>

              {sedes.find((s) => s.id === form.sede_id)?.nombre?.toLowerCase() === "monterrey" && (
                <div className="flex items-center space-x-2 pt-8 sm:col-span-2">
                  <input
                    type="checkbox"
                    id="hospedaje"
                    checked={!!form.hospedaje}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        hospedaje: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <Label htmlFor="hospedaje" className="cursor-pointer font-semibold text-sm">
                    ¿Tiene Hospedaje?
                  </Label>
                </div>
              )}

              <div className="sm:col-span-2">
                <Label>Uniformes Asignados</Label>
                <Textarea
                  
                  value={form.uniformes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      uniformes: e.target.value,
                    })
                  }
                />
              </div>

            </div>

          </div>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setModalOpen(false)}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
          >
             {saving ? "Guardando..." : "Guardar"}
          
            
          </Button>
        </DialogFooter>

        </DialogContent>
        </Dialog>
        <Dialog
          open={!!viewEmpleado}
          onOpenChange={(v) => !v && setViewEmpleado(null)}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">

            <DialogHeader>
              <DialogTitle>
                {viewEmpleado?.nombre_completo}
              </DialogTitle>

              <DialogDescription>
                Información del empleado
              </DialogDescription>
            </DialogHeader>
                <div className="space-y-6 py-2">

    {/* Información General */}
    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Información General
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Nombre</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.nombre_completo || "—"}
          </p>
        </div>

        <div>
          <Label>Puesto</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.puesto || "—"}
          </p>
        </div>

        <div>
          <Label>Servicio</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.servicio_ubicacion || "—"}
          </p>
        </div>

        <div>
          <Label>Sede</Label>
          <p className="text-sm text-muted-foreground">
            {sedeNombre(viewEmpleado?.sede_id)}
          </p>
        </div>

        <div>
          <Label>Fecha de ingreso</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_ingreso || "—"}
          </p>
        </div>

        <div>
          <Label>Días en la Empresa</Label>
          <p className="text-sm text-muted-foreground font-semibold text-primary">
            {calcularDiasEnEmpresa(viewEmpleado?.fecha_ingreso, viewEmpleado?.fecha_baja, viewEmpleado?.fecha_reingreso)}
          </p>
        </div>

        {viewEmpleado?.fecha_reingreso && (
          <div>
            <Label>Fecha de reingreso</Label>
            <p className="text-sm text-muted-foreground">
              {viewEmpleado.fecha_reingreso}
            </p>
          </div>
        )}

        {(viewEmpleado?.historial_bajas || viewEmpleado?.fecha_baja) && (
          <div>
            <Label>{viewEmpleado.historial_bajas?.includes(",") ? "Historial de Bajas" : "Fecha de Baja"}</Label>
            <p className="text-sm text-muted-foreground font-semibold text-rose-600">
              {viewEmpleado.historial_bajas || viewEmpleado.fecha_baja}
            </p>
          </div>
        )}

        {sedes.find((s) => s.id === viewEmpleado?.sede_id)?.nombre?.toLowerCase() === "monterrey" && (
          <div>
            <Label>Hospedaje</Label>
            <p className="text-sm text-muted-foreground font-semibold">
              {viewEmpleado?.hospedaje ? "Sí" : "No"}
            </p>
          </div>
        )}

        {viewEmpleado?.motivo_baja && (
          <div>
            <Label>Motivo de la Baja</Label>
            <p className="text-sm text-muted-foreground font-semibold text-rose-600">
              {viewEmpleado.motivo_baja}
            </p>
          </div>
        )}

      </div>
    </div>

    {/* Información Laboral */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Información Laboral
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Sueldo</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.sueldo ?? "—"}
          </p>
        </div>

        <div>
          <Label>Actas administrativas</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.actas_administrativas}
          </p>
        </div>

        <div>
          <Label>Uniformes</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.uniformes || "—"}
          </p>
        </div>

        <div>
          <Label>Medio de Reclutamiento</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.medio_reclutamiento || "—"}
          </p>
        </div>

        <div>
          <Label>Día de Capacitación</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.dia_capacitacion || "—"}
          </p>
        </div>

        <div>
          <Label>Fecha de Montaje</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_montaje || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Información Personal */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Información Personal
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Sexo</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.sexo || "—"}
          </p>
        </div>

        <div>
          <Label>Fecha de nacimiento</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_nacimiento || "—"}
          </p>
        </div>

        <div>
          <Label>Edad</Label>
          <p className="text-sm text-muted-foreground">
            {calcularEdad(viewEmpleado?.fecha_nacimiento)}
          </p>
        </div>

        <div>
          <Label>Estado civil</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.estado_civil || "—"}
          </p>
        </div>

        <div>
          <Label>Nivel de estudios</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.nivel_estudios || "—"}
          </p>
        </div>

        <div>
          <Label>Teléfono</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.telefono || "—"}
          </p>
        </div>

        <div>
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.email || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Documentación */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Documentación
      </h3>

      <div className="grid grid-cols-3 gap-4 mt-3">

        <div>
          <Label>CURP</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.curp || "—"}
          </p>
        </div>

        <div>
          <Label>RFC</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.rfc || "—"}
          </p>
        </div>

        <div>
          <Label>NSS</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.nss || "—"}
          </p>
        </div>

        <div>
          <Label>Infonavit</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.infonavit || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Domicilio */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Domicilio
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Calle</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.calle || "—"}
          </p>
        </div>

        <div>
          <Label>Número</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.numero || "—"}
          </p>
        </div>

        <div>
          <Label>Colonia</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.colonia || "—"}
          </p>
        </div>

        <div>
          <Label>Código Postal</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.codigo_postal || "—"}
          </p>
        </div>

        <div>
          <Label>Ciudad</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.ciudad || "—"}
          </p>
        </div>

        <div>
          <Label>Zona</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.zona || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Contacto de Emergencia */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Contacto de Emergencia
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Nombre</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.contacto_emergencia || "—"}
          </p>
        </div>

        <div>
          <Label>Teléfono</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.telefono_emergencia || "—"}
          </p>
        </div>

        <div>
          <Label>Parentesco</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.parentesco || "—"}
          </p>
        </div>

      </div>
    </div>

  </div>
            
            <DialogFooter>
              {!viewEmpleado?.fecha_baja || (viewEmpleado?.fecha_reingreso && viewEmpleado?.fecha_reingreso >= viewEmpleado?.fecha_baja) ? (
                (can("empleados", "edit") || user?.role?.toLowerCase() === "supervisor") && (
                  <Button
                    variant="outline"
                    className="border-rose-300 text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      setBajaConfirmId(viewEmpleado.id);
                      setMotivoBajaInput("");
                      setViewEmpleado(null);
                    }}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Baja
                  </Button>
                )
              ) : (
                can("empleados", "edit") && (
                  <Button
                    variant="outline"
                    className="border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => {
                      setReingresoConfirmId(viewEmpleado.id);
                      setViewEmpleado(null);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Reingreso
                  </Button>
                )
              )}

              {can("empleados", "delete") && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewEmpleado(null);
                    setDeleteId(viewEmpleado.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              )}

              {can("empleados", "edit") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewEmpleado(null);
                    openEdit(viewEmpleado);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}

              <Button onClick={() => setViewEmpleado(null)}>
                Cerrar
              </Button>

            </DialogFooter>

          </DialogContent>
        </Dialog>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar empleado?"
        description="Esta acción no se puede deshacer y borrará permanentemente la información."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!bajaConfirmId}
        onOpenChange={(v) => !v && setBajaConfirmId(null)}
        title="¿Dar de baja al empleado?"
        description="Esta acción registrará la baja del empleado con la fecha de hoy automáticamente y lo moverá a la sección de bajas."
        confirmLabel="Dar de Baja"
        onConfirm={handleConfirmBaja}
      >
        <div className="space-y-2 py-3 px-1">
          <Label htmlFor="motivo-baja-confirm">Motivo de la Baja</Label>
          <Textarea
            id="motivo-baja-confirm"
            placeholder="Escribe el motivo de la baja..."
            value={motivoBajaInput}
            onChange={(e) => setMotivoBajaInput(e.target.value)}
          />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!reingresoConfirmId}
        onOpenChange={(v) => !v && setReingresoConfirmId(null)}
        title="¿Confirmar reingreso del empleado?"
        description="Esta acción registrará el reingreso del empleado con la fecha de hoy automáticamente y lo moverá a la sección de activos."
        confirmLabel="Confirmar Reingreso"
        variant="success"
        loadingLabel="Guardando..."
        onConfirm={handleConfirmReingreso}
      />
    </div>
  );
}