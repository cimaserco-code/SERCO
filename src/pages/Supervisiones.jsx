import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Search, Eye, FileText, Calendar, Clock, User, Briefcase, Trash2 } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import SedeSelector from "@/components/SedeSelector";
import { usePermissions } from "@/lib/PermissionsContext";
import { useAuth } from "@/lib/AuthContext";
import AccessRestricted from "@/components/AccessRestricted";

const emptyRondin = { supervisor_id: "", servicio_id: "", fecha: "", hora: "", sede_id: "" };
const emptyReporte = { supervisor_id: "", servicio_id: "", fecha: "", hora: "", reporte: "", sede_id: "" };

export default function Supervisiones() {
  const { user } = useAuth();
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView } = usePermissions();

  const [activeTab, setActiveTab] = useState("rondin");
  const [rondines, setRondines] = useState([]);
  const [sortField, setSortField] = useState("nombre_completo");
  const [sortDirection, setSortDirection] = useState("asc");

  // Error notifications
  const [saveRondinError, setSaveRondinError] = useState("");
  const [saveReporteError, setSaveReporteError] = useState("");
  const [reportes, setReportes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Rondin Modal
  const [rondinModalOpen, setRondinModalOpen] = useState(false);
  const [editingRondin, setEditingRondin] = useState(null);
  const [rondinForm, setRondinForm] = useState(emptyRondin);
  const [savingRondin, setSavingRondin] = useState(false);
  const [deleteRondinId, setDeleteRondinId] = useState(null);

  // Reporte Modal
  const [reporteModalOpen, setReporteModalOpen] = useState(false);
  const [editingReporte, setEditingReporte] = useState(null);
  const [reporteForm, setReporteForm] = useState(emptyReporte);
  const [savingReporte, setSavingReporte] = useState(false);
  const [deleteReporteId, setDeleteReporteId] = useState(null);

  useEffect(() => {
    loadData();
  }, [sedeFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [rData, repData, servs, usersList, sedesList] = await Promise.all([
        sercoApi.entities.Rondin.filter(sedeFilter, "-created_date").catch(() => []),
        sercoApi.entities.ReporteSupervision.filter(sedeFilter, "-created_date").catch(() => []),
        sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
        sercoApi.entities.User.list().catch(() => []),
        sercoApi.entities.Sede.list().catch(() => [])
      ]);
      console.log("SUPERVISIONES DIAGNOSTIC:", {
        rondines: rData?.length,
        reportes: repData?.length,
        servicios: servs?.length,
        supervisores: usersList?.length,
        sedes: sedesList?.length,
        sedeFilter,
        user
      });
      setRondines(rData || []);
      setReportes(repData || []);
      setServicios(servs || []);
      setSupervisores(usersList || []);
      setSedes(sedesList || []);
    } catch (err) {
      console.error("Error loading supervision data:", err);
    } finally {
      setLoading(false);
    }
  }

  const isAuthorized = canView("supervisiones") || 
                       user?.role === "Administrador" || 
                       user?.role === "Super Administrador" || 
                       user?.role === "Supervisor";

  if (!isAuthorized) {
    return <AccessRestricted />;
  }

  // Helpers
  const getSupervisorName = (id) => {
    const s = supervisores.find((u) => u.id === id);
    if (s) {
      return s.full_name?.split("|")[0].trim() || s.email;
    }
    if (id === user?.id) {
      return user?.full_name || user?.email || "—";
    }
    return "—";
  };

  const getServicioName = (id) => {
    const s = servicios.find((item) => item.id === id);
    return s ? s.nombre : "—";
  };

  // Filtrar supervisores: solo rol "Supervisor" y de la sede activa
  const supervisoresParaRondin = React.useMemo(() => {
    if (!defaultSedeId) {
      return supervisores.filter(s => s.role === "Supervisor");
    }
    return supervisores.filter(s => 
      s.role === "Supervisor" &&
      s.sede_ids?.includes(defaultSedeId)
    );
  }, [supervisores, defaultSedeId]);

  // Rondin Handlers
  const openCreateRondin = () => {
    setSaveRondinError("");
    setEditingRondin(null);
    const today = new Date().toISOString().split("T")[0];
    const nowTime = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
    setRondinForm({
      supervisor_id: user?.id || "",
      servicio_id: "",
      fecha: today,
      hora: nowTime,
      sede_id: defaultSedeId || ""
    });
    setRondinModalOpen(true);
  };

  const openEditRondin = (item) => {
    setEditingRondin(item);
    setRondinForm({
      supervisor_id: item.supervisor_id || "",
      servicio_id: item.servicio_id || "",
      fecha: item.fecha || "",
      hora: item.hora || "",
      sede_id: item.sede_id || defaultSedeId || ""
    });
    setSaveRondinError("");
    setRondinModalOpen(true);
  };

  const handleSaveRondin = async (e) => {
    e.preventDefault();
    setSavingRondin(true);
    setSaveRondinError("");
    try {
      const payload = {
        ...rondinForm,
        supervisor_nombre: getSupervisorName(rondinForm.supervisor_id),
        servicio_nombre: getServicioName(rondinForm.servicio_id)
      };

      if (editingRondin) {
        await sercoApi.entities.Rondin.update(editingRondin.id, payload);
      } else {
        await sercoApi.entities.Rondin.create(payload);
      }
      setRondinModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      setSaveRondinError(err.message || "Error al guardar el rondín.");
    } finally {
      setSavingRondin(false);
    }
  };

  const handleDeleteRondin = async () => {
    if (!deleteRondinId) return;
    try {
      await sercoApi.entities.Rondin.delete(deleteRondinId);
      setDeleteRondinId(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Reporte Handlers
  const openCreateReporte = () => {
    setSaveReporteError("");
    setEditingReporte(null);
    const today = new Date().toISOString().split("T")[0];
    const nowTime = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
    setReporteForm({
      supervisor_id: user?.id || "",
      servicio_id: "",
      fecha: today,
      hora: nowTime,
      reporte: "",
      sede_id: defaultSedeId || ""
    });
    setReporteModalOpen(true);
  };

  const openEditReporte = (item) => {
    setSaveReporteError("");
    setEditingReporte(item);
    setReporteForm({
      supervisor_id: item.supervisor_id || "",
      servicio_id: item.servicio_id || "",
      fecha: item.fecha || "",
      hora: item.hora || "",
      reporte: item.reporte || "",
      sede_id: item.sede_id || defaultSedeId || ""
    });
    setReporteModalOpen(true);
  };

  const handleSaveReporte = async (e) => {
    e.preventDefault();
    setSavingReporte(true);
    setSaveReporteError("");
    try {
      const payload = {
        ...reporteForm,
        supervisor_nombre: getSupervisorName(reporteForm.supervisor_id),
        servicio_nombre: getServicioName(reporteForm.servicio_id)
      };

      if (editingReporte) {
        await sercoApi.entities.ReporteSupervision.update(editingReporte.id, payload);
      } else {
        await sercoApi.entities.ReporteSupervision.create(payload);
      }
      setReporteModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      setSaveReporteError(err.message || "Error al guardar el reporte.");
    } finally {
      setSavingReporte(false);
    }
  };

  const handleDeleteReporte = async () => {
    if (!deleteReporteId) return;
    try {
      await sercoApi.entities.ReporteSupervision.delete(deleteReporteId);
      setDeleteReporteId(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Filtering
  const filteredRondines = rondines.filter((r) =>
    getSupervisorName(r.supervisor_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    getServicioName(r.servicio_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReportes = reportes.filter((r) =>
    getSupervisorName(r.supervisor_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    getServicioName(r.servicio_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.reporte || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supervisiones</h1>
          <p className="text-sm text-muted-foreground">
            Control de rondines y reportes detallados por servicio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "rondin" ? (
            <Button onClick={openCreateRondin} className="gap-2">
              <Plus className="w-4 h-4" /> Registrar Rondín
            </Button>
          ) : (
            <Button onClick={openCreateReporte} className="gap-2">
              <Plus className="w-4 h-4" /> Registrar Reporte
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 bg-background p-3 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por supervisor, servicio o reporte..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full sm:w-[350px]"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-64 grid-cols-2">
          <TabsTrigger value="rondin" className="gap-2">
            <Clock className="w-4 h-4" /> Rondines
          </TabsTrigger>
          <TabsTrigger value="reportes" className="gap-2">
            <FileText className="w-4 h-4" /> Reportes
          </TabsTrigger>
        </TabsList>

        {/* RONDIN TAB */}
        <TabsContent value="rondin" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Registro de Rondines</CardTitle>
              <CardDescription>Lista de visitas y rondines completados por los supervisores.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando rondines...</TableCell></TableRow>
                  ) : filteredRondines.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No se encontraron rondines.</TableCell></TableRow>
                  ) : (
                    filteredRondines.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {getSupervisorName(r.supervisor_id)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                            {getServicioName(r.servicio_id)}
                          </span>
                        </TableCell>
                        <TableCell>{r.fecha}</TableCell>
                        <TableCell>{r.hora}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditRondin(r)}>Editar</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteRondinId(r.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTES TAB */}
        <TabsContent value="reportes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Reportes de Supervisión</CardTitle>
              <CardDescription>Informes y novedades registradas por los supervisores en los servicios.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Fecha / Hora</TableHead>
                    <TableHead>Reporte / Observaciones</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando reportes...</TableCell></TableRow>
                  ) : filteredReportes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No se encontraron reportes.</TableCell></TableRow>
                  ) : (
                    filteredReportes.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {getSupervisorName(r.supervisor_id)}
                        </TableCell>
                        <TableCell>
                          {getServicioName(r.servicio_id)}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {r.fecha} a las {r.hora}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {r.reporte || "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditReporte(r)}>Editar</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteReporteId(r.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* RONDIN DIALOG */}
      <Dialog open={rondinModalOpen} onOpenChange={setRondinModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleSaveRondin}>
            <DialogHeader>
              <DialogTitle>{editingRondin ? "Editar Rondín" : "Registrar Rondín"}</DialogTitle>
              <DialogDescription>
                Ingresa los detalles del rondín completado por el supervisor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="rondin-supervisor">Supervisor</Label>
                <select
                  id="rondin-supervisor"
                  value={rondinForm.supervisor_id}
                  onChange={(e) => setRondinForm({ ...rondinForm, supervisor_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="" disabled>Selecciona un supervisor...</option>
                  {supervisoresParaRondin.length > 0 ? (
                    supervisoresParaRondin.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name?.split("|")[0].trim() || s.email}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No hay supervisores disponibles para esta sede</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="rondin-servicio">Servicio</Label>
                <select
                  id="rondin-servicio"
                  value={rondinForm.servicio_id}
                  onChange={(e) => setRondinForm({ ...rondinForm, servicio_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="" disabled>Selecciona un servicio...</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <SedeSelector
                  value={rondinForm.sede_id}
                  onChange={(v) => setRondinForm({ ...rondinForm, sede_id: v })}
                  sedes={sedes}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="rondin-fecha">Día</Label>
                  <Input
                    id="rondin-fecha"
                    type="date"
                    value={rondinForm.fecha}
                    onChange={(e) => setRondinForm({ ...rondinForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rondin-hora">Hora</Label>
                  <Input
                    id="rondin-hora"
                    type="time"
                    value={rondinForm.hora}
                    onChange={(e) => setRondinForm({ ...rondinForm, hora: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
            
            {saveRondinError && (
              <div className="mx-6 mb-3 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm font-medium">
                {saveRondinError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRondinModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingRondin}>
                {savingRondin ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* REPORTE DIALOG */}
      <Dialog open={reporteModalOpen} onOpenChange={setReporteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveReporte}>
            <DialogHeader>
              <DialogTitle>{editingReporte ? "Editar Reporte" : "Registrar Reporte"}</DialogTitle>
              <DialogDescription>
                Completa la novedad o reporte para el servicio seleccionado.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label>Supervisor</Label>
                <div className="h-10 w-full rounded-md border bg-slate-50 px-3 py-2 text-sm text-muted-foreground flex items-center">
                  {getSupervisorName(reporteForm.supervisor_id || user?.id)}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reporte-servicio">Servicio</Label>
                <select
                  id="reporte-servicio"
                  value={reporteForm.servicio_id}
                  onChange={(e) => setReporteForm({ ...reporteForm, servicio_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="" disabled>Selecciona un servicio...</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <SedeSelector
                  value={reporteForm.sede_id}
                  onChange={(v) => setReporteForm({ ...reporteForm, sede_id: v })}
                  sedes={sedes}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="reporte-fecha">Fecha</Label>
                  <Input
                    id="reporte-fecha"
                    type="date"
                    value={reporteForm.fecha}
                    onChange={(e) => setReporteForm({ ...reporteForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reporte-hora">Hora</Label>
                  <Input
                    id="reporte-hora"
                    type="time"
                    value={reporteForm.hora}
                    onChange={(e) => setReporteForm({ ...reporteForm, hora: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reporte-texto">Novedades / Reporte</Label>
                <Textarea
                  id="reporte-texto"
                  placeholder="Detalles sobre novedades, bitácoras o incidentes..."
                  value={reporteForm.reporte}
                  onChange={(e) => setReporteForm({ ...reporteForm, reporte: e.target.value })}
                  rows={4}
                  required
                />
              </div>
            </div>

            {saveReporteError && (
              <div className="mx-6 mb-3 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm font-medium">
                {saveReporteError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReporteModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingReporte}>
                {savingReporte ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRondinId}
        onOpenChange={(v) => !v && setDeleteRondinId(null)}
        title="¿Eliminar Rondín?"
        description="Esta acción eliminará permanentemente el rondín registrado."
        onConfirm={handleDeleteRondin}
      />

      <ConfirmDialog
        open={!!deleteReporteId}
        onOpenChange={(v) => !v && setDeleteReporteId(null)}
        title="¿Eliminar Reporte?"
        description="Esta acción eliminará permanentemente el reporte registrado."
        onConfirm={handleDeleteReporte}
      />
    </div>
  );
}
