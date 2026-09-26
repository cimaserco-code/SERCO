import React from "react";
import { useClientPortal } from "@/context/ClientPortalContext";
import { formatUserDisplayName } from "@/lib/userNameFormatting";
import {
  FileText,
  DollarSign,
  Users,
  Phone,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Smartphone,
  Building2,
  X,
  CreditCard,
  Eye,
  BookOpen,
  User as UserIcon,
  Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function ClientHome() {
  const {
    user,
    selectedServicio,
    loading,
    facturaActual,
    guardias,
    telefonos,
    notificaciones,
    dismissNotification,
    datosBancarios,
  } = useClientPortal();

  const displayName = formatUserDisplayName(user?.full_name || user?.nombre || "Cliente", user?.role);
  const servicioNombre = selectedServicio?.nombre || "Servicio Asignado";

  const getTurnoBadge = (turno) => {
    const t = (turno || "").toLowerCase();
    if (t.includes("matutino")) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-semibold">Turno Matutino</Badge>;
    }
    if (t.includes("vespertino")) {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-semibold">Turno Vespertino</Badge>;
    }
    if (t.includes("cubre") || t.includes("descanso")) {
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-semibold">Cubre Descansos</Badge>;
    }
    return <Badge variant="outline" className="text-xs font-semibold capitalize">{turno || "Turno 12h"}</Badge>;
  };

  const getFacturaStatusBadge = (estado) => {
    switch (estado?.toLowerCase()) {
      case "pagado":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-xs font-semibold px-3 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 inline" /> Al Corriente / Pagado
          </Badge>
        );
      case "parcial":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 text-xs font-semibold px-3 py-1">
            <Clock className="w-3.5 h-3.5 mr-1 text-blue-600 inline" /> Pago Parcial
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-xs font-semibold px-3 py-1">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600 inline" /> Pendiente de Pago
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* ══════════════════ GREETING & HEADER (SIN BOTONES DE AGENDA NI REPORTE) ══════════════════ */}
      {/* REGLA: "En inicio, igual dira Bienvenido, [Nombre de usuario], no dira rol, pero si dira 'Administrador de [Servicio]'." */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Bienvenido, {displayName}
            </h1>
            <p className="text-base sm:text-lg font-semibold text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              Administrador de {servicioNombre}
            </p>
          </div>

          {/* Campana de Notificaciones dentro de la tarjeta de Bienvenido */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative h-11 w-11 rounded-xl bg-card border-border shadow-xs hover:bg-muted shrink-0"
                aria-label={`Notificaciones${notificaciones.length > 0 ? ` (${notificaciones.length} no leídas)` : ""}`}
              >
                <Bell className="w-5 h-5 text-foreground" />
                {notificaciones.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {notificaciones.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[350px] sm:w-[420px] p-0 shadow-xl z-50">
              <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-foreground" />
                  <span className="font-bold text-sm">Notificaciones del Servicio</span>
                  <Badge variant="secondary" className="text-xs">
                    {notificaciones.length}
                  </Badge>
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
                {notificaciones.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-70" />
                    No tienes notificaciones pendientes. Todo al corriente.
                  </div>
                ) : (
                  notificaciones.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 text-xs transition-colors flex items-start gap-2.5 ${
                        notif.tipo === "finanzas"
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30"
                          : notif.tipo === "personal"
                          ? "bg-blue-50/70 dark:bg-blue-950/30"
                          : notif.tipo === "supervision"
                          ? "bg-indigo-50/70 dark:bg-indigo-950/30"
                          : notif.tipo === "capacitacion"
                          ? "bg-amber-50/70 dark:bg-amber-950/30"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className="p-1.5 rounded-md bg-card shadow-2xs shrink-0 mt-0.5">
                        {notif.tipo === "finanzas" && <DollarSign className="w-4 h-4 text-emerald-600" />}
                        {notif.tipo === "personal" && <UserIcon className="w-4 h-4 text-blue-600" />}
                        {notif.tipo === "supervision" && <Eye className="w-4 h-4 text-indigo-600" />}
                        {notif.tipo === "capacitacion" && <BookOpen className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-foreground truncate">
                            {notif.titulo}
                          </span>
                          {notif.urgente && (
                            <Badge className="bg-red-500 text-white text-[9px] py-0 px-1.5 shrink-0">
                              Urgente
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {notif.mensaje}
                        </p>
                        {notif.fecha && (
                          <span className="text-[10px] text-muted-foreground/80 block pt-0.5">
                            {notif.fecha}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => dismissNotification(notif.id)}
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-black/5"
                        title="Descartar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Decorative subtle background gradient */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ══════════════════ NOTIFICACIONES INTELIGENTES ══════════════════ */}
      {notificaciones.length > 0 && (
        <section aria-label="Notificaciones del Servicio" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              Avisos y Notificaciones del Servicio ({notificaciones.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notificaciones.slice(0, 4).map((notif) => {
              const isUrgent = notif.urgente;
              return (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                    isUrgent
                      ? "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                      : notif.tipo === "finanzas"
                      ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900"
                      : notif.tipo === "supervision"
                      ? "bg-indigo-50/80 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900"
                      : notif.tipo === "capacitacion"
                      ? "bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
                      : "bg-blue-50/80 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-card shadow-2xs shrink-0 mt-0.5">
                    {notif.tipo === "finanzas" && <DollarSign className="w-4 h-4 text-emerald-600" />}
                    {notif.tipo === "personal" && <UserIcon className="w-4 h-4 text-blue-600" />}
                    {notif.tipo === "supervision" && <Eye className="w-4 h-4 text-indigo-600" />}
                    {notif.tipo === "capacitacion" && <BookOpen className="w-4 h-4 text-amber-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-foreground truncate">
                        {notif.titulo}
                      </span>
                      {isUrgent && (
                        <Badge className="bg-red-600 text-white text-[9px] px-1.5 py-0">
                          Prioritario
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {notif.mensaje}
                    </p>
                    {notif.fecha && (
                      <span className="text-[10px] text-muted-foreground/80 block mt-1">
                        {notif.fecha}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => dismissNotification(notif.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Descartar aviso"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ══════════════════ SECCIONES DE ARRIBA HACIA ABAJO (NO DE LADO A LADO) ══════════════════ */}
      {/* 1. FACTURA  ↓
          2. GUARDIAS  ↓
          3. TELÉFONOS ↓ */}
      <div className="space-y-6">

        {/* ────────────────── 1. SECCIÓN: FACTURA DEL MES (ARRIBA) ────────────────── */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold shadow-2xs">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Factura del Mes
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {facturaActual?.mes
                      ? `Periodo fiscal correspondiente: ${facturaActual.mes}`
                      : "Estado financiero de tu servicio"}
                  </CardDescription>
                </div>
              </div>
              {facturaActual && (
                <div>
                  {getFacturaStatusBadge(facturaActual.estado)}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {facturaActual ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Factura Details: Monto y Fechas */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase font-semibold block">
                        Monto de Factura
                      </span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                        {Number(facturaActual.monto || 0).toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Fecha Límite:</span>
                      <span className="text-xs font-bold text-foreground">
                        {facturaActual.fecha_limite_pago || "Fin de mes"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border bg-card">
                      <span className="text-muted-foreground block">Fecha de Emisión:</span>
                      <span className="font-semibold text-foreground">
                        {facturaActual.fecha_factura || facturaActual.fecha_envio || "Emitida"}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <span className="text-muted-foreground block">Método preferente:</span>
                      <span className="font-semibold text-foreground capitalize">
                        {facturaActual.metodo_pago || "Transferencia SPEI"}
                      </span>
                    </div>
                  </div>

                  {facturaActual.fecha_pago && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Pago confirmado registrado el: <strong>{facturaActual.fecha_pago}</strong></span>
                    </div>
                  )}
                </div>

                {/* Bank Transfer Instructions or Alternative Payment Notice */}
                {(() => {
                  const metodo = (facturaActual?.metodo_pago || "transferencia").toLowerCase().trim();
                  const esEfectivo = metodo.includes("efectivo");
                  const esCheque = metodo.includes("cheque");
                  const esTransferencia = !esEfectivo && !esCheque;

                  if (esTransferencia) {
                    return (
                      <div className="lg:col-span-6">
                        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                          <div className="font-bold flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-300">
                            <CreditCard className="w-4 h-4" /> Datos Bancarios para Pago SERCO
                          </div>
                          <div className="space-y-1 text-xs">
                            <p><strong>Beneficiario:</strong> {datosBancarios?.beneficiario || "SERCO SEGURIDAD PRIVADA S.A. DE C.V."}</p>
                            <p><strong>Banco:</strong> {datosBancarios?.banco || "BBVA México"}</p>
                            {datosBancarios?.cuenta && (
                              <p><strong>Número de Cuenta:</strong> <span className="font-mono font-bold">{datosBancarios.cuenta}</span></p>
                            )}
                            <p><strong>CLABE Interbancaria:</strong> <span className="font-mono font-bold tracking-wider">{datosBancarios?.clabe || "012 180 00123456789 0"}</span></p>
                            {datosBancarios?.notas && datosBancarios.notas.trim() && !datosBancarios.notas.includes("Favor de indicar como referencia el nombre de su servicio") ? (
                              <p className="text-[11px] text-amber-800 dark:text-amber-300 pt-1">
                                * {datosBancarios.notas}
                              </p>
                            ) : null}
                            <p className="text-[11px] text-amber-800 dark:text-amber-300">
                              * Recuerda colocar como concepto o referencia el nombre del servicio: <strong>{servicioNombre}</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (esEfectivo) {
                    return (
                      <div className="lg:col-span-6">
                        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                          <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-800 dark:text-emerald-300">
                            <DollarSign className="w-4 h-4" /> Modalidad de Pago: Efectivo
                          </div>
                          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                            Este cobro está configurado para liquidarse en <strong>efectivo</strong>.
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            La recolección o entrega de comprobante es gestionada directamente con el personal administrativo o de supervisión de SERCO.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (esCheque) {
                    return (
                      <div className="lg:col-span-6">
                        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 space-y-2">
                          <div className="font-bold flex items-center gap-1.5 text-sm text-blue-800 dark:text-blue-300">
                            <FileText className="w-4 h-4" /> Modalidad de Pago: Cheque
                          </div>
                          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                            Este cobro está configurado para liquidarse mediante <strong>cheque nominativo</strong>.
                          </p>
                          <p className="text-xs text-blue-900 dark:text-blue-200">
                            Expedir a nombre de: <strong>{datosBancarios?.beneficiario || "SERCO SEGURIDAD PRIVADA S.A. DE C.V."}</strong>.
                          </p>
                          <p className="text-[11px] text-blue-700 dark:text-blue-400">
                            Favor de coordinar la entrega con el área administrativa o de supervisión asignada.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                <p className="text-sm font-medium">No hay factura registrada este mes para este servicio.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ────────────────── 2. SECCIÓN: GUARDIAS ASIGNADOS (EN MEDIO) ────────────────── */}
        {/* REGLA: "pon los guardias en orden matutino, vespertino y cubredescansos" */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold shadow-2xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Guardias Asignados al Servicio
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Plantilla operativa activa (Ordenada por turno: Matutino, Vespertino y Cubredescansos)
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {guardias.length} en plantilla
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {guardias.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">No hay guardias asignados en este servicio.</p>
                <p className="text-xs">Comunícate con Operaciones SERCO para coordinar la asignación.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {guardias.map((guardia) => (
                  <div
                    key={guardia.id}
                    className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition flex items-center gap-3.5 shadow-2xs"
                  >
                    <Avatar className="w-12 h-12 border border-border shadow-xs shrink-0">
                      <AvatarImage src={guardia.foto_url} alt={guardia.nombre} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                        {guardia.nombre
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {guardia.nombre}
                      </h4>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {guardia.puesto}
                      </p>
                      <div>
                        {getTurnoBadge(guardia.turno)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ────────────────── 3. SECCIÓN: TELÉFONOS (ABAJO) ────────────────── */}
        {/* REGLA: "el numero de telefono tomalo del apartado de celulares en el modulo de egresos" */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold shadow-2xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Teléfonos y Celulares Asignados
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Líneas operativas del servicio registradas en el catálogo de celulares
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {telefonos.length} celulares
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {telefonos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">No hay celulares asignados a este servicio en el módulo de egresos.</p>
                <p className="text-xs">El equipo administrativo registrará la línea asignada en el catálogo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {telefonos.map((tel) => (
                  <div
                    key={tel.id}
                    className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition flex items-center gap-3.5 shadow-2xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-foreground block truncate">
                        {tel.nombre}
                      </span>
                      <a
                        href={`tel:${tel.numero}`}
                        className="text-xs font-mono font-bold text-primary hover:underline block"
                      >
                        {tel.numero}
                      </a>
                      <span className="text-[10px] text-muted-foreground">
                        {tel.compania || "Compañía Telefónica"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
