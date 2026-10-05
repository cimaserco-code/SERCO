import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { useSedeScope } from "@/hooks/useSedeScope";
import AccessRestricted from "@/components/AccessRestricted";
import { useToast } from "@/components/ui/use-toast";
import {
  Headphones,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building2,
  User,
  MessageSquare,
  Sparkles,
  Send,
  MoreVertical,
  Trash2,
  Eye,
  Calendar,
  ShieldAlert,
  ArrowUpDown,
  Mail,
  Phone,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Atencion() {
  const { user } = useAuth();
  const { canView, can, isAdmin } = usePermissions();
  const { sedeFilter, activeSedeId, availableSedes } = useSedeScope();
  const { toast } = useToast();

  const [reportes, setReportes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroServicio, setFiltroServicio] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroPrioridad, setFiltroPrioridad] = useState("all");

  // Modal de Detalle y Respuesta
  const [selectedReporte, setSelectedReporte] = useState(null);
  const [respuestaForm, setRespuestaForm] = useState({
    estado: "En Proceso",
    respuesta: "",
  });
  const [savingRespuesta, setSavingRespuesta] = useState(false);

  // Confirmar eliminación
  const [reporteToDelete, setReporteToDelete] = useState(null);

  // Verificar permisos del módulo
  const hasAccess = canView("atencion") || isAdmin;

  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);

      const [servs, seds] = await Promise.all([
        sercoApi.entities.Servicio.list().catch(() => []),
        sercoApi.entities.Sede.list().catch(() => []),
      ]);

      setServicios(servs || []);
      setSedes(seds || []);

      // Intentar cargar reportes desde Supabase
      let loadedReportes = [];
      try {
        const { data: dbReportes, error: dbErr } = await supabase
          .from("reportes_cliente")
          .select("*")
          .order("created_at", { ascending: false });

        if (!dbErr && dbReportes) {
          loadedReportes = dbReportes;
        }
      } catch (err) {
        console.warn("Error consultando tabla reportes_cliente en Supabase:", err);
      }

      // Si aún no hay tabla o no hay datos remotos, buscar en localStorages de servicios para no perder datos
      if (loadedReportes.length === 0) {
        const fallback = [];
        (servs || []).forEach((srv) => {
          try {
            const stored = JSON.parse(localStorage.getItem(`serco_reportes_cliente_${srv.id}`) || "[]");
            stored.forEach((rep) => {
              fallback.push({
                ...rep,
                folio: rep.folio || rep.id,
                servicio_id: rep.servicio_id || srv.id,
                servicio_nombre: rep.servicio_nombre || srv.nombre,
                sede_id: rep.sede_id || srv.sede_id || null,
              });
            });
          } catch {}
        });
        loadedReportes = fallback;
      }

      setReportes(loadedReportes);
    } catch (e) {
      console.error("Error al cargar datos de atención:", e);
      toast({
        title: "Error al cargar reportes",
        description: "No se pudieron obtener los reportes de clientes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [hasAccess, loadData]);

  // Manejo de filtrado de reportes
  const filteredReportes = useMemo(() => {
    return reportes.filter((rep) => {
      // 1. Filtro por Sede (según alcance de sede)
      if (sedeFilter) {
        if (rep.sede_id && rep.sede_id !== sedeFilter) return false;
      }

      // 2. Filtro por Servicio seleccionado
      if (filtroServicio !== "all" && rep.servicio_id !== filtroServicio) {
        return false;
      }

      // 3. Filtro por Estado
      if (filtroEstado !== "all") {
        const estadoNorm = (rep.estado || "").toLowerCase();
        if (estadoNorm !== filtroEstado.toLowerCase()) return false;
      }

      // 4. Filtro por Prioridad
      if (filtroPrioridad !== "all") {
        const prioridadNorm = (rep.prioridad || "").toLowerCase();
        if (prioridadNorm !== filtroPrioridad.toLowerCase()) return false;
      }

      // 5. Búsqueda por texto (folio, título, descripción, cliente, servicio)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const folio = (rep.folio || rep.id || "").toLowerCase();
        const titulo = (rep.titulo || "").toLowerCase();
        const desc = (rep.descripcion || "").toLowerCase();
        const cliente = (rep.creado_por || "").toLowerCase();
        const servNombre = (rep.servicio_nombre || "").toLowerCase();

        return (
          folio.includes(query) ||
          titulo.includes(query) ||
          desc.includes(query) ||
          cliente.includes(query) ||
          servNombre.includes(query)
        );
      }

      return true;
    });
  }, [reportes, sedeFilter, filtroServicio, filtroEstado, filtroPrioridad, searchTerm]);

  // Contadores de KPIs
  const kpis = useMemo(() => {
    const total = filteredReportes.length;
    const recibidos = filteredReportes.filter((r) => (r.estado || "").toLowerCase() === "recibido").length;
    const enProceso = filteredReportes.filter((r) => (r.estado || "").toLowerCase() === "en proceso").length;
    const atendidos = filteredReportes.filter((r) => (r.estado || "").toLowerCase() === "atendido").length;
    const urgentes = filteredReportes.filter(
      (r) => (r.prioridad || "").toLowerCase() === "urgente" || (r.prioridad || "").toLowerCase() === "alta"
    ).length;

    return { total, recibidos, enProceso, atendidos, urgentes };
  }, [filteredReportes]);

  // Abrir modal para responder
  const handleOpenResponder = (rep) => {
    setSelectedReporte(rep);
    setRespuestaForm({
      estado: rep.estado || "En Proceso",
      respuesta: rep.respuesta || "",
    });
  };

  // Guardar respuesta y actualizar estatus
  const handleSaveRespuesta = async () => {
    if (!selectedReporte) return;
    setSavingRespuesta(true);

    try {
      const nowIso = new Date().toISOString();
      const updatedFields = {
        estado: respuestaForm.estado,
        respuesta: respuestaForm.respuesta.trim(),
        atendido_por: user?.full_name || user?.nombre || "Mesa de Operaciones SERCO",
        fecha_respuesta: nowIso,
        updated_at: nowIso,
      };

      // 1. Intentar actualizar en Supabase
      let dbUpdated = false;
      if (selectedReporte.id) {
        try {
          const { error: updErr } = await supabase
            .from("reportes_cliente")
            .update(updatedFields)
            .eq("id", selectedReporte.id);

          if (!updErr) dbUpdated = true;
        } catch (dbErr) {
          console.warn("No se pudo actualizar en Supabase:", dbErr);
        }
      }

      // 2. Sincronizar en estado local
      setReportes((prev) =>
        prev.map((r) =>
          r.id === selectedReporte.id || (r.folio && r.folio === selectedReporte.folio)
            ? { ...r, ...updatedFields }
            : r
        )
      );

      // 3. Sincronizar en localStorage del servicio por respaldo
      if (selectedReporte.servicio_id) {
        try {
          const localKey = `serco_reportes_cliente_${selectedReporte.servicio_id}`;
          const currentLocal = JSON.parse(localStorage.getItem(localKey) || "[]");
          const nextLocal = currentLocal.map((r) =>
            r.id === selectedReporte.id || (r.folio && r.folio === selectedReporte.folio)
              ? { ...r, ...updatedFields }
              : r
          );
          localStorage.setItem(localKey, JSON.stringify(nextLocal));
        } catch {}
      }

      toast({
        title: "Reporte Actualizado",
        description: `Se actualizó el reporte ${selectedReporte.folio || selectedReporte.id} a estatus "${respuestaForm.estado}". El cliente podrá visualizar tu respuesta.`,
      });

      setSelectedReporte(null);
    } catch (err) {
      console.error("Error al actualizar reporte:", err);
      toast({
        title: "Error al actualizar",
        description: "No se pudo guardar la respuesta del reporte.",
        variant: "destructive",
      });
    } finally {
      setSavingRespuesta(false);
    }
  };

  // Cambio rápido de estado desde la tabla
  const handleQuickStatusChange = async (reporte, nuevoEstado) => {
    try {
      const updatedFields = {
        estado: nuevoEstado,
        atendido_por: user?.full_name || user?.nombre || "Operaciones SERCO",
        updated_at: new Date().toISOString(),
      };

      if (reporte.id) {
        await supabase
          .from("reportes_cliente")
          .update(updatedFields)
          .eq("id", reporte.id)
          .catch(() => {});
      }

      setReportes((prev) =>
        prev.map((r) =>
          r.id === reporte.id || (r.folio && r.folio === reporte.folio)
            ? { ...r, ...updatedFields }
            : r
        )
      );

      toast({
        title: "Estado modificado",
        description: `El reporte ${reporte.folio || reporte.id} ahora está en "${nuevoEstado}".`,
      });
    } catch (err) {
      console.error("Error al cambiar estado:", err);
    }
  };

  // Eliminar reporte
  const handleDeleteReporte = async () => {
    if (!reporteToDelete) return;

    try {
      if (reporteToDelete.id) {
        const { error: delErr } = await supabase
          .from("reportes_cliente")
          .delete()
          .eq("id", reporteToDelete.id);

        if (delErr) {
          console.warn("Error al borrar en Supabase:", delErr);
        }
      }

      // Eliminar también por folio si existe
      if (reporteToDelete.folio) {
        await supabase
          .from("reportes_cliente")
          .delete()
          .eq("folio", reporteToDelete.folio)
          .catch(() => {});
      }

      setReportes((prev) =>
        prev.filter((r) => r.id !== reporteToDelete.id && r.folio !== reporteToDelete.folio)
      );

      if (reporteToDelete.servicio_id) {
        try {
          const localKey = `serco_reportes_cliente_${reporteToDelete.servicio_id}`;
          const currentLocal = JSON.parse(localStorage.getItem(localKey) || "[]");
          const nextLocal = currentLocal.filter(
            (r) => r.id !== reporteToDelete.id && r.folio !== reporteToDelete.folio
          );
          localStorage.setItem(localKey, JSON.stringify(nextLocal));
        } catch {}
      }

      toast({
        title: "Reporte eliminado",
        description: `Se eliminó el reporte ${reporteToDelete.folio || reporteToDelete.id} correctamente.`,
      });

      if (selectedReporte?.id === reporteToDelete.id || selectedReporte?.folio === reporteToDelete.folio) {
        setSelectedReporte(null);
      }
    } catch (err) {
      console.error("Error al eliminar reporte:", err);
      toast({
        title: "Error",
        description: "No se pudo eliminar el reporte.",
        variant: "destructive",
      });
    } finally {
      setReporteToDelete(null);
    }
  };

  // Badges y utilidades de renderizado
  const getBadgeEstado = (estado) => {
    switch ((estado || "").toLowerCase()) {
      case "recibido":
        return <Badge className="bg-amber-500 text-white font-bold text-[11px]">Recibido (Nuevo)</Badge>;
      case "en proceso":
        return <Badge className="bg-sky-600 text-white font-bold text-[11px]">En Proceso</Badge>;
      case "atendido":
        return <Badge className="bg-emerald-600 text-white font-bold text-[11px]">Atendido / Resuelto</Badge>;
      case "descartado":
        return <Badge className="bg-slate-500 text-white font-bold text-[11px]">Descartado</Badge>;
      default:
        return <Badge className="bg-slate-500 text-white text-[11px]">{estado || "Sin Estado"}</Badge>;
    }
  };

  const getBadgePrioridad = (prioridad) => {
    switch ((prioridad || "").toLowerCase()) {
      case "urgente":
        return (
          <Badge className="bg-rose-600 text-white font-bold text-[10px] animate-pulse">
            🚨 Urgente
          </Badge>
        );
      case "alta":
        return <Badge className="bg-orange-500 text-white font-bold text-[10px]">Alta</Badge>;
      case "normal":
        return <Badge variant="outline" className="text-slate-700 dark:text-slate-300 text-[10px]">Normal</Badge>;
      case "baja":
        return <Badge variant="secondary" className="text-muted-foreground text-[10px]">Baja</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{prioridad || "Normal"}</Badge>;
    }
  };

  if (!hasAccess) {
    return <AccessRestricted />;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ══════════════════ ENCABEZADO ══════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Atención a Clientes y Reportes
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Bandeja central de incidencias, solicitudes y requerimientos generados por clientes desde su portal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={refreshing}
            className="text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* ══════════════════ TARJETAS DE KPIS ══════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-border shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Total Reportes</span>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-black text-foreground mt-1">{kpis.total}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">En el alcance actual</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Recibidos / Nuevos</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{kpis.recibidos}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pendientes de atención</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs bg-sky-500/5 border-sky-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-sky-700 dark:text-sky-400 font-semibold">En Proceso</span>
              <RefreshCw className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{kpis.enProceso}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">En seguimiento operativo</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Atendidos</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{kpis.atendidos}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Resueltos y concluidos</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs bg-rose-500/5 border-rose-500/20 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rose-700 dark:text-rose-400 font-semibold">Alta / Urgente</span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{kpis.urgentes}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Prioridad crítica</p>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════ BARRA DE FILTROS Y BÚSQUEDA ══════════════════ */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Buscador general */}
            <div className="sm:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por folio, asunto, cliente, servicio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Filtro por Servicio */}
            <div className="sm:col-span-3">
              <Select value={filtroServicio} onValueChange={setFiltroServicio}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos los servicios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏢 Todos los Servicios</SelectItem>
                  {servicios.map((srv) => (
                    <SelectItem key={srv.id} value={srv.id}>
                      {srv.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Estado */}
            <div className="sm:col-span-3">
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📋 Todos los Estados</SelectItem>
                  <SelectItem value="recibido">🟡 Recibido (Nuevo)</SelectItem>
                  <SelectItem value="en proceso">🔵 En Proceso</SelectItem>
                  <SelectItem value="atendido">🟢 Atendido / Resuelto</SelectItem>
                  <SelectItem value="descartado">⚪ Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Prioridad */}
            <div className="sm:col-span-2">
              <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">⚡ Prioridad</SelectItem>
                  <SelectItem value="urgente">🚨 Urgente</SelectItem>
                  <SelectItem value="alta">🔥 Alta</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════ TABLA DE REPORTES ══════════════════ */}
      <Card className="border-border shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Bandeja de Reportes e Incidencias
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredReportes.length} {filteredReportes.length === 1 ? "reporte registrado" : "reportes registrados"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              Cargando bandeja de atención...
            </div>
          ) : filteredReportes.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
              <div className="text-sm font-semibold text-foreground">
                No hay reportes de clientes en este criterio de búsqueda
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Cuando los clientes generen incidencias o dudas desde su portal, aparecerán aquí de forma inmediata.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[110px] text-xs font-bold">Folio</TableHead>
                    <TableHead className="w-[130px] text-xs font-bold">Fecha / Hora</TableHead>
                    <TableHead className="min-w-[170px] text-xs font-bold">Servicio</TableHead>
                    <TableHead className="min-w-[140px] text-xs font-bold">Cliente</TableHead>
                    <TableHead className="min-w-[220px] text-xs font-bold">Asunto / Incidencia</TableHead>
                    <TableHead className="w-[100px] text-xs font-bold text-center">Prioridad</TableHead>
                    <TableHead className="w-[140px] text-xs font-bold text-center">Estado</TableHead>
                    <TableHead className="w-[120px] text-xs font-bold text-center">Respuesta</TableHead>
                    <TableHead className="w-[80px] text-xs font-bold text-right pr-4">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportes.map((rep) => {
                    const folio = rep.folio || rep.id;
                    const hasRespuesta = Boolean(rep.respuesta && rep.respuesta.trim());

                    return (
                      <TableRow key={rep.id || folio} className="hover:bg-muted/40 transition-colors">
                        {/* Folio */}
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {folio}
                        </TableCell>

                        {/* Fecha y Hora */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <div className="font-medium text-foreground">{rep.fecha || "Hoy"}</div>
                          <div className="text-[10px]">{rep.hora || ""}</div>
                        </TableCell>

                        {/* Servicio */}
                        <TableCell className="text-xs font-semibold text-foreground">
                          <div className="flex items-center gap-1.5 truncate max-w-[180px]" title={rep.servicio_nombre}>
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{rep.servicio_nombre || "Servicio no especificado"}</span>
                          </div>
                        </TableCell>

                        {/* Cliente */}
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="font-medium text-foreground truncate max-w-[140px]" title={rep.creado_por}>
                            {rep.creado_por || "Cliente"}
                          </div>
                          {rep.cliente_email && (
                            <div className="text-[10px] truncate max-w-[140px]" title={rep.cliente_email}>
                              {rep.cliente_email}
                            </div>
                          )}
                        </TableCell>

                        {/* Asunto y tipo */}
                        <TableCell className="text-xs">
                          <div className="font-bold text-foreground truncate max-w-[240px]" title={rep.titulo}>
                            {rep.titulo}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[240px]" title={rep.descripcion}>
                            {rep.descripcion}
                          </div>
                          <span className="inline-block text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                            📌 {rep.tipo || "Incidencia Operativa"}
                          </span>
                        </TableCell>

                        {/* Prioridad */}
                        <TableCell className="text-center">
                          {getBadgePrioridad(rep.prioridad)}
                        </TableCell>

                        {/* Estado */}
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="cursor-pointer focus:outline-none transition-transform hover:scale-105">
                                {getBadgeEstado(rep.estado)}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="text-xs">
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(rep, "Recibido")}>
                                🟡 Marcar Recibido
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(rep, "En Proceso")}>
                                🔵 Marcar En Proceso
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(rep, "Atendido")}>
                                🟢 Marcar Atendido / Resuelto
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(rep, "Descartado")}>
                                ⚪ Marcar Descartado
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>

                        {/* Respuesta */}
                        <TableCell className="text-center">
                          {hasRespuesta ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px]">
                              Respondido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 text-[10px]">
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenResponder(rep)}
                              className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 gap-1.5"
                              title="Ver Detalle y Responder"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Responder</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReporteToDelete(rep)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Eliminar Reporte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════ MODAL DE DETALLE Y RESPUESTA ══════════════════ */}
      {selectedReporte && (
        <Dialog open={!!selectedReporte} onOpenChange={(open) => !open && setSelectedReporte(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <Badge variant="outline" className="font-mono text-xs font-bold">
                  {selectedReporte.folio || selectedReporte.id}
                </Badge>
                {getBadgePrioridad(selectedReporte.prioridad)}
              </div>
              <DialogTitle className="text-lg font-bold text-foreground mt-1">
                {selectedReporte.titulo}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Reporte levantado el {selectedReporte.fecha || "recientemente"} {selectedReporte.hora ? `a las ${selectedReporte.hora} hrs` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Información del cliente y servicio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Servicio afectado:</span>
                  <span className="font-semibold text-foreground block mt-0.5">
                    {selectedReporte.servicio_nombre || "Servicio no especificado"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Reportado por:</span>
                  <span className="font-semibold text-foreground block mt-0.5">
                    {selectedReporte.creado_por || "Cliente"}
                  </span>
                  {selectedReporte.cliente_email && (
                    <span className="text-muted-foreground text-[10px] block">
                      {selectedReporte.cliente_email}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Tipo de Incidencia:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 block mt-0.5">
                    {selectedReporte.tipo || "Incidencia Operativa"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Estado actual:</span>
                  <span className="mt-0.5 block">{getBadgeEstado(selectedReporte.estado)}</span>
                </div>
              </div>

              {/* Descripción del cliente */}
              <div className="p-3 bg-card rounded-xl border border-border space-y-1">
                <span className="font-semibold text-foreground text-xs block">
                  Descripción enviada por el cliente:
                </span>
                <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedReporte.descripcion || "Sin descripción proporcionada."}
                </p>
              </div>

              {/* Formulario de Respuesta y Cambio de Estatus */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-foreground text-xs">
                    Respuesta de Operaciones SERCO
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Cambiar Estado a:</Label>
                    <Select
                      value={respuestaForm.estado}
                      onValueChange={(val) => setRespuestaForm({ ...respuestaForm, estado: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Recibido">🟡 Recibido (Sin iniciar)</SelectItem>
                        <SelectItem value="En Proceso">🔵 En Proceso (Atendiendo)</SelectItem>
                        <SelectItem value="Atendido">🟢 Atendido / Resuelto</SelectItem>
                        <SelectItem value="Descartado">⚪ Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedReporte.atendido_por && (
                    <div className="text-[11px] text-muted-foreground flex flex-col justify-center">
                      <span>Última atención por: <strong>{selectedReporte.atendido_por}</strong></span>
                      {selectedReporte.fecha_respuesta && (
                        <span className="text-[10px]">
                          {new Date(selectedReporte.fecha_respuesta).toLocaleString("es-MX")}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Mensaje de respuesta para el cliente:
                  </Label>
                  <Textarea
                    placeholder="Escribe la respuesta o acciones tomadas por SERCO para que el cliente lo visualice en su portal..."
                    value={respuestaForm.respuesta}
                    onChange={(e) => setRespuestaForm({ ...respuestaForm, respuesta: e.target.value })}
                    className="min-h-[100px] text-xs leading-relaxed"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Esta respuesta será visible para el cliente en su apartado de "Historial de Reportes".
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setReporteToDelete(selectedReporte)}
                disabled={savingRespuesta}
                className="gap-1.5 w-full sm:w-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Reporte
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReporte(null)}
                  disabled={savingRespuesta}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveRespuesta}
                  disabled={savingRespuesta}
                  className="bg-primary text-primary-foreground font-semibold gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {savingRespuesta ? "Guardando..." : "Guardar y Notificar al Cliente"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ══════════════════ DIÁLOGO DE CONFIRMACIÓN PARA ELIMINAR ══════════════════ */}
      {reporteToDelete && (
        <ConfirmDialog
          open={!!reporteToDelete}
          onOpenChange={(open) => !open && setReporteToDelete(null)}
          title="¿Eliminar reporte de cliente?"
          description={`¿Estás seguro de que deseas eliminar permanentemente el reporte ${
            reporteToDelete.folio || reporteToDelete.id
          }? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar Reporte"
          variant="destructive"
          onConfirm={handleDeleteReporte}
        />
      )}
    </div>
  );
}
