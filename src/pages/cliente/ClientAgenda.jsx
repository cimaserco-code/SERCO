import React, { useState, useMemo } from "react";
import { useClientPortal } from "@/context/ClientPortalContext";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  BookOpen,
  DollarSign,
  AlertCircle,
  Building2,
  CheckCircle2,
  List,
  Grid
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ClientAgenda() {
  const { selectedServicio, agendaEvents, facturaActual, cobros } = useClientPortal();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // 'month' | 'list'
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Combine agenda events (visita_supervision and capacitacion) with invoice due dates
  const allCalendarEvents = useMemo(() => {
    const list = [...agendaEvents];

    // Add invoice due date as special financial events
    (cobros || []).forEach((c) => {
      if (c.fecha_limite_pago) {
        list.push({
          id: `factura-limite-${c.id}`,
          tipo: "factura_limite",
          titulo: `Fecha Límite Factura (${c.mes || ""})`,
          fecha: c.fecha_limite_pago,
          hora_inicio: "18:00",
          hora_fin: "23:59",
          monto: c.monto,
          estado: c.estado,
          notas: `Fecha límite para realizar el pago de la factura correspondiente al mes ${c.mes || ""}. Monto: $${Number(c.monto || 0).toLocaleString("es-MX")}`,
        });
      }
    });

    return list;
  }, [agendaEvents, cobros]);

  // Calendar grid calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDayOfMonth.getDate();

    const days = [];

    // Days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        events: [],
      });
    }

    // Days of current month
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = allCalendarEvents.filter((e) => e.fecha === dateStr);
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        events: dayEvents,
      });
    }

    // Days of next month to complete standard 35 or 42 grid cells
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthNum = month + 2 > 12 ? 1 : month + 2;
      const nextYearNum = month + 2 > 12 ? year + 1 : year;
      const dateStr = `${nextYearNum}-${String(nextMonthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        events: [],
      });
    }

    return days;
  }, [year, month, allCalendarEvents]);

  const getEventBadge = (event) => {
    switch (event.tipo) {
      case "visita_supervision":
        return {
          bg: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300",
          dot: "bg-blue-500",
          icon: Eye,
          label: "Supervisión",
        };
      case "capacitacion":
        return {
          bg: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300",
          dot: "bg-amber-500",
          icon: BookOpen,
          label: "Capacitación",
        };
      case "factura_limite":
        return {
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300",
          dot: "bg-emerald-500",
          icon: DollarSign,
          label: "Límite Factura",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-800",
          dot: "bg-slate-500",
          icon: CalendarIcon,
          label: "Evento",
        };
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* ══════════════════ HEADER ══════════════════ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Agenda de Servicio
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Programación exclusiva de supervisiones, capacitaciones y fechas clave para{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {selectedServicio?.nombre || "tu servicio"}
            </span>
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
            className="text-xs font-semibold gap-1.5"
          >
            <Grid className="w-3.5 h-3.5" />
            Mes
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="text-xs font-semibold gap-1.5"
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </Button>
        </div>
      </div>

      {/* ══════════════════ CALENDAR CONTROLS & LEGEND ══════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={goToToday}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm sm:text-base font-bold capitalize text-slate-900 dark:text-white ml-2">
            {monthName}
          </span>
        </div>

        {/* Event Type Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Visitas de Supervisión</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Capacitaciones</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Vencimiento de Factura</span>
          </div>
        </div>
      </div>

      {/* ══════════════════ MONTH CALENDAR VIEW ══════════════════ */}
      {viewMode === "month" && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center text-xs font-bold text-muted-foreground py-2.5">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 transition flex flex-col justify-between ${
                    day.isCurrentMonth
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50/50 dark:bg-slate-900/40 opacity-40"
                  } ${day.isToday ? "ring-2 ring-inset ring-amber-500/50 bg-amber-50/20" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                        day.isToday
                          ? "bg-amber-500 text-white font-bold"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                  </div>

                  <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[85px]">
                    {day.events.map((ev) => {
                      const cfg = getEventBadge(ev);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-left p-1 rounded text-[10px] sm:text-xs font-medium border truncate block transition hover:opacity-85 ${cfg.bg}`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="truncate font-semibold">{ev.titulo || cfg.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════ LIST VIEW ══════════════════ */}
      {viewMode === "list" && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold">Listado de Eventos del Servicio</CardTitle>
            <CardDescription className="text-xs">
              Supervisiones, capacitaciones e hitos programados
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {allCalendarEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                No hay eventos programados para este servicio en los registros.
              </div>
            ) : (
              <div className="space-y-3">
                {allCalendarEvents
                  .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
                  .map((ev) => {
                    const cfg = getEventBadge(ev);
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${cfg.bg} border shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {ev.titulo || cfg.label}
                              </h4>
                              <Badge className={`${cfg.bg} text-[10px] px-1.5 py-0`}>
                                {cfg.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ev.notas || ev.objetivo_visita || ev.tema_capacitacion || "Evento del servicio"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            {ev.fecha}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {ev.hora_inicio ? `${ev.hora_inicio} hrs` : "Todo el día"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════════════ EVENT DETAIL DIALOG (READ-ONLY) ══════════════════ */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {selectedEvent.tipo === "visita_supervision" && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      Supervisión Operativa
                    </Badge>
                  )}
                  {selectedEvent.tipo === "capacitacion" && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                      Capacitación
                    </Badge>
                  )}
                  {selectedEvent.tipo === "factura_limite" && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      Facturación SERCO
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-base font-bold">
                  {selectedEvent.titulo || "Detalles del Evento"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Información registrada para tu servicio
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha programada:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedEvent.fecha}
                    </span>
                  </div>
                  {selectedEvent.hora_inicio && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horario:</span>
                      <span className="font-semibold">
                        {selectedEvent.hora_inicio} {selectedEvent.hora_fin ? `- ${selectedEvent.hora_fin}` : ""} hrs
                      </span>
                    </div>
                  )}
                  {selectedEvent.responsable_nombre && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Responsable SERCO:</span>
                      <span className="font-semibold">{selectedEvent.responsable_nombre}</span>
                    </div>
                  )}
                  {selectedEvent.turno && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Turno:</span>
                      <span className="font-semibold capitalize">{selectedEvent.turno}</span>
                    </div>
                  )}
                  {selectedEvent.monto && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto de la Factura:</span>
                      <span className="font-bold text-emerald-600">
                        ${Number(selectedEvent.monto).toLocaleString("es-MX")} MXN
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional notes / objectives */}
                {(selectedEvent.objetivo_visita || selectedEvent.tema_capacitacion || selectedEvent.notas) && (
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border">
                    <span className="text-muted-foreground font-semibold block mb-1">
                      Descripción y objetivos:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedEvent.objetivo_visita || selectedEvent.tema_capacitacion || selectedEvent.notas}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button size="sm" variant="outline" onClick={() => setSelectedEvent(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
