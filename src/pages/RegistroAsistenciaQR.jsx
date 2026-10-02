import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  Camera, CheckCircle2, AlertTriangle, Clock, Shield, Search, RefreshCw,
  UserCheck, ArrowLeft, Building2, UserX, AlertCircle, Sun, Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

/**
 * Evalúa el estado de asistencia según el turno asignado y la hora exacta
 * - Matutino: antes o a las 7:15 AM -> Asistió; después -> Retraso
 * - Vespertino: antes o a las 7:15 PM (19:15) -> Asistió; después -> Retraso
 * - Cubredescansos / otro: según la ventana más cercana (AM -> 7:15 AM, PM -> 7:15 PM)
 */
function evaluateAttendanceState(turno, date = new Date()) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const normalizedTurno = (turno || "").trim().toLowerCase();

  const morningLimit = 7 * 60 + 15; // 07:15 AM = 435 mins
  const eveningLimit = 19 * 60 + 15; // 07:15 PM = 1155 mins

  if (normalizedTurno.includes("matutino")) {
    return totalMinutes <= morningLimit ? "asistió" : "retraso";
  } else if (normalizedTurno.includes("vespertino")) {
    return totalMinutes <= eveningLimit ? "asistió" : "retraso";
  } else {
    // Para cubredescansos u otro turno: evaluar según ventana horaria más cercana
    if (hours < 13) {
      return totalMinutes <= morningLimit ? "asistió" : "retraso";
    } else {
      return totalMinutes <= eveningLimit ? "asistió" : "retraso";
    }
  }
}

