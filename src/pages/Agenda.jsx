import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { useSedeScope } from "@/hooks/useSedeScope";
import { sercoApi } from "@/api/sercoClient";
import { supabase } from "@/lib/supabaseClient";
import AccessRestricted from "@/components/AccessRestricted";
import { 
  Calendar as CalendarIcon, 
  CalendarDays, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Phone, 
  BookOpen, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Pencil, 
  Trash2, 
  List, 
  Grid,
  Building2,
  RotateCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatUserDisplayName } from "@/lib/userNameFormatting";

// Tipos de Eventos soportados
const EVENT_TYPES = {
  entrevista: {
    id: "entrevista",
    label: "Entrevista",
    color: "purple",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    dotClass: "bg-purple-500",
    icon: User,
  },
  visita_supervision: {
    id: "visita_supervision",
    label: "Visita de Supervisión",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    dotClass: "bg-blue-500",
    icon: Eye,
  },
  capacitacion: {
    id: "capacitacion",
    label: "Capacitación",
    color: "emerald",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
    icon: BookOpen,
  },
};

const emptyEventForm = {
  tipo: "entrevista", // entrevista | visita_supervision | capacitacion
  titulo: "",
  fecha: new Date().toISOString().slice(0, 10),
  hora_inicio: "09:00",
  hora_fin: "10:00",
  sede_id: "",
  servicio_id: "",
  servicio_nombre: "",
  responsable_id: "",
  responsable_nombre: "",
  // Entrevista
  candidato_nombre: "",
  candidato_telefono: "",
  puesto: "",
  // Visita
  objetivo_visita: "",
  turno: "matutino",
  // Capacitación
  tema_capacitacion: "",
  asistentes_estimados: "",
  // General
  estado: "programada", // programada | completada | cancelada
  notas: "",
};

