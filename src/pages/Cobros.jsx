import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search, DollarSign, CheckCircle, EyeOff, ChevronLeft, ChevronRight, CalendarDays, CreditCard } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function getDiasMesFactura(mesString) {
  if (!mesString) return 31;
  const parts = mesString.split("-");
  const monthNum = parseInt(parts[1], 10);
  switch (monthNum) {
    case 2:
      return 29; // Febrero 29 días
    case 4: // Abril 30 días
    case 6: // Junio 30 días
      return 30;
    case 1: // Enero 32 días
    case 5: // Mayo 32 días
    case 12: // Diciembre 32 días
      return 32;
    default:
      return 31; // Marzo, Julio, Agosto, Septiembre, Octubre, Noviembre
  }
}

export function getCobroMeta(id) {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(`serco_cobro_meta_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCobroMeta(id, meta) {
  if (!id) return;
  try {
    localStorage.setItem(`serco_cobro_meta_${id}`, JSON.stringify(meta));
  } catch (e) {
    console.error("Error guardando cobro metadata:", e);
  }
}

export function getServicioCobroConfig(servicioId) {
  if (!servicioId) return null;
  try {
    const raw = localStorage.getItem(`serco_serv_cobro_cfg_${servicioId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setServicioCobroConfig(servicioId, cfg) {
  if (!servicioId) return;
  try {
    localStorage.setItem(`serco_serv_cobro_cfg_${servicioId}`, JSON.stringify(cfg));
  } catch (e) {
    console.error("Error guardando config cobro servicio:", e);
  }
}

export const DEFAULT_DATOS_BANCARIOS = {
  beneficiario: "SERCO SEGURIDAD PRIVADA S.A. DE C.V.",
  banco: "BBVA México",
  clabe: "012 180 00123456789 0",
  cuenta: "",
  notas: ""
};

export function getDatosBancarios() {
  try {
    const raw = localStorage.getItem("serco_datos_bancarios_empresa");
    if (!raw) return DEFAULT_DATOS_BANCARIOS;
    const parsed = JSON.parse(raw);
    if (parsed.notas === "Favor de indicar como referencia el nombre de su servicio") {
      parsed.notas = "";
    }
    return { ...DEFAULT_DATOS_BANCARIOS, ...parsed };
  } catch {
    return DEFAULT_DATOS_BANCARIOS;
  }
}

export function setDatosBancarios(data) {
  try {
    localStorage.setItem("serco_datos_bancarios_empresa", JSON.stringify(data));
    window.dispatchEvent(new Event("serco_datos_bancarios_updated"));
  } catch (e) {
    console.error("Error guardando datos bancarios:", e);
  }
}

function getParteNombre(frecuencia, index) {
  if (frecuencia === "semanal") return index === 4 ? "Cierre" : `Semana ${index + 1}`;
  if (frecuencia === "quincenal") return `Quincena ${index + 1}`;
  return index === 0 ? "Mensual" : `Parte ${index + 1}`;
}

function getPartePeriodo(frecuencia, index, mes) {
  if (!mes || frecuencia === "mensual") return null;
  const diasMes = getDiasMesFactura(mes);
  if (frecuencia === "semanal") {
    if (index < 4) return `Días ${index * 7 + 1} al ${(index + 1) * 7}`;
    return `Días 29 al ${diasMes}`;
  }
  if (index === 0) return "Días 1 al 15";
  return `Días 16 al ${diasMes}`;
}

export function calcularPlanPagos({ montoBase, costoDia, esVariable, diasMes, calcularIva, frecuencia }) {
  const monto = Number(montoBase) || 0;
  const cDia = Number(costoDia) || (diasMes > 0 ? monto / diasMes : 0);
  const factorIva = calcularIva ? 1.16 : 1;
  const total = Math.round(monto * factorIva);
  const iva = calcularIva ? Math.round(monto * 0.16) : 0;

  if (frecuencia === "quincenal") {
    let q1 = 0;
    let q2 = 0;
    if (esVariable && cDia > 0) {
      const diasQ1 = Math.min(15, diasMes);
      const diasQ2 = Math.max(0, diasMes - 15);
      const baseQ1 = Math.round(diasQ1 * cDia);
      q1 = Math.round(baseQ1 * factorIva);
      q2 = total - q1;
      return {
        total,
        iva,
        tipo: "quincenal",
        detalles: [
          { id: "q1", nombre: "Quincena 1", monto: q1 },
          { id: "q2", nombre: "Quincena 2", monto: q2 },
        ],
      };
    } else {
      q1 = Math.round(total / 2);
      q2 = total - q1;
      return {
        total,
        iva,
        tipo: "quincenal",
        detalles: [
          { id: "q1", nombre: "Quincena 1", monto: q1 },
          { id: "q2", nombre: "Quincena 2", monto: q2 },
        ],
      };
    }
  }

  if (frecuencia === "semanal") {
    if (esVariable && cDia > 0) {
      const cuotaSemana = Math.round(7 * cDia * factorIva);
      const diasSobrantes = Math.max(0, diasMes - 28);
      const montoRemanente = total - (cuotaSemana * 4);

      const detalles = [
        { id: "w1", nombre: "Semana 1", monto: cuotaSemana },
        { id: "w2", nombre: "Semana 2", monto: cuotaSemana },
        { id: "w3", nombre: "Semana 3", monto: cuotaSemana },
        { id: "w4", nombre: "Semana 4", monto: cuotaSemana },
      ];
      if (diasSobrantes > 0 && montoRemanente > 0) {
        detalles.push({
          id: "w5",
          nombre: "Cierre",
          monto: montoRemanente,
        });
      }
      return {
        total,
        iva,
        tipo: "semanal",
        detalles,
      };
    } else {
      const cuota = Math.round(total / 4);
      const c4 = total - (cuota * 3);
      return {
        total,
        iva,
        tipo: "semanal",
        detalles: [
          { id: "w1", nombre: "Semana 1", monto: cuota },
          { id: "w2", nombre: "Semana 2", monto: cuota },
          { id: "w3", nombre: "Semana 3", monto: cuota },
          { id: "w4", nombre: "Semana 4", monto: c4 },
        ],
      };
    }
  }

  return {
    total,
    iva,
    tipo: "mensual",
    detalles: [
      { id: "m1", nombre: "Pago mensual único", monto: total },
    ],
  };
}

export function getCobroPartesInfo(cobro, meta = null) {
  if (!cobro) {
    return {
      plan: { total: 0, iva: 0, detalles: [] },
      partes: [],
      totalPartes: 0,
      partesPagadas: [],
      fechasPartes: {},
      pagadoCount: 0,
      isFullPaid: false,
      isParcial: false,
      isPendiente: true,
      estadoEfectivo: "pendiente",
      totalConIva: 0,
      totalNormal: 0,
      totalIva: 0,
      pagadoTotal: 0,
      pagadoNormal: 0,
      pagadoIva: 0,
      pendienteTotal: 0,
      pendienteNormal: 0,
      pendienteIva: 0,
    };
  }

  const m = meta || getCobroMeta(cobro.id) || {};
  const diasMes = getDiasMesFactura(cobro.mes);
  const montoBase = Number(cobro.monto) || 0;
  const calcularIva = m?.calcular_iva !== undefined ? m.calcular_iva : true;
  const frecuencia = m?.frecuencia_pago || "mensual";

  const plan = calcularPlanPagos({
    montoBase,
    costoDia: m?.costo_dia,
    esVariable: m?.es_variable,
    diasMes,
    calcularIva,
    frecuencia,
  });

  const partes = Array.isArray(m?.partes_personalizadas) && m.partes_personalizadas.length > 0
    ? m.partes_personalizadas.map((parte, index) => ({
        id: parte.id || `custom-${index + 1}`,
        nombre: getParteNombre(frecuencia, index),
        monto: Number(parte.monto) || 0,
      }))
    : (plan.detalles || []);
  const totalPartes = partes.length;

  let partesPagadas = Array.isArray(m?.partes_pagadas) ? [...m.partes_pagadas] : [];
  const fechasPartes = m?.fechas_partes || {};

  // Si en la base de datos está marcado como 'pagado' pero no tiene partes registradas en metadata,
  // asumimos que todas las cuotas están cubiertas al 100%.
  if (cobro.estado === "pagado" && partesPagadas.length === 0) {
    partesPagadas = partes.map((p) => p.id);
  }

  let pagadoTotal = 0;
  let pagadoNormal = 0;

  partes.forEach((p) => {
    if (partesPagadas.includes(p.id)) {
      pagadoTotal += p.monto;
      const sub = calcularIva ? Math.round(p.monto / 1.16) : p.monto;
      pagadoNormal += sub;
    }
  });

  const isFullPaid = cobro.estado === "pagado" || (totalPartes > 0 && partesPagadas.length === totalPartes);
  const isParcial = !isFullPaid && partesPagadas.length > 0;
  const isPendiente = !isFullPaid && !isParcial;

  if (isFullPaid) {
    pagadoTotal = plan.total;
    pagadoNormal = montoBase;
  }

  const pagadoIva = Math.max(0, pagadoTotal - pagadoNormal);
  const pendienteTotal = Math.max(0, plan.total - pagadoTotal);
  const pendienteNormal = Math.max(0, montoBase - pagadoNormal);
  const pendienteIva = Math.max(0, plan.iva - pagadoIva);

  let estadoEfectivo = cobro.estado;
  if (isFullPaid) {
    estadoEfectivo = "pagado";
  } else if (isParcial) {
    estadoEfectivo = "parcial";
  } else {
    estadoEfectivo = cobro.estado === "vencido" ? "vencido" : "pendiente";
  }

  return {
    plan,
    partes,
    totalPartes,
    partesPagadas,
    fechasPartes,
    pagadoCount: partesPagadas.length,
    isFullPaid,
    isParcial,
    isPendiente,
    estadoEfectivo,
    totalConIva: plan.total,
    totalNormal: montoBase,
    totalIva: plan.iva,
    pagadoTotal,
    pagadoNormal,
    pagadoIva,
    pendienteTotal,
    pendienteNormal,
    pendienteIva,
  };
}

function getMonthsBetween(start, end) {
  const result = [];
  let [startY, startM] = start.split("-").map(Number);
  const [endY, endM] = end.split("-").map(Number);
  
  while (startY < endY || (startY === endY && startM <= endM)) {
    const mm = String(startM).padStart(2, '0');
    result.push(`${startY}-${mm}`);
    startM++;
    if (startM > 12) {
      startM = 1;
      startY++;
    }
  }
  return result;
}

function adjustDateToMonth(prevDate, targetMonth) {
  if (!prevDate) return null;
  const day = parseInt(prevDate.substring(8, 10));
  const [targetY, targetM] = targetMonth.split("-").map(Number);
  const lastDay = new Date(targetY, targetM, 0).getDate();
  const finalDay = Math.min(day, lastDay);
  const dd = String(finalDay).padStart(2, '0');
  return `${targetMonth}-${dd}`;
}

const emptyForm = {
  servicio_id: "",
  servicio_nombre: "",
  mes: "",
  fecha_factura: "",
  monto: "",
  estado: "pendiente",
  fecha_limite_pago: "",
  fecha_pago: "",
  sede_id: "",
  // Configuración de Factura Variable y Métodos de Pago
  es_variable: false,
  costo_dia: "",
  metodo_pago: "transferencia", // transferencia | efectivo | cheque
  calcular_iva: true,
  frecuencia_pago: "mensual", // mensual | quincenal | semanal
  partes_pagadas: [],
  fechas_partes: {},
};

function copiarFecha(fecha,mes){

  if(!fecha) return "";

  const dia=fecha.slice(8);

  return mes+"-"+dia;

  }

function formatMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getDateFromMonthKey(monthKey) {
  if (!monthKey) return new Date();
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1, 1);
}

export default function Cobros() {
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView, can } = usePermissions();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [kpiMode, setKpiMode] = useState("total");
  const [deleteId, setDeleteId] = useState(null);
  const [excludeId, setExcludeId] = useState(null);

  // Estado del modal de registro de pago (abono parcial o pago completo)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentCobro, setPaymentCobro] = useState(null);
  const [paymentMeta, setPaymentMeta] = useState(null);
  const [paymentParts, setPaymentParts] = useState([]);
  const [savingPayment, setSavingPayment] = useState(false);

  // Modal de configuración de datos bancarios para finanzas
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState(getDatosBancarios);
  const [savingBank, setSavingBank] = useState(false);

  const handleSaveBankInfo = () => {
    setSavingBank(true);
    try {
      setDatosBancarios(bankForm);
      toast({
        title: "Datos Bancarios Actualizados",
        description: "La información de la cuenta se ha guardado y se reflejará en el portal de clientes.",
      });
      setBankModalOpen(false);
    } catch {
      toast({
        title: "Error al guardar",
        description: "No se pudieron actualizar los datos bancarios.",
        variant: "destructive"
      });
    } finally {
      setSavingBank(false);
    }
  };

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    return `${today.getFullYear()}-${mm}`;
  });

  useEffect(() => { load(); }, [currentMonth, sedeFilter]);

  async function load() {
    setLoading(true);
    try {
      const cobroQuery = {
        ...sedeFilter,
        mes: currentMonth,
      };

      const [monthlyCobros, allServicios, allSedes] = await Promise.all([
        sercoApi.entities.Cobro.filter(cobroQuery, "-created_date"),
        sercoApi.entities.Servicio.filter(sedeFilter, "-created_date"),
        sercoApi.entities.Sede.list(),
      ]);

      const activeServicios = allServicios.filter((s) => {
        const isCurrentlyActive = (s.estado || "activo") === "activo";

        if (!isCurrentlyActive) {
          // If no deactivation date, exclude it completely
          if (!s.fecha_baja) return false;
          
          // Allow billing generation ONLY for months prior to or equal to the deactivation month
          const [curYear, curMonth] = currentMonth.split("-").map(Number);
          const [bajaYear, bajaMonth] = s.fecha_baja.split("-").map(Number);
          if (curYear < bajaYear) return true;
          if (curYear === bajaYear && curMonth <= bajaMonth) return true;
          return false;
        }

        if (!s.fecha_inicio) return true;
        const [curYear, curMonth] = currentMonth.split("-").map(Number);
        const [startYear, startMonth] = s.fecha_inicio.split("-").map(Number);
        if (startYear < curYear) return true;
        if (startYear === curYear && startMonth <= curMonth) return true;
        return false;
      });

      const allPendingCreates = [];

      activeServicios.forEach((s) => {
        const startMonth = s.fecha_inicio ? s.fecha_inicio.substring(0, 7) : currentMonth;
        if (startMonth <= currentMonth) {
          const existing = monthlyCobros.find((c) => c.servicio_id === s.id);
          if (!existing) {
            const cfg = getServicioCobroConfig(s.id);
            let calculatedMonto = Number(s.monto_mensual) || 0;
            if (cfg?.es_variable && cfg?.costo_dia) {
              const dias = getDiasMesFactura(currentMonth);
              calculatedMonto = Math.round(Number(cfg.costo_dia) * dias);
            } else if (cfg?.monto != null && cfg.monto !== "") {
              calculatedMonto = Number(cfg.monto);
            }

            allPendingCreates.push({
              servicio_id: s.id,
              servicio_nombre: s.nombre,
              mes: currentMonth,
              fecha_factura: null,
              monto: calculatedMonto,
              estado: "pendiente",
              fecha_limite_pago: null,
              fecha_pago: null,
              sede_id: s.sede_id,
              _cfg: cfg,
            });
          }
        }
      });

      let nextCobros = monthlyCobros;
      if (allPendingCreates.length > 0) {
        const createdResults = await Promise.allSettled(
          allPendingCreates.map(({ _cfg, ...payload }) => sercoApi.entities.Cobro.create(payload))
        );

        createdResults.forEach((res, idx) => {
          if (res.status === "fulfilled" && res.value?.id) {
            const cfg = allPendingCreates[idx]?._cfg;
            if (cfg) {
              setCobroMeta(res.value.id, {
                es_variable: cfg.es_variable,
                costo_dia: cfg.costo_dia,
                metodo_pago: cfg.metodo_pago,
                calcular_iva: cfg.calcular_iva,
                frecuencia_pago: cfg.frecuencia_pago,
              });
            }
          }
        });

        nextCobros = await sercoApi.entities.Cobro.filter(cobroQuery, "-created_date");
      }

      setItems(nextCobros.filter((c) => !getCobroMeta(c.id)?.excluida));
      setServicios(allServicios);
      setSedes(allSedes);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al cargar facturas",
        description: e.message || "Ocurrió un error inesperado al procesar facturas automáticas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleMonthChange = (direction) => {
    const [yearStr, monthStr] = currentMonth.split("-");
    let year = parseInt(yearStr);
    let month = parseInt(monthStr) - 1;
    month += direction;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    const mm = String(month + 1).padStart(2, '0');
    setCurrentMonth(`${year}-${mm}`);
  };

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const monthlyItems = items.filter((item) => item.mes === currentMonth && !getCobroMeta(item.id)?.excluida);

  const filtered = monthlyItems.filter((item) => {
    const txt = search.toLowerCase();
    return (
      (item.servicio_nombre || "").toLowerCase().includes(txt) ||
      (item.estado || "").toLowerCase().includes(txt) ||
      (item.fecha_factura || "").toLowerCase().includes(txt)
    );
  });


  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      mes: currentMonth,
      sede_id: defaultSedeId,
      es_variable: false,
      costo_dia: "",
      metodo_pago: "transferencia",
      calcular_iva: true,
      frecuencia_pago: "mensual",
      partes_pagadas: [],
      fechas_partes: {},
      partes_personalizadas: null,
    });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    const meta = getCobroMeta(item.id) || {};
    const esVariable = meta.es_variable ?? false;
    const costoDia = meta.costo_dia ?? "";
    const metodoPago = meta.metodo_pago ?? "transferencia";
    const calcularIva = meta.calcular_iva !== undefined ? meta.calcular_iva : (metodoPago !== "efectivo");
    const frecuenciaPago = meta.frecuencia_pago ?? "mensual";

    const info = getCobroPartesInfo(item, meta);

    setForm({
      ...emptyForm,
      ...item,
      monto: item.monto ?? "",
      mes: item.mes,
      es_variable: esVariable,
      costo_dia: costoDia,
      metodo_pago: metodoPago,
      calcular_iva: calcularIva,
      frecuencia_pago: frecuenciaPago,
      partes_pagadas: info.partesPagadas,
      fechas_partes: info.fechasPartes,
      partes_personalizadas: Array.isArray(meta.partes_personalizadas) ? info.partes : null,
      estado: info.estadoEfectivo,
    });

    setModalOpen(true);
  }

  const handleOpenPayment = (item) => {
    const meta = getCobroMeta(item.id) || {};
    const info = getCobroPartesInfo(item, meta);
    const todayStr = new Date().toISOString().slice(0, 10);

    let foundFirstUnpaid = false;
    const partsState = info.partes.map((p) => {
      const isPaid = info.partesPagadas.includes(p.id);
      let checked = isPaid;
      let fecha = info.fechasPartes[p.id] || (isPaid ? (item.fecha_pago || todayStr) : todayStr);

      // Si no está liquidado completamente y la cuota está pendiente, auto-seleccionamos la primera pendiente
      if (!info.isFullPaid && !isPaid && !foundFirstUnpaid) {
        checked = true;
        foundFirstUnpaid = true;
        fecha = todayStr;
      }

      return {
        id: p.id,
        nombre: p.nombre,
        monto: p.monto,
        checked,
        fecha,
      };
    });

    setPaymentCobro(item);
    setPaymentMeta(meta);
    setPaymentParts(partsState);
    setPaymentModalOpen(true);
  };

  const handleSavePaymentModal = async () => {
    if (!paymentCobro) return;
    setSavingPayment(true);
    try {
      const checkedParts = paymentParts.filter((p) => p.checked);
      const paidIds = checkedParts.map((p) => p.id);
      const fechas = {};
      paymentParts.forEach((p) => {
        if (p.checked) {
          fechas[p.id] = p.fecha || new Date().toISOString().slice(0, 10);
        }
      });

      const isAllPaid = checkedParts.length === paymentParts.length && paymentParts.length > 0;
      const isNonePaid = checkedParts.length === 0;

      let nuevoEstado = "pendiente";
      if (isAllPaid) {
        nuevoEstado = "pagado";
      } else if (!isNonePaid) {
        nuevoEstado = "parcial";
      } else {
        nuevoEstado = paymentCobro.estado === "vencido" ? "vencido" : "pendiente";
      }

      const latestFechaPago = checkedParts.length > 0
        ? (checkedParts[checkedParts.length - 1].fecha || new Date().toISOString().slice(0, 10))
        : null;

      const updatedMeta = {
        ...paymentMeta,
        partes_pagadas: paidIds,
        fechas_partes: fechas,
      };
      setCobroMeta(paymentCobro.id, updatedMeta);

      try {
        await sercoApi.entities.Cobro.update(paymentCobro.id, {
          estado: nuevoEstado,
          fecha_pago: isAllPaid ? latestFechaPago : null,
        });
      } catch (dbErr) {
        console.warn("DB update con estado", nuevoEstado, "falló, guardando en pendiente:", dbErr);
        if (nuevoEstado === "parcial") {
          await sercoApi.entities.Cobro.update(paymentCobro.id, {
            estado: "pendiente",
            fecha_pago: null,
          });
        } else {
          throw dbErr;
        }
      }

      toast({
        title: isAllPaid ? "Factura liquidada al 100%" : isNonePaid ? "Pago retirado" : "Pago parcial registrado",
        description: isAllPaid
          ? "Se marcaron todas las cuotas como cubiertas."
          : isNonePaid
          ? "La factura quedó en estado pendiente."
          : `Se guardó el pago de ${checkedParts.length} de ${paymentParts.length} cuotas.`,
      });

      setPaymentModalOpen(false);
      await load();
    } catch (e) {
      console.error("Error al registrar pago:", e);
      toast({
        title: "Error al registrar pago",
        description: e.message || "Ocurrió un error inesperado al procesar el pago",
        variant: "destructive",
      });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleQuickPay = async (id) => {
    const item = items.find((c) => c.id === id);
    if (item) {
      handleOpenPayment(item);
    }
  };

  async function handleExclude() {
    if (!excludeId) return;
    const meta = getCobroMeta(excludeId) || {};
    setCobroMeta(excludeId, { ...meta, excluida: true });
    setExcludeId(null);
    setModalOpen(false);
    setEditing(null);
    await load();
  }

  function getFormPlan() {
    const diasMes = getDiasMesFactura(form.mes || currentMonth);
    return calcularPlanPagos({
      montoBase: Number(form.monto) || 0,
      costoDia: form.costo_dia,
      esVariable: form.es_variable,
      diasMes,
      calcularIva: form.calcular_iva,
      frecuencia: form.frecuencia_pago,
    });
  }

  function getEditableParts() {
    return form.partes_personalizadas || getFormPlan().detalles;
  }

  function enableCustomParts() {
    if (!form.partes_personalizadas) {
      setForm({ ...form, partes_personalizadas: getFormPlan().detalles.map((part) => ({ ...part })) });
    }
  }

  function updateCustomPart(partId, value) {
    const parts = getEditableParts().map((part) => (
      part.id === partId ? { ...part, monto: value } : part
    ));
    setForm({ ...form, partes_personalizadas: parts });
  }

  function addCustomPart() {
    const parts = getEditableParts();
    setForm({
      ...form,
      partes_personalizadas: [
        ...parts,
        { id: `custom-${Date.now()}`, nombre: getParteNombre(form.frecuencia_pago, parts.length), monto: 0 },
      ],
    });
  }

  function removeCustomPart(partId) {
    const parts = getEditableParts().filter((part) => part.id !== partId);
    const paidParts = (form.partes_pagadas || []).filter((id) => id !== partId);
    const dates = { ...(form.fechas_partes || {}) };
    delete dates[partId];
    setForm({
      ...form,
      partes_personalizadas: parts,
      partes_pagadas: paidParts,
      fechas_partes: dates,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const diasMes = getDiasMesFactura(form.mes || currentMonth);
      let finalMonto = form.monto === "" ? null : Number(form.monto);
      if (form.es_variable && form.costo_dia) {
        finalMonto = Math.round(Number(form.costo_dia) * diasMes);
      }

      const planActual = calcularPlanPagos({
        montoBase: finalMonto || 0,
        costoDia: form.costo_dia,
        esVariable: form.es_variable,
        diasMes,
        calcularIva: form.calcular_iva,
        frecuencia: form.frecuencia_pago,
      });

      const partesActuales = form.partes_personalizadas || planActual.detalles;
      const totalDistribuido = partesActuales.reduce((total, parte) => total + (Number(parte.monto) || 0), 0);
      if (form.partes_personalizadas && totalDistribuido !== planActual.total) {
        toast({
          title: "Distribución incompleta",
          description: `Las partes deben sumar exactamente $${planActual.total.toLocaleString("es-MX")}.`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const checkedParts = form.partes_pagadas || [];
      let finalEstado = form.estado;
      if (form.partes_personalizadas || form.frecuencia_pago !== "mensual") {
        if (checkedParts.length === 0) {
          finalEstado = form.estado === "vencido" ? "vencido" : "pendiente";
        } else if (checkedParts.length === partesActuales.length) {
          finalEstado = "pagado";
        } else {
          finalEstado = "parcial";
        }
      }

      const latestFechaPago = form.fecha_pago || (Object.values(form.fechas_partes || {}).pop()) || null;

      const payload = {
        servicio_id: form.servicio_id,
        servicio_nombre: form.servicio_nombre,
        mes: form.mes,
        fecha_factura: form.fecha_factura || null,
        monto: finalMonto,
        estado: finalEstado,
        fecha_limite_pago: form.fecha_limite_pago || null,
        fecha_pago: finalEstado === "pagado" ? latestFechaPago : null,
        sede_id: form.sede_id || defaultSedeId,
      };

      if (editing) {
        try {
          await sercoApi.entities.Cobro.update(editing.id, payload);
        } catch (dbErr) {
          console.warn("DB update falló con estado:", finalEstado, dbErr);
          if (finalEstado === "parcial") {
            await sercoApi.entities.Cobro.update(editing.id, {
              ...payload,
              estado: "pendiente",
              fecha_pago: null,
            });
          } else {
            throw dbErr;
          }
        }

        setCobroMeta(editing.id, {
          es_variable: form.es_variable,
          costo_dia: form.costo_dia,
          metodo_pago: form.metodo_pago,
          calcular_iva: form.calcular_iva,
          frecuencia_pago: form.frecuencia_pago,
          partes_pagadas: checkedParts,
          fechas_partes: form.fechas_partes || {},
          partes_personalizadas: form.partes_personalizadas || undefined,
        });

        try {
          const serviceId = editing.servicio_id;
          const editedMonth = editing.mes;
          const newMonto = payload.monto;
          const newFechaLimite = payload.fecha_limite_pago;

          const subsequentPendingCobros = await sercoApi.entities.Cobro.filter({
            servicio_id: serviceId,
            estado: "pendiente",
            mes: { $gt: editedMonth },
          });

          if (subsequentPendingCobros.length > 0) {
            await Promise.all(
              subsequentPendingCobros.map((c) => {
                const adjustedFechaLimite = adjustDateToMonth(newFechaLimite, c.mes);
                let cMonto = newMonto;
                if (form.es_variable && form.costo_dia) {
                  const cDias = getDiasMesFactura(c.mes);
                  cMonto = Math.round(Number(form.costo_dia) * cDias);
                }
                setCobroMeta(c.id, {
                  ...getCobroMeta(c.id),
                  es_variable: form.es_variable,
                  costo_dia: form.costo_dia,
                  metodo_pago: form.metodo_pago,
                  calcular_iva: form.calcular_iva,
                  frecuencia_pago: form.frecuencia_pago,
                });
                return sercoApi.entities.Cobro.update(c.id, {
                  monto: cMonto,
                  fecha_limite_pago: adjustedFechaLimite,
                });
              })
            );
            toast({
              title: "Propagación exitosa",
              description: `Se actualizó el monto de $${newMonto} y la configuración en ${subsequentPendingCobros.length} meses posteriores.`,
            });
          } else {
            toast({
              title: "Guardado sin propagación",
              description: "No se encontraron meses futuros pendientes para este servicio en esta sede.",
            });
          }
        } catch (propagateError) {
          console.error("No se pudo propagar el cambio a los meses siguientes:", propagateError);
          toast({
            title: "Advertencia de propagación",
            description: "El cobro se guardó, pero no se pudo propagar a los meses siguientes.",
            variant: "warning",
          });
        }
      } else {
        const created = await sercoApi.entities.Cobro.create(payload);
        if (created?.id) {
          setCobroMeta(created.id, {
            es_variable: form.es_variable,
            costo_dia: form.costo_dia,
            metodo_pago: form.metodo_pago,
            calcular_iva: form.calcular_iva,
            frecuencia_pago: form.frecuencia_pago,
            partes_pagadas: checkedParts,
            fechas_partes: form.fechas_partes || {},
            partes_personalizadas: form.partes_personalizadas || undefined,
          });
        }
        toast({ title: "Factura creada con éxito" });
      }

      setServicioCobroConfig(form.servicio_id, {
        es_variable: form.es_variable,
        costo_dia: form.costo_dia,
        metodo_pago: form.metodo_pago,
        calcular_iva: form.calcular_iva,
        frecuencia_pago: form.frecuencia_pago,
        monto: form.es_variable ? null : payload.monto,
      });

      setEditing(null);
      setForm(emptyForm);
      setModalOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al guardar factura",
        description: e.message || "Ocurrió un error inesperado al procesar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await sercoApi.entities.Cobro.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  if (!canView("cobros")) return <AccessRestricted />;

  const formatMes = (mes) => {
    if (!mes) return "—";
    try {
      return getDateFromMonthKey(mes).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    } catch {
      return mes;
    }
  };

  const estadoBadge = (item, info) => {
    if (info.isFullPaid) {
      return <Badge className="bg-emerald-100 text-emerald-700 font-semibold">Pagado</Badge>;
    }
    if (info.isParcial) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
          Parcial ({info.pagadoCount}/{info.totalPartes})
        </Badge>
      );
    }
    if (item.estado === "vencido") {
      return <Badge variant="secondary" className="bg-red-100 text-red-700 font-semibold">Vencido</Badge>;
    }
    return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200">Pendiente</Badge>;
  };

  const getCobroTotal = (c) => {
    const meta = getCobroMeta(c.id);
    const m = Number(c.monto) || 0;
    const tieneIva = meta?.calcular_iva !== undefined ? meta.calcular_iva : true;
    return tieneIva ? m * 1.16 : m;
  };

  const getCobroIva = (c) => {
    const meta = getCobroMeta(c.id);
    const m = Number(c.monto) || 0;
    const tieneIva = meta?.calcular_iva !== undefined ? meta.calcular_iva : true;
    return tieneIva ? m * 0.16 : 0;
  };

  let totalMontoNormal = 0;
  let totalIva = 0;
  let totalConIva = 0;
  let pagadoNormal = 0;
  let pagadoIva = 0;
  let pagadoTotal = 0;
  let pendienteNormal = 0;
  let pendienteIva = 0;
  let pendienteTotal = 0;

  filtered.forEach((c) => {
    const info = getCobroPartesInfo(c);
    totalMontoNormal += info.totalNormal;
    totalIva += info.totalIva;
    totalConIva += info.totalConIva;
    pagadoNormal += info.pagadoNormal;
    pagadoIva += info.pagadoIva;
    pagadoTotal += info.pagadoTotal;
    pendienteNormal += info.pendienteNormal;
    pendienteIva += info.pendienteIva;
    pendienteTotal += info.pendienteTotal;
  });

  const distributionTotal = form.partes_personalizadas
    ? form.partes_personalizadas.reduce((total, part) => total + (Number(part.monto) || 0), 0)
    : getFormPlan().total;
  const distributionIsInvalid = Boolean(
    form.partes_personalizadas && distributionTotal !== getFormPlan().total
  );

  return (
    <div className="space-y-4">

      {/* KPI Cards Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`cursor-pointer transition-all ${kpiMode === "normal" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted/30"}`} onClick={() => setKpiMode("normal")}>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Subtotal (Normal)</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">${totalMontoNormal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</h3>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Pagado: ${pagadoNormal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
              <span>Pendiente: ${pendienteNormal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`cursor-pointer transition-all ${kpiMode === "iva" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted/30"}`} onClick={() => setKpiMode("iva")}>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase">IVA (16%)</p>
            <h3 className="text-2xl font-bold mt-1 text-amber-600">${totalIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</h3>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Pagado: ${pagadoIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
              <span>Pendiente: ${pendienteIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`cursor-pointer transition-all ${kpiMode === "total" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted/30"}`} onClick={() => setKpiMode("total")}>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total (Con IVA)</p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-600">${totalConIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</h3>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Pagado: ${pagadoTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
              <span>Pendiente: ${pendienteTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-heading font-bold">Facturas</h2>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} factura(s)</p>
          </div>
          <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg border">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[120px] text-center">
              {formatMes(currentMonth)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {can("cobros", "edit") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBankForm(getDatosBancarios());
                setBankModalOpen(true);
              }}
              className="gap-2 text-xs font-semibold h-9 border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs"
              title="Configurar cuenta bancaria visible para los clientes"
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Datos Bancarios</span>
            </Button>
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Servicio</TableHead>
              <TableHead>Fecha Factura</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead className="text-right">Total Factura</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha Límite</TableHead>
              <TableHead>Fecha Pago</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay facturas registradas</TableCell></TableRow>
            ) : (
              filtered.map((item) => {
                const meta = getCobroMeta(item.id);
                const info = getCobroPartesInfo(item, meta);
                return (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => can("cobros", "edit") && openEdit(item)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{item.servicio_nombre || "—"}</span>
                        {meta?.es_variable && (
                          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] px-1.5 py-0 font-medium">
                            Variable
                          </Badge>
                        )}
                        {meta?.metodo_pago && (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0 capitalize">
                            {meta.metodo_pago}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.fecha_factura || "—"}</TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">
                      {meta?.frecuencia_pago || "Mensual"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.monto != null ? (
                        <div>
                          <div>${Math.round(info.totalConIva).toLocaleString("es-MX")}</div>
                          {info.isParcial && (
                            <div className="text-[11px] text-amber-700 font-medium">
                              Abonado: ${Math.round(info.pagadoTotal).toLocaleString("es-MX")}
                            </div>
                          )}
                          {meta?.calcular_iva === false && (
                            <div className="text-[10px] text-amber-600 font-normal">Sin IVA</div>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{estadoBadge(item, info)}</TableCell>
                    <TableCell>{item.fecha_limite_pago || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {info.isFullPaid ? (
                        item.fecha_pago || Object.values(info.fechasPartes)[0] || "—"
                      ) : info.isParcial ? (
                        <div className="space-y-0.5">
                          {info.partes
                            .filter((p) => info.partesPagadas.includes(p.id))
                            .map((p) => (
                              <div key={p.id} className="text-[11px] text-emerald-700 font-medium whitespace-nowrap">
                                {p.nombre.split("(")[0].trim()}: {info.fechasPartes[p.id] || "Pagado"}
                              </div>
                            ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                      {!info.isFullPaid ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-7 font-semibold gap-1",
                            info.isParcial
                              ? "border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800"
                              : "border-emerald-300 hover:bg-emerald-50 text-emerald-600"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPayment(item);
                          }}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          {info.isParcial ? "Abonar" : "Pago"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-emerald-700 gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPayment(item);
                          }}
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Pagos
                        </Button>
                      )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Factura" : "Nueva Factura"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Actualiza la información financiera y método de cobro del servicio."
                : "Crea un registro de cobro para el mes actual o subsecuente."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2">
            {/* Selector de servicio si es nueva factura */}
            {!editing ? (
              <div>
                <Label>Servicio *</Label>
                <Select
                  value={form.servicio_id}
                  onValueChange={(val) => {
                    const serv = servicios.find((s) => s.id === val);
                    setForm({
                      ...form,
                      servicio_id: val,
                      servicio_nombre: serv?.nombre || "",
                      sede_id: serv?.sede_id || defaultSedeId,
                      monto: serv?.monto_mensual || form.monto,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servicios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} {s.sede_id ? `(${sedeNombre(s.sede_id)})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Servicio</Label>
                <Input value={form.servicio_nombre} disabled className="bg-muted" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mes de Factura</Label>
                {!editing ? (
                  <Input
                    type="month"
                    value={form.mes}
                    onChange={(e) => {
                      const newMes = e.target.value;
                      const dias = getDiasMesFactura(newMes);
                      let newMonto = form.monto;
                      if (!form.partes_personalizadas && form.es_variable && form.costo_dia) {
                        newMonto = Math.round(Number(form.costo_dia) * dias);
                      }
                      setForm({ ...form, mes: newMes, monto: newMonto });
                    }}
                  />
                ) : (
                  <Input value={formatMes(form.mes)} disabled className="bg-muted" />
                )}
              </div>
              <div>
                <Label>Fecha de Factura</Label>
                <Input
                  type="date"
                  value={form.fecha_factura || ""}
                  onChange={(e) => setForm({ ...form, fecha_factura: e.target.value })}
                />
              </div>
            </div>

            {/* SECCIÓN FACTURA VARIABLE */}
            <div className="rounded-lg border p-3.5 bg-slate-50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">¿Es factura variable?</Label>
                  <p className="text-xs text-muted-foreground">
                    Calcula automáticamente el total con base en la tarifa por día del mes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${!form.es_variable ? "text-primary" : "text-muted-foreground"}`}>No</span>
                  <Switch
                    checked={form.es_variable}
                    onCheckedChange={(checked) => {
                      const dias = getDiasMesFactura(form.mes || currentMonth);
                      let newMonto = form.monto;
                      if (checked && !form.partes_personalizadas && form.costo_dia) {
                        newMonto = Math.round(Number(form.costo_dia) * dias);
                      }
                      setForm({ ...form, es_variable: checked, monto: newMonto });
                    }}
                  />
                  <span className={`text-xs font-semibold ${form.es_variable ? "text-primary" : "text-muted-foreground"}`}>Sí</span>
                </div>
              </div>

              {form.es_variable ? (
                <div className="space-y-3 pt-2 border-t border-border/60">
                  <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 p-2.5 rounded-md text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Días calculados para este mes:</span>
                      <Badge variant="secondary" className="bg-sky-200/60 dark:bg-sky-900 font-bold">
                        {getDiasMesFactura(form.mes || currentMonth)} días
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Regla oficial: Febrero (29d), Abril y Junio (30d), Enero, Mayo y Diciembre (32d), Resto (31d).
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="costo_dia">Costo por día ($ MXN) *</Label>
                    <Input
                      id="costo_dia"
                      type="number"
                      placeholder="Ej. 750"
                      value={form.costo_dia}
                      onChange={(e) => {
                        const val = e.target.value;
                        const dias = getDiasMesFactura(form.mes || currentMonth);
                        const calcMonto = val ? Math.round(Number(val) * dias) : "";
                        setForm({
                          ...form,
                          costo_dia: val,
                          monto: form.partes_personalizadas ? form.monto : calcMonto,
                        });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="monto_fijo">Monto Fijo Normal (Sin IVA) *</Label>
                  <Input
                    id="monto_fijo"
                    type="number"
                    placeholder="0.00"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* SECCIÓN FORMA DE PAGO Y FRECUENCIA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Método de Pago</Label>
                <Select
                  value={form.metodo_pago}
                  onValueChange={(val) => {
                    // Si Efectivo -> No IVA por defecto
                    // Si Transferencia o Cheque -> Con IVA por defecto
                    const nuevoIva = val !== "efectivo";
                    setForm({
                      ...form,
                      metodo_pago: val,
                      calcular_iva: nuevoIva,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Frecuencia de Pago</Label>
                <Select
                  value={form.frecuencia_pago}
                  onValueChange={(val) => {
                    if (val !== form.frecuencia_pago) {
                      setForm({
                        ...form,
                        frecuencia_pago: val,
                        partes_pagadas: [],
                        fechas_partes: {},
                        partes_personalizadas: null,
                        estado: form.estado === "pagado" ? "pendiente" : form.estado,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual (1 Pago)</SelectItem>
                    <SelectItem value="quincenal">Quincenal (2 Pagos)</SelectItem>
                    <SelectItem value="semanal">Semanal (Por Semanas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SWITCH OPCIÓN IVA */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
              <div>
                <Label className="text-sm font-semibold">¿Calcular IVA (16%)?</Label>
                <p className="text-xs text-muted-foreground">
                  {form.metodo_pago === "efectivo"
                    ? "En Efectivo está desactivado por defecto (puedes activarlo si se solicita)."
                    : "En Transferencia / Cheque está activado por defecto."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${!form.calcular_iva ? "text-primary" : "text-muted-foreground"}`}>No (0%)</span>
                <Switch
                  checked={form.calcular_iva}
                  onCheckedChange={(checked) => setForm({ ...form, calcular_iva: checked })}
                />
                <span className={`text-xs font-semibold ${form.calcular_iva ? "text-primary" : "text-muted-foreground"}`}>Sí (16%)</span>
              </div>
            </div>

            {/* TOTALES Y PLAN DE PAGOS DESGLOSADO */}
            {(() => {
              const diasMes = getDiasMesFactura(form.mes || currentMonth);
              const montoBase = Number(form.monto) || 0;
              const ivaMonto = form.calcular_iva ? Math.round(montoBase * 0.16) : 0;
              const totalMonto = montoBase + ivaMonto;

              const plan = calcularPlanPagos({
                montoBase,
                costoDia: form.costo_dia,
                esVariable: form.es_variable,
                diasMes,
                calcularIva: form.calcular_iva,
                frecuencia: form.frecuencia_pago,
              });

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/30">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase">Subtotal</span>
                      <p className="text-base font-bold text-slate-800">${montoBase.toLocaleString("es-MX")}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase">IVA (16%)</span>
                      <p className={`text-base font-bold ${form.calcular_iva ? "text-amber-600" : "text-slate-400 line-through"}`}>
                        ${ivaMonto.toLocaleString("es-MX")}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase">Total</span>
                      <p className="text-base font-extrabold text-primary">${totalMonto.toLocaleString("es-MX")}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5">
                    {(() => {
                      const parts = form.partes_personalizadas || plan.detalles;
                      const totalDistributed = parts.reduce((total, part) => total + (Number(part.monto) || 0), 0);
                      const distributionDifference = totalDistributed - plan.total;
                      const formattedDifference = `${distributionDifference > 0 ? "+" : distributionDifference < 0 ? "-" : ""}$${Math.abs(distributionDifference).toLocaleString("es-MX")}`;
                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase">
                              <CalendarDays className="w-3.5 h-3.5" />
                              Distribución de pagos
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-background font-semibold">
                              Cubiertas: {form.partes_pagadas?.length || 0} de {parts.length}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            La distribución automática se conserva por defecto. Puedes personalizar esta factura sin cambiar otros meses.
                          </p>
                          <div className="grid grid-cols-[1fr_7rem_2rem_2rem] gap-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
                            <span>Parte</span><span>Monto</span><span>Pagada</span><span />
                          </div>
                          <div className="space-y-2">
                            {parts.map((part, index) => {
                              const isPaid = (form.partes_pagadas || []).includes(part.id);
                              const periodo = getPartePeriodo(form.frecuencia_pago, index, form.mes);
                              return (
                                <div key={part.id} className={cn("rounded bg-background border p-2 space-y-2", isPaid && "bg-emerald-50/60 border-emerald-300 dark:bg-emerald-950/20")}>
                                  <div className="grid grid-cols-[1fr_7rem_2rem_2rem] items-center gap-2">
                                    <div>
                                      <span className="text-xs font-semibold text-slate-800 block">{part.nombre}</span>
                                      {periodo && <span className="text-[10px] text-muted-foreground">{periodo}</span>}
                                    </div>
                                    {form.partes_personalizadas ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        value={part.monto}
                                        className="h-8 text-xs"
                                        onChange={(e) => updateCustomPart(part.id, e.target.value)}
                                      />
                                    ) : (
                                      <span className="text-xs font-bold text-slate-700">${Number(part.monto).toLocaleString("es-MX")}</span>
                                    )}
                                    <Checkbox
                                      id={`edit-part-${part.id}`}
                                      checked={isPaid}
                                      onCheckedChange={(checked) => {
                                        const nextParts = checked
                                          ? [...new Set([...(form.partes_pagadas || []), part.id])]
                                          : (form.partes_pagadas || []).filter((id) => id !== part.id);
                                        const nextFechas = { ...(form.fechas_partes || {}) };
                                        if (checked && !nextFechas[part.id]) nextFechas[part.id] = new Date().toISOString().slice(0, 10);
                                        const nextEstado = nextParts.length === parts.length ? "pagado" : nextParts.length > 0 ? "parcial" : "pendiente";
                                        setForm({ ...form, partes_pagadas: nextParts, fechas_partes: nextFechas, estado: nextEstado });
                                      }}
                                    />
                                    {form.partes_personalizadas ? (
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCustomPart(part.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : <span />}
                                  </div>
                                  <div className="flex items-center gap-2 pl-1">
                                    <Label htmlFor={`date-part-${part.id}`} className="text-[10px] text-muted-foreground whitespace-nowrap">Fecha de la parte</Label>
                                    <Input
                                      id={`date-part-${part.id}`}
                                      type="date"
                                      className="h-7 text-xs w-36 bg-background"
                                      value={form.fechas_partes?.[part.id] || ""}
                                      onChange={(e) => setForm({ ...form, fechas_partes: { ...(form.fechas_partes || {}), [part.id]: e.target.value } })}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {!form.partes_personalizadas && (
                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={enableCustomParts}>
                              <Pencil className="h-3.5 w-3.5" /> Editar distribución
                            </Button>
                          )}
                          {form.partes_personalizadas && (
                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addCustomPart}>
                              <Plus className="h-3.5 w-3.5" /> Agregar parte
                            </Button>
                          )}
                          <div className="grid grid-cols-3 gap-2 border-t pt-2 text-xs">
                            <div><span className="text-muted-foreground">Total factura</span><p className="font-bold">${plan.total.toLocaleString("es-MX")}</p></div>
                            <div><span className="text-muted-foreground">Total distribuido</span><p className="font-bold">${totalDistributed.toLocaleString("es-MX")}</p></div>
                            <div><span className="text-muted-foreground">Diferencia</span><p className={cn("font-bold", distributionDifference !== 0 ? "text-amber-600" : "text-emerald-600")}>{formattedDifference}</p></div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            <div>
              <Label>Estado</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => {
                  const diasMes = getDiasMesFactura(form.mes || currentMonth);
                  const montoBase = Number(form.monto) || 0;
                  const plan = calcularPlanPagos({
                    montoBase,
                    costoDia: form.costo_dia,
                    esVariable: form.es_variable,
                    diasMes,
                    calcularIva: form.calcular_iva,
                    frecuencia: form.frecuencia_pago,
                  });
                  const todayStr = new Date().toISOString().slice(0, 10);
                  let nextParts = form.partes_pagadas || [];
                  let nextFechas = { ...(form.fechas_partes || {}) };

                  if (v === "pagado") {
                    nextParts = plan.detalles.map((d) => d.id);
                    plan.detalles.forEach((d) => {
                      if (!nextFechas[d.id]) nextFechas[d.id] = form.fecha_pago || todayStr;
                    });
                  } else if (v === "pendiente" || v === "vencido") {
                    nextParts = [];
                    nextFechas = {};
                  }

                  setForm({
                    ...form,
                    estado: v,
                    partes_pagadas: nextParts,
                    fechas_partes: nextFechas,
                    fecha_pago: v === "pagado" ? (form.fecha_pago || todayStr) : form.fecha_pago,
                  });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagado">Pagado (100%)</SelectItem>
                  <SelectItem value="parcial">Parcial (Abonos)</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Fecha Límite de Pago</Label>
                <Input type="date" value={form.fecha_limite_pago || ""} onChange={(e) => setForm({ ...form, fecha_limite_pago: e.target.value })} />
              </div>
              {form.estado === "pagado" && form.frecuencia_pago === "mensual" && (
                <div>
                  <Label>Fecha de Pago</Label>
                  <Input type="date" value={form.fecha_pago || ""} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            {editing && can("cobros", "edit") && (
              <Button
                variant="ghost"
                className="mr-auto text-muted-foreground hover:text-foreground"
                onClick={() => setExcludeId(editing.id)}
              >
                <EyeOff className="w-4 h-4 mr-1.5" />
                Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || distributionIsInvalid}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REGISTRO DE PAGO (ABONO PARCIAL O COMPLETO) */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Registrar Pago de Factura
            </DialogTitle>
            <DialogDescription>
              {paymentCobro?.servicio_nombre} • {formatMes(paymentCobro?.mes)}
            </DialogDescription>
          </DialogHeader>

          {paymentCobro && (
            <div className="space-y-4 py-2">
              {/* Tarjetas resumen de montos */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border bg-muted/30 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Factura</span>
                  <div className="text-base font-bold text-slate-800">
                    ${paymentParts.reduce((s, p) => s + p.monto, 0).toLocaleString("es-MX")}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Pagado</span>
                  <div className="text-base font-bold text-emerald-600">
                    ${paymentParts.filter((p) => p.checked).reduce((s, p) => s + p.monto, 0).toLocaleString("es-MX")}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-700">Pendiente</span>
                  <div className="text-base font-bold text-amber-600">
                    ${Math.max(0, paymentParts.filter((p) => !p.checked).reduce((s, p) => s + p.monto, 0)).toLocaleString("es-MX")}
                  </div>
                </div>
              </div>

              {/* Indicador de frecuencia */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  {paymentParts.length > 1
                    ? `Selecciona qué cuota(s) fueron pagadas:`
                    : "Confirmar pago mensual:"}
                </span>
                <Badge variant="outline" className="capitalize text-xs font-semibold">
                  Frecuencia: {paymentMeta?.frecuencia_pago || "mensual"}
                </Badge>
              </div>

              {/* Lista interactiva de cuotas */}
              <div className="space-y-2.5">
                {paymentParts.map((part, index) => {
                  const periodo = getPartePeriodo(paymentMeta?.frecuencia_pago, index, paymentCobro?.mes);
                  return (
                  <div
                    key={part.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all flex flex-col gap-2.5",
                      part.checked
                        ? "bg-emerald-50/60 border-emerald-300 dark:bg-emerald-950/20"
                        : "bg-card border-border"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`modal-pay-${part.id}`}
                          checked={part.checked}
                          onCheckedChange={(checked) => {
                            const todayStr = new Date().toISOString().slice(0, 10);
                            setPaymentParts((prev) =>
                              prev.map((p) =>
                                p.id === part.id
                                  ? { ...p, checked: !!checked, fecha: checked ? (p.fecha || todayStr) : p.fecha }
                                  : p
                              )
                            );
                          }}
                        />
                        <label
                          htmlFor={`modal-pay-${part.id}`}
                          className="text-sm font-semibold cursor-pointer select-none text-slate-800"
                        >
                          {part.nombre}
                          {periodo && <span className="block text-[10px] font-normal text-muted-foreground">{periodo}</span>}
                        </label>
                      </div>
                      <span className="font-bold text-sm text-slate-800">
                        ${part.monto.toLocaleString("es-MX")}
                      </span>
                    </div>

                    {part.checked && (
                      <div className="flex items-center justify-between pl-7 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                        <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                          Fecha de abono/pago:
                        </span>
                        <Input
                          type="date"
                          className="h-8 text-xs w-36 bg-background"
                          value={part.fecha || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPaymentParts((prev) =>
                              prev.map((p) => (p.id === part.id ? { ...p, fecha: val } : p))
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Estado resultante de la factura */}
              {(() => {
                const checkedCount = paymentParts.filter((p) => p.checked).length;
                const totalCount = paymentParts.length;
                let badge = null;
                if (checkedCount === totalCount && totalCount > 0) {
                  badge = <Badge className="bg-emerald-100 text-emerald-800 font-semibold">Liquidado al 100%</Badge>;
                } else if (checkedCount > 0) {
                  badge = <Badge className="bg-amber-100 text-amber-800 font-semibold">Pago Parcial ({checkedCount}/{totalCount})</Badge>;
                } else {
                  badge = <Badge variant="secondary">Pendiente (0 pagos)</Badge>;
                }
                return (
                  <div className="flex items-center justify-between p-2.5 rounded bg-muted/40 border text-xs">
                    <span className="text-muted-foreground font-medium">Estado resultante:</span>
                    {badge}
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSavePaymentModal}
              disabled={savingPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              {savingPayment ? "Guardando..." : "Guardar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ MODAL DE DATOS BANCARIOS (FINANZAS) ══════════════════ */}
      <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Configuración de Cuenta Bancaria</DialogTitle>
                <DialogDescription className="text-xs">
                  Esta información se mostrará en el portal de clientes para pagos por transferencia SPEI.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Beneficiario / Razón Social *</Label>
              <Input
                value={bankForm.beneficiario}
                onChange={(e) => setBankForm({ ...bankForm, beneficiario: e.target.value })}
                placeholder="Ej: SERCO SEGURIDAD PRIVADA S.A. DE C.V."
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Institución Bancaria *</Label>
                <Input
                  value={bankForm.banco}
                  onChange={(e) => setBankForm({ ...bankForm, banco: e.target.value })}
                  placeholder="Ej: BBVA México"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Número de Cuenta</Label>
                <Input
                  value={bankForm.cuenta || ""}
                  onChange={(e) => setBankForm({ ...bankForm, cuenta: e.target.value })}
                  placeholder="Opcional"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CLABE Interbancaria (18 dígitos) *</Label>
              <Input
                value={bankForm.clabe}
                onChange={(e) => setBankForm({ ...bankForm, clabe: e.target.value })}
                placeholder="012 180 00123456789 0"
                className="h-8 text-xs font-mono font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Instrucciones / Concepto de Pago</Label>
              <Input
                value={bankForm.notas}
                onChange={(e) => setBankForm({ ...bankForm, notas: e.target.value })}
                placeholder="Ej: Favor de indicar como referencia el nombre de su servicio"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setBankModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveBankInfo}
              disabled={savingBank}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {savingBank ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar factura?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!excludeId}
        onOpenChange={(open) => !open && setExcludeId(null)}
        title="¿Excluir factura?"
        description="La factura dejará de mostrarse en este módulo, pero el servicio y sus facturas de otros meses permanecerán intactos."
        confirmLabel="Excluir"
        loadingLabel="Excluyendo..."
        onConfirm={handleExclude}
      />
    </div>
  );
}