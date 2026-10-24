import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Clock, ExternalLink, Filter, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const filters = [
  { id: "todas", label: "Todas" },
  { id: "no_leidas", label: "No leídas" },
  { id: "leidas", label: "Leídas" },
  { id: "acciones", label: "Acciones" },
  { id: "recordatorios", label: "Recordatorios" },
];

function notificationPath(notification) {
  const recordId = encodeURIComponent(notification.referencia_id || "");
  switch (notification.referencia_tipo) {
    case "empleado": return `/empleados?registro=${recordId}`;
    case "servicio": return `/servicios?registro=${recordId}`;
    case "solicitud_material": return `/inventario?solicitud=${recordId}`;
    case "agenda": return `/agenda?evento=${recordId}`;
    case "egreso": return `/egresos?egreso=${recordId}`;
    case "recarga_celular": return `/egresos?recarga=${recordId}`;
    default: return "/";
  }
}

function formatDate(value) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function NoticeRow({ notification, onOpen, onRead, onAttend }) {
  const isRequiredAction = notification.categoria === "accion_requerida";
  const isReminder = notification.categoria === "recordatorio";

  return (
    <article className={`rounded-md border border-l-4 p-3 overflow-hidden break-words transition-colors ${notification.leida ? "border-l-muted-foreground/30 bg-card" : "border-l-primary bg-primary/[0.035]"}`}>
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground break-words">{notification.titulo}</h3>
          {!notification.leida && <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary shrink-0">No leída</span>}
          {isRequiredAction && <span className="rounded-sm bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300 shrink-0">Acción {notification.estado}</span>}
          {isReminder && <span className="rounded-sm bg-sky-100 dark:bg-sky-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-300 shrink-0">Recordatorio</span>}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground break-words">{notification.mensaje}</p>
        <time className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5 break-words" dateTime={notification.created_at}>
          <Clock className="h-3 w-3 shrink-0" />
          <span>{formatDate(notification.fecha_programada || notification.created_at)}</span>
        </time>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 border-t pt-2">
        <button type="button" onClick={() => onOpen(notification)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Abrir registro <ExternalLink className="h-3 w-3 shrink-0" />
        </button>
        <div className="flex flex-wrap items-center gap-1">
          {!notification.leida && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onRead(notification)}>
              <Check className="mr-1 h-3 w-3" />Marcar leída
            </Button>
          )}
          {isRequiredAction && notification.estado === "pendiente" && (
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs font-medium text-amber-800 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50" onClick={() => onAttend(notification)}>
              <CheckCheck className="mr-1 h-3 w-3" />Atendida
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function NotificationCenter({ userId, legacyNotifications = [], dismissedLegacy = [], onDismissLegacy, onRestoreLegacy }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todas");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let mounted = true;

    const loadNotifications = async () => {
      try {
        await supabase.rpc("generar_recordatorios_egresos_mensuales");
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("notificaciones")
          .select("*")
          .eq("usuario_id", userId)
          .or(`fecha_programada.is.null,fecha_programada.lte.${now}`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (mounted) setNotifications(data || []);
      } catch (error) {
        console.error("Error al cargar notificaciones:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadNotifications();
    const channel = supabase
      .channel(`notificaciones-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notificaciones",
        filter: `usuario_id=eq.${userId}`,
      }, loadNotifications)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = notifications.filter((item) => !item.leida).length;
  const requiredCount = notifications.filter((item) => item.categoria === "accion_requerida" && item.estado === "pendiente").length;
  const reminderCount = notifications.filter((item) => item.categoria === "recordatorio").length;
  const notifiedRecordIds = new Set(notifications.map((item) => item.referencia_id).filter(Boolean));
  const visibleLegacy = legacyNotifications.filter((item) => {
    const legacyRecordId = item.id.split("-").slice(1).join("-");
    return !dismissedLegacy.includes(item.id) && !notifiedRecordIds.has(legacyRecordId);
  });

  const filteredNotifications = useMemo(() => notifications.filter((item) => {
    if (filter === "no_leidas") return !item.leida;
    if (filter === "leidas") return item.leida;
    if (filter === "acciones") return item.categoria === "accion_requerida";
    if (filter === "recordatorios") return item.categoria === "recordatorio";
    return true;
  }), [filter, notifications]);

  const updateNotification = async (notification, operation) => {
    const rpc = operation === "attend" ? "atender_notificacion" : "marcar_notificacion_leida";
    const { error } = await supabase.rpc(rpc, { p_notificacion_id: notification.id });
    if (error) {
      console.error("No se pudo actualizar la notificación:", error);
      return;
    }
    setNotifications((current) => current.map((item) => item.id !== notification.id ? item : operation === "attend"
      ? { ...item, estado: "atendida", fecha_atendida: new Date().toISOString() }
      : { ...item, leida: true }));
  };

  const handleOpenRecord = async (notification) => {
    if (!notification.leida) await updateNotification(notification, "read");
    setOpen(false);
    navigate(notificationPath(notification));
  };

  const renderNotice = (notification) => (
    <NoticeRow
      key={notification.id}
      notification={notification}
      onOpen={handleOpenRecord}
      onRead={(item) => updateNotification(item, "read")}
      onAttend={(item) => updateNotification(item, "attend")}
    />
  );

  return (
    <>
      <Card className="h-full overflow-hidden shadow-sm">
        <CardHeader className="cursor-pointer border-b pb-3 transition-colors hover:bg-muted/40" onClick={() => setOpen(true)}>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-primary" />Notificaciones
              {unreadCount > 0 && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">{unreadCount}</span>}
            </CardTitle>
            <span className="text-xs text-primary">Ver todas</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3.5 sm:p-4">
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground break-words leading-tight">
            <span>{unreadCount} no leídas</span>
            <span aria-hidden="true">·</span>
            <span>{notifications.length - unreadCount} leídas</span>
            <span aria-hidden="true">·</span>
            <span>{requiredCount} pendientes</span>
            <span aria-hidden="true">·</span>
            <span>{reminderCount} avisos</span>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
            {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando notificaciones...</p> : (
              <>
                {notifications.slice(0, 5).map(renderNotice)}
                {visibleLegacy.slice(0, 3).map((item) => (
                  <article key={item.id} className="rounded-md border border-l-4 border-l-blue-500 p-3 overflow-hidden break-words bg-card/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 break-words">
                        <h3 className="text-sm font-semibold break-words">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground break-words leading-relaxed">{item.description}</p>
                      </div>
                      <button 
                        type="button" 
                        title="Descartar aviso" 
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground font-medium underline sm:no-underline hover:underline ml-1" 
                        onClick={() => onDismissLegacy(item.id)}
                      >
                        Descartar
                      </button>
                    </div>
                    {item.autor && <p className="mt-1.5 text-[11px] text-muted-foreground font-medium break-words">Por: {item.autor}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1 break-words">
                      <Clock className="w-3 h-3 shrink-0" /> {item.hora || item.categoria}
                    </p>
                  </article>
                ))}
                {!notifications.length && !visibleLegacy.length && <p className="py-8 text-center text-sm text-muted-foreground">No hay notificaciones.</p>}
              </>
            )}
          </div>
          {dismissedLegacy.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onRestoreLegacy}>
              <RotateCcw className="mr-1 h-3 w-3" />Restaurar avisos anteriores ({dismissedLegacy.length})
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col p-5 sm:p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Centro de notificaciones</DialogTitle>
            <DialogDescription>
              {unreadCount} no leídas · {notifications.length - unreadCount} leídas · {requiredCount} acciones pendientes · {reminderCount} recordatorios
            </DialogDescription>
            <div className="flex items-center gap-1 overflow-x-auto pt-2">
              <Filter className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {filters.map((item) => (
                <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`shrink-0 rounded-sm px-2.5 py-1 text-xs font-medium ${filter === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </DialogHeader>
          <div className="flex-1 space-y-2 overflow-y-auto py-3">
            {filteredNotifications.length ? filteredNotifications.map(renderNotice) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No hay notificaciones en esta vista.</p>
            )}
            {visibleLegacy.map((item) => (
              <article key={item.id} className="rounded-md border border-l-4 border-l-blue-500 p-3 overflow-hidden break-words bg-card/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 break-words">
                    <h3 className="text-sm font-semibold break-words">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground break-words leading-relaxed">{item.description}</p>
                  </div>
                  <button 
                    type="button" 
                    title="Descartar aviso" 
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground font-medium underline sm:no-underline hover:underline ml-1" 
                    onClick={() => onDismissLegacy(item.id)}
                  >
                    Descartar
                  </button>
                </div>
                {item.autor && <p className="mt-1.5 text-[11px] text-muted-foreground font-medium break-words">Por: {item.autor}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1 break-words">
                  <Clock className="w-3 h-3 shrink-0" /> {item.hora || item.categoria}
                </p>
              </article>
            ))}
            {dismissedLegacy.length > 0 && <Button variant="ghost" size="sm" onClick={onRestoreLegacy}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restaurar avisos anteriores ({dismissedLegacy.length})</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}