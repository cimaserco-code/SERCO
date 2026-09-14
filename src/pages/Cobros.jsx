import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { Plus, Pencil, Trash2, Search, DollarSign, CheckCircle, Clock4, FileText, ChevronLeft, ChevronRight, CreditCard, Banknote, CalendarDays } from "lucide-react";
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
          { nombre: `1ª Quincena (Días 1 al ${diasQ1} • ${diasQ1} días)`, monto: q1 },
          { nombre: `2ª Quincena (Días 16 al cierre • ${diasQ2} días)`, monto: q2 },
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
          { nombre: "1ª Quincena (50%)", monto: q1 },
          { nombre: "2ª Quincena (50%)", monto: q2 },
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
        { nombre: "Semana 1 (7 días)", monto: cuotaSemana },
        { nombre: "Semana 2 (7 días)", monto: cuotaSemana },
        { nombre: "Semana 3 (7 días)", monto: cuotaSemana },
        { nombre: "Semana 4 (7 días)", monto: cuotaSemana },
      ];
      if (diasSobrantes > 0 && montoRemanente > 0) {
        detalles.push({
          nombre: `Cierre (${diasSobrantes} días restantes)`,
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
          { nombre: "Semana 1 (25%)", monto: cuota },
          { nombre: "Semana 2 (25%)", monto: cuota },
          { nombre: "Semana 3 (25%)", monto: cuota },
          { nombre: "Semana 4 (Ajuste)", monto: c4 },
        ],
      };
    }
  }

  return {
    total,
    iva,
    tipo: "mensual",
    detalles: [
      { nombre: "Pago mensual único", monto: total },
    ],
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

      setItems(nextCobros);
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

  const monthlyItems = items.filter((item) => item.mes === currentMonth);

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
    });

    setModalOpen(true);
  }

  const handleQuickPay = async (id) => {
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayStr = `${yyyy}-${mm}-${dd}`;

      await sercoApi.entities.Cobro.update(id, {
        estado: "pagado",
        fecha_pago: todayStr
      });
      await load();
    } catch (e) {
      console.error("Error al registrar pago rápido:", e);
    }
  };

  async function handleSave() {
    setSaving(true);
    try {
      const diasMes = getDiasMesFactura(form.mes || currentMonth);
      let finalMonto = form.monto === "" ? null : Number(form.monto);
      if (form.es_variable && form.costo_dia) {
        finalMonto = Math.round(Number(form.costo_dia) * diasMes);
      }

      const payload = {
        servicio_id: form.servicio_id,
        servicio_nombre: form.servicio_nombre,
        mes: form.mes,
        fecha_factura: form.fecha_factura || null,
        monto: finalMonto,
        estado: form.estado,
        fecha_limite_pago: form.fecha_limite_pago || null,
        fecha_pago: form.estado === "pagado" ? form.fecha_pago : null,
        sede_id: form.sede_id || defaultSedeId,
      };

      if (editing) {
        await sercoApi.entities.Cobro.update(editing.id, payload);

        setCobroMeta(editing.id, {
          es_variable: form.es_variable,
          costo_dia: form.costo_dia,
          metodo_pago: form.metodo_pago,
          calcular_iva: form.calcular_iva,
          frecuencia_pago: form.frecuencia_pago,
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

  const estadoBadge = (estado) => {
    switch (estado) {
      case "pagado":
        return <Badge className="bg-emerald-100 text-emerald-700">Pagado</Badge>;
      case "vencido":
        return <Badge variant="secondary" className="bg-red-100 text-red-700">Vencido</Badge>;
      default:
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Pendiente</Badge>;
    }
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

  const totalMontoNormal = filtered.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const totalIva = filtered.reduce((sum, c) => sum + getCobroIva(c), 0);
  const totalConIva = filtered.reduce((sum, c) => sum + getCobroTotal(c), 0);

  const pagadoNormal = filtered.filter(c => c.estado === 'pagado').reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const pagadoIva = filtered.filter(c => c.estado === 'pagado').reduce((sum, c) => sum + getCobroIva(c), 0);
  const pagadoTotal = filtered.filter(c => c.estado === 'pagado').reduce((sum, c) => sum + getCobroTotal(c), 0);

  const pendienteNormal = filtered.filter(c => c.estado !== 'pagado').reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const pendienteIva = filtered.filter(c => c.estado !== 'pagado').reduce((sum, c) => sum + getCobroIva(c), 0);
  const pendienteTotal = filtered.filter(c => c.estado !== 'pagado').reduce((sum, c) => sum + getCobroTotal(c), 0);

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
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          {(can("cobros", "create") || can("cobros", "edit")) && (
            <Button onClick={openCreate} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Nueva Factura
            </Button>
          )}
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
                          <div>${Math.round(getCobroTotal(item)).toLocaleString("es-MX")}</div>
                          {meta?.calcular_iva === false && (
                            <div className="text-[10px] text-amber-600 font-normal">Sin IVA</div>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{estadoBadge(item.estado)}</TableCell>
                    <TableCell>{item.fecha_limite_pago || "—"}</TableCell>
                    <TableCell>{item.fecha_pago || "—"}</TableCell>
                    <TableCell className="text-right">
                      {item.estado === "pendiente" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-emerald-300 hover:bg-emerald-50 text-emerald-600 font-semibold gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickPay(item.id);
                          }}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Pago
                        </Button>
                      )}
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
                      if (form.es_variable && form.costo_dia) {
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
                      if (checked && form.costo_dia) {
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
                          monto: calcMonto,
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
                  onValueChange={(val) => setForm({ ...form, frecuencia_pago: val })}
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

                  {/* Tarjeta de desglose Quincenal / Semanal */}
                  {form.frecuencia_pago !== "mensual" && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Desglose de Pagos ({form.frecuencia_pago})
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-background">
                          Total: ${totalMonto.toLocaleString("es-MX")}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {plan.detalles.map((d, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-background border shadow-xs">
                            <span className="text-muted-foreground font-medium">{d.nombre}</span>
                            <span className="font-bold text-slate-800">${d.monto.toLocaleString("es-MX")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagado">Pagado</SelectItem>
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
              {form.estado === "pagado" && (
                <div>
                  <Label>Fecha de Pago</Label>
                  <Input type="date" value={form.fecha_pago || ""} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
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
    </div>
  );
}