export default function Agenda() {
  const { user } = useAuth();
  const { canView, can, isAdmin } = usePermissions();
  const { sedeFilter, defaultSedeId } = useSedeScope();

  if (!canView("agenda")) return <AccessRestricted />;

  // Detectar roles con restricciones específicas en Agenda
  const userRole = (user?.role || "").toLowerCase().trim();
  const isSupervisor = userRole === "supervisor";
  const isReclutador = userRole === "reclutador";
  const canCreate = can("agenda", "create");
  const canEdit = can("agenda", "edit");
  const canDelete = can("agenda", "delete");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Vistas y filtros
  const [viewMode, setViewMode] = useState("calendario"); // 'calendario' | 'lista'
  const [typeFilter, setTypeFilter] = useState("todos"); // 'todos' | 'entrevista' | 'visita_supervision' | 'capacitacion'
  const [statusFilter, setStatusFilter] = useState("todos"); // 'todos' | 'programada' | 'completada' | 'cancelada'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServiceFilter, setSelectedServiceFilter] = useState("todos");

  // Navegación de mes en Calendario
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Modal de Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyEventForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Modal de confirmación de eliminación
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, [sedeFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [seds, servs, users] = await Promise.all([
        sercoApi.entities.Sede.list().catch(() => []),
        sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
        sercoApi.entities.User.list().catch(() => [])
      ]);
      setSedes(seds || []);
      setServices(servs || []);
      setUsersList(users || []);

      // Cargar eventos (con persistencia híbrida: Supabase con fallback a localStorage)
      let loadedEvents = [];
      try {
        const { data: dbEvents, error: dbErr } = await supabase
          .from("agenda")
          .select("*")
          .order("fecha", { ascending: true });
        
        if (!dbErr && Array.isArray(dbEvents)) {
          loadedEvents = dbEvents;
        } else {
          const localStored = localStorage.getItem("serco_agenda_local_events");
          loadedEvents = localStored ? JSON.parse(localStored) : [];
        }
      } catch {
        const localStored = localStorage.getItem("serco_agenda_local_events");
        loadedEvents = localStored ? JSON.parse(localStored) : [];
      }

      setEvents(loadedEvents);
    } catch (err) {
      console.error("Error al cargar agenda:", err);
    } finally {
      setLoading(false);
    }
  }

  // Guardar evento (Supabase con fallback a localStorage)
  async function persistEvent(eventData, isEdit = false, eventId = null) {
    try {
      if (isEdit && eventId) {
        const { error } = await supabase
          .from("agenda")
          .update(eventData)
          .eq("id", eventId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agenda")
          .insert(eventData);
        if (error) throw error;
      }
    } catch (err) {
      console.warn("No se pudo guardar en Supabase (usando fallback local):", err?.message);
    }

    setEvents((prev) => {
      let updated;
      if (isEdit && eventId) {
        updated = prev.map((e) => (e.id === eventId ? { ...e, ...eventData } : e));
      } else {
        const newObj = {
          id: eventData.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...eventData,
          created_at: new Date().toISOString()
        };
        updated = [...prev, newObj];
      }
      try {
        localStorage.setItem("serco_agenda_local_events", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }

  async function removeEvent(eventId) {
    try {
      await supabase.from("agenda").delete().eq("id", eventId);
    } catch {
      // ignore
    }
    setEvents((prev) => {
      const updated = prev.filter((e) => e.id !== eventId);
      try {
        localStorage.setItem("serco_agenda_local_events", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }

  // Filtrado de Eventos
  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        // Supervisores solo ven visitas de supervisión
        if (isSupervisor && ev.tipo !== "visita_supervision") return false;
        // Reclutadores solo ven entrevistas (no supervisión ni capacitación)
        if (isReclutador && (ev.tipo === "visita_supervision" || ev.tipo === "capacitacion")) return false;

        if (sedeFilter?.sede_id && ev.sede_id && ev.sede_id !== sedeFilter.sede_id) {
          return false;
        }
        if (typeFilter !== "todos" && ev.tipo !== typeFilter) {
          return false;
        }
        if (statusFilter !== "todos" && ev.estado !== statusFilter) {
          return false;
        }
        if (selectedServiceFilter !== "todos" && ev.servicio_id !== selectedServiceFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (ev.titulo || "").toLowerCase().includes(q);
          const matchCandidate = (ev.candidato_nombre || "").toLowerCase().includes(q);
          const matchService = (ev.servicio_nombre || "").toLowerCase().includes(q);
          const matchResp = (ev.responsable_nombre || "").toLowerCase().includes(q);
          const matchTopic = (ev.tema_capacitacion || "").toLowerCase().includes(q);
          const matchPuesto = (ev.puesto || "").toLowerCase().includes(q);
          if (!matchTitle && !matchCandidate && !matchService && !matchResp && !matchTopic && !matchPuesto) {
            return false;
          }
        }
        return true;
      })
      // Ordenar cronológicamente: por fecha, luego por hora_inicio
      .sort((a, b) => {
        const dateA = `${a.fecha || ""}T${a.hora_inicio || "00:00"}`;
        const dateB = `${b.fecha || ""}T${b.hora_inicio || "00:00"}`;
        return dateA.localeCompare(dateB);
      });
  }, [events, sedeFilter, typeFilter, statusFilter, selectedServiceFilter, searchQuery, isSupervisor]);

  // Contadores de resumen
  const stats = useMemo(() => {
    const total = filteredEvents.length;
    const entrevistas = filteredEvents.filter((e) => e.tipo === "entrevista").length;
    const visitas = filteredEvents.filter((e) => e.tipo === "visita_supervision").length;
    const capacitaciones = filteredEvents.filter((e) => e.tipo === "capacitacion").length;
    const completadas = filteredEvents.filter((e) => e.estado === "completada").length;
    const pendientes = filteredEvents.filter((e) => e.estado === "programada").length;
    return { total, entrevistas, visitas, capacitaciones, completadas, pendientes };
  }, [filteredEvents]);

  // Navegación de mes
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generador de días del mes para el calendario
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const adjustedFirstDay = (firstDayIndex + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Días del mes anterior
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: true });
    }

    // Días del siguiente mes para completar 35 o 42 casillas (múltiplo de 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Abrir modal para crear
  const openCreate = (defaultDate = null) => {
    setEditingEvent(null);
    setFormError("");
    setForm({
      ...emptyEventForm,
      // Supervisores solo pueden crear visitas de supervisión, reclutadores solo entrevistas
      tipo: isSupervisor ? "visita_supervision" : isReclutador ? "entrevista" : emptyEventForm.tipo,
      fecha: defaultDate || new Date().toISOString().slice(0, 10),
      sede_id: defaultSedeId || "",
      responsable_id: user?.id || "",
      responsable_nombre: user?.full_name || "",
    });
    setModalOpen(true);
  };

  // Abrir modal para editar o ver detalles
  const openEdit = (ev, e) => {
    e?.stopPropagation?.();
    setEditingEvent(ev);
    setFormError("");
    setForm({
      ...emptyEventForm,
      ...ev,
    });
    setModalOpen(true);
  };

  // Guardar evento
  async function handleSave() {
    setFormError("");
    if (!form.fecha) {
      setFormError("La fecha del evento es obligatoria.");
      return;
    }

    let autoTitle = form.titulo?.trim();
    if (!autoTitle) {
      if (form.tipo === "entrevista") {
        autoTitle = `Entrevista: ${form.candidato_nombre || "Candidato"} ${form.puesto ? `(${form.puesto})` : ""}`;
      } else if (form.tipo === "visita_supervision") {
        autoTitle = `Visita a ${form.servicio_nombre || "Servicio"} (${form.turno || "General"})`;
      } else if (form.tipo === "capacitacion") {
        autoTitle = `Capacitación: ${form.tema_capacitacion || "General"} en ${form.servicio_nombre || "Servicio"}`;
      }
    }

    if (isSupervisor && form.tipo !== "visita_supervision") {
      setFormError("Como supervisor solo puedes agendar visitas de supervisión.");
      return;
    }

    if (isReclutador && form.tipo !== "entrevista") {
      setFormError("Como reclutador solo puedes agendar entrevistas.");
      return;
    }

    if (form.tipo === "entrevista" && !form.candidato_nombre?.trim()) {
      setFormError("Por favor ingresa el nombre del candidato.");
      return;
    }
    if ((form.tipo === "visita_supervision" || form.tipo === "capacitacion") && !form.servicio_id) {
      setFormError("Por favor selecciona el servicio correspondiente.");
      return;
    }

    setSaving(true);
    try {
      const serv = services.find((s) => s.id === form.servicio_id);
      const resp = usersList.find((u) => u.id === form.responsable_id);

      const payload = {
        tipo: form.tipo,
        titulo: autoTitle,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio || "09:00",
        hora_fin: form.tipo === "entrevista" ? null : (form.hora_fin || null),
        sede_id: form.sede_id || defaultSedeId || null,
        servicio_id: form.servicio_id || null,
        servicio_nombre: serv?.nombre || form.servicio_nombre || null,
        responsable_id: form.responsable_id || null,
        responsable_nombre: resp?.full_name || resp?.usuario || form.responsable_nombre || user?.full_name || null,
        candidato_nombre: form.candidato_nombre || null,
        candidato_telefono: form.candidato_telefono || null,
        puesto: form.puesto || null,
        objetivo_visita: form.objetivo_visita || null,
        turno: form.turno || null,
        tema_capacitacion: form.tema_capacitacion || null,
        asistentes_estimados: form.asistentes_estimados || null,
        estado: form.estado || "programada",
        notas: form.notas || null,
        creado_por: user?.full_name || user?.email || "Usuario",
        updated_at: new Date().toISOString(),
      };

      await persistEvent(payload, !!editingEvent, editingEvent?.id);
      toast({
        title: editingEvent ? "Evento actualizado" : "Evento agendado con éxito",
        description: `${autoTitle} (${form.fecha})`,
      });
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setFormError("Ocurrió un error al guardar el evento.");
    } finally {
      setSaving(false);
    }
  }

  // Cambiar estado rápido
  async function handleToggleStatus(ev, nextStatus, e) {
    e?.stopPropagation?.();
    try {
      await persistEvent({ ...ev, estado: nextStatus, updated_at: new Date().toISOString() }, true, ev.id);
      toast({
        title: nextStatus === "completada" ? "Evento marcado como Realizado" : "Estado actualizado",
      });
    } catch (err) {
      console.error(err);
    }
  }

  const monthName = currentDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-primary" />
            Agenda y Calendario Operativo
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Coordinación de entrevistas de RH, visitas de supervisores y capacitaciones a servicios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de Vista (Calendario / Lista) */}
          <div className="bg-muted p-1 rounded-lg border flex items-center gap-1">
            <Button
              variant={viewMode === "calendario" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs flex items-center gap-1.5"
              onClick={() => setViewMode("calendario")}
            >
              <Grid className="w-3.5 h-3.5" />
              Mes
            </Button>
            <Button
              variant={viewMode === "lista" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs flex items-center gap-1.5"
              onClick={() => setViewMode("lista")}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </Button>
          </div>

          {canCreate && (
            <Button onClick={() => openCreate()} className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
              <Plus className="w-4 h-4" />
              {isSupervisor ? "Agendar Supervisión" : "Agendar Evento"}
            </Button>
          )}
        </div>
      </div>

      {/* TARJETAS DE RESUMEN RÁPIDO */}
      {isSupervisor ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setTypeFilter("visita_supervision")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.visitas}</div>
                <p className="text-xs text-muted-foreground font-medium">Visitas de Supervisión</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setTypeFilter("todos")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.total}</div>
                <p className="text-xs text-muted-foreground font-medium">Total de Visitas Asignadas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="cursor-pointer hover:border-purple-300 transition-colors" onClick={() => setTypeFilter("entrevista")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.entrevistas}</div>
                <p className="text-xs text-muted-foreground font-medium">Entrevistas (RH)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setTypeFilter("visita_supervision")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.visitas}</div>
                <p className="text-xs text-muted-foreground font-medium">Visitas Supervisión</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-emerald-300 transition-colors" onClick={() => setTypeFilter("capacitacion")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.capacitaciones}</div>
                <p className="text-xs text-muted-foreground font-medium">Capacitaciones</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setTypeFilter("todos")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.total}</div>
                <p className="text-xs text-muted-foreground font-medium">Total de Eventos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <Card>
        <CardContent className="p-3.5">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar candidato, servicio, supervisor, tema..."
                className="pl-9 h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro Tipo - oculto para supervisor y reclutador porque tienen tipo exclusivo */}
              {!isSupervisor && !isReclutador && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 text-xs w-[170px]">
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los Tipos</SelectItem>
                    <SelectItem value="entrevista">🟣 Entrevistas</SelectItem>
                    <SelectItem value="visita_supervision">🔵 Visitas Supervisión</SelectItem>
                    <SelectItem value="capacitacion">🟢 Capacitaciones</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Filtro Servicio */}
              <Select value={selectedServiceFilter} onValueChange={setSelectedServiceFilter}>
                <SelectTrigger className="h-9 text-xs w-[170px]">
                  <SelectValue placeholder="Servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Servicios</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro Estado */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Estados</SelectItem>
                  <SelectItem value="programada">Programadas</SelectItem>
                  <SelectItem value="completada">Completadas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>

              {(typeFilter !== "todos" || statusFilter !== "todos" || selectedServiceFilter !== "todos" || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setTypeFilter("todos");
                    setStatusFilter("todos");
                    setSelectedServiceFilter("todos");
                    setSearchQuery("");
                  }}
                  title="Restablecer filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VISTA 1: CALENDARIO MENSUAL */}
      {viewMode === "calendario" && (
        <Card className="overflow-hidden">
          {/* Navegación del Calendario */}
          <div className="p-4 border-b flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold capitalize text-foreground">{monthName}</h3>
              <Button variant="outline" size="sm" className="h-7 text-xs ml-2" onClick={handleToday}>
                Hoy
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth} title="Mes anterior">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth} title="Siguiente mes">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground py-2">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>

          {/* Cuadrícula de días */}
          <div className="grid grid-cols-7 divide-x divide-y auto-rows-fr min-h-[550px] bg-background">
            {calendarDays.map((item, idx) => {
              const dayEvents = filteredEvents.filter((e) => e.fecha === item.dateStr);
              const isToday = item.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  onClick={() => canCreate && openCreate(item.dateStr)}
                  className={`group relative p-1.5 flex flex-col min-h-[95px] transition-colors ${
                    canCreate ? "cursor-pointer" : "cursor-default"
                  } ${
                    item.isCurrentMonth ? "bg-card hover:bg-muted/30" : "bg-muted/10 text-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center ${
                        isToday
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : item.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {item.dayNumber}
                    </span>
                    {item.isCurrentMonth && canCreate && (
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-primary transition-opacity font-medium">
                        +
                      </span>
                    )}
                  </div>

                  {/* Pastillas de eventos en el día */}
                  <div className="space-y-1 overflow-y-auto max-h-[80px] pr-0.5">
                    {dayEvents.map((ev) => {
                      const typeConfig = EVENT_TYPES[ev.tipo] || EVENT_TYPES.entrevista;
                      const IconComp = typeConfig.icon;

                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => openEdit(ev, e)}
                          title={`${ev.hora_inicio || ""}${ev.tipo !== "entrevista" && ev.hora_fin ? ` - ${ev.hora_fin}` : ""} · ${ev.titulo}\nResponsable: ${ev.responsable_nombre || "Sin asignar"}`}
                          className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border truncate cursor-pointer shadow-2xs hover:brightness-95 transition-all ${
                            typeConfig.badgeClass
                          } ${ev.estado === "completada" ? "opacity-60 line-through" : ""}`}
                        >
                          <IconComp className="w-3 h-3 shrink-0" />
                          <span className="font-semibold shrink-0 text-[10px]">{ev.hora_inicio || ""}</span>
                          <span className="truncate">{ev.titulo}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* VISTA 2: LISTA / CRONOLOGÍA */}
      {viewMode === "lista" && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold">Listado Cronológico de Eventos</CardTitle>
            <CardDescription className="text-xs">
              Mostrando {filteredEvents.length} evento(s) ordenados por fecha y hora
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Cargando eventos...</p>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <CalendarIcon className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-semibold text-foreground">No hay eventos en esta selección</p>
                <p className="text-xs text-muted-foreground">Prueba ajustando los filtros o agenda un nuevo evento.</p>
                {canCreate && (
                  <Button size="sm" variant="outline" onClick={() => openCreate()} className="mt-2 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> {isSupervisor ? "Agendar supervisión" : "Agendar ahora"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((ev) => {
                  const typeConfig = EVENT_TYPES[ev.tipo] || EVENT_TYPES.entrevista;
                  const IconComp = typeConfig.icon;
                  const isDone = ev.estado === "completada";

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => openEdit(ev, e)}
                      className={`p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 cursor-pointer shadow-xs ${
                        ev.tipo === "entrevista"
                          ? "border-l-purple-500"
                          : ev.tipo === "visita_supervision"
                          ? "border-l-blue-500"
                          : "border-l-emerald-500"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${typeConfig.badgeClass}`}>
                            <IconComp className="w-3 h-3" />
                            {typeConfig.label}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            {ev.fecha} · {ev.hora_inicio || "09:00"}{ev.tipo !== "entrevista" && ev.hora_fin ? ` - ${ev.hora_fin}` : ""}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              ev.estado === "completada"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : ev.estado === "cancelada"
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {ev.estado}
                          </span>
                        </div>

                        <h4 className={`text-sm font-bold text-foreground truncate ${isDone ? "line-through opacity-70" : ""}`}>
                          {ev.titulo}
                        </h4>

                        {/* Detalles específicos del tipo */}
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-y-1 gap-x-3">
                          {ev.tipo === "entrevista" && (
                            <>
                              {ev.candidato_nombre && (
                                <span className="font-medium text-foreground">
                                  Candidato: <strong>{ev.candidato_nombre}</strong>
                                </span>
                              )}
                              {ev.candidato_telefono && (
                                <span className="flex items-center gap-1 text-primary">
                                  <Phone className="w-3 h-3" /> {ev.candidato_telefono}
                                </span>
                              )}
                              {ev.puesto && <span>Puesto: {ev.puesto}</span>}
                            </>
                          )}

                          {ev.tipo === "visita_supervision" && (
                            <>
                              {ev.servicio_nombre && (
                                <span className="font-medium text-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-primary" /> {ev.servicio_nombre}
                                </span>
                              )}
                              {ev.turno && <span>Turno: <strong className="capitalize">{ev.turno}</strong></span>}
                              {ev.objetivo_visita && <span className="italic">Obj: {ev.objetivo_visita}</span>}
                            </>
                          )}

                          {ev.tipo === "capacitacion" && (
                            <>
                              {ev.servicio_nombre && (
                                <span className="font-medium text-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-primary" /> {ev.servicio_nombre}
                                </span>
                              )}
                              {ev.tema_capacitacion && (
                                <span>Tema: <strong>{ev.tema_capacitacion}</strong></span>
                              )}
                              {ev.asistentes_estimados && <span>Cupo: {ev.asistentes_estimados} pers.</span>}
                            </>
                          )}

                          {ev.responsable_nombre && (
                            <span className="text-muted-foreground border-l pl-2">
                              Responsable: <strong className="text-foreground">{ev.responsable_nombre}</strong>
                            </span>
                          )}
                        </div>

                        {ev.notas && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 italic bg-muted/40 p-1.5 rounded">
                            Nota: {ev.notas}
                          </p>
                        )}
                      </div>

                      {/* Botones de acción rápida */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          ev.estado === "programada" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={(e) => handleToggleStatus(ev, "completada", e)}
                              title="Marcar como realizada"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Realizada
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground"
                              onClick={(e) => handleToggleStatus(ev, "programada", e)}
                              title="Reabrir / Programar"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir
                            </Button>
                          )
                        )}

                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={(e) => openEdit(ev, e)}
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(ev.id);
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL DE CREAR / EDITAR EVENTO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {editingEvent ? (canEdit ? "Editar Cita / Evento" : "Detalles del Evento") : "Agendar Nuevo Evento"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Completa los datos del evento según el área operativa correspondiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Selector de Tipo de Evento */}
            <div>
              <Label className="text-xs font-semibold">Tipo de Evento *</Label>
              {isSupervisor ? (
                <div className="mt-1.5">
                  <div className="p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 bg-blue-100 text-blue-900 border-blue-500 shadow-xs dark:bg-blue-950 dark:text-blue-200">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>Visita de Supervisión (Operativa)</span>
                  </div>
                </div>
              ) : isReclutador ? (
                <div className="mt-1.5">
                  <div className="p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 bg-purple-100 text-purple-900 border-purple-500 shadow-xs dark:bg-purple-950 dark:text-purple-200">
                    <User className="w-4 h-4 text-purple-600" />
                    <span>Entrevista (Reclutamiento / RH)</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, tipo: "entrevista" })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      form.tipo === "entrevista"
                        ? "bg-purple-100 text-purple-900 border-purple-500 shadow-xs dark:bg-purple-950 dark:text-purple-200"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <User className="w-4 h-4 text-purple-600" />
                    <span>Entrevista (RH)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, tipo: "visita_supervision" })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      form.tipo === "visita_supervision"
                        ? "bg-blue-100 text-blue-900 border-blue-500 shadow-xs dark:bg-blue-950 dark:text-blue-200"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>Visita Supervisión</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, tipo: "capacitacion" })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      form.tipo === "capacitacion"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-500 shadow-xs dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Capacitación</span>
                  </button>
                </div>
              )}
            </div>

            {/* CAMPOS ESPECÍFICOS SEGÚN EL TIPO */}

            {/* 1. ENTREVISTA */}
            {form.tipo === "entrevista" && (
              <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200/70 space-y-3">
                <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-600" /> Datos del Candidato
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nombre del Candidato *</Label>
                    <Input
                      placeholder="Ej. Juan Pérez Garza"
                      value={form.candidato_nombre || ""}
                      onChange={(e) => setForm({ ...form, candidato_nombre: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Teléfono de Contacto</Label>
                    <Input
                      placeholder="Ej. 811 234 5678"
                      value={form.candidato_telefono || ""}
                      onChange={(e) => setForm({ ...form, candidato_telefono: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Puesto al que Aspira</Label>
                    <Input
                      placeholder="Ej. Guardia de Seguridad, Monitorista, Chofer..."
                      value={form.puesto || ""}
                      onChange={(e) => setForm({ ...form, puesto: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. VISITA DE SUPERVISIÓN */}
            {form.tipo === "visita_supervision" && (
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/70 space-y-3">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-600" /> Datos de la Visita al Servicio
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Servicio a Visitar *</Label>
                    <Select
                      value={form.servicio_id}
                      onValueChange={(val) => {
                        const s = services.find((x) => x.id === val);
                        setForm({ ...form, servicio_id: val, servicio_nombre: s?.nombre || "" });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Selecciona el servicio..." />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Turno de Visita</Label>
                    <Select
                      value={form.turno}
                      onValueChange={(val) => setForm({ ...form, turno: val })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Turno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matutino">Matutino</SelectItem>
                        <SelectItem value="vespertino">Vespertino</SelectItem>
                        <SelectItem value="nocturno">Nocturno</SelectItem>
                        <SelectItem value="mixto">Mixto / General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Objetivo de la Visita</Label>
                    <Input
                      placeholder="Ej. Pase de lista, entrega de insumos, auditoría..."
                      value={form.objetivo_visita || ""}
                      onChange={(e) => setForm({ ...form, objetivo_visita: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. CAPACITACIÓN */}
            {form.tipo === "capacitacion" && (
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/70 space-y-3">
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Datos de la Capacitación
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Servicio o Ubicación *</Label>
                    <Select
                      value={form.servicio_id}
                      onValueChange={(val) => {
                        const s = services.find((x) => x.id === val);
                        setForm({ ...form, servicio_id: val, servicio_nombre: s?.nombre || "" });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Selecciona servicio / ubicación..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oficina">🏢 Oficinas Centrales SERCO</SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Tema / Curso de Capacitación *</Label>
                    <Input
                      placeholder="Ej. Consignas generales, Primeros auxilios, Rondas..."
                      value={form.tema_capacitacion || ""}
                      onChange={(e) => setForm({ ...form, tema_capacitacion: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Asistentes Estimados</Label>
                    <Input
                      placeholder="Ej. 6 guardias"
                      value={form.asistentes_estimados || ""}
                      onChange={(e) => setForm({ ...form, asistentes_estimados: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* FECHA Y HORARIOS (Sin hora final para entrevistas) */}
            {form.tipo === "entrevista" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fecha de la Entrevista *</Label>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Hora de la Cita *</Label>
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Fecha del Evento *</Label>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Hora Inicio *</Label>
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Hora Fin (Opcional)</Label>
                  <Input
                    type="time"
                    value={form.hora_fin || ""}
                    onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            )}

            {/* RESPONSABLE Y ESTADO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Responsable Asignado</Label>
                <Select
                  value={form.responsable_id || "none"}
                  onValueChange={(val) => {
                    if (val === "none") {
                      setForm({ ...form, responsable_id: "", responsable_nombre: "" });
                    } else {
                      const u = usersList.find((x) => x.id === val);
                      setForm({ ...form, responsable_id: val, responsable_nombre: u?.full_name || u?.usuario || "" });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Selecciona responsable..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {usersList.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {formatUserDisplayName(u.full_name || u.usuario, u.role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Estado de la Cita</Label>
                <Select
                  value={form.estado}
                  onValueChange={(val) => setForm({ ...form, estado: val })}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programada">🟡 Programada</SelectItem>
                    <SelectItem value="completada">🟢 Realizada / Completada</SelectItem>
                    <SelectItem value="cancelada">🔴 Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* NOTAS Y OBSERVACIONES */}
            <div>
              <Label className="text-xs">Notas u Observaciones Adicionales</Label>
              <Textarea
                rows={2}
                placeholder="Detalles importantes, instrucciones de acceso, consignas..."
                value={form.notas || ""}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>
              {editingEvent && !canEdit ? "Cerrar" : "Cancelar"}
            </Button>
            {(!editingEvent || canEdit) && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 font-semibold">
                {saving ? "Guardando..." : editingEvent ? "Guardar Cambios" : "Agendar Evento"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="¿Eliminar evento de la agenda?"
        description="Esta acción eliminará el registro de la agenda. Esta acción no se puede deshacer."
        onConfirm={async () => {
          if (deleteConfirmId) {
            await removeEvent(deleteConfirmId);
            setDeleteConfirmId(null);
            toast({ title: "Evento eliminado de la agenda" });
          }
        }}
      />
    </div>
  );
}
