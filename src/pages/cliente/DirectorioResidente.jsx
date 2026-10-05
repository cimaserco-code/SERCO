import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  Shield,
  ShieldCheck,
  Building2,
  Phone,
  PhoneCall,
  Clock,
  Users,
  MapPin,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DirectorioResidente() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [servicio, setServicio] = useState(null);
  const [guardias, setGuardias] = useState([]);
  const [telefonos, setTelefonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Actualizar hora cada minuto para dar sensación de monitoreo en vivo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const applyDirectoryPayload = (payload) => {
    if (!payload) return;
    setServicio({
      id: payload.id || id,
      nombre: payload.n || payload.nombre || "Servicio SERCO",
      direccion: payload.dir || payload.direccion || "",
      ciudad: payload.ciudad || "",
      telefono: payload.t1 || payload.telefono || "",
      telefono_2: payload.t2 || payload.telefono_2 || "",
      estado: payload.estado || "activo",
    });

    if (Array.isArray(payload.g)) {
      setGuardias(
        payload.g.map((g, idx) => ({
          id: g.id || `g_${idx}`,
          nombre: g.n || g.nombre || "Guardia de Seguridad",
          puesto: g.p || g.puesto || "Guardia de Seguridad",
          turno: g.t || g.turno || "Matutino",
          foto_url: g.f || g.foto_url || null,
        }))
      );
    } else if (Array.isArray(payload.guardias)) {
      setGuardias(payload.guardias);
    }

    if (Array.isArray(payload.tel)) {
      setTelefonos(
        payload.tel.map((t, idx) => ({
          id: t.id || `tel_${idx}`,
          numero: t.num || t.numero || "",
          etiqueta: t.nom || t.etiqueta || "Caseta Principal",
          compania: t.c || t.compania || "",
          tipo: t.tipo || "caseta",
        }))
      );
    } else if (Array.isArray(payload.telefonos)) {
      setTelefonos(payload.telefonos);
    }
  };

  useEffect(() => {
    loadDirectorio();
  }, [id, searchParams]);

  async function loadDirectorio() {
    setLoading(true);
    setError(null);
    try {
      // 1. PRIMER NIVEL: Token codificado en parámetro de URL (funciona siempre sin login ni base de datos)
      const token = searchParams.get("d");
      if (token) {
        try {
          let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
          while (base64.length % 4) base64 += "=";
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const json = new TextDecoder().decode(bytes);
          const parsed = JSON.parse(json);
          if (parsed && (parsed.id === id || !id || parsed.n)) {
            applyDirectoryPayload(parsed);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("No se pudo decodificar el token de URL:", e);
        }
      }

      // 2. SEGUNDO NIVEL: Cache local prealmacenado en este dispositivo/navegador
      if (id) {
        try {
          const localCached = localStorage.getItem(`serco_residente_directorio_${id}`);
          if (localCached) {
            const parsed = JSON.parse(localCached);
            if (parsed && (parsed.id === id || parsed.n)) {
              applyDirectoryPayload(parsed);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("No se pudo leer de cache local:", e);
        }
      }

      // 3. TERCER NIVEL: Función RPC de Supabase con SECURITY DEFINER
      if (id) {
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc("get_directorio_residente", {
            p_servicio_id: id,
          });
          if (!rpcErr && rpcData && rpcData.success && rpcData.servicio) {
            setServicio(rpcData.servicio);
            setGuardias(rpcData.guardias || []);
            setTelefonos(rpcData.telefonos || []);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("RPC get_directorio_residente no disponible:", e);
        }
      }

      // 4. CUARTO NIVEL: Consulta directa a la base de datos de Supabase
      if (!id) {
        throw new Error("No se especificó el servicio en el enlace.");
      }

      const { data: servData } = await supabase
        .from("servicios")
        .select("id, nombre, direccion, ciudad, telefono, telefono_2, estado, sede_id, admin_nombre")
        .eq("id", id)
        .maybeSingle();

      if (servData) {
        setServicio(servData);

        // Guardias vía función RPC de asistencia QR o asignación de turnos
        try {
          const { data: rpcGuards } = await supabase.rpc("get_personal_servicio_qr", {
            p_servicio_id: id,
          });
          if (rpcGuards && rpcGuards.length > 0) {
            setGuardias(
              rpcGuards.map((g) => ({
                id: g.empleado_id,
                nombre: g.nombre_completo,
                puesto: g.puesto || "Guardia de Seguridad",
                turno: g.turno || "Matutino",
                foto_url: null,
              }))
            );
          } else {
            // Intentar tabla asignacion_turnos
            const { data: asigData } = await supabase
              .from("asignacion_turnos")
              .select("id, empleado_id, empleado_nombre, turno")
              .eq("servicio_id", id);
            if (asigData && asigData.length > 0) {
              setGuardias(
                asigData.map((a) => ({
                  id: a.empleado_id || a.id,
                  nombre: a.empleado_nombre || "Guardia de Seguridad",
                  puesto: "Guardia de Seguridad",
                  turno: a.turno || "Matutino",
                  foto_url: null,
                }))
              );
            }
          }
        } catch {}

        // Teléfonos del servicio
        const phoneList = [];
        if (servData.telefono) {
          phoneList.push({
            id: "serv_tel_1",
            numero: servData.telefono,
            etiqueta: "Caseta Principal / Acceso",
            tipo: "caseta",
          });
        }
        if (servData.telefono_2) {
          phoneList.push({
            id: "serv_tel_2",
            numero: servData.telefono_2,
            etiqueta: "Teléfono Secundario / Rondín",
            tipo: "secundario",
          });
        }
        setTelefonos(phoneList);
        setLoading(false);
        return;
      }

      throw new Error("El servicio no fue encontrado o el enlace no es válido.");
    } catch (err) {
      console.error("Error al cargar directorio de residentes:", err);
      setError(err.message || "No se pudo cargar la información del directorio.");
    } finally {
      setLoading(false);
    }
  }

  const getTurnoBadge = (turno) => {
    const t = (turno || "").toLowerCase();
    if (t.includes("matutino")) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-semibold">
          Turno Matutino
        </Badge>
      );
    }
    if (t.includes("vespertino")) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-semibold">
          Turno Vespertino
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 text-xs font-semibold">
        {turno || "24 Horas"}
      </Badge>
    );
  };

  const cleanPhone = (num) => (num || "").replace(/\D/g, "");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto animate-pulse">
            <Shield className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Cargando directorio de seguridad...</p>
          <p className="text-xs text-muted-foreground">Obteniendo datos de caseta y guardias en turno</p>
        </div>
      </div>
    );
  }

  if (error || !servicio) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg">Directorio no disponible</CardTitle>
          <CardDescription className="text-xs">
            {error || "El enlace consultado no existe o no se encuentra activo."}
          </CardDescription>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="text-xs">
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
      {/* ══════════════════ CABECERA PRINCIPAL ══════════════════ */}
      <header className="bg-card border-b border-border sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-card/95">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="SERCO" className="h-8 w-auto object-contain" />
            <div>
              <span className="font-heading font-black text-xs tracking-wider text-primary uppercase block leading-none">
                SERCO SEGURIDAD
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Directorio Oficial de Caseta
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              Operativo
            </span>
          </div>
        </div>
      </header>

      {/* ══════════════════ CUERPO PRINCIPAL (MOBILE FIRST) ══════════════════ */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* TARJETA DEL RESIDENCIAL / SERVICIO */}
        <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-xs relative overflow-hidden">
          <div className="space-y-1.5">
            <Badge variant="outline" className="text-[10px] font-semibold bg-background/80 mb-1">
              <Building2 className="w-3 h-3 mr-1 text-primary" /> Caseta de Seguridad
            </Badge>
            <h1 className="text-2xl font-heading font-black text-foreground tracking-tight">
              {servicio.nombre}
            </h1>
            {servicio.direccion && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                {servicio.direccion}
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Turno actual: {currentTime.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })}
            </span>
            <span className="text-foreground font-semibold">
              {currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* ══════════════════ SECCIÓN 1: TELÉFONOS DE CONTACTO DIRECTO ══════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              Teléfonos de Caseta y Emergencia
            </h2>
            <span className="text-[10px] text-muted-foreground">Toca para llamar</span>
          </div>

          {telefonos.length === 0 ? (
            <Card className="border-dashed bg-card/50">
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                <Phone className="w-6 h-6 mx-auto mb-1 text-muted-foreground/40" />
                No hay teléfonos registrados aún para esta caseta.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {telefonos.map((tel) => {
                const numeric = cleanPhone(tel.numero);
                return (
                  <div
                    key={tel.id}
                    className="p-4 rounded-xl border bg-card hover:border-emerald-300 dark:hover:border-emerald-800 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase block truncate">
                        {tel.etiqueta}
                      </span>
                      <span className="text-base font-bold font-mono text-foreground block truncate">
                        {tel.numero}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${numeric}`}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Llamar
                      </a>
                      <a
                        href={`https://wa.me/52${numeric}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Enviar mensaje por WhatsApp"
                        className="p-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ══════════════════ SECCIÓN 2: GUARDIAS EN TURNO Y ASIGNADOS ══════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Guardias Asignados al Servicio ({guardias.length})
            </h2>
            <span className="text-[10px] text-muted-foreground">Personal acreditado</span>
          </div>

          {guardias.length === 0 ? (
            <Card className="border-dashed bg-card/50">
              <CardContent className="p-6 text-center text-xs text-muted-foreground space-y-1">
                <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-1" />
                <p className="font-semibold text-foreground text-sm">Sin guardias asignados en este momento</p>
                <p>Comunícate con la administración para cualquier aclaración.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {guardias.map((guardia) => (
                <div
                  key={guardia.id}
                  className="p-3.5 rounded-xl border bg-card flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition"
                >
                  <Avatar className="w-12 h-12 border shadow-xs shrink-0">
                    <AvatarImage src={guardia.foto_url || undefined} alt={guardia.nombre} className="object-cover" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                      {guardia.nombre
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {guardia.nombre}
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {guardia.puesto}
                    </p>
                    <div className="pt-0.5">
                      {getTurnoBadge(guardia.turno)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ══════════════════ INFORMACIÓN DE SEGURIDAD PARA EL RESIDENTE ══════════════════ */}
        <div className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-bold">Protocolo de Identificación y Seguridad</p>
            <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
              Todos los elementos de seguridad en este servicio portan uniforme oficial, gafete institucional y están debidamente dados de alta ante las autoridades competentes. Para cualquier duda, reporte o solicitud de rondín, marca directamente a la caseta.
            </p>
          </div>
        </div>
      </main>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="border-t border-border bg-card py-5 px-4 text-center mt-auto">
        <div className="max-w-md mx-auto space-y-1 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            SERCO Seguridad Privada S.A. de C.V.
          </p>
          <p className="text-[11px]">
            Protección, vigilancia y control de accesos 24 horas al día, 365 días al año.
          </p>
        </div>
      </footer>
    </div>
  );
}
