import React, { useState, useEffect, useMemo } from "react";
import { useClientPortal } from "@/context/ClientPortalContext";
import { formatUserDisplayName } from "@/lib/userNameFormatting";
import { sercoApi } from "@/api/sercoClient";
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
  Bell,
  Download,
  Printer,
  Loader2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  QrCode,
  Copy,
  ExternalLink,
  MessageCircle,
  Share2
} from "lucide-react";
import QRCode from "qrcode";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateFichaTecnicaPDF } from "@/lib/fichaTecnicaTemplate";

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

  const [selectedGuardiaFicha, setSelectedGuardiaFicha] = useState(null);
  const [fichaPdfUrl, setFichaPdfUrl] = useState(null);
  const [fichaDocToSave, setFichaDocToSave] = useState(null);
  const [fichaFilename, setFichaFilename] = useState("");
  const [loadingFichaPdf, setLoadingFichaPdf] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("ficha");
  const [guardiaAsistencias, setGuardiaAsistencias] = useState([]);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);
  const [selectedAsistenciaMonth, setSelectedAsistenciaMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const [selYear, selMonthNum] = (selectedAsistenciaMonth || "").split("-").map(Number);
  const selMonthName = monthNames[(selMonthNum || 1) - 1] || "";

  const empMonthAsists = useMemo(() => {
    return (guardiaAsistencias || []).filter(
      (a) => a.fecha && a.fecha.startsWith(selectedAsistenciaMonth)
    );
  }, [guardiaAsistencias, selectedAsistenciaMonth]);

  const asistenciaStats = useMemo(() => {
    const totalA = empMonthAsists.filter((a) => a.estado === "asistió").length;
    const totalR = empMonthAsists.filter((a) => a.estado === "retraso").length;
    const totalF = empMonthAsists.filter((a) => a.estado === "falta").length;
    const totalD = empMonthAsists.filter((a) => a.estado === "descanso").length;
    const totalE = empMonthAsists.filter((a) => a.estado === "extra").length;
    const totalDL = empMonthAsists.filter((a) => a.estado === "descanso_laborado").length;
    const totalDLE = empMonthAsists.filter((a) => a.estado === "descanso_extra").length;
    const totalV = empMonthAsists.filter((a) => a.estado === "vacaciones").length;
    const totalJ = empMonthAsists.filter((a) => a.estado === "justificada").length;

    const divisor = totalA + totalR + totalF + totalDL + totalDLE;
    const punctuality = divisor > 0 ? Math.round(((totalA + totalR + totalDL + totalDLE) / divisor) * 100) : 100;

    return { totalA, totalR, totalF, totalD, totalE, totalDL, totalDLE, totalV, totalJ, punctuality };
  }, [empMonthAsists]);

  // Modal de Enlace y Código QR para Residentes
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const publicDirectorioUrl = useMemo(() => {
    if (!selectedServicio?.id) return "";
    return `${window.location.origin}/residente/${selectedServicio.id}`;
  }, [selectedServicio?.id]);

  useEffect(() => {
    if (publicDirectorioUrl && qrModalOpen) {
      try {
        QRCode.toDataURL(publicDirectorioUrl, {
          width: 380,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        })
          .then((url) => setQrDataUrl(url))
          .catch((err) => {
            console.warn("Fallback QR generator activated:", err);
            setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(publicDirectorioUrl)}`);
          });
      } catch (err) {
        console.warn("Error invoking QRCode:", err);
        setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(publicDirectorioUrl)}`);
      }
    }
  }, [publicDirectorioUrl, qrModalOpen]);

  const handleCopyLink = () => {
    if (!publicDirectorioUrl) return;
    navigator.clipboard.writeText(publicDirectorioUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyWhatsapp = () => {
    const text = `Estimados residentes y vecinos de ${servicioNombre}:\n\nLes compartimos el enlace al Directorio Oficial de Caseta de Seguridad SERCO. Aquí pueden consultar en tiempo real quiénes son los guardias en turno y los teléfonos directos de la caseta:\n\n👉 ${publicDirectorioUrl}\n\n(No requiere usuario ni contraseña).`;
    navigator.clipboard.writeText(text);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR_Caseta_${(selectedServicio?.nombre || "servicio").replace(/\s+/g, "_")}.png`;
    a.click();
  };

  const handlePrintPoster = () => {
    if (!qrDataUrl || !selectedServicio) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Directorio de Seguridad - ${selectedServicio.nombre}</title>
        <style>
          @page { size: letter; margin: 20mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            text-align: center;
            color: #0f172a;
          }
          .card {
            border: 3px solid #0f172a;
            border-radius: 20px;
            padding: 40px 30px;
            max-width: 600px;
            margin: 0 auto;
          }
          .logo {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: 2px;
            color: #0f172a;
            text-transform: uppercase;
          }
          .sublogo {
            font-size: 13px;
            font-weight: 600;
            color: #d97706;
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .divider {
            height: 2px;
            background: #e2e8f0;
            margin: 20px auto;
            width: 80%;
          }
          .service-name {
            font-size: 28px;
            font-weight: 800;
            margin: 10px 0 5px 0;
            color: #1e293b;
          }
          .badge {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 25px;
          }
          .qr-img {
            width: 260px;
            height: 260px;
            margin: 0 auto;
            display: block;
            border-radius: 12px;
            border: 1px solid #cbd5e1;
            padding: 8px;
            background: #fff;
          }
          .instruction {
            font-size: 18px;
            font-weight: 700;
            margin-top: 25px;
            color: #0f172a;
          }
          .sub-instruction {
            font-size: 13px;
            color: #64748b;
            margin-top: 6px;
            max-width: 450px;
            margin-left: auto;
            margin-right: auto;
          }
          .footer-note {
            margin-top: 35px;
            font-size: 11px;
            color: #94a3b8;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">SERCO SEGURIDAD PRIVADA</div>
          <div class="sublogo">Protección y Confianza 24/7</div>
          <div class="divider"></div>
          <div class="service-name">${selectedServicio.nombre}</div>
          <div class="badge">Directorio Oficial de Caseta para Residentes</div>
          <img src="${qrDataUrl}" class="qr-img" alt="Código QR" />
          <div class="instruction">📱 Escanea con tu celular</div>
          <div class="sub-instruction">
            Apunta la cámara de tu teléfono a este código para consultar los nombres de los guardias en turno y los números de teléfono directo de la caseta.
          </div>
          <div class="footer-note">
            No requiere registro ni contraseña · Acceso exclusivo para residentes
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleOpenFicha = async (guardia) => {
    setSelectedGuardiaFicha(guardia);
    setActiveModalTab("ficha");
    setLoadingFichaPdf(true);
    setFichaPdfUrl(null);
    setFichaDocToSave(null);
    setLoadingAsistencia(true);
    setGuardiaAsistencias([]);

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setSelectedAsistenciaMonth(currentMonthKey);

    const empId = guardia.empleado?.id || guardia.id;

    if (empId) {
      sercoApi.entities.Asistencia.filter({ empleado_id: empId }, "-fecha")
        .then((res) => {
          setGuardiaAsistencias(res || []);
        })
        .catch((err) => {
          console.warn("Error cargando asistencias del guardia:", err);
          setGuardiaAsistencias([]);
        })
        .finally(() => {
          setLoadingAsistencia(false);
        });
    } else {
      setLoadingAsistencia(false);
    }

    try {
      const emp = guardia.empleado || {
        nombre_completo: guardia.nombre,
        puesto: guardia.puesto,
        turno: guardia.turno,
        foto_url: guardia.foto_url,
        foto_url_runtime: guardia.foto_url_runtime,
        servicio_ubicacion: selectedServicio?.nombre,
      };

      const result = await generateFichaTecnicaPDF(
        emp,
        {
          tipo_movimiento: "ALTA",
          fecha_movimiento: emp.fecha_ingreso || new Date().toISOString().slice(0, 10),
          sede_nombre: selectedServicio?.sede_nombre || "Monterrey",
          servicio_nombre: selectedServicio?.nombre,
          turno: guardia.turno || emp.turno || "Matutino",
        },
        { returnDoc: true }
      );

      setFichaDocToSave(result.doc);
      setFichaPdfUrl(result.blobUrl);
      setFichaFilename(result.filename || `Ficha_Tecnica_${(guardia.nombre || "guardia").replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("Error al generar Ficha Técnica:", err);
    } finally {
      setLoadingFichaPdf(false);
    }
  };

  const handleCloseFicha = () => {
    if (fichaPdfUrl) {
      try {
        URL.revokeObjectURL(fichaPdfUrl);
      } catch {}
    }
    setFichaPdfUrl(null);
    setFichaDocToSave(null);
    setSelectedGuardiaFicha(null);
    setGuardiaAsistencias([]);
    setActiveModalTab("ficha");
  };

  const getAsistenciaStatusBadge = (estado, festivo) => {
    if (festivo) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[11px]">
          ⭐ Festivo
        </Badge>
      );
    }
    switch (estado?.toLowerCase()) {
      case "asistió":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[11px]">
            ✓ Asistió
          </Badge>
        );
      case "retraso":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-[11px]">
            ⏱ Retraso (R)
          </Badge>
        );
      case "falta":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[11px]">
            ✕ Falta (F)
          </Badge>
        );
      case "descanso":
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 font-bold text-[11px]">
            Descanso (D)
          </Badge>
        );
      case "extra":
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 font-bold text-[11px]">
            + Turno Extra (E)
          </Badge>
        );
      case "descanso_laborado":
        return (
          <Badge className="bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 font-bold text-[11px]">
            Descanso Lab. (DL)
          </Badge>
        );
      case "descanso_extra":
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold text-[11px]">
            Descanso Extra (DLE)
          </Badge>
        );
      case "vacaciones":
        return (
          <Badge className="bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 font-bold text-[11px]">
            Vacaciones (V)
          </Badge>
        );
      case "justificada":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-[11px]">
            Justificada (J)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[11px] font-medium capitalize">
            {estado || "Sin registro"}
          </Badge>
        );
    }
  };

  const formatFechaDia = (fechaStr) => {
    if (!fechaStr) return "";
    try {
      const [y, m, d] = fechaStr.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      const diaSemana = dias[date.getDay()];
      return `${diaSemana} ${d}`;
    } catch {
      return fechaStr;
    }
  };

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

          <div className="flex items-center gap-2">
            {/* Botón para abrir el Enlace y QR del Directorio para Residentes */}
            <Button
              onClick={() => setQrModalOpen(true)}
              className="h-11 px-4 rounded-xl text-xs font-bold gap-2 shadow-xs bg-amber-500 hover:bg-amber-600 text-white shrink-0"
              title="Generar enlace o código QR para colonos y residentes"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Enlace para Residentes (QR)</span>
              <span className="sm:hidden">QR Caseta</span>
            </Button>

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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQrModalOpen(true)}
                  className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/5 hidden sm:flex"
                  title="Compartir directorio de guardias con residentes"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Directorio Residentes (QR)
                </Button>
                <Badge variant="outline" className="text-xs font-semibold">
                  {guardias.length} en plantilla
                </Badge>
              </div>
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
                    onClick={() => handleOpenFicha(guardia)}
                    className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 hover:shadow-xs transition cursor-pointer flex items-center gap-3.5 shadow-2xs group"
                    role="button"
                    tabIndex={0}
                    title="Click para ver la Ficha Técnica y el Resumen de Asistencias del guardia"
                  >
                    <Avatar className="w-12 h-12 border border-border shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <AvatarImage src={guardia.foto_url_runtime || undefined} alt={guardia.nombre} className="object-cover" />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                        {guardia.nombre
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {guardia.nombre}
                        </h4>
                        <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                          <FileText className="w-3.5 h-3.5" title="Ficha Técnica" />
                          <UserCheck className="w-3.5 h-3.5" title="Asistencias" />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {guardia.puesto}
                      </p>
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        {getTurnoBadge(guardia.turno)}
                        <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                          Ficha y asistencia &rarr;
                        </span>
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

      {/* ────────────────── MODAL DE DETALLE DEL GUARDIA (FICHA TÉCNICA Y ASISTENCIAS) ────────────────── */}
      <Dialog open={!!selectedGuardiaFicha} onOpenChange={(open) => !open && handleCloseFicha()}>
        <DialogContent className="max-w-4xl w-[96vw] h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border border-border shadow-xs shrink-0">
                  <AvatarImage src={selectedGuardiaFicha?.foto_url_runtime || selectedGuardiaFicha?.foto_url || undefined} alt={selectedGuardiaFicha?.nombre} className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                    {(selectedGuardiaFicha?.nombre || "G").split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <span>{selectedGuardiaFicha?.nombre}</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                    <span>{selectedGuardiaFicha?.puesto || "Guardia de Seguridad"}</span>
                    <span>•</span>
                    <span className="capitalize">{selectedGuardiaFicha?.turno}</span>
                    <span>•</span>
                    <span>{servicioNombre}</span>
                  </DialogDescription>
                </div>
              </div>

              {/* KPI Badge de puntualidad mensual en el encabezado */}
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 font-bold text-xs px-2.5 py-1">
                  <UserCheck className="w-3.5 h-3.5 mr-1 inline" />
                  {asistenciaStats.punctuality}% Asistencia ({selMonthName})
                </Badge>
              </div>
            </div>

            {/* Pestañas de Navegación */}
            <Tabs value={activeModalTab} onValueChange={setActiveModalTab} className="w-full mt-3">
              <TabsList className="grid grid-cols-2 w-full max-w-sm">
                <TabsTrigger value="ficha" className="gap-2 text-xs font-semibold">
                  <FileText className="w-3.5 h-3.5" />
                  Ficha Técnica
                </TabsTrigger>
                <TabsTrigger value="asistencia" className="gap-2 text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5" />
                  Resumen de Asistencia
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>

          {/* CUERPO DEL MODAL SEGÚN PESTAÑA */}
          {activeModalTab === "ficha" ? (
            /* Vista 1: Ficha Técnica Oficial PDF */
            <div className="flex-1 w-full my-3 bg-muted/20 rounded-xl overflow-hidden border border-border flex items-center justify-center min-h-0">
              {loadingFichaPdf ? (
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="font-medium">Generando ficha técnica del guardia...</span>
                </div>
              ) : fichaPdfUrl ? (
                <iframe
                  src={fichaPdfUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title={`Ficha Técnica - ${selectedGuardiaFicha?.nombre}`}
                />
              ) : (
                <div className="text-center p-6 text-muted-foreground text-sm">
                  <p>No se pudo generar la vista previa del documento.</p>
                </div>
              )}
            </div>
          ) : (
            /* Vista 2: Resumen y Reporte Mensual de Asistencias */
            <div className="flex-1 w-full my-3 overflow-y-auto pr-1 space-y-3.5 min-h-0">
              {/* Barra de Navegación de Mes */}
              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-xl border border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 font-semibold"
                  onClick={() => {
                    const prevDate = new Date(selYear, selMonthNum - 2, 1);
                    setSelectedAsistenciaMonth(
                      `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
                    );
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Mes Anterior
                </Button>
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-bold text-foreground block">
                    {selMonthName} {selYear}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Control mensual de asistencia en {servicioNombre}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 font-semibold"
                  onClick={() => {
                    const nextDate = new Date(selYear, selMonthNum, 1);
                    setSelectedAsistenciaMonth(
                      `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`
                    );
                  }}
                >
                  Mes Siguiente <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              {loadingAsistencia ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="font-medium">Cargando registros de asistencia...</span>
                </div>
              ) : (
                <>
                  {/* Tarjetas KPI Principales (idénticas a Asistencias.jsx) */}
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                    <Card className="bg-primary/5 border-primary/20 shadow-2xs">
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl sm:text-3xl font-black text-primary">
                          {asistenciaStats.punctuality}%
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                          Asistencia
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50 shadow-2xs">
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl sm:text-3xl font-black text-green-600">
                          {asistenciaStats.totalA}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                          Asistió
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50 shadow-2xs">
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl sm:text-3xl font-black text-orange-600">
                          {asistenciaStats.totalR}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                          Retrasos (R)
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Desglose Detallado de Registros */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="flex justify-between items-center bg-card px-3 py-2 rounded-lg border border-border text-xs shadow-2xs">
                      <span className="text-muted-foreground">Faltas:</span>
                      <span className="font-bold text-red-500">{asistenciaStats.totalF}</span>
                    </div>
                    <div className="flex justify-between items-center bg-card px-3 py-2 rounded-lg border border-border text-xs shadow-2xs">
                      <span className="text-muted-foreground">Turnos Extras (E):</span>
                      <span className="font-bold text-purple-600">{asistenciaStats.totalE}</span>
                    </div>
                    <div className="flex justify-between items-center bg-card px-3 py-2 rounded-lg border border-border text-xs shadow-2xs">
                      <span className="text-muted-foreground">Descansos (D):</span>
                      <span className="font-bold text-slate-500">{asistenciaStats.totalD}</span>
                    </div>
                    <div className="flex justify-between items-center bg-card px-3 py-2 rounded-lg border border-border text-xs shadow-2xs">
                      <span className="text-muted-foreground">Descanso Lab. (DL):</span>
                      <span className="font-bold text-sky-600">{asistenciaStats.totalDL}</span>
                    </div>
                    <div className="flex justify-between items-center bg-card px-3 py-2 rounded-lg border border-border text-xs shadow-2xs">
                      <span className="text-muted-foreground">Descanso + Extra (DLE):</span>
                      <span className="font-bold text-indigo-600">{asistenciaStats.totalDLE}</span>
                    </div>
                    <div className="flex justify-between items-center bg-card px-3 py-2 rounded-lg border border-border text-xs shadow-2xs">
                      <span className="text-muted-foreground">Vacaciones (V):</span>
                      <span className="font-bold text-teal-600">{asistenciaStats.totalV}</span>
                    </div>
                    <div className="flex justify-between items-center bg-card px-3 py-2 rounded-lg border border-border text-xs shadow-2xs col-span-2">
                      <span className="text-muted-foreground">Justificaciones (J):</span>
                      <span className="font-bold text-amber-600">{asistenciaStats.totalJ}</span>
                    </div>
                  </div>

                  {/* Tabla / Historial Día por Día del Mes */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                    <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-xs sm:text-sm font-bold text-foreground">
                          Bitácora Diaria de {selMonthName} {selYear}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {empMonthAsists.length} días registrados
                      </Badge>
                    </div>

                    {empMonthAsists.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-foreground">
                          No hay registros de asistencia en {selMonthName} de {selYear}.
                        </p>
                        <p className="text-xs mt-0.5">
                          Las asistencias tomadas en este servicio aparecerán listadas aquí.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60 max-h-56 overflow-y-auto">
                        {empMonthAsists
                          .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
                          .map((asist) => (
                            <div
                              key={asist.id || asist.fecha}
                              className="p-2.5 px-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-semibold text-foreground capitalize">
                                  {formatFechaDia(asist.fecha)}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  ({asist.fecha})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {asist.motivo && (
                                  <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px] hidden sm:inline" title={asist.motivo}>
                                    {asist.motivo}
                                  </span>
                                )}
                                {getAsistenciaStatusBadge(asist.estado, asist.festivo)}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer adaptativo según pestaña */}
          <DialogFooter className="pt-3 border-t border-border flex flex-row items-center justify-between gap-2 shrink-0 w-full">
            <Button variant="outline" size="sm" onClick={handleCloseFicha}>
              Cerrar
            </Button>

            <div className="flex items-center gap-2">
              {activeModalTab === "ficha" ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveModalTab("asistencia")}
                    className="gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Ver Asistencias</span>
                  </Button>
                  {fichaPdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(fichaPdfUrl, "_blank")}
                    >
                      <Printer className="w-4 h-4 mr-1.5" />
                      Imprimir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground font-semibold"
                    disabled={!fichaDocToSave}
                    onClick={() => {
                      if (fichaDocToSave && fichaFilename) {
                        fichaDocToSave.save(fichaFilename);
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Descargar PDF
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setActiveModalTab("ficha")}
                  className="gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ver Ficha Técnica</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ MODAL DE ENLACE Y CÓDIGO QR PARA RESIDENTES ══════════════════ */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Directorio de Caseta para Residentes
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Comparte este enlace o código QR con los colonos de <strong>{servicioNombre}</strong>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Aviso de Seguridad y Privacidad */}
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5">
                <p className="font-bold">Modo Seguro de Solo Lectura</p>
                <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                  Los residentes solo verán los nombres y turnos de los guardias, y los teléfonos de la caseta. 
                  Toda tu información financiera, facturas, sueldos y reportes internos permanecen estrictamente <strong>ocultos y protegidos</strong>.
                </p>
              </div>
            </div>

            {/* Código QR Generado */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border bg-card text-center sm:text-left">
              <div className="p-2 bg-white rounded-xl border shadow-xs shrink-0 mx-auto sm:mx-0">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Código QR del Directorio" className="w-36 h-36 object-contain" />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                  📱 Escaneo con Cámara Móvil
                </Badge>
                <h4 className="text-sm font-bold text-foreground">
                  Código QR para Caseta o Elevador
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Imprímelo y colócalo en la ventanilla de la caseta para que los vecinos lo escaneen sin necesidad de instalar nada.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadQr}
                    className="h-8 text-xs gap-1.5"
                    disabled={!qrDataUrl}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar QR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrintPoster}
                    className="h-8 text-xs gap-1.5"
                    disabled={!qrDataUrl}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Letrero
                  </Button>
                </div>
              </div>
            </div>

            {/* Enlace Directo para Copiar */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Enlace Directo del Directorio:</span>
                <a
                  href={publicDirectorioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline text-[11px] inline-flex items-center gap-1 font-semibold"
                >
                  Abrir vista previa <ExternalLink className="w-3 h-3" />
                </a>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicDirectorioUrl}
                  className="h-9 px-3 rounded-lg border bg-muted/40 text-xs font-mono flex-1 text-foreground focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyLink}
                  className="h-9 px-3 text-xs gap-1.5 shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>

            {/* Compartir por WhatsApp a Grupos de Vecinos */}
            <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-foreground">Compartir en WhatsApp de Vecinos</span>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950">
                  Listo para enviar
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Copia este mensaje prediseñado o compártelo directo en el grupo de chat de tu fraccionamiento:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Estimados residentes de ${servicioNombre}:\n\nCompartimos el Directorio Oficial de Seguridad y Caseta SERCO (guardias en turno y teléfonos de caseta): ${publicDirectorioUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Abrir WhatsApp
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyWhatsapp}
                  className="h-8 text-xs gap-1.5"
                >
                  {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMessage ? "Mensaje Copiado" : "Copiar Texto"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20">
            <Button size="sm" variant="outline" onClick={() => setQrModalOpen(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
