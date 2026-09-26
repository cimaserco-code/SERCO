import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { supabase } from "@/lib/supabaseClient";

const ClientPortalContext = createContext(null);

/** @param {string} fotoUrl */
function getEmployeePhotoPath(fotoUrl) {
  try {
    const url = new URL(fotoUrl);
    const objectPrefix = "/storage/v1/object/public/documentos/";
    if (!url.pathname.startsWith(objectPrefix)) return null;

    const path = decodeURIComponent(url.pathname.slice(objectPrefix.length));
    const segments = path.split("/");
    if (segments[0] !== "fotos" || segments.length < 2 || segments.some((part) => !part || part === "." || part === "..")) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

export function ClientPortalProvider({ children }) {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  const [allServices, setAllServices] = useState([]);
  const [clientServices, setClientServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(() => {
    return localStorage.getItem("serco_client_selected_service_id") || "";
  });
  const [loading, setLoading] = useState(true);

  // Data for current service
  const [cobros, setCobros] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const photoObjectUrls = useRef(new Map());
  const [telefonos, setTelefonos] = useState([]);
  const [agendaEvents, setAgendaEvents] = useState([]);
  const [reportesCliente, setReportesCliente] = useState([]);
  const [dismissedNotifications, setDismissedNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem(`serco_client_dismissed_${user?.id || "guest"}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const parseStoredBankData = (raw) => {
    if (!raw) {
      return {
        beneficiario: "SERCO SEGURIDAD PRIVADA S.A. DE C.V.",
        banco: "BBVA México",
        clabe: "012 180 00123456789 0",
        cuenta: "",
        notas: ""
      };
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.notas === "Favor de indicar como referencia el nombre de su servicio") {
        parsed.notas = "";
      }
      return parsed;
    } catch {
      return {
        beneficiario: "SERCO SEGURIDAD PRIVADA S.A. DE C.V.",
        banco: "BBVA México",
        clabe: "012 180 00123456789 0",
        cuenta: "",
        notas: ""
      };
    }
  };

  const [datosBancarios, setDatosBancariosState] = useState(() => {
    return parseStoredBankData(localStorage.getItem("serco_datos_bancarios_empresa"));
  });

  useEffect(() => {
    const handleBankUpdate = () => {
      setDatosBancariosState(parseStoredBankData(localStorage.getItem("serco_datos_bancarios_empresa")));
    };
    window.addEventListener("serco_datos_bancarios_updated", handleBankUpdate);
    return () => window.removeEventListener("serco_datos_bancarios_updated", handleBankUpdate);
  }, []);

  useEffect(() => () => {
    photoObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    photoObjectUrls.current.clear();
  }, []);

  const getPhotoRuntimeUrl = useCallback(/** @param {string} fotoUrl */ async (fotoUrl) => {
    if (typeof fotoUrl === "string" && /^data:image\/(?:webp|jpeg|png);base64,/i.test(fotoUrl)) {
      return fotoUrl;
    }

    const path = getEmployeePhotoPath(fotoUrl);
    if (!path) return null;

    const cachedUrl = photoObjectUrls.current.get(fotoUrl);
    if (cachedUrl) return cachedUrl;

    try {
      const { data, error } = await supabase.storage.from("documentos").download(path);
      if (error || !data) return null;

      const runtimeUrl = URL.createObjectURL(data);
      photoObjectUrls.current.set(fotoUrl, runtimeUrl);
      return runtimeUrl;
    } catch {
      return null;
    }
  }, []);

  // Load all services and determine which ones belong to this client
  const loadServices = useCallback(async () => {
    try {
      const servs = await sercoApi.entities.Servicio.list();
      const list = servs || [];
      setAllServices(list);

      const userEmail = (user?.email || "").toLowerCase().trim();
      const userFullName = (user?.full_name || "").toLowerCase().trim();
      const userNombre = (user?.nombre || "").toLowerCase().trim();

      // If user is admin in preview mode, they can preview ALL services
      if (isAdmin) {
        setClientServices(list);
        if (!selectedServiceId && list.length > 0) {
          setSelectedServiceId(list[0].id);
        }
      } else {
        // Match client by email, second email or admin_nombre
        const matched = list.filter((s) => {
          const c1 = (s.correo || "").toLowerCase().trim();
          const c2 = (s.correo_2 || "").toLowerCase().trim();
          const admin = (s.admin_nombre || "").toLowerCase().trim();
          if (userEmail && (c1 === userEmail || c2 === userEmail)) return true;
          if (admin && (admin === userFullName || admin === userNombre)) return true;
          return false;
        });

        // If no match found by email/name, allow the list if role is cliente (fallback to first available or all active)
        const effectiveList = matched.length > 0 ? matched : list.filter(s => s.estado !== "inactivo");
        setClientServices(effectiveList);

        if (!selectedServiceId && effectiveList.length > 0) {
          setSelectedServiceId(effectiveList[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading services for client portal:", err);
    }
  }, [isAdmin, user, selectedServiceId]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Selected service object
  const selectedServicio = useMemo(() => {
    if (!selectedServiceId) {
      return clientServices[0] || allServices[0] || null;
    }
    return (
      clientServices.find((s) => s.id === selectedServiceId) ||
      allServices.find((s) => s.id === selectedServiceId) ||
      clientServices[0] ||
      allServices[0] ||
      null
    );
  }, [selectedServiceId, clientServices, allServices]);

  const handleSelectService = (id) => {
    setSelectedServiceId(id);
    localStorage.setItem("serco_client_selected_service_id", id);
  };

  // Load service-specific data whenever selectedServicio changes
  const loadServiceData = useCallback(async () => {
    if (!selectedServicio) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        cobrosData,
        asigData,
        empData,
        saldosData,
        agendaData
      ] = await Promise.all([
        sercoApi.entities.Cobro.list("-mes").catch(() => []),
        sercoApi.entities.AsignacionTurno.list().catch(() => []),
        sercoApi.entities.Empleado.list().catch(() => []),
        sercoApi.entities.Saldo ? sercoApi.entities.Saldo.list().catch(() => []) : Promise.resolve([]),
        sercoApi.entities.Agenda.list("-fecha").catch(() => [])
      ]);

      // 1. Cobros for this service (enriquecidos con metadata de método de pago)
      const rawCobros = (cobrosData || []).filter(
        (c) =>
          c.servicio_id === selectedServicio.id ||
          (c.servicio_nombre &&
            c.servicio_nombre.toLowerCase() === selectedServicio.nombre.toLowerCase())
      );

      const servCobros = rawCobros.map((c) => {
        let meta = {};
        try {
          const raw = localStorage.getItem(`serco_cobro_meta_${c.id}`);
          if (raw) meta = JSON.parse(raw);
        } catch {}

        let servCfg = {};
        try {
          const rawCfg = localStorage.getItem(`serco_serv_cobro_cfg_${c.servicio_id}`);
          if (rawCfg) servCfg = JSON.parse(rawCfg);
        } catch {}

        const metodoPago = c.metodo_pago || meta.metodo_pago || servCfg.metodo_pago || "transferencia";

        return {
          ...c,
          ...meta,
          metodo_pago: metodoPago,
        };
      });

      setCobros(servCobros);

      // 2. Asignaciones for this service
      const servAsignaciones = (asigData || []).filter(
        (a) => a.servicio_id === selectedServicio.id
      );
      const employeesWithPhotoUrls = await Promise.all((empData || []).map(async (emp) => ({
        ...emp,
        foto_url_runtime: emp.foto_url ? await getPhotoRuntimeUrl(emp.foto_url) : null,
      })));
      setAsignaciones(servAsignaciones);
      setEmpleados(employeesWithPhotoUrls);

      // 3. Telefonos asignados al servicio (tomados exclusivamente del apartado de celulares en el módulo de egresos)
      const parsedSaldos = (saldosData || []).map((saldo) => {
        let compania = saldo.compania || "";
        let servicio = saldo.servicio || "";
        let nombre = saldo.nombre || saldo.responsable || "";

        if ((!compania || !servicio) && saldo.notas) {
          try {
            if (saldo.notas.startsWith("{") && saldo.notas.endsWith("}")) {
              const parsed = JSON.parse(saldo.notas);
              if (parsed.compania) compania = parsed.compania;
              if (parsed.servicio) servicio = parsed.servicio;
              if (parsed.nombre && !nombre) nombre = parsed.nombre;
            }
          } catch {}
        }

        return {
          ...saldo,
          nombre: nombre || "-",
          compania: compania || "-",
          servicio: servicio || "",
        };
      });

      const servSaldos = parsedSaldos.filter((s) => {
        const servMatch =
          (s.servicio && s.servicio.toLowerCase().trim() === selectedServicio.nombre.toLowerCase().trim()) ||
          s.servicio_id === selectedServicio.id;
        return servMatch && s.numero_telefono;
      });

      const celularesList = servSaldos.map((s) => ({
        id: s.id,
        numero: s.numero_telefono,
        nombre: s.nombre !== "-" ? s.nombre : "Celular Asignado",
        compania: s.compania !== "-" ? s.compania : "Telcel",
        tipo: "Celular Operativo"
      }));

      setTelefonos(celularesList);

      // 4. Agenda events for this service (only visita_supervision and capacitacion)
      const servEvents = (agendaData || []).filter((e) => {
        const matchesService =
          e.servicio_id === selectedServicio.id ||
          (e.servicio_nombre && e.servicio_nombre.toLowerCase() === selectedServicio.nombre.toLowerCase());
        const matchesType = e.tipo === "visita_supervision" || e.tipo === "capacitacion";
        return matchesService && matchesType;
      });
      setAgendaEvents(servEvents);

      // 5. Load client reports from localStorage + server
      try {
        const localKey = `serco_reportes_cliente_${selectedServicio.id}`;
        const localReports = JSON.parse(localStorage.getItem(localKey) || "[]");
        setReportesCliente(localReports);
      } catch (e) {
        console.error("Error reading client reports from localStorage:", e);
      }
    } catch (err) {
      console.error("Error loading client service data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedServicio]);

  useEffect(() => {
    loadServiceData();
  }, [loadServiceData]);

  // Current month's invoice
  const facturaActual = useMemo(() => {
    if (!cobros || cobros.length === 0) return null;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Try matching current month
    const current = cobros.find((c) => c.mes === currentMonthKey);
    if (current) return current;

    // Otherwise return the most recent invoice
    return cobros[0];
  }, [cobros]);

  const getTurnoPriority = (turno) => {
    if (!turno) return 99;
    const clean = turno.toLowerCase().replace(/[-_]/g, " ").trim();
    if (clean.includes("matutino")) return 1;
    if (clean.includes("vespertino")) return 2;
    if (clean.includes("cubre") || clean.includes("descanso")) return 3;
    return 4;
  };

  // Assigned guards mapped with employee details and ordered: Matutino, Vespertino, Cubredescansos
  const guardias = useMemo(() => {
    const list = asignaciones.map((asig) => {
      const emp = empleados.find(
        (e) =>
          (asig.empleado_id != null && String(e.id) === String(asig.empleado_id)) ||
          (e.nombre_completo &&
            asig.empleado_nombre &&
            e.nombre_completo.trim().toLowerCase() === asig.empleado_nombre.trim().toLowerCase())
      );
      return {
        id: asig.id,
        turno: asig.turno || "matutino",
        nombre: emp?.nombre_completo || asig.empleado_nombre || "Guardia Asignado",
        puesto: emp?.puesto || "Guardia de Seguridad",
        foto_url: emp?.foto_url || null,
        foto_url_runtime: emp?.foto_url_runtime || null,
        telefono: emp?.telefono || null,
        estado: emp?.estado || "activo"
      };
    });

    return list.sort((a, b) => getTurnoPriority(a.turno) - getTurnoPriority(b.turno));
  }, [asignaciones, empleados]);

  // Empleados con servicio de oficina o supervisión asignados a la sede donde se encuentra el servicio
  const organigramaEmpleados = useMemo(() => {
    if (!selectedServicio) return [];
    const currentSedeId = selectedServicio.sede_id;

    // Servicios cuyo nombre incluya oficina o supervisión
    const oficinaSupervisionServIds = (allServices || [])
      .filter((s) => {
        const nom = (s.nombre || "").toLowerCase();
        return nom.includes("oficina") || nom.includes("supervis");
      })
      .map((s) => s.id);

    return (empleados || []).filter((emp) => {
      // Excluir bajas
      if (emp.estado === "baja" || emp.fecha_baja) return false;

      // Filtrar por sede donde se encuentra el servicio (si tiene sede_id)
      if (currentSedeId && emp.sede_id && emp.sede_id !== currentSedeId) {
        return false;
      }

      const puesto = (emp.puesto || "").toLowerCase();
      const servicioUbicacion = (emp.servicio_ubicacion || "").toLowerCase();

      const isOficinaOrSupervisionByText =
        puesto.includes("oficina") ||
        puesto.includes("supervis") ||
        puesto.includes("coordinad") ||
        puesto.includes("administrativ") ||
        servicioUbicacion.includes("oficina") ||
        servicioUbicacion.includes("supervis");

      if (isOficinaOrSupervisionByText) return true;

      // Verificar en asignación de turnos si está asignado a servicio de oficina o supervisión
      const hasAsig = (asignaciones || []).some((asig) => {
        const empMatches =
          asig.empleado_id === emp.id ||
          (asig.empleado_nombre &&
            emp.nombre_completo &&
            asig.empleado_nombre.trim().toLowerCase() === emp.nombre_completo.trim().toLowerCase());

        if (!empMatches) return false;

        const asigServNombre = (asig.servicio_nombre || "").toLowerCase();
        if (asigServNombre.includes("oficina") || asigServNombre.includes("supervis")) {
          return true;
        }

        if (asig.servicio_id && oficinaSupervisionServIds.includes(asig.servicio_id)) {
          return true;
        }

        return false;
      });

      return hasAsig;
    });
  }, [selectedServicio, allServices, empleados, asignaciones]);

  // Submit client report / incident
  const addReporte = (nuevoReporte) => {
    if (!selectedServicio) return;
    const ticketId = `REP-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const item = {
      id: ticketId,
      servicio_id: selectedServicio.id,
      servicio_nombre: selectedServicio.nombre,
      tipo: nuevoReporte.tipo || "Incidencia Operativa",
      titulo: nuevoReporte.titulo || "",
      descripcion: nuevoReporte.descripcion || "",
      prioridad: nuevoReporte.prioridad || "Normal",
      estado: "Recibido",
      fecha: now.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
      hora: now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      creado_por: user?.full_name || user?.nombre || "Cliente",
      respuesta: "Tu reporte ha sido canalizado a la mesa de operaciones de SERCO."
    };

    const updated = [item, ...reportesCliente];
    setReportesCliente(updated);
    try {
      const localKey = `serco_reportes_cliente_${selectedServicio.id}`;
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving client report:", e);
    }
    return item;
  };

  // Generate the 4 Smart Notification types:
  // 1. Finanzas (Factura enviada & Semana de pago/1 día antes/día de - SI NO ESTÁ PAGADA)
  // 2. Personal (Alta o baja de guardia en el servicio)
  // 3. Supervisión (Supervisión agendada & hoy día/hora)
  // 4. Capacitación (Capacitación agendada & hoy día/hora)
  const notificaciones = useMemo(() => {
    if (!selectedServicio) return [];
    const list = [];
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // ──────────────── 1. FINANZAS ────────────────
    if (facturaActual) {
      const isPaid = (facturaActual.estado || "").toLowerCase() === "pagado";
      const montoFormateado = Number(facturaActual.monto || 0).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN"
      });

      // 1.1 Factura emitida / enviada
      if (facturaActual.fecha_factura || facturaActual.fecha_envio) {
        list.push({
          id: `fin-emitida-${facturaActual.id}`,
          tipo: "finanzas",
          titulo: "Factura del mes emitida",
          mensaje: `Se ha emitido tu factura correspondiente al periodo ${facturaActual.mes || ""} por ${montoFormateado}.`,
          fecha: facturaActual.fecha_factura || facturaActual.fecha_envio,
          urgente: false,
          icono: "dollar"
        });
      }

      // 1.2 Recordatorio de pago (Semana de pago, 1 día antes, y el día de)
      // REGLA ESTRICTA: "en caso de que se cambie el estatus a pagado antes de enviar esas notificaciones no las mandes."
      if (!isPaid && facturaActual.fecha_limite_pago) {
        const dueDate = new Date(facturaActual.fecha_limite_pago + "T00:00:00");
        const todayZero = new Date(todayStr + "T00:00:00");
        const diffDays = Math.round((dueDate - todayZero) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          list.push({
            id: `fin-vence-hoy-${facturaActual.id}`,
            tipo: "finanzas",
            titulo: "¡Hoy vence tu factura!",
            mensaje: `Hoy es la fecha límite para el pago de tu factura (${montoFormateado}). Evita recargos o afectaciones en el servicio.`,
            fecha: todayStr,
            urgente: true,
            icono: "alert"
          });
        } else if (diffDays === 1) {
          list.push({
            id: `fin-vence-manana-${facturaActual.id}`,
            tipo: "finanzas",
            titulo: "Recordatorio de pago: vence mañana",
            mensaje: `Tu factura por ${montoFormateado} vence el día de mañana (${facturaActual.fecha_limite_pago}).`,
            fecha: todayStr,
            urgente: true,
            icono: "alert"
          });
        } else if (diffDays > 1 && diffDays <= 7) {
          list.push({
            id: `fin-semana-pago-${facturaActual.id}`,
            tipo: "finanzas",
            titulo: "Semana de pago de factura",
            mensaje: `Estamos en la semana de vencimiento de tu factura (${montoFormateado}). Fecha límite: ${facturaActual.fecha_limite_pago}.`,
            fecha: todayStr,
            urgente: false,
            icono: "dollar"
          });
        }
      }
    }

    // ──────────────── 2. PERSONAL ────────────────
    // Altas y bajas en el servicio
    guardias.forEach((g) => {
      if (g.estado === "baja" || g.fecha_baja) {
        list.push({
          id: `pers-baja-${g.id}`,
          tipo: "personal",
          titulo: "Baja de personal en servicio",
          mensaje: `El guardia ${g.nombre} ha concluido su asignación en el turno ${g.turno}. SERCO ya gestiona el reemplazo operativo.`,
          fecha: todayStr,
          urgente: true,
          icono: "user"
        });
      } else {
        list.push({
          id: `pers-alta-${g.id}`,
          tipo: "personal",
          titulo: "Personal activo asignado",
          mensaje: `${g.nombre} está asignado como ${g.puesto} en turno ${g.turno}.`,
          fecha: todayStr,
          urgente: false,
          icono: "user"
        });
      }
    });

    // ──────────────── 3. SUPERVISIÓN ────────────────
    const supervisionEvents = agendaEvents.filter((e) => e.tipo === "visita_supervision");
    supervisionEvents.forEach((ev) => {
      const isToday = ev.fecha === todayStr;
      if (isToday) {
        list.push({
          id: `sup-hoy-${ev.id}`,
          tipo: "supervision",
          titulo: "Visita de supervisión hoy",
          mensaje: `Hoy se realizará una visita de supervisión operativa programada a las ${ev.hora_inicio || "horario establecido"}.`,
          fecha: ev.fecha,
          urgente: true,
          icono: "eye"
        });
      } else if (ev.fecha >= todayStr) {
        list.push({
          id: `sup-programada-${ev.id}`,
          tipo: "supervision",
          titulo: "Supervisión agendada",
          mensaje: `Se ha programado una visita de supervisión para el ${ev.fecha} a las ${ev.hora_inicio}.`,
          fecha: ev.fecha,
          urgente: false,
          icono: "eye"
        });
      }
    });

    // ──────────────── 4. CAPACITACIÓN ────────────────
    const capacitacionEvents = agendaEvents.filter((e) => e.tipo === "capacitacion");
    capacitacionEvents.forEach((ev) => {
      const isToday = ev.fecha === todayStr;
      if (isToday) {
        list.push({
          id: `cap-hoy-${ev.id}`,
          tipo: "capacitacion",
          titulo: "Capacitación de guardias hoy",
          mensaje: `Hoy se imparte la capacitación "${ev.titulo || ev.tema_capacitacion || "Operativa"}" a las ${ev.hora_inicio || "horario establecido"}.`,
          fecha: ev.fecha,
          urgente: true,
          icono: "book"
        });
      } else if (ev.fecha >= todayStr) {
        list.push({
          id: `cap-programada-${ev.id}`,
          tipo: "capacitacion",
          titulo: "Capacitación agendada",
          mensaje: `Capacitación programada: "${ev.titulo || ev.tema_capacitacion || "Formación continua"}" para el ${ev.fecha} a las ${ev.hora_inicio}.`,
          fecha: ev.fecha,
          urgente: false,
          icono: "book"
        });
      }
    });

    // Filter out dismissed notifications
    return list.filter((n) => !dismissedNotifications.includes(n.id));
  }, [selectedServicio, facturaActual, guardias, agendaEvents, dismissedNotifications]);

  const dismissNotification = (id) => {
    const updated = [...dismissedNotifications, id];
    setDismissedNotifications(updated);
    try {
      localStorage.setItem(`serco_client_dismissed_${user?.id || "guest"}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving dismissed notifications:", e);
    }
  };

  const clearDismissedNotifications = () => {
    setDismissedNotifications([]);
    try {
      localStorage.removeItem(`serco_client_dismissed_${user?.id || "guest"}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ClientPortalContext.Provider
      value={{
        user,
        isAdmin,
        allServices,
        clientServices,
        selectedServicio,
        setSelectedServiceId: handleSelectService,
        loading,
        facturaActual,
        cobros,
        guardias,
        telefonos,
        agendaEvents,
        reportesCliente,
        addReporte,
        notificaciones,
        dismissNotification,
        clearDismissedNotifications,
        organigramaEmpleados,
        empleados,
        asignaciones,
        datosBancarios,
        refreshData: loadServiceData,
      }}
    >
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal() {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) {
    throw new Error("useClientPortal must be used within a ClientPortalProvider");
  }
  return ctx;
}
