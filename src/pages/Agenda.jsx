import { useSearchParams } from "react-router-dom";
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
  RotateCcw,
  AlertTriangle,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Maximize2,
  Download,
  Loader2,
  DollarSign,
  Users,
  MapPin,
  Link as LinkIcon
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

// Tipos de Eventos soportados en la Agenda SERCO
const EVENT_TYPES = {
  entrevista: {
    id: "entrevista",
    label: "Entrevista",
    color: "purple",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    dotClass: "bg-purple-500",
    borderLeftClass: "border-l-purple-500",
    icon: User,
  },
  visita_supervision: {
    id: "visita_supervision",
    label: "Visita de Supervisión",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    dotClass: "bg-blue-500",
    borderLeftClass: "border-l-blue-500",
    icon: Eye,
  },
  capacitacion: {
    id: "capacitacion",
    label: "Capacitación",
    color: "emerald",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
    borderLeftClass: "border-l-emerald-500",
    icon: BookOpen,
  },
  reporte: {
    id: "reporte",
    label: "Reporte Operativo",
    color: "amber",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dotClass: "bg-amber-500",
    borderLeftClass: "border-l-amber-500",
    icon: AlertTriangle,
  },
  reunion: {
    id: "reunion",
    label: "Reunión",
    color: "indigo",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    dotClass: "bg-indigo-500",
    borderLeftClass: "border-l-indigo-500",
    icon: Users,
  },
  inauguracion: {
    id: "inauguracion",
    label: "Inauguración de Servicio",
    color: "teal",
    badgeClass: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
    dotClass: "bg-teal-500",
    borderLeftClass: "border-l-teal-500",
    icon: Building2,
  },
  limite_pago: {
    id: "limite_pago",
    label: "Límite de Pago",
    color: "rose",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    dotClass: "bg-rose-500",
    borderLeftClass: "border-l-rose-500",
    icon: DollarSign,
  },
};

/**
 * Compresión ultra-eficiente de fotografías de evidencia en el cliente antes de guardar.
 * Mantiene alta nitidez (1200px) pero reduce el peso a ~40-80 KB en WebP/JPEG.
 */
async function compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Error al procesar la imagen"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const emptyEventForm = {
  tipo: "entrevista", // entrevista | visita_supervision | capacitacion | reporte | reunion | inauguracion | limite_pago
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
  // Reporte
  tipo_reporte: "Incidencia Operativa",
  descripcion_reporte: "",
  // Reunión
  tema_reunion: "",
  participantes_reunion: "",
  lugar_reunion: "",
  enlace_reunion: "",
  // Inauguración de Servicio
  fecha_arranque: "",
  elementos_requeridos: "",
  detalles_inauguracion: "",
  // Límite de Pago
  monto: "",
  mes: "",
  estado_cobro: "",
  is_system_cobro: false,
  // Evidencias fotográficas (Capacitación y Reporte)
  fotos_evidencia: [],
  // General
  estado: "programada", // programada | completada | cancelada
  notas: "",
};

