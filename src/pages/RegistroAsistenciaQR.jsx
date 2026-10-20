import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  Camera, CheckCircle2, AlertTriangle, Clock, Shield, Search, RefreshCw,
  UserCheck, ArrowLeft, Building2, UserX, AlertCircle, Sun, Moon, Sparkles, Calendar
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

/**
 * Determina si un re-registro califica como Turno Extra (siguiente turno)
 * o si es un registro redundante dentro del mismo turno.
 *
 * Regla SERCO:
 * - Turno Matutino: 07:00 AM (inicia ~07:00).
 * - Turno Vespertino / Nocturno: 19:00 hrs (07:00 PM).
 * - Si un guardia ya se registró a las 7:00 AM y vuelve a escanear a las 8:00 AM o durante
 *   su mismo turno: NO cuenta como extra (evita duplicados y mantiene su asistencia matutina).
 * - Si vuelve a registrarse en el siguiente turno (a partir de las 18:00 / 19:00 hrs para matutinos,
 *   o a partir de las 06:00 / 07:00 AM para nocturnos): califica como Turno Extra ("extra").
 */
function evaluateSecondRegistration({ employeeTurno, existingRecord, currentTime = new Date() }) {
  const currentHour = currentTime.getHours();

  // Intentar obtener la hora del registro previo si está almacenada en BD
  let previousHour = null;
  if (existingRecord?.hora) {
    const match = existingRecord.hora.match(/(\d{1,2}):(\d{2})/);
    if (match) previousHour = parseInt(match[1], 10);
  } else if (existingRecord?.created_at) {
    const prevDate = new Date(existingRecord.created_at);
    if (!isNaN(prevDate.getTime())) {
      previousHour = prevDate.getHours();
    }
  }

  const normalizedTurno = (employeeTurno || "").trim().toLowerCase();
  const isMatutinoBase =
    normalizedTurno.includes("matutino") ||
    (previousHour !== null && previousHour >= 5 && previousHour < 15);
  const isVespertinoBase =
    normalizedTurno.includes("vespertino") ||
    normalizedTurno.includes("nocturno") ||
    (previousHour !== null && (previousHour >= 18 || previousHour < 5));

  // Caso 1: Turno Base Matutino (7:00 AM)
  if (isMatutinoBase) {
    // El siguiente turno (turno extra/doblete) inicia a las 19:00 hrs (7:00 PM).
    // Se habilita recepción a partir de las 18:00 hrs (6:00 PM).
    if (currentHour >= 18) {
      return {
        isNextShift: true,
        targetState: "extra",
        shiftName: "Vespertino (19:00 hrs)",
        message: "Registro válido para Turno Extra (siguiente turno vespertino / nocturno).",
      };
    } else {
      return {
        isNextShift: false,
        targetState: null,
        shiftName: "Matutino",
        message: "Tu asistencia para el turno matutino ya fue registrada hoy. Para registrar Turno Extra (doblete), debes escanear al presentarte al siguiente turno (a partir de las 7:00 PM / 19:00 hrs).",
      };
    }
  }

  // Caso 2: Turno Base Vespertino/Nocturno (7:00 PM)
  if (isVespertinoBase) {
    // El siguiente turno inicia a las 07:00 AM.
    // Se habilita recepción entre las 06:00 AM y 14:00 hrs.
    if (currentHour >= 6 && currentHour < 15) {
      return {
        isNextShift: true,
        targetState: "extra",
        shiftName: "Matutino (07:00 hrs)",
        message: "Registro válido para Turno Extra (siguiente turno matutino).",
      };
    } else {
      return {
        isNextShift: false,
        targetState: null,
        shiftName: "Vespertino",
        message: "Tu asistencia para el turno vespertino ya fue registrada. Para registrar Turno Extra, debes escanear al presentarte al siguiente turno (a partir de las 7:00 AM).",
      };
    }
  }

  // Caso 3: Cubredescansos u otros horarios (verificar diferencia de horas o cruce a noche)
  if (previousHour !== null) {
    const diffHours = Math.abs(currentHour - previousHour);
    if (diffHours >= 8) {
      return {
        isNextShift: true,
        targetState: "extra",
        shiftName: "Turno Siguiente",
        message: "Registro válido para Turno Extra (segundo turno transcurridas más de 8 horas).",
      };
    }
  }

  if (currentHour >= 18) {
    return {
      isNextShift: true,
      targetState: "extra",
      shiftName: "Vespertino (19:00 hrs)",
      message: "Registro válido para Turno Extra (Turno de las 19:00 hrs).",
    };
  }

  return {
    isNextShift: false,
    targetState: null,
    shiftName: "Mismo turno",
    message: "Ya cuentas con asistencia registrada para este turno. El Turno Extra aplica únicamente al ingresar al siguiente turno.",
  };
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
          setAllServices([
            { id: "oficina", nombre: "Oficina (Oficinas Centrales SERCO)" },
            ...activeServs,
          ]);
          setLoading(false);
          return;
        }

        const isOficina = servicioIdParam.toLowerCase() === "oficina";

        // Si es Oficina, cargar empleados asignados a oficina o puestos administrativos
        if (isOficina) {
          setService({
            id: "oficina",
            nombre: servicioNombreParam || "Oficina",
          });

          const { data: allEmps } = await supabase
            .from("empleados")
            .select("id, nombre_completo, servicio_ubicacion, puesto, sede_id, fecha_baja, fecha_reingreso")
            .order("nombre_completo", { ascending: true });

          const today = new Date().toISOString().slice(0, 10);
          const activeEmps = (allEmps || []).filter((e) => {
            return !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja) || e.fecha_baja > today;
          });

          const oficinaEmps = activeEmps.filter((e) => {
            const serv = (e.servicio_ubicacion || "").toLowerCase();
            const puesto = (e.puesto || "").toLowerCase();
            return serv.includes("oficina") || puesto.includes("oficina") || puesto.includes("administrativ");
          });

          const listToUse = oficinaEmps.length > 0 ? oficinaEmps : activeEmps;
          const guardList = listToUse.map((e) => ({
            empleado_id: e.id,
            nombre_completo: e.nombre_completo,
            turno: "matutino",
            puesto: e.puesto || "Oficina",
            sede_id: e.sede_id || null,
          }));

          setPersonal(guardList);
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

  // Verificar si el empleado seleccionado ya tiene registro hoy
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
          .select("*")
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

  // Evaluación de turno y validación de Turno Extra (Doblete)
  const attendanceStatusInfo = useMemo(() => {
    if (!selectedEmployee) return null;
    if (!existingRecord?.estado) {
      return {
        type: "new",
        canRegister: true,
        targetState: evaluatedStatus || "asistió",
        message: evaluatedStatus === "asistió" ? "A TIEMPO (ASISTIÓ)" : "DESPUÉS DE HORA (RETRASO)",
      };
    }

    const state = existingRecord.estado;

    if (state === "vacaciones") {
      return {
        type: "vacaciones",
        canRegister: false,
        targetState: null,
        message: "Vacaciones Programadas. Tu asistencia está protegida y no se sobreescribirá.",
      };
    }

    if (state === "extra" || state === "descanso_extra") {
      return {
        type: "already_extra",
        canRegister: false,
        targetState: null,
        message: "Ya registraste tu Turno Extra de hoy. Ambos turnos se encuentran debidamente asentados.",
      };
    }

    if (state === "descanso") {
      return {
        type: "descanso",
        canRegister: true,
        targetState: "descanso_laborado",
        message: "Día de descanso asignado. Al confirmar tu asistencia se registrará como Descanso Laborado (DL).",
      };
    }

    if (state === "falta") {
      return {
        type: "falta_provisional",
        canRegister: true,
        targetState: evaluatedStatus || "asistió",
        message: `Estado provisional FALTA. Al registrarte cambiará a: ${evaluatedStatus === "asistió" ? "A TIEMPO (ASISTIÓ)" : "DESPUÉS DE HORA (RETRASO)"}`,
      };
    }

    // Si ya registró 'asistió', 'retraso' o 'descanso_laborado'
    if (["asistió", "retraso", "descanso_laborado"].includes(state)) {
      const evalRes = evaluateSecondRegistration({
        employeeTurno: selectedEmployee?.turno,
        existingRecord,
        currentTime,
      });

      if (evalRes.isNextShift) {
        const nextTarget = state === "descanso_laborado" ? "descanso_extra" : "extra";
        return {
          type: "turno_extra_eligible",
          canRegister: true,
          targetState: nextTarget,
          shiftName: evalRes.shiftName,
          message: evalRes.message,
        };
      } else {
        return {
          type: "same_shift_duplicate",
          canRegister: false,
          targetState: null,
          shiftName: evalRes.shiftName,
          message: evalRes.message,
        };
      }
    }

    return {
      type: "unknown",
      canRegister: true,
      targetState: evaluatedStatus || "asistió",
      message: evaluatedStatus === "asistió" ? "A TIEMPO (ASISTIÓ)" : "DESPUÉS DE HORA (RETRASO)",
    };
  }, [selectedEmployee, existingRecord, evaluatedStatus, currentTime]);

  const canRegister = Boolean(attendanceStatusInfo?.canRegister);

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

  // Iniciar o detener cámara según si el empleado seleccionado puede registrar asistencia
  useEffect(() => {
    if (selectedEmployee && canRegister && !photoDataUrl) {
      startCamera();
    } else if (!canRegister) {
      stopCamera();
    }
  }, [selectedEmployee, canRegister, photoDataUrl]);

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

    // Validación: si no está habilitado para registro (duplicado en mismo turno, vacaciones, etc.)
    if (!attendanceStatusInfo?.canRegister) {
      toast({
        title: "Registro no disponible",
        description: attendanceStatusInfo?.message || "No es posible registrar asistencia en este momento.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const calculatedStatus = attendanceStatusInfo.targetState || evaluatedStatus || "asistió";
    const horaFormateada = currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const isExtraResult = calculatedStatus === "extra" || calculatedStatus === "descanso_extra";

    try {
      // 1. Intentar registrar vía RPC seguro (solo si service.id no es 'oficina')
      let rpcSuccess = false;
      const isOficinaService = service.id === "oficina";
      if (!isOficinaService) {
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
            if (rpcRes.success && !rpcRes.ignored) {
              rpcSuccess = true;
            } else if (rpcRes.ignored && isExtraResult) {
              // Si la versión antigua del RPC lo marcó como already_registered pero aquí calificó para Turno Extra, forzar upsert
              rpcSuccess = false;
            } else if (rpcRes.ignored) {
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
        isExtra: isExtraResult,
        guardName: selectedEmployee.nombre_completo,
        status: calculatedStatus,
        serviceName: service.nombre,
        turno: selectedEmployee.turno,
        time: currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        date: todayStr,
      });

      toast({
        title: isExtraResult ? "¡Turno Extra Confirmado!" : "¡Asistencia Registrada!",
        description: isExtraResult
          ? "Se ha registrado exitosamente tu segundo turno (Turno Extra / Doblete)."
          : `Registrado como: ${calculatedStatus.toUpperCase()}`,
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
                {submissionResult.isExtra ? (
                  <Sparkles className="w-10 h-10 text-purple-400 animate-in zoom-in-50 duration-300" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-in zoom-in-50 duration-300" />
                )}
              </div>
              <CardTitle className="text-xl font-bold text-white">
                {submissionResult.isExtra ? "¡Turno Extra Confirmado!" : "¡Asistencia Confirmada!"}
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                {submissionResult.isExtra
                  ? "Tu segundo turno laboral (doblete) se ha registrado exitosamente en el sistema"
                  : "El registro se ha procesado exitosamente en el sistema"}
              </p>
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
                      submissionResult.status === "extra" || submissionResult.status === "descanso_extra"
                        ? "bg-purple-600 text-white font-bold"
                        : submissionResult.status === "asistió"
                        ? "bg-emerald-600 text-white font-bold"
                        : submissionResult.status === "retraso"
                        ? "bg-amber-600 text-white font-bold"
                        : "bg-teal-600 text-white font-bold"
                    }
                  >
                    {submissionResult.status === "extra"
                      ? "TURNO EXTRA (E)"
                      : submissionResult.status === "descanso_extra"
                      ? "DESCANSO + EXTRA (DLE)"
                      : submissionResult.status.toUpperCase()}
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

                    {/* Alertas de Vacaciones, Descanso o Turno Extra */}
                    {checkingExisting ? (
                      <div className="text-[11px] text-slate-500 italic">Verificando estatus programado...</div>
                    ) : attendanceStatusInfo?.type === "vacaciones" ? (
                      <div className="bg-teal-950/50 border border-teal-800/80 p-2.5 rounded-lg text-xs text-teal-300 flex items-start gap-2 mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-teal-400 mt-0.5" />
                        <div>
                          <strong className="block font-semibold">Vacaciones Programadas</strong>
                          Tienes este día asignado en plantilla. Tu asistencia está protegida y no se sobreescribirá.
                        </div>
                      </div>
                    ) : attendanceStatusInfo?.type === "descanso" ? (
                      <div className="bg-sky-950/40 border border-sky-800/60 p-2.5 rounded-lg text-xs text-sky-300 flex items-start gap-2 mt-2">
                        <Calendar className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <strong className="font-semibold">Día de Descanso Asignado</strong>
                            <Badge className="bg-sky-600 text-white font-bold text-[10px]">DL (DESCANSO LAB.)</Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-sky-200">
                            Al confirmar tu asistencia se registrará como <strong>Descanso Laborado (DL)</strong>.
                          </p>
                        </div>
                      </div>
                    ) : attendanceStatusInfo?.type === "already_extra" ? (
                      <div className="bg-purple-950/40 border border-purple-800/60 p-2.5 rounded-lg text-xs text-purple-300 flex items-start gap-2 mt-2">
                        <Sparkles className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" />
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <strong className="font-semibold">Turno Extra Ya Registrado</strong>
                            <Badge className="bg-purple-600 text-white font-bold text-[10px]">EXTRA (E)</Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-purple-200">
                            Ya completaste tu registro de turno regular y tu Turno Extra de hoy. Ambos turnos están asentados.
                          </p>
                        </div>
                      </div>
                    ) : attendanceStatusInfo?.type === "turno_extra_eligible" ? (
                      <div className="bg-purple-950/70 border border-purple-500/80 p-3 rounded-lg text-xs text-purple-200 space-y-2 mt-2 shadow-lg shadow-purple-950/40 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-white">
                            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                            <span>TURNO EXTRA DETECTADO (DOBLETE)</span>
                          </div>
                          <Badge className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-2 py-0.5">
                            EXTRA (E)
                          </Badge>
                        </div>
                        <p className="text-[11px] text-purple-200 leading-snug">
                          Asistencia previa ({existingRecord?.estado?.toUpperCase()}) confirmada. Al confirmar ahora en tu siguiente turno ({attendanceStatusInfo.shiftName}), se registrará como <strong>Turno Extra (E)</strong>.
                        </p>
                      </div>
                    ) : attendanceStatusInfo?.type === "same_shift_duplicate" ? (
                      <div className="bg-amber-950/50 border border-amber-800/80 p-3 rounded-lg text-xs text-amber-200 space-y-1.5 mt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-amber-300">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            <span>ASISTENCIA YA REGISTRADA HOY</span>
                          </div>
                          <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                            {existingRecord?.estado?.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-amber-200/90 leading-snug">
                          {attendanceStatusInfo.message}
                        </p>
                      </div>
                    ) : attendanceStatusInfo?.type === "falta_provisional" ? (
                      <div className="space-y-1.5 pt-1 border-t border-slate-900 text-xs mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-rose-400 font-medium">Estado provisional:</span>
                          <Badge className="bg-rose-600 text-white font-bold text-[10px]">FALTA (SIN REGISTRO PREVIO)</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Al registrarte ahora cambiará a:</span>
                          <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                            {evaluatedStatus === "asistió" ? "A TIEMPO (ASISTIÓ)" : "DESPUÉS DE HORA (RETRASO)"}
                          </Badge>
                        </div>
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

            {/* Aviso si el registro está completado o bloqueado por duplicado de mismo turno */}
            {selectedEmployee && !canRegister && (
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                <CardContent className="pt-6 pb-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center mx-auto text-amber-400">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">Estatus Verificado</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      {attendanceStatusInfo?.message || "No se requieren registros adicionales para este elemento en este turno."}
                    </p>
                  </div>
                  <Button
                    onClick={handleResetForNext}
                    variant="outline"
                    className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700 text-xs h-9"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Registrar a otro elemento
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* PASO 2: Toma de Fotografía de Verificación */}
            {selectedEmployee && canRegister && (
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