export default function RegistroAsistenciaQR() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const servicioIdParam = searchParams.get("servicio_id") || "";
  const servicioNombreParam = searchParams.get("servicio_nombre") || "";

  const [service, setService] = useState({
    id: servicioIdParam,
    nombre: servicioNombreParam || "Servicio SERCO",
  });

  const [allServices, setAllServices] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Registro de asistencia preexistente hoy
  const [existingRecord, setExistingRecord] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Cámara y Foto
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const streamRef = useRef(null);

  // Estado del envío
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Reloj en tiempo real
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Formato de fecha actual YYYY-MM-DD
  const todayStr = useMemo(() => {
    const y = currentTime.getFullYear();
    const m = String(currentTime.getMonth() + 1).padStart(2, "0");
    const d = String(currentTime.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [currentTime]);

  // Cargar datos del servicio y personal asignado
  useEffect(() => {
    async function loadServiceData() {
      setLoading(true);
      try {
        // 1. Si no hay servicio_id en la URL, cargar lista de servicios para seleccionar
        if (!servicioIdParam) {
          const { data: servs } = await supabase.from("servicios").select("id, nombre, sede_id, estado");
          const activeServs = (servs || []).filter((s) => (s.estado || "activo").toLowerCase() !== "suspendido");
          setAllServices(activeServs);
          setLoading(false);
          return;
        }

        // Si tenemos servicio_id, cargar datos del servicio
        const { data: servData } = await supabase
          .from("servicios")
          .select("id, nombre, sede_id, estado")
          .eq("id", servicioIdParam)
          .single();

        if (servData) {
          if ((servData.estado || "").toLowerCase() === "suspendido") {
            setLoading(false);
            setCameraError("Este servicio se encuentra suspendido. No es posible registrar asistencias.");
            return;
          }
          setService(servData);
        }

        // 2. Intentar obtener el personal vía RPC seguro (para anon o auth)
        let guardList = [];
        try {
          const { data: rpcGuards, error: rpcErr } = await supabase.rpc("get_personal_servicio_qr", {
            p_servicio_id: servicioIdParam,
          });
          if (!rpcErr && rpcGuards && rpcGuards.length > 0) {
            guardList = rpcGuards;
          }
        } catch (e) {
          console.warn("RPC get_personal_servicio_qr no disponible, intentando consulta directa:", e);
        }

        // Fallback si RPC no devolvió datos
        if (guardList.length === 0) {
          // Intentar consultar asignacion_turnos y empleados
          const [asigRes, empRes] = await Promise.all([
            supabase
              .from("asignacion_turnos")
              .select("id, empleado_id, empleado_nombre, turno, servicio_id, sede_id")
              .eq("servicio_id", servicioIdParam),
            supabase
              .from("empleados")
              .select("id, nombre_completo, servicio_ubicacion, sede_id, fecha_baja, fecha_reingreso")
              .or(`servicio_ubicacion.eq.${servData?.nombre || servicioNombreParam}`),
          ]);

          const asigs = asigRes.data || [];
          const emps = (empRes.data || []).filter((e) => {
            const today = new Date().toISOString().slice(0, 10);
            return !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja) || e.fecha_baja > today;
          });

          // Unificar nombres únicos
          const map = new Map();
          asigs.forEach((a) => {
            const cleanName = (a.empleado_nombre || "").trim();
            if (cleanName && !map.has(cleanName.toLowerCase())) {
              const matchedEmp = emps.find(
                (e) => (e.nombre_completo || "").trim().toLowerCase() === cleanName.toLowerCase() || e.id === a.empleado_id
              );
              map.set(cleanName.toLowerCase(), {
                empleado_id: matchedEmp?.id || a.empleado_id || a.id,
                nombre_completo: matchedEmp?.nombre_completo || cleanName,
                turno: a.turno || "matutino",
                sede_id: matchedEmp?.sede_id || a.sede_id || servData?.sede_id || null,
              });
            }
          });

          emps.forEach((e) => {
            const cleanName = (e.nombre_completo || "").trim();
            if (cleanName && !map.has(cleanName.toLowerCase())) {
              map.set(cleanName.toLowerCase(), {
                empleado_id: e.id,
                nombre_completo: cleanName,
                turno: "matutino",
                sede_id: e.sede_id || servData?.sede_id || null,
              });
            }
          });

          guardList = Array.from(map.values());
        }

        setPersonal(guardList);
      } catch (err) {
        console.error("Error al cargar personal del servicio:", err);
      } finally {
        setLoading(false);
      }
    }

    loadServiceData();
  }, [servicioIdParam, servicioNombreParam]);

  // Verificar si el empleado seleccionado ya tiene registro hoy (especialmente Vacaciones o Descanso)
  useEffect(() => {
    async function checkExistingRecord() {
      if (!selectedEmployee?.empleado_id) {
        setExistingRecord(null);
        return;
      }

      setCheckingExisting(true);
      try {
        const { data, error } = await supabase
          .from("asistencias")
          .select("id, empleado_id, fecha, estado, sede_id")
          .eq("empleado_id", selectedEmployee.empleado_id)
          .eq("fecha", todayStr)
          .maybeSingle();

        if (!error && data) {
          setExistingRecord(data);
        } else {
          setExistingRecord(null);
        }
      } catch (err) {
        console.warn("No se pudo verificar asistencia previa:", err);
        setExistingRecord(null);
      } finally {
        setCheckingExisting(false);
      }
    }

    checkExistingRecord();
  }, [selectedEmployee, todayStr]);

  // Manejo de Cámara Frontal
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("No se pudo acceder a la cámara frontal web:", err);
      setCameraError("No se pudo activar la cámara web. Puedes usar el botón de subir foto de tu celular.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Detener cámara al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Iniciar cámara al seleccionar empleado
  useEffect(() => {
    if (selectedEmployee && !existingRecord?.estado && !photoDataUrl) {
      startCamera();
    }
  }, [selectedEmployee, existingRecord]);

  // Tomar instantánea en memoria (Canvas)
  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      // Efecto espejo para cámara frontal
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      setPhotoDataUrl(dataUrl);
      stopCamera();
    } catch (e) {
      console.error("Error al capturar foto:", e);
    }
  };

  // Subir foto desde el input file nativo de celular
  const handleFileCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoDataUrl(event.target?.result);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const handleRetakePhoto = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  // Filtrar lista de personal por término de búsqueda
  const filteredPersonal = useMemo(() => {
    if (!searchTerm.trim()) return personal;
    const clean = searchTerm.toLowerCase();
    return personal.filter((p) => p.nombre_completo.toLowerCase().includes(clean));
  }, [personal, searchTerm]);

  // Estado calculado para el turno del guardia a la hora actual
  const evaluatedStatus = useMemo(() => {
    if (!selectedEmployee) return null;
    return evaluateAttendanceState(selectedEmployee.turno, currentTime);
  }, [selectedEmployee, currentTime]);

  // Procesar registro de asistencia
  const handleSubmitAttendance = async () => {
    if (!selectedEmployee) {
      toast({
        title: "Selecciona un guardia",
        description: "Por favor busca y selecciona tu nombre en la lista.",
        variant: "destructive",
      });
      return;
    }

    if (!photoDataUrl) {
      toast({
        title: "Fotografía requerida",
        description: "Toma una fotografía de verificación antes de confirmar.",
        variant: "destructive",
      });
      return;
    }

    // Regla: si ya tiene vacaciones o descanso asignado, proteger el registro
    if (existingRecord?.estado === "vacaciones" || existingRecord?.estado === "descanso") {
      toast({
        title: "Registro protegido",
        description: `Tienes programado ${existingRecord.estado.toUpperCase()} hoy. Tu estado no fue modificado.`,
      });
      setSubmissionResult({
        success: true,
        ignored: true,
        guardName: selectedEmployee.nombre_completo,
        status: existingRecord.estado,
        message: `Tienes asignado ${existingRecord.estado.toUpperCase()} el día de hoy. El registro se ha conservado sin alteraciones.`,
        time: currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
      // Limpiar foto inmediatamente por privacidad
      setPhotoDataUrl(null);
      stopCamera();
      return;
    }

    setSubmitting(true);
    const calculatedStatus = evaluatedStatus || "asistió";
    const horaFormateada = currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

    try {
      // 1. Intentar registrar vía RPC seguro
      let rpcSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("registrar_asistencia_qr", {
          p_empleado_id: selectedEmployee.empleado_id,
          p_servicio_id: service.id,
          p_fecha: todayStr,
          p_estado: calculatedStatus,
          p_hora: horaFormateada,
          p_sede_id: selectedEmployee.sede_id || service.sede_id || null,
        });

        if (!rpcErr && rpcRes) {
          rpcSuccess = true;
          if (rpcRes.ignored && (rpcRes.estado === "vacaciones" || rpcRes.estado === "descanso")) {
            setSubmissionResult({
              success: true,
              ignored: true,
              guardName: selectedEmployee.nombre_completo,
              status: rpcRes.estado,
              message: rpcRes.message || "Se conservó tu estado programado.",
              time: horaFormateada,
            });
            return;
          }
        }
      } catch (rpcErr) {
        console.warn("RPC falló, intentando upsert directo:", rpcErr);
      }

      // 2. Fallback upsert directo
      if (!rpcSuccess) {
        const payload = {
          empleado_id: selectedEmployee.empleado_id,
          fecha: todayStr,
          estado: calculatedStatus,
          sede_id: selectedEmployee.sede_id || service.sede_id || null,
        };

        const { error: upsertErr } = await supabase
          .from("asistencias")
          .upsert(payload, { onConflict: "empleado_id,fecha" });

        if (upsertErr) throw upsertErr;
      }

      // Éxito: Establecer resultado para pantalla de confirmación
      setSubmissionResult({
        success: true,
        ignored: false,
        guardName: selectedEmployee.nombre_completo,
        status: calculatedStatus,
        serviceName: service.nombre,
        turno: selectedEmployee.turno,
        time: currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        date: todayStr,
      });

      toast({
        title: "¡Asistencia Registrada!",
        description: `Registrado como: ${calculatedStatus.toUpperCase()}`,
      });
    } catch (err) {
      console.error("Error al registrar asistencia:", err);
      toast({
        title: "Error al registrar",
        description: err.message || "Ocurrió un error al enviar tu asistencia.",
        variant: "destructive",
      });
    } finally {
      // Regla estricta de privacidad: borrar la fotografía de la memoria inmediatamente
      setPhotoDataUrl(null);
      stopCamera();
      setSubmitting(false);
    }
  };

  const handleResetForNext = () => {
    setSelectedEmployee(null);
    setPhotoDataUrl(null);
    setSubmissionResult(null);
    setSearchTerm("");
    setExistingRecord(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 font-sans">
      {/* Encabezado Corporativo SERCO */}
      <header className="w-full max-w-lg flex items-center justify-between py-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <img src="/gafete/logo_serco.png" alt="SERCO" className="h-9 w-9 object-contain" onError={(e) => { e.currentTarget.src = "/favicon.png"; }} />
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">SERCO SEGURIDAD</h1>
            <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Asistencia Operativa</p>
          </div>
        </div>

        {/* Reloj en Vivo */}
        <div className="text-right bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
          <div className="flex items-center justify-end gap-1.5 text-xs font-mono font-bold text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            {currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="text-[10px] text-slate-400">
            {currentTime.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="w-full max-w-lg my-4 flex-1 flex flex-col justify-center">
        {/* Caso 1: Pantalla de Éxito / Confirmación */}
        {submissionResult ? (
          <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-in zoom-in-50 duration-300" />
              </div>
              <CardTitle className="text-xl font-bold text-white">¡Asistencia Confirmada!</CardTitle>
              <p className="text-xs text-slate-400 mt-1">El registro se ha procesado exitosamente en el sistema</p>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Guardia:</span>
                  <span className="font-bold text-white text-sm text-right">{submissionResult.guardName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Servicio:</span>
                  <span className="font-semibold text-slate-200">{service.nombre}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Hora registrada:</span>
                  <span className="font-mono font-bold text-emerald-400">{submissionResult.time}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Estado aplicado:</span>
                  <Badge
                    className={
                      submissionResult.status === "asistió"
                        ? "bg-emerald-600 text-white font-bold"
                        : submissionResult.status === "retraso"
                        ? "bg-amber-600 text-white font-bold"
                        : "bg-teal-600 text-white font-bold"
                    }
                  >
                    {submissionResult.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {submissionResult.ignored ? (
                <div className="bg-teal-950/40 border border-teal-800/60 p-3 rounded-lg text-xs text-teal-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-teal-400 mt-0.5" />
                  <span>{submissionResult.message}</span>
                </div>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-800/50 p-3 rounded-lg text-xs text-emerald-300 text-center">
                  Tu asistencia ha sido transmitida en tiempo real al panel de operaciones SERCO.
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleResetForNext}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-5 text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Registrar a otro elemento
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Banner del Servicio Actual */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-1">
                <Building2 className="w-4 h-4" />
                <span>PUESTO / SERVICIO DE ASISTENCIA</span>
              </div>
              <h2 className="text-lg font-bold text-white uppercase">{service.nombre}</h2>
            </div>

            {/* Selector de Servicio si no vino en URL */}
            {!servicioIdParam && allServices.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <label className="text-xs font-semibold text-slate-300">Selecciona el Servicio:</label>
                <select
                  value={service.id}
                  onChange={(e) => {
                    const found = allServices.find((s) => s.id === e.target.value);
                    if (found) {
                      setService(found);
                      navigate(`?servicio_id=${found.id}&servicio_nombre=${encodeURIComponent(found.nombre)}`);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-lg p-2.5"
                >
                  <option value="">-- Elige un servicio --</option>
                  {allServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* PASO 1: Selección y Búsqueda del Guardia */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <CardTitle className="text-sm font-bold text-white">Identifícate en la lista</CardTitle>
                  </div>
                  {selectedEmployee && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedEmployee(null);
                        setPhotoDataUrl(null);
                        stopCamera();
                      }}
                      className="h-7 text-xs text-slate-400 hover:text-white"
                    >
                      Cambiar
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {!selectedEmployee ? (
                  <>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <Input
                        placeholder="Escribe tu nombre para buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-white pl-9 h-10 text-xs rounded-lg"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {loading ? (
                        <div className="py-6 text-center text-xs text-slate-500">Cargando personal asignado...</div>
                      ) : filteredPersonal.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500">
                          No se encontraron guardias registrados para este servicio.
                        </div>
                      ) : (
                        filteredPersonal.map((emp) => (
                          <button
                            key={emp.empleado_id}
                            type="button"
                            onClick={() => setSelectedEmployee(emp)}
                            className="w-full text-left p-3 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                                {emp.nombre_completo}
                              </div>
                              <div className="text-[11px] text-slate-400 capitalize">
                                Turno: {emp.turno || "Matutino"}
                              </div>
                            </div>
                            <UserCheck className="w-4 h-4 text-slate-600 group-hover:text-amber-400" />
                          </button>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Elemento seleccionado:</span>
                      <Badge className="bg-slate-800 text-amber-400 border border-amber-500/30 text-[10px] uppercase">
                        {selectedEmployee.turno || "Matutino"}
                      </Badge>
                    </div>
                    <div className="text-sm font-bold text-white">{selectedEmployee.nombre_completo}</div>

                    {/* Alertas de Vacaciones o Descanso */}
                    {checkingExisting ? (
                      <div className="text-[11px] text-slate-500 italic">Verificando estatus programado...</div>
                    ) : existingRecord?.estado === "vacaciones" || existingRecord?.estado === "descanso" ? (
                      <div className="bg-teal-950/50 border border-teal-800/80 p-2.5 rounded-lg text-xs text-teal-300 flex items-start gap-2 mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-teal-400 mt-0.5" />
                        <div>
                          <strong className="block font-semibold">
                            {existingRecord.estado === "vacaciones" ? "Vacaciones Programadas" : "Día de Descanso"}
                          </strong>
                          Tienes este día asignado en plantilla. Tu asistencia está protegida y no se sobreescribirá.
                        </div>
                      </div>
                    ) : existingRecord?.estado === "asistió" || existingRecord?.estado === "retraso" ? (
                      <div className="bg-sky-950/40 border border-sky-800/60 p-2.5 rounded-lg text-xs text-sky-300 flex items-center justify-between mt-2">
                        <span>Ya registraste asistencia hoy:</span>
                        <Badge className="bg-sky-600 text-white font-bold">{existingRecord.estado.toUpperCase()}</Badge>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-xs">
                        <span className="text-slate-400">Estatus según horario actual:</span>
                        <Badge
                          className={
                            evaluatedStatus === "asistió"
                              ? "bg-emerald-600 text-white font-bold"
                              : "bg-amber-600 text-white font-bold"
                          }
                        >
                          {evaluatedStatus === "asistió" ? "A TIEMPO (ASISTIÓ)" : "DESPUÉS DE HORA (RETRASO)"}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PASO 2: Toma de Fotografía de Verificación */}
            {selectedEmployee && (
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                    <CardTitle className="text-sm font-bold text-white">Fotografía de Verificación</CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 flex flex-col items-center">
                  {/* Vista de Video en Vivo o Foto Capturada */}
                  <div className="relative w-full aspect-[4/3] max-w-xs bg-black rounded-xl overflow-hidden border-2 border-slate-800 shadow-inner flex items-center justify-center">
                    {photoDataUrl ? (
                      <img src={photoDataUrl} alt="Captura" className="w-full h-full object-cover" />
                    ) : cameraActive ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                    ) : (
                      <div className="p-4 text-center space-y-2">
                        <Camera className="w-10 h-10 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">Activa la cámara para tomar tu foto de verificación</p>
                      </div>
                    )}
                  </div>

                  {/* Acciones de Fotografía */}
                  <div className="w-full max-w-xs space-y-2">
                    {photoDataUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRetakePhoto}
                        className="w-full border-slate-700 bg-slate-800 text-white hover:bg-slate-700 text-xs h-9"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Repetir Fotografía
                      </Button>
                    ) : cameraActive ? (
                      <Button
                        type="button"
                        onClick={capturePhoto}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-10 shadow-lg shadow-amber-500/20"
                      >
                        <Camera className="w-4 h-4 mr-2" /> Capturar Foto
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={startCamera}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs h-9"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5" /> Activar Cámara
                      </Button>
                    )}

                    {/* Botón de respaldo para subir foto con la cámara nativa del celular */}
                    <div className="text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleFileCapture}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-slate-400 hover:text-amber-400 underline underline-offset-2 transition-colors"
                      >
                        ¿Problemas con la cámara? Pulsa aquí para abrir la cámara de tu celular
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 text-center leading-tight">
                      * Por privacidad y seguridad, esta fotografía solo verifica tu identidad en este instante y se borra inmediatamente al confirmar.
                    </p>
                  </div>
                </CardContent>

                {/* PASO 3: Botón de Confirmación Final */}
                <CardFooter className="pt-2">
                  <Button
                    onClick={handleSubmitAttendance}
                    disabled={submitting || !photoDataUrl}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 text-sm shadow-xl shadow-emerald-900/30 disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Registrando asistencia...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> Confirmar Asistencia
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Pie Corporativo */}
      <footer className="w-full max-w-lg text-center py-3 border-t border-slate-800/80 text-[11px] text-slate-500">
        SERCO Seguridad Privada S.A. de C.V. • Control de Operaciones
      </footer>
    </div>
  );
}
