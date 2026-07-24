import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search, FileText } from "lucide-react";
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
};

export default function Empleados() {
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
  const activos = filtered.filter(item => !item.fecha_baja);
  const bajas = filtered.filter(item => item.fecha_baja);

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
      uniformes: item.uniformes || ""
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
     uniformes: form.uniformes || null
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Fecha Ingreso</TableHead>
                  <TableHead className="text-right">Sueldo</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Uniformes</TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : activos.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No hay empleados activos</TableCell></TableRow>
                ) : (
                  activos.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
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
                        <div className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          
                        </div>
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Fecha Ingreso</TableHead>
                  <TableHead>Fecha Baja</TableHead>
                  <TableHead>Días Laborados</TableHead>
                  <TableHead className="text-right">Finiquito Est.</TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : bajas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay registros de bajas</TableCell></TableRow>
                ) : (
                  bajas.map((item) => {
                    const est = getFiniquitoEstimation(item.fecha_ingreso, item.fecha_baja, item.sueldo);
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
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
                <Label>Fecha de Reingreso</Label>
                <Input
                  type="date"
                  value={form.fecha_reingreso}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_reingreso: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Fecha de Baja</Label>
                <Input
                  type="date"
                  value={form.fecha_baja}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_baja: e.target.value,
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
          <Label>Fecha de reingreso</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_reingreso || "—"}
          </p>
        </div>

        <div>
          <Label>Fecha de baja</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_baja || "—"}
          </p>
        </div>

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
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}