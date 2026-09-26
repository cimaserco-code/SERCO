import React, { useState } from "react";
import { useClientPortal } from "@/context/ClientPortalContext";
import {
  Headphones,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MessageCircle,
  Building2,
  UserCheck,
  Shield,
  Briefcase,
  DollarSign,
  Users,
  Inbox,
  Sparkles,
  User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function ClientAtencion() {
  const { selectedServicio, reportesCliente, addReporte, organigramaEmpleados } = useClientPortal();

  const [form, setForm] = useState({
    tipo: "Incidencia Operativa",
    titulo: "",
    prioridad: "Normal",
    descripcion: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      toast({
        title: "Campos incompletos",
        description: "Por favor proporciona un título y una descripción detallada.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const created = addReporte(form);
      toast({
        title: "Reporte Levantado con Éxito",
        description: `Se ha registrado el folio ${created.id}. El equipo de SERCO atenderá tu solicitud a la brevedad.`,
      });
      setForm({
        tipo: "Incidencia Operativa",
        titulo: "",
        prioridad: "Normal",
        descripcion: "",
      });
    } catch {
      toast({
        title: "Error al levantar reporte",
        description: "Hubo un problema al procesar el reporte. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado?.toLowerCase()) {
      case "atendido":
        return <Badge className="bg-emerald-500 text-white text-[10px]">Atendido</Badge>;
      case "en proceso":
      case "en revisión":
        return <Badge className="bg-blue-500 text-white text-[10px]">En Revisión</Badge>;
      default:
        return <Badge className="bg-amber-500 text-white text-[10px]">Recibido</Badge>;
    }
  };

  const cleanPhone = (phone) => {
    if (!phone) return "";
    return phone.replace(/[^\d]/g, "");
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* ══════════════════ HEADER ══════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
              <Headphones className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Centro de Atención y Soporte
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Levanta solicitudes o incidencias operativas y consulta el directorio directo del personal de oficina y supervisión de tu sede en{" "}
            <span className="font-semibold text-foreground">
              {selectedServicio?.nombre || "tu servicio"}
            </span>
          </p>
        </div>
      </div>

      {/* ══════════════════ SECCIONES DE ARRIBA HACIA ABAJO (VERTICAL STACK) ══════════════════ */}
      <div className="space-y-6">

        {/* ────────────────── 1. LEVANTAR REPORTE (ARRIBA) ────────────────── */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-2xs">
                <Send className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Levantar Reporte o Incidencia
                </CardTitle>
                <CardDescription className="text-xs">
                  Tu reporte será canalizado inmediatamente al área de Operaciones SERCO
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Reporte *</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(val) => setForm({ ...form, tipo: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Incidencia Operativa">Incidencia Operativa</SelectItem>
                      <SelectItem value="Falta de Personal / Guardia">Falta de Personal / Guardia</SelectItem>
                      <SelectItem value="Desempeño o Consigna">Desempeño o Consigna</SelectItem>
                      <SelectItem value="Requerimiento de Equipo / Celular">Requerimiento de Equipo / Celular</SelectItem>
                      <SelectItem value="Duda sobre Facturación">Duda sobre Facturación</SelectItem>
                      <SelectItem value="Felicitación / Sugerencia">Felicitación / Sugerencia</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nivel de Prioridad *</Label>
                  <Select
                    value={form.prioridad}
                    onValueChange={(val) => setForm({ ...form, prioridad: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baja">Baja (Informativo)</SelectItem>
                      <SelectItem value="Normal">Normal (Atención en jornada)</SelectItem>
                      <SelectItem value="Alta">Alta (Atención prioritaria)</SelectItem>
                      <SelectItem value="Urgente">Urgente (Reacción inmediata)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Asunto o Título del Reporte *</Label>
                <Input
                  placeholder="Ej: Ausencia de guardia matutino / Solicitud de cambio de turno"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descripción Detallada *</Label>
                <Textarea
                  placeholder="Describe los hechos, fecha, hora y cualquier información relevante para que el equipo operativo tome acción inmediata..."
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="min-h-[110px] text-xs leading-relaxed"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary text-primary-foreground hover:opacity-90 font-semibold text-xs h-9 px-5 gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Enviando..." : "Enviar Reporte a SERCO"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ────────────────── 2. HISTORIAL DE REPORTES (EN MEDIO) ────────────────── */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold shadow-2xs">
                  <Inbox className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Historial de Reportes del Servicio
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Seguimiento y respuestas a incidencias levantadas
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {reportesCliente.length} registrados
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {reportesCliente.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-60" />
                No tienes reportes pendientes. Todas las solicitudes e incidencias previas están atendidas.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {reportesCliente.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-xl border border-border bg-card hover:bg-muted/20 space-y-2.5 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          {rep.id}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-foreground">
                          {rep.titulo}
                        </span>
                      </div>
                      {getStatusBadge(rep.estado)}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rep.descripcion}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/60">
                      <span>Tipo: <strong>{rep.tipo}</strong> | Prioridad: <strong>{rep.prioridad}</strong></span>
                      <span>{rep.fecha} {rep.hora && `- ${rep.hora}`}</span>
                    </div>

                    {rep.respuesta && (
                      <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border text-xs text-foreground flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground">Respuesta SERCO: </span>
                          {rep.respuesta}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ────────────────── 3. ORGANIGRAMA: EMPLEADOS DE OFICINA O SUPERVISIÓN DE LA SEDE (ABAJO) ────────────────── */}
        {/* REGLA: "toma los empleados con servicio de oficina o supervision asignados a la sede donde se encuentra el servicio" */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center font-bold shadow-2xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Organigrama y Directorio de Sede
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Personal de oficina y supervisión asignado a la sede de tu servicio
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {organigramaEmpleados.length} contactos
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {organigramaEmpleados.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-6 text-muted-foreground text-xs">
                  <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-foreground">No hay personal de oficina o supervisión asignado directamente a esta sede en el catálogo.</p>
                  <p className="text-xs mt-1">Puedes comunicarte a la Central de Operaciones de SERCO:</p>
                </div>

                {/* Central de Operaciones Fallback */}
                <div className="max-w-md mx-auto p-4 rounded-xl border border-border bg-card shadow-xs text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto font-bold">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Mesa de Control y Emergencias 24/7</h4>
                    <p className="text-xs text-muted-foreground">Operaciones Centrales SERCO</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Button size="sm" variant="outline" asChild className="h-8 text-xs font-semibold gap-1.5">
                      <a href="tel:2288123456">
                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                        <span>228 812 3456</span>
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" asChild className="h-8 text-xs font-semibold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400">
                      <a href="https://wa.me/522288123456" target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {organigramaEmpleados.map((emp) => {
                  const rawPhone = emp.telefono || "";
                  const cPhone = cleanPhone(rawPhone);
                  const isSupervisor = (emp.puesto || "").toLowerCase().includes("supervis");

                  return (
                    <div
                      key={emp.id}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition flex flex-col justify-between space-y-3 shadow-2xs"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-12 h-12 border border-border shadow-xs shrink-0">
                            <AvatarImage src={emp.foto_url_runtime || undefined} alt={emp.nombre_completo} className="object-cover" />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                              {(emp.nombre_completo || "S")
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                className={`text-[10px] px-1.5 py-0 ${
                                  isSupervisor
                                    ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
                                    : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                                }`}
                              >
                                {isSupervisor ? "Supervisión" : "Oficina"}
                              </Badge>
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-foreground truncate mt-1">
                              {emp.nombre_completo}
                            </h4>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {emp.puesto || "Personal Operativo"}
                            </span>
                          </div>
                        </div>

                        {emp.servicio_ubicacion && (
                          <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg">
                            <strong className="text-foreground">Área / Servicio:</strong> {emp.servicio_ubicacion}
                          </div>
                        )}
                      </div>

                      {/* Contact Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        {rawPhone ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-8 text-xs font-semibold flex-1 gap-1.5"
                            >
                              <a href={`tel:${cPhone}`}>
                                <Phone className="w-3.5 h-3.5 text-blue-600" />
                                <span>Llamar</span>
                              </a>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-8 text-xs font-semibold flex-1 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                            >
                              <a
                                href={`https://wa.me/52${cPhone}?text=Hola%20${encodeURIComponent(emp.nombre_completo)},%20me%20comunico%20del%20servicio%20${encodeURIComponent(selectedServicio?.nombre || "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>WhatsApp</span>
                              </a>
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic py-1">
                            Sin teléfono registrado
                          </span>
                        )}

                        {(emp.email || emp.correo) && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-8 text-xs font-semibold flex-1 gap-1.5"
                          >
                            <a href={`mailto:${emp.email || emp.correo}?subject=Atención%20Servicio%20${encodeURIComponent(selectedServicio?.nombre || "")}`}>
                              <Mail className="w-3.5 h-3.5 text-foreground" />
                              <span>Correo</span>
                            </a>
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

      </div>
    </div>
  );
}