export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { canView, can } = usePermissions();
  const { sedeFilter, defaultSedeId } = useSedeScope();

  const userRole = (user?.role || "").toLowerCase().trim();

  const isFinanzas = useMemo(() => {
    return userRole.includes("finanz") || userRole === "director de finanzas" || userRole === "director finanzas";
  }, [userRole]);

  const isExecutive = useMemo(() => {
    return (
      userRole === "admin" ||
      userRole === "administrador" ||
      userRole === "super administrador" ||
      userRole === "ceo" ||
      userRole === "director" ||
      userRole === "director general" ||
      userRole === "director_general" ||
      userRole.includes("director general") ||
      userRole === "gerente general"
    );
  }, [userRole]);

  if (!canView("agenda") && !isFinanzas && !isExecutive) return <AccessRestricted />;

  /**
   * Permisos de vista por Rol estrictos solicitados:
   * - Finanzas y Director de Finanzas: SOLO fechas de límite de pago de los servicios.
   * - ADMIN, CEO y Director: Pueden ver TODAS las actividades (incluyendo límites de pago, reuniones e inauguraciones).
   * - Director de RH y RH: Entrevistas y Capacitaciones.
   * - Reclutador: Solo Entrevistas.
   * - Capacitador: Solo Capacitaciones.
   * - Director de Supervisor y Supervisor: Supervisiones y Reportes.
   * - Monitoreo / Monitorista: Solo Reportes.
   */
  const allowedEventTypes = useMemo(() => {
    // 1. Finanzas y Director de Finanzas: sólo fechas de límite de pago de los servicios
    if (isFinanzas) {
      return ["limite_pago"];
    }

    // 2. ADMIN, CEO y Director: acceso a todas las actividades
    if (isExecutive) {
      return ["entrevista", "visita_supervision", "capacitacion", "reporte", "reunion", "inauguracion", "limite_pago"];
    }

    // 3. Reclutador: solo entrevistas
    if (userRole.includes("reclutador") || userRole.includes("reclutamiento")) {
      return ["entrevista"];
    }

    // 4. Capacitador: solo capacitaciones
    if (userRole.includes("capacitador") || (userRole.includes("capacitacion") && !userRole.includes("director"))) {
      return ["capacitacion"];
    }

    // 5. Director de RH y RH: entrevistas y capacitaciones
    if (
      userRole === "rh" ||
      userRole === "recursos humanos" ||
      userRole.includes("director de recursos humanos") ||
      userRole.includes("director de rh") ||
      userRole.includes("director rh") ||
      userRole.includes("recursos humanos")
    ) {
      return ["entrevista", "capacitacion"];
    }

    // 6. Director de Supervisiones y Supervisor: supervisiones y reportes
    if (
      userRole.includes("supervisor") ||
      userRole.includes("supervision") ||
      userRole.includes("supervisión")
    ) {
      return ["visita_supervision", "reporte"];
    }

    // 7. Monitoreo / Monitorista: solo reportes
    if (userRole.includes("monitoreo") || userRole.includes("monitorista")) {
      return ["reporte"];
    }

    // Por defecto para cualquier otro usuario autorizado
    return ["entrevista", "visita_supervision", "capacitacion", "reporte"];
  }, [userRole, isFinanzas, isExecutive]);

  const canCreate = !isFinanzas && (can("agenda", "create") || isExecutive);
  const canEdit = can("agenda", "edit") || isExecutive;
  const canDelete = can("agenda", "delete") || isExecutive;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Vistas y filtros
  const [viewMode, setViewMode] = useState("calendario"); // 'calendario' | 'lista'
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos"); // 'todos' | 'programada' | 'completada' | 'cancelada'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServiceFilter, setSelectedServiceFilter] = useState("todos");

  // Navegación de mes en Calendario
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [listScopeAll, setListScopeAll] = useState(false); // false = solo mes actual, true = todo el historial

  // Modal de Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyEventForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Manejo de fotografías y lightbox
  const [compressingPhotos, setCompressingPhotos] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  // Modal de confirmación de eliminación
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Ajustar filtro si el tipo seleccionado no está permitido para el usuario
  useEffect(() => {
    if (typeFilter !== "todos" && !allowedEventTypes.includes(typeFilter)) {
      setTypeFilter("todos");
    }
  }, [allowedEventTypes, typeFilter]);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, [sedeFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [seds, servs, users, cobrosList] = await Promise.all([
        sercoApi.entities.Sede.list().catch(() => []),
        sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
        sercoApi.entities.User.list().catch(() => []),
        sercoApi.entities.Cobro.filter(sedeFilter).catch(() => []),
      ]);
      setSedes(seds || []);
      setServices(servs || []);
      setUsersList(users || []);

      const { data: loadedEvents, error: eventsError } = await supabase
        .from("agenda")
        .select("*")
        .order("fecha", { ascending: true });
      if (eventsError) throw eventsError;

      // Generar eventos de fechas límite de pago de servicios a partir de cobros
      const paymentDeadlineEvents = (cobrosList || [])
        .filter((c) => c && c.fecha_limite_pago)
        .map((c) => {
          const isPagado = (c.estado || "").toLowerCase() === "pagado";
          const montoNum = Number(c.monto || 0);
          const montoFormatted = montoNum.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
          return {
            id: `cobro_limite_${c.id}`,
            cobro_id: c.id,
            tipo: "limite_pago",
            titulo: `Límite Pago: ${c.servicio_nombre || "Servicio"} (${montoFormatted})`,
            fecha: c.fecha_limite_pago,
            hora_inicio: "18:00",
            hora_fin: null,
            sede_id: c.sede_id || null,
            servicio_id: c.servicio_id || null,
            servicio_nombre: c.servicio_nombre || "Servicio",
            monto: c.monto,
            mes: c.mes,
            estado_cobro: c.estado || "pendiente",
            estado: isPagado ? "completada" : "programada",
            notas: `Límite de pago para ${c.servicio_nombre || "Servicio"} · Periodo: ${c.mes || "N/A"} · Monto: ${montoFormatted} · Estatus: ${c.estado || "pendiente"}`,
            is_system_cobro: true,
          };
        });

      setEvents([...loadedEvents, ...paymentDeadlineEvents]);
    } catch (err) {
      console.error("Error al cargar agenda:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  // Guardar evento en Supabase; solo actualizar la interfaz tras confirmación.
  async function persistEvent(eventData, isEdit = false, eventId = null) {
    const query = isEdit && eventId
      ? supabase.from("agenda").update(eventData).eq("id", eventId)
      : supabase.from("agenda").insert(eventData);
    const { data, error } = await query.select().maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Supabase no devolvió el evento guardado.");

    setEvents((prev) => {
      if (isEdit && eventId) {
        return prev.map((event) => event.id === eventId ? { ...event, ...data } : event);
      }
      return [...prev, data];
    });
    return data;
  }

  async function removeEvent(eventId) {
    const { error } = await supabase.from("agenda").delete().eq("id", eventId);
    if (error) throw error;
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  }

  // Filtrado de Eventos respetando rigurosamente los permisos por Rol
  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        // 1. Verificación de permisos por rol: sólo se muestran los tipos permitidos
        if (!allowedEventTypes.includes(ev.tipo)) return false;

        // 2. Filtro de Sede
        if (sedeFilter?.sede_id && ev.sede_id && ev.sede_id !== sedeFilter.sede_id) {
          return false;
        }

        // 3. Filtro por tipo específico seleccionado
        if (typeFilter !== "todos" && ev.tipo !== typeFilter) {
          return false;
        }

        // 4. Filtro por estado
        if (statusFilter !== "todos" && ev.estado !== statusFilter) {
          return false;
        }

        // 5. Filtro por servicio
        if (selectedServiceFilter !== "todos" && ev.servicio_id !== selectedServiceFilter) {
          return false;
        }

        // 6. Búsqueda por texto libre
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (ev.titulo || "").toLowerCase().includes(q);
          const matchCandidate = (ev.candidato_nombre || "").toLowerCase().includes(q);
          const matchService = (ev.servicio_nombre || "").toLowerCase().includes(q);
          const matchResp = (ev.responsable_nombre || "").toLowerCase().includes(q);
          const matchTopic = (ev.tema_capacitacion || "").toLowerCase().includes(q);
          const matchPuesto = (ev.puesto || "").toLowerCase().includes(q);
          const matchReportType = (ev.tipo_reporte || "").toLowerCase().includes(q);
          const matchReportDesc = (ev.descripcion_reporte || "").toLowerCase().includes(q);
          const matchNotes = (ev.notas || "").toLowerCase().includes(q);
          const matchReunionTema = (ev.tema_reunion || "").toLowerCase().includes(q);
          const matchReunionPart = (ev.participantes_reunion || "").toLowerCase().includes(q);
          const matchReunionLugar = (ev.lugar_reunion || "").toLowerCase().includes(q);
          const matchInaugElem = (ev.elementos_requeridos || "").toLowerCase().includes(q);
          const matchInaugDet = (ev.detalles_inauguracion || "").toLowerCase().includes(q);
          const matchMes = (ev.mes || "").toLowerCase().includes(q);

          if (
            !matchTitle && 
            !matchCandidate && 
            !matchService && 
            !matchResp && 
            !matchTopic && 
            !matchPuesto && 
            !matchReportType && 
            !matchReportDesc && 
            !matchNotes &&
            !matchReunionTema &&
            !matchReunionPart &&
            !matchReunionLugar &&
            !matchInaugElem &&
            !matchInaugDet &&
            !matchMes
          ) {
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
  }, [events, allowedEventTypes, sedeFilter, typeFilter, statusFilter, selectedServiceFilter, searchQuery]);

  // Clave del mes actual en formato "YYYY-MM"
  const currentMonthKey = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [currentDate]);

  // Eventos filtrados para el mes seleccionado
  const monthFilteredEvents = useMemo(() => {
    return filteredEvents.filter((e) => (e.fecha || "").startsWith(currentMonthKey));
  }, [filteredEvents, currentMonthKey]);

  // Eventos para la vista de lista según el alcance (mes actual o todo el historial)
  const displayedListEvents = useMemo(() => {
    return listScopeAll ? filteredEvents : monthFilteredEvents;
  }, [listScopeAll, filteredEvents, monthFilteredEvents]);

  // Contadores de resumen dinámicos según los tipos permitidos, calculados EXCLUSIVAMENTE para el mes seleccionado
  const stats = useMemo(() => {
    const total = monthFilteredEvents.length;
    const entrevistas = monthFilteredEvents.filter((e) => e.tipo === "entrevista").length;
    const visitas = monthFilteredEvents.filter((e) => e.tipo === "visita_supervision").length;
    const capacitaciones = monthFilteredEvents.filter((e) => e.tipo === "capacitacion").length;
    const reportes = monthFilteredEvents.filter((e) => e.tipo === "reporte").length;
    const reuniones = monthFilteredEvents.filter((e) => e.tipo === "reunion").length;
    const inauguraciones = monthFilteredEvents.filter((e) => e.tipo === "inauguracion").length;
    const limitesPago = monthFilteredEvents.filter((e) => e.tipo === "limite_pago").length;
    const completadas = monthFilteredEvents.filter((e) => e.estado === "completada").length;
    const pendientes = monthFilteredEvents.filter((e) => e.estado === "programada").length;
    return { 
      total, 
      entrevistas, 
      visitas, 
      capacitaciones, 
      reportes, 
      reuniones, 
      inauguraciones, 
      limitesPago, 
      completadas, 
      pendientes 
    };
  }, [monthFilteredEvents]);

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

  // Manejador de selección de fotos de evidencia
  const handleEvidencePhotosUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCompressingPhotos(true);
    try {
      const newUrls = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImageFile(file, 1200, 1200, 0.75);
        newUrls.push(compressed);
      }
      setForm((prev) => ({
        ...prev,
        fotos_evidencia: [...(Array.isArray(prev.fotos_evidencia) ? prev.fotos_evidencia : []), ...newUrls],
      }));
      toast({
        title: "Fotografías cargadas",
        description: `Se agregaron ${newUrls.length} fotografía(s) de evidencia.`,
      });
    } catch (err) {
      console.error("Error al procesar fotos:", err);
      toast({
        variant: "destructive",
        title: "Error al cargar fotos",
        description: "No se pudieron procesar las fotografías seleccionadas.",
      });
    } finally {
      setCompressingPhotos(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveEvidencePhoto = (photoIdx) => {
    setForm((prev) => ({
      ...prev,
      fotos_evidencia: (Array.isArray(prev.fotos_evidencia) ? prev.fotos_evidencia : []).filter((_, idx) => idx !== photoIdx),
    }));
  };

  // Abrir modal para crear
  const openCreate = (defaultDate = null) => {
    setEditingEvent(null);
    setFormError("");
    const initialType = allowedEventTypes[0] || "entrevista";

    setForm({
      ...emptyEventForm,
      tipo: initialType,
      fecha: defaultDate || new Date().toISOString().slice(0, 10),
      sede_id: defaultSedeId || "",
      responsable_id: user?.id || "",
      responsable_nombre: user?.full_name || "",
      fotos_evidencia: [],
    });
    setModalOpen(true);
  };

  // Abrir modal para editar o ver detalles
  const openEdit = (ev, e) => {
    e?.stopPropagation?.();
    setEditingEvent(ev);
    setFormError("");

    let parsedPhotos = [];
    if (Array.isArray(ev.fotos_evidencia)) {
      parsedPhotos = ev.fotos_evidencia;
    } else if (typeof ev.fotos_evidencia === "string" && ev.fotos_evidencia.trim()) {
      try {
        parsedPhotos = JSON.parse(ev.fotos_evidencia);
      } catch {
        parsedPhotos = [];
      }
    }

    setForm({
      ...emptyEventForm,
      ...ev,
      fotos_evidencia: parsedPhotos,
    });
    setModalOpen(true);
  };
  useEffect(() => {
    const eventoId = searchParams.get("evento");
    if (!eventoId || loading) return;
    const evento = events.find((item) => item.id === eventoId);
    if (
      !evento ||
      !allowedEventTypes.includes(evento.tipo) ||
      (sedeFilter?.sede_id && evento.sede_id && evento.sede_id !== sedeFilter.sede_id)
    ) return;

    setCurrentDate(new Date(`${evento.fecha}T12:00:00`));
    setTypeFilter(evento.tipo);
    setViewMode("calendario");
    openEdit(evento);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("evento");
    setSearchParams(nextParams, { replace: true });
  }, [allowedEventTypes, events, loading, openEdit, searchParams, sedeFilter, setSearchParams]);

  // Guardar evento
  async function handleSave() {
    setFormError("");
    if (!form.fecha) {
      setFormError("La fecha del evento es obligatoria.");
      return;
    }

    if (!allowedEventTypes.includes(form.tipo)) {
      setFormError("No tienes permisos para agendar eventos de este tipo.");
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
      } else if (form.tipo === "reporte") {
        autoTitle = `Reporte: ${form.tipo_reporte || "Incidencia"} - ${form.servicio_nombre || "General"}`;
      } else if (form.tipo === "reunion") {
        autoTitle = `Reunión: ${form.tema_reunion || form.titulo || "Reunión de Trabajo"}`;
      } else if (form.tipo === "inauguracion") {
        autoTitle = `Inauguración: ${form.servicio_nombre || "Nuevo Servicio"}`;
      } else if (form.tipo === "limite_pago") {
        autoTitle = `Límite de Pago: ${form.servicio_nombre || "Servicio"}`;
      }
    }

    if (form.tipo === "entrevista" && !form.candidato_nombre?.trim()) {
      setFormError("Por favor ingresa el nombre del candidato.");
      return;
    }
    if ((form.tipo === "visita_supervision" || form.tipo === "capacitacion" || form.tipo === "reporte") && !form.servicio_id) {
      setFormError("Por favor selecciona el servicio correspondiente.");
      return;
    }
    if (form.tipo === "reporte" && !form.descripcion_reporte?.trim() && !form.notas?.trim()) {
      setFormError("Por favor describe brevemente los detalles del reporte o incidencia.");
      return;
    }
    if (form.tipo === "reunion" && !form.tema_reunion?.trim() && !form.titulo?.trim()) {
      setFormError("Por favor ingresa el tema o asunto de la reunión.");
      return;
    }
    if (form.tipo === "inauguracion" && !form.servicio_id && !form.servicio_nombre?.trim()) {
      setFormError("Por favor indica el servicio a inaugurar.");
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
        hora_fin: form.tipo === "entrevista" || form.tipo === "reporte" ? null : (form.hora_fin || null),
        sede_id: form.sede_id || defaultSedeId || null,
        servicio_id: form.servicio_id === "oficina" ? null : (form.servicio_id || null),
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
        tipo_reporte: form.tipo_reporte || null,
        descripcion_reporte: form.descripcion_reporte || null,
        tema_reunion: form.tema_reunion || null,
        participantes_reunion: form.participantes_reunion || null,
        lugar_reunion: form.lugar_reunion || null,
        enlace_reunion: form.enlace_reunion || null,
        fecha_arranque: form.fecha_arranque || null,
        elementos_requeridos: form.elementos_requeridos || null,
        detalles_inauguracion: form.detalles_inauguracion || null,
        fotos_evidencia: Array.isArray(form.fotos_evidencia) ? form.fotos_evidencia : [],
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
      console.error("Error real de Supabase al guardar evento:", err);
      const errorDetails = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean);
      setFormError(errorDetails.length
        ? `No se pudo guardar: ${errorDetails.join(" | ")}`
        : "No se pudo guardar el evento. Supabase no devolvió detalles del error.");
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
        title: nextStatus === "completada" 
          ? (ev.tipo === "reporte" ? "Reporte marcado como Atendido / Resuelto" : "Evento marcado como Realizado")
          : "Estado actualizado",
      });
    } catch (err) {
      console.error(err);
    }
  }

  const monthName = currentDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().slice(0, 10);

  // Botón principal de creación dinámico
  const createButtonText = useMemo(() => {
    if (allowedEventTypes.length === 1) {
      if (allowedEventTypes[0] === "reporte") return "Levantar Reporte";
      if (allowedEventTypes[0] === "entrevista") return "Agendar Entrevista";
      if (allowedEventTypes[0] === "capacitacion") return "Agendar Capacitación";
      if (allowedEventTypes[0] === "visita_supervision") return "Agendar Supervisión";
      if (allowedEventTypes[0] === "reunion") return "Agendar Reunión";
      if (allowedEventTypes[0] === "inauguracion") return "Agendar Inauguración";
      if (allowedEventTypes[0] === "limite_pago") return "Límites de Pago";
    }
    if (allowedEventTypes.includes("reporte") && allowedEventTypes.includes("visita_supervision") && allowedEventTypes.length === 2) {
      return "Agendar Supervisión / Reporte";
    }
    return "Agendar Evento";
  }, [allowedEventTypes]);

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
            Coordinación y seguimiento de entrevistas, supervisiones, capacitaciones y reportes operativos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navegador de mes global */}
          <div className="flex items-center bg-card border rounded-lg p-1 shadow-2xs">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth} title="Mes anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold capitalize px-3 min-w-[130px] text-center text-foreground select-none">
              {monthName}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth} title="Siguiente mes">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 ml-1" onClick={handleToday}>
              Hoy
            </Button>
          </div>

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
              {createButtonText}
            </Button>
          )}
        </div>
      </div>

      {/* TARJETAS DE RESUMEN RÁPIDO MENSUAL SEGÚN PERMISOS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            Resumen del Mes: <span className="capitalize text-foreground font-bold">{monthName}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {allowedEventTypes.includes("entrevista") && (
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
        )}

        {allowedEventTypes.includes("visita_supervision") && (
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
        )}

        {allowedEventTypes.includes("capacitacion") && (
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
        )}

        {allowedEventTypes.includes("reporte") && (
          <Card className="cursor-pointer hover:border-amber-300 transition-colors" onClick={() => setTypeFilter("reporte")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.reportes}</div>
                <p className="text-xs text-muted-foreground font-medium">Reportes Operativos</p>
              </div>
            </CardContent>
          </Card>
        )}

        {allowedEventTypes.includes("reunion") && (
          <Card className="cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setTypeFilter("reunion")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.reuniones}</div>
                <p className="text-xs text-muted-foreground font-medium">Reuniones</p>
              </div>
            </CardContent>
          </Card>
        )}

        {allowedEventTypes.includes("inauguracion") && (
          <Card className="cursor-pointer hover:border-teal-300 transition-colors" onClick={() => setTypeFilter("inauguracion")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.inauguraciones}</div>
                <p className="text-xs text-muted-foreground font-medium">Inauguraciones</p>
              </div>
            </CardContent>
          </Card>
        )}

        {allowedEventTypes.includes("limite_pago") && (
          <Card className="cursor-pointer hover:border-rose-300 transition-colors" onClick={() => setTypeFilter("limite_pago")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stats.limitesPago}</div>
                <p className="text-xs text-muted-foreground font-medium">Límites de Pago</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setTypeFilter("todos")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{stats.total}</div>
              <p className="text-xs text-muted-foreground font-medium">Total del Mes</p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <Card>
        <CardContent className="p-3.5">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar candidato, servicio, reporte, tema..."
                className="pl-9 h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro Tipo dinámico: sólo se muestran opciones si el rol tiene más de un tipo permitido */}
              {allowedEventTypes.length > 1 && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 text-xs w-[170px]">
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los Tipos</SelectItem>
                    {allowedEventTypes.includes("entrevista") && (
                      <SelectItem value="entrevista">🟣 Entrevistas</SelectItem>
                    )}
                    {allowedEventTypes.includes("visita_supervision") && (
                      <SelectItem value="visita_supervision">🔵 Visitas Supervisión</SelectItem>
                    )}
                    {allowedEventTypes.includes("capacitacion") && (
                      <SelectItem value="capacitacion">🟢 Capacitaciones</SelectItem>
                    )}
                    {allowedEventTypes.includes("reporte") && (
                      <SelectItem value="reporte">🟠 Reportes</SelectItem>
                    )}
                    {allowedEventTypes.includes("reunion") && (
                      <SelectItem value="reunion">🔵 Reuniones</SelectItem>
                    )}
                    {allowedEventTypes.includes("inauguracion") && (
                      <SelectItem value="inauguracion">🟢 Inauguraciones</SelectItem>
                    )}
                    {allowedEventTypes.includes("limite_pago") && (
                      <SelectItem value="limite_pago">🔴 Límites de Pago</SelectItem>
                    )}
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
                  <SelectItem value="programada">Pendientes / Prog.</SelectItem>
                  <SelectItem value="completada">Realizadas / Resueltos</SelectItem>
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
                      const hasPhotos = Array.isArray(ev.fotos_evidencia) && ev.fotos_evidencia.length > 0;

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
                          {hasPhotos && <Camera className="w-2.5 h-2.5 shrink-0 opacity-75 ml-auto" />}
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
          <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold">Listado Cronológico de Eventos y Reportes</CardTitle>
              <CardDescription className="text-xs">
                {listScopeAll
                  ? `Mostrando ${filteredEvents.length} registro(s) en todo el historial acumulado`
                  : `Mostrando ${displayedListEvents.length} registro(s) correspondientes a ${monthName}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={listScopeAll ? "secondary" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setListScopeAll(!listScopeAll)}
              >
                {listScopeAll ? `Ver solo ${monthName}` : "Ver todo el historial"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Cargando eventos...</p>
            ) : displayedListEvents.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <CalendarIcon className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-semibold text-foreground">No hay eventos ni reportes en esta selección</p>
                <p className="text-xs text-muted-foreground">Prueba ajustando los filtros o registra un nuevo evento.</p>
                {canCreate && (
                  <Button size="sm" variant="outline" onClick={() => openCreate()} className="mt-2 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> {createButtonText}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedListEvents.map((ev) => {
                  const typeConfig = EVENT_TYPES[ev.tipo] || EVENT_TYPES.entrevista;
                  const IconComp = typeConfig.icon;
                  const isDone = ev.estado === "completada";
                  const photos = Array.isArray(ev.fotos_evidencia)
                    ? ev.fotos_evidencia
                    : typeof ev.fotos_evidencia === "string" && ev.fotos_evidencia.trim()
                    ? JSON.parse(ev.fotos_evidencia || "[]")
                    : [];

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => openEdit(ev, e)}
                      className={`p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 cursor-pointer shadow-xs ${
                        typeConfig.borderLeftClass || "border-l-primary"
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
                            {ev.tipo === "reporte"
                              ? (ev.estado === "completada" ? "Atendido / Resuelto" : ev.estado === "cancelada" ? "Descartado" : "Abierto / Pendiente")
                              : ev.tipo === "limite_pago"
                              ? (ev.estado === "completada" ? "Pagado" : "Pendiente de Pago")
                              : ev.estado}
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

                          {ev.tipo === "reporte" && (
                            <>
                              {ev.servicio_nombre && (
                                <span className="font-medium text-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-amber-600" /> {ev.servicio_nombre}
                                </span>
                              )}
                              {ev.tipo_reporte && (
                                <span className="font-semibold text-amber-700 dark:text-amber-300">
                                  Tipo: {ev.tipo_reporte}
                                </span>
                              )}
                              {ev.turno && <span>Turno: <strong className="capitalize">{ev.turno}</strong></span>}
                            </>
                          )}

                          {ev.tipo === "reunion" && (
                            <>
                              {ev.tema_reunion && (
                                <span className="font-medium text-foreground">
                                  Tema: <strong>{ev.tema_reunion}</strong>
                                </span>
                              )}
                              {ev.lugar_reunion && (
                                <span className="flex items-center gap-1 text-indigo-600">
                                  <MapPin className="w-3 h-3" /> {ev.lugar_reunion}
                                </span>
                              )}
                              {ev.participantes_reunion && (
                                <span className="line-clamp-1">Convocados: <strong>{ev.participantes_reunion}</strong></span>
                              )}
                            </>
                          )}

                          {ev.tipo === "inauguracion" && (
                            <>
                              {ev.servicio_nombre && (
                                <span className="font-medium text-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-teal-600" /> {ev.servicio_nombre}
                                </span>
                              )}
                              {ev.elementos_requeridos && (
                                <span>Plantilla: <strong>{ev.elementos_requeridos}</strong></span>
                              )}
                              {ev.detalles_inauguracion && (
                                <span className="italic line-clamp-1">{ev.detalles_inauguracion}</span>
                              )}
                            </>
                          )}

                          {ev.tipo === "limite_pago" && (
                            <>
                              {ev.servicio_nombre && (
                                <span className="font-medium text-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-rose-600" /> {ev.servicio_nombre}
                                </span>
                              )}
                              {ev.monto && (
                                <span className="font-bold text-rose-600 flex items-center gap-0.5">
                                  <DollarSign className="w-3 h-3" />
                                  {Number(ev.monto).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                                </span>
                              )}
                              {ev.mes && <span>Periodo: {ev.mes}</span>}
                            </>
                          )}

                          {ev.responsable_nombre && (
                            <span className="text-muted-foreground border-l pl-2">
                              Responsable: <strong className="text-foreground">{ev.responsable_nombre}</strong>
                            </span>
                          )}
                        </div>

                        {/* Descripción del reporte si existe */}
                        {ev.tipo === "reporte" && ev.descripcion_reporte && (
                          <p className="text-xs text-foreground/90 bg-amber-500/10 dark:bg-amber-950/30 p-2 rounded border border-amber-200/50 dark:border-amber-800/40">
                            {ev.descripcion_reporte}
                          </p>
                        )}

                        {/* Tira de fotos de evidencia */}
                        {photos.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                              <Camera className="w-3 h-3 text-primary" />
                              {photos.length} evidencia(s)
                            </span>
                            <div className="flex items-center gap-1.5">
                              {photos.slice(0, 4).map((imgUrl, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  className="w-8 h-8 rounded border overflow-hidden hover:opacity-80 transition-opacity cursor-pointer shadow-2xs shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImageModal(imgUrl);
                                  }}
                                  title="Ver fotografía de evidencia ampliada"
                                >
                                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                              {photos.length > 4 && (
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  +{photos.length - 4} más
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {ev.notas && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 italic bg-muted/40 p-1.5 rounded">
                            Nota: {ev.notas}
                          </p>
                        )}
                      </div>

                      {/* Botones de acción rápida */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                        {canEdit && !ev.is_system_cobro && (
                          ev.estado === "programada" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                              onClick={(e) => handleToggleStatus(ev, "completada", e)}
                              title={ev.tipo === "reporte" ? "Marcar como atendido" : "Marcar como realizada"}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              {ev.tipo === "reporte" ? "Atendido" : "Realizada"}
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
                            title={ev.is_system_cobro ? "Ver detalles" : "Editar"}
                          >
                            {ev.is_system_cobro ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                          </Button>
                        )}

                        {canDelete && !ev.is_system_cobro && (
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
              {editingEvent 
                ? (form.tipo === "limite_pago"
                    ? "Detalles de Fecha Límite de Pago"
                    : canEdit 
                    ? (form.tipo === "reporte" ? "Editar Reporte Operativo" : form.tipo === "reunion" ? "Editar Reunión" : form.tipo === "inauguracion" ? "Editar Inauguración" : "Editar Evento") 
                    : "Detalles del Registro") 
                : (form.tipo === "reporte" 
                    ? "Levantar Nuevo Reporte Operativo" 
                    : form.tipo === "reunion" 
                    ? "Agendar Nueva Reunión" 
                    : form.tipo === "inauguracion" 
                    ? "Agendar Inauguración de Servicio" 
                    : form.tipo === "limite_pago"
                    ? "Fecha Límite de Pago"
                    : "Agendar Nuevo Evento")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Completa los datos del registro según el área operativa correspondiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Selector dinámico de Tipo de Evento según los permisos del usuario */}
            <div>
              <Label className="text-xs font-semibold">Tipo de Registro *</Label>
              {allowedEventTypes.length === 1 ? (
                <div className="mt-1.5">
                  <div className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                    allowedEventTypes[0] === "reporte"
                      ? "bg-amber-100 text-amber-900 border-amber-500 shadow-xs dark:bg-amber-950 dark:text-amber-200"
                      : allowedEventTypes[0] === "entrevista"
                      ? "bg-purple-100 text-purple-900 border-purple-500 shadow-xs dark:bg-purple-950 dark:text-purple-200"
                      : allowedEventTypes[0] === "capacitacion"
                      ? "bg-emerald-100 text-emerald-900 border-emerald-500 shadow-xs dark:bg-emerald-950 dark:text-emerald-200"
                      : allowedEventTypes[0] === "reunion"
                      ? "bg-indigo-100 text-indigo-900 border-indigo-500 shadow-xs dark:bg-indigo-950 dark:text-indigo-200"
                      : allowedEventTypes[0] === "inauguracion"
                      ? "bg-teal-100 text-teal-900 border-teal-500 shadow-xs dark:bg-teal-950 dark:text-teal-200"
                      : allowedEventTypes[0] === "limite_pago"
                      ? "bg-rose-100 text-rose-900 border-rose-500 shadow-xs dark:bg-rose-950 dark:text-rose-200"
                      : "bg-blue-100 text-blue-900 border-blue-500 shadow-xs dark:bg-blue-950 dark:text-blue-200"
                  }`}>
                    {React.createElement(EVENT_TYPES[allowedEventTypes[0]]?.icon || AlertTriangle, { className: "w-4 h-4" })}
                    <span>{EVENT_TYPES[allowedEventTypes[0]]?.label || "Evento"}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1.5">
                  {allowedEventTypes.map((t) => {
                    const config = EVENT_TYPES[t];
                    const IconC = config.icon;
                    const isSelected = form.tipo === t;

                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, tipo: t })}
                        className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? config.id === "entrevista"
                              ? "bg-purple-100 text-purple-900 border-purple-500 shadow-xs dark:bg-purple-950 dark:text-purple-200"
                              : config.id === "visita_supervision"
                              ? "bg-blue-100 text-blue-900 border-blue-500 shadow-xs dark:bg-blue-950 dark:text-blue-200"
                              : config.id === "capacitacion"
                              ? "bg-emerald-100 text-emerald-900 border-emerald-500 shadow-xs dark:bg-emerald-950 dark:text-emerald-200"
                              : config.id === "reunion"
                              ? "bg-indigo-100 text-indigo-900 border-indigo-500 shadow-xs dark:bg-indigo-950 dark:text-indigo-200"
                              : config.id === "inauguracion"
                              ? "bg-teal-100 text-teal-900 border-teal-500 shadow-xs dark:bg-teal-950 dark:text-teal-200"
                              : config.id === "limite_pago"
                              ? "bg-rose-100 text-rose-900 border-rose-500 shadow-xs dark:bg-rose-950 dark:text-rose-200"
                              : "bg-amber-100 text-amber-900 border-amber-500 shadow-xs dark:bg-amber-950 dark:text-amber-200"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <IconC className="w-4 h-4" />
                        <span>{config.label}</span>
                      </button>
                    );
                  })}
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
                      value={form.turno || "matutino"}
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
                        if (val === "oficina") {
                          setForm({ ...form, servicio_id: "oficina", servicio_nombre: "Oficinas Centrales SERCO" });
                        } else {
                          const s = services.find((x) => x.id === val);
                          setForm({ ...form, servicio_id: val, servicio_nombre: s?.nombre || "" });
                        }
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

            {/* 4. REPORTE OPERATIVO */}
            {form.tipo === "reporte" && (
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/70 space-y-3">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Datos del Reporte Operativo
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Servicio Afectado / Ubicación *</Label>
                    <Select
                      value={form.servicio_id}
                      onValueChange={(val) => {
                        if (val === "oficina") {
                          setForm({ ...form, servicio_id: "oficina", servicio_nombre: "Oficinas Centrales SERCO" });
                        } else {
                          const s = services.find((x) => x.id === val);
                          setForm({ ...form, servicio_id: val, servicio_nombre: s?.nombre || "" });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Selecciona el servicio..." />
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
                    <Label className="text-xs">Tipo de Reporte *</Label>
                    <Select
                      value={form.tipo_reporte || "Incidencia Operativa"}
                      onValueChange={(val) => setForm({ ...form, tipo_reporte: val })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Tipo de reporte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Incidencia Operativa">⚠️ Incidencia Operativa</SelectItem>
                        <SelectItem value="Novedad en Servicio">📋 Novedad en Servicio</SelectItem>
                        <SelectItem value="Falta / Falla de Equipo">🛡️ Falta o Falla de Equipo / Uniforme</SelectItem>
                        <SelectItem value="Inasistencia / Guardia Faltante">👤 Inasistencia de Personal</SelectItem>
                        <SelectItem value="Queja o Petición de Cliente">🗣️ Queja o Petición de Cliente</SelectItem>
                        <SelectItem value="Emergencia / Conato">🚨 Emergencia / Conato</SelectItem>
                        <SelectItem value="Otro">📌 Otro Reporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Turno</Label>
                    <Select
                      value={form.turno || "matutino"}
                      onValueChange={(val) => setForm({ ...form, turno: val })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Turno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matutino">Matutino</SelectItem>
                        <SelectItem value="vespertino">Vespertino</SelectItem>
                        <SelectItem value="nocturno">Nocturno</SelectItem>
                        <SelectItem value="mixto">Mixto / 24 Horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs">Detalle o Descripción de los Hechos *</Label>
                    <Textarea
                      rows={3}
                      placeholder="Describe detalladamente lo acontecido, personas involucradas, daños, medidas tomadas..."
                      value={form.descripcion_reporte || ""}
                      onChange={(e) => setForm({ ...form, descripcion_reporte: e.target.value })}
                      className="text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. REUNIÓN */}
            {form.tipo === "reunion" && (
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/70 space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" /> Datos de la Reunión
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Tema o Asunto de la Reunión *</Label>
                    <Input
                      placeholder="Ej. Junta directiva mensual, Revisión operativa con cliente, Planeación de presupuesto..."
                      value={form.tema_reunion || ""}
                      onChange={(e) => setForm({ ...form, tema_reunion: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Lugar o Modalidad</Label>
                    <Input
                      placeholder="Ej. Sala de juntas, Virtual / Meet, Instalaciones del cliente..."
                      value={form.lugar_reunion || ""}
                      onChange={(e) => setForm({ ...form, lugar_reunion: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Enlace Virtual (Opcional)</Label>
                    <Input
                      placeholder="Ej. meet.google.com/xyz o Teams..."
                      value={form.enlace_reunion || ""}
                      onChange={(e) => setForm({ ...form, enlace_reunion: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs">Participantes Convocados</Label>
                    <Input
                      placeholder="Ej. Dirección General, Operaciones, Finanzas, Representante de Cliente..."
                      value={form.participantes_reunion || ""}
                      onChange={(e) => setForm({ ...form, participantes_reunion: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs">Servicio Relacionado (Opcional)</Label>
                    <Select
                      value={form.servicio_id || "ninguno"}
                      onValueChange={(val) => {
                        if (val === "ninguno") {
                          setForm({ ...form, servicio_id: "", servicio_nombre: "" });
                        } else {
                          const s = services.find((x) => x.id === val);
                          setForm({ ...form, servicio_id: val, servicio_nombre: s?.nombre || "" });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Selecciona un servicio si aplica..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ninguno">Ninguno / General de la Empresa</SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* 6. INAUGURACIÓN DE SERVICIO */}
            {form.tipo === "inauguracion" && (
              <div className="p-3.5 bg-teal-50/50 dark:bg-teal-950/20 rounded-xl border border-teal-200/70 space-y-3">
                <h4 className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-teal-600" /> Datos de la Inauguración de Servicio
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Servicio a Inaugurar *</Label>
                    <Select
                      value={form.servicio_id || "nuevo"}
                      onValueChange={(val) => {
                        if (val === "nuevo") {
                          setForm({ ...form, servicio_id: "" });
                        } else {
                          const s = services.find((x) => x.id === val);
                          setForm({ ...form, servicio_id: val, servicio_nombre: s?.nombre || "" });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Selecciona servicio existente o ingresa nuevo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nuevo">➕ Escribir nombre de nuevo servicio</SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(!form.servicio_id || form.servicio_id === "") && (
                      <Input
                        placeholder="Nombre del nuevo servicio por inaugurar..."
                        value={form.servicio_nombre || ""}
                        onChange={(e) => setForm({ ...form, servicio_nombre: e.target.value })}
                        className="h-8 text-xs mt-2"
                      />
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Plantilla / Elementos Asignados</Label>
                    <Input
                      placeholder="Ej. 6 guardias 24x24 + 1 jefe de turno"
                      value={form.elementos_requeridos || ""}
                      onChange={(e) => setForm({ ...form, elementos_requeridos: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Sede Asignada</Label>
                    <Select
                      value={form.sede_id || defaultSedeId || "none"}
                      onValueChange={(val) => setForm({ ...form, sede_id: val === "none" ? "" : val })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Sede" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin sede específica</SelectItem>
                        {sedes.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs">Detalles y Consignas de Arranque</Label>
                    <Textarea
                      rows={2}
                      placeholder="Protocolos de apertura, entrega de uniformes, radios, rondineros, presentación con cliente..."
                      value={form.detalles_inauguracion || ""}
                      onChange={(e) => setForm({ ...form, detalles_inauguracion: e.target.value })}
                      className="text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. LÍMITE DE PAGO */}
            {form.tipo === "limite_pago" && (
              <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/70 space-y-3">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-rose-600" /> Información de Fecha Límite de Pago
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Servicio:</span>
                    <span className="font-semibold text-foreground">{form.servicio_nombre || "Servicio general"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Monto de Factura:</span>
                    <span className="font-bold text-rose-600 text-sm">
                      {form.monto ? Number(form.monto).toLocaleString("es-MX", { style: "currency", currency: "MXN" }) : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Periodo / Mes:</span>
                    <span className="font-semibold text-foreground">{form.mes || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Estatus de Cobranza:</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      form.estado_cobro === "pagado"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {form.estado_cobro || form.estado}
                    </span>
                  </div>
                </div>
                {form.is_system_cobro && (
                  <p className="text-[11px] text-muted-foreground bg-rose-100/50 dark:bg-rose-950/40 p-2 rounded">
                    ℹ️ Esta fecha de límite de pago está sincronizada automáticamente con la cartera del módulo de Facturas.
                  </p>
                )}
              </div>
            )}

            {/* SECCIÓN DE FOTOGRAFÍAS DE EVIDENCIA (PARA CAPACITACIÓN Y REPORTES) */}
            {(form.tipo === "capacitacion" || form.tipo === "reporte") && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Fotografías de Evidencia</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {form.tipo === "capacitacion"
                          ? "Comprobantes fotográficos de que se llevó a cabo la capacitación."
                          : "Fotografías de evidencia sobre los hechos del reporte."}
                      </p>
                    </div>
                  </div>

                  {(!editingEvent || canEdit) && (
                    <div>
                      <input
                        type="file"
                        id="evidence-photos-input"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleEvidencePhotosUpload}
                        disabled={compressingPhotos}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => document.getElementById("evidence-photos-input")?.click()}
                        disabled={compressingPhotos}
                      >
                        {compressingPhotos ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Procesando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3 h-3" /> Subir Fotos
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Galería de miniaturas cargadas */}
                {Array.isArray(form.fotos_evidencia) && form.fotos_evidencia.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-1">
                    {form.fotos_evidencia.map((photoUrl, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-lg overflow-hidden border bg-background aspect-square shadow-2xs cursor-pointer"
                        onClick={() => setPreviewImageModal(photoUrl)}
                      >
                        <img
                          src={photoUrl}
                          alt={`Evidencia ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-4 h-4 drop-shadow" />
                        </div>
                        {(!editingEvent || canEdit) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveEvidencePhoto(idx);
                            }}
                            title="Eliminar foto"
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 shadow"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => (!editingEvent || canEdit) && document.getElementById("evidence-photos-input")?.click()}
                    className={`border-2 border-dashed rounded-lg p-3.5 text-center text-xs transition-colors ${
                      (!editingEvent || canEdit)
                        ? "border-muted-foreground/30 hover:border-primary/50 cursor-pointer text-muted-foreground"
                        : "border-muted-foreground/20 text-muted-foreground/60"
                    }`}
                  >
                    <ImageIcon className="w-6 h-6 mx-auto mb-1 text-muted-foreground/50" />
                    <span>
                      {(!editingEvent || canEdit)
                        ? "Haz clic aquí o pulsa \"Subir Fotos\" para adjuntar fotos de evidencia."
                        : "No se adjuntaron fotografías de evidencia."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* FECHA Y HORARIOS */}
            {form.tipo === "limite_pago" ? (
              <div>
                <Label className="text-xs">Fecha Límite de Pago *</Label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="h-8 text-xs mt-1"
                  disabled={form.is_system_cobro}
                />
              </div>
            ) : form.tipo === "entrevista" || form.tipo === "reporte" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">
                    {form.tipo === "reporte" ? "Fecha del Reporte *" : "Fecha de la Entrevista *"}
                  </Label>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">
                    {form.tipo === "reporte" ? "Hora del Suceso *" : "Hora de la Cita *"}
                  </Label>
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
                  <Label className="text-xs">
                    {form.tipo === "reunion" 
                      ? "Fecha de la Reunión *" 
                      : form.tipo === "inauguracion" 
                      ? "Fecha de Arranque / Inauguración *" 
                      : "Fecha del Evento *"}
                  </Label>
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
                <Label className="text-xs">
                  {form.tipo === "reporte" ? "Estado del Reporte" : "Estado del Evento"}
                </Label>
                <Select
                  value={form.estado}
                  onValueChange={(val) => setForm({ ...form, estado: val })}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programada">
                      {form.tipo === "reporte" ? "🟡 Abierto / Pendiente" : "🟡 Programada"}
                    </SelectItem>
                    <SelectItem value="completada">
                      {form.tipo === "reporte" ? "🟢 Atendido / Resuelto" : "🟢 Realizada / Completada"}
                    </SelectItem>
                    <SelectItem value="cancelada">
                      {form.tipo === "reporte" ? "🔴 Descartado / Cancelado" : "🔴 Cancelada"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* NOTAS Y OBSERVACIONES */}
            <div>
              <Label className="text-xs">Notas u Observaciones Adicionales</Label>
              <Textarea
                rows={2}
                placeholder="Detalles importantes, consignas, instrucciones de seguimiento..."
                value={form.notas || ""}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>
              {editingEvent && (!canEdit || editingEvent?.is_system_cobro) ? "Cerrar" : "Cancelar"}
            </Button>
            {(!editingEvent || canEdit) && !editingEvent?.is_system_cobro && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 font-semibold">
                {saving 
                  ? "Guardando..." 
                  : editingEvent 
                  ? "Guardar Cambios" 
                  : (form.tipo === "reporte" 
                      ? "Guardar Reporte" 
                      : form.tipo === "reunion" 
                      ? "Agendar Reunión" 
                      : form.tipo === "inauguracion" 
                      ? "Agendar Inauguración" 
                      : "Agendar Evento")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL LIGHTBOX PARA VISUALIZAR FOTOGRAFÍAS EN ALTA RESOLUCIÓN */}
      <Dialog open={!!previewImageModal} onOpenChange={(open) => !open && setPreviewImageModal(null)}>
        <DialogContent className="max-w-3xl p-4 bg-black/95 border-neutral-800 text-white flex flex-col items-center">
          <DialogHeader className="w-full flex flex-row items-center justify-between pb-2 border-b border-neutral-800">
            <DialogTitle className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Fotografía de Evidencia
            </DialogTitle>
          </DialogHeader>

          <div className="w-full max-h-[75vh] flex items-center justify-center p-2 overflow-auto">
            {previewImageModal && (
              <img
                src={previewImageModal}
                alt="Evidencia ampliada"
                className="max-h-[70vh] max-w-full object-contain rounded-md shadow-2xl"
              />
            )}
          </div>

          <div className="w-full flex items-center justify-between pt-3 border-t border-neutral-800 text-xs text-neutral-400">
            <span>Comprobante de evidencia fotográfica</span>
            <div className="flex gap-2">
              <a
                href={previewImageModal}
                download="evidencia-serco.jpg"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Descargar
              </a>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                onClick={() => setPreviewImageModal(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="¿Eliminar evento o reporte de la agenda?"
        description="Esta acción eliminará el registro de la agenda. Esta acción no se puede deshacer."
        onConfirm={async () => {
          if (deleteConfirmId) {
            await removeEvent(deleteConfirmId);
            setDeleteConfirmId(null);
            toast({ title: "Registro eliminado de la agenda" });
          }
        }}
      />
    </div>
  );
}
