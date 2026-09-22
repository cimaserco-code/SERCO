import React, { useEffect, useState, useRef } from "react";
import { sercoApi } from "@/api/sercoClient";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Pencil, Trash2, Search, FileText, UserX, Download, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Check, Camera, Upload, Loader2 } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import SedeSelector from "@/components/SedeSelector";
import { usePermissions } from "@/lib/PermissionsContext";
import { useAuth } from "@/lib/AuthContext";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { formatPersonName, formatUserDisplayName } from "@/lib/userNameFormatting";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  resolveEmpleadoNumero,
  getNextEmpleadoNumero,
  setStoredEmpleadoNumero,
  syncAndAssignEmpleadoNumeros,
} from "@/lib/empleadoNumero";

export function formatProperName(text) {
  return formatPersonName(text);
}

export function parseExistingNombre(item) {
  if (!item) return { nombres: "", apellido_paterno: "", apellido_materno: "" };
  if (item.nombres || item.apellido_paterno) {
    return {
      nombres: item.nombres || "",
      apellido_paterno: item.apellido_paterno || "",
      apellido_materno: item.apellido_materno || "",
    };
  }
  const full = (item.nombre_completo || "").trim();
  if (!full) return { nombres: "", apellido_paterno: "", apellido_materno: "" };

  const parts = full.split(/\s+/);
  if (parts.length === 1) {
    return { nombres: parts[0], apellido_paterno: "", apellido_materno: "" };
  } else if (parts.length === 2) {
    return { apellido_paterno: parts[0], nombres: parts[1], apellido_materno: "" };
  } else if (parts.length === 3) {
    return { apellido_paterno: parts[0], apellido_materno: parts[1], nombres: parts[2] };
  } else {
    return {
      apellido_paterno: parts[0],
      apellido_materno: parts[1],
      nombres: parts.slice(2).join(" "),
    };
  }
}

/**
 * Redimensiona y comprime una imagen en el cliente usando HTML5 Canvas.
 * Genera un WebP (o JPEG) de máx 350x350 px con peso ~20-35 KB para no saturar almacenamiento ni BD.
 */
export async function compressImage(file, maxWidth = 350, maxHeight = 350, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Error al cargar la imagen"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let mime = "image/webp";
        let dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl.startsWith("data:image/webp")) {
          mime = "image/jpeg";
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        canvas.toBlob(
          (blob) => {
            resolve({ blob, dataUrl, mime });
          },
          mime,
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const emptyForm = {
  numero_empleado: "",
  nombres: "",
  apellido_paterno: "",
  apellido_materno: "",
  nombre_completo: "",
  clabe_bancaria: "",
  banco: "",
  fecha_ingreso: "",
  sueldo: "",
  servicio_ubicacion: "",
  turno: "matutino",
  puesto: "",
  telefono: "",
  email: "",
  curp: "",
  rfc: "",
  nss: "",
  sede_id: "",
  fecha_baja: "",
  motivo_baja: "",
  actas_administrativas: "0",
  uniformes: "",
  sexo: "",
  fecha_nacimiento: "",
  estado_civil: "",
  nivel_estudios: "",
  zona: "",
  calle: "",
  numero: "",
  colonia: "",
  codigo_postal: "",
  ciudad: "",
  fecha_reingreso: "",
  contacto_emergencia: "",
  telefono_emergencia: "",
  parentesco: "",
  infonavit: "",
  medio_reclutamiento: "",
  dia_capacitacion: "",
  dia_capacitacion_2: "",
  fecha_montaje: "",
  hospedaje: false,
  seguro: false,
  beneficiario: "",
  carta_militar: "No",
  referencia: "",
  referencia_telefono: "",
  usuario_alta: "",
  usuario_baja: "",
  foto_url: "",
};

export default function Empleados() {
  const { user } = useAuth();
  const { canView, can } = usePermissions();
  const canAccess = canView("empleados");
  const { sedeFilter, defaultSedeId, isSuperAdmin } = useSedeScope();
  const userRole = (user?.role || "").toLowerCase();
  const isAdmin = userRole === "admin" || userRole === "administrador" || userRole === "super administrador" || isSuperAdmin;

  const [items, setItems] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState("activos");
  const [viewEmpleado, setViewEmpleado] = useState(null);
  const [bajaConfirmId, setBajaConfirmId] = useState(null);
  const [reingresoConfirmId, setReingresoConfirmId] = useState(null);
  const [fechaReingresoInput, setFechaReingresoInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivoBajaInput, setMotivoBajaInput] = useState("");
  const [editMotivoEmpleado, setEditMotivoEmpleado] = useState(null);
  const [editMotivoText, setEditMotivoText] = useState("");
  const [savingMotivo, setSavingMotivo] = useState(false);
  const [editNumeroEmpleado, setEditNumeroEmpleado] = useState(null);
  const [newNumeroInput, setNewNumeroInput] = useState("");
  const [savingNumero, setSavingNumero] = useState(false);
  const [editNumeroError, setEditNumeroError] = useState("");
  const [sortField, setSortField] = useState("nombre_completo");
  const [sortDirection, setSortDirection] = useState("asc");
  const [serviceComboboxOpen, setServiceComboboxOpen] = useState(false);

  // Save Error Notification
  const [saveError, setSaveError] = useState("");

  // IMSS Baja Alert
  const [imssAlertEmpleado, setImssAlertEmpleado] = useState(null);

  // Foto del Empleado (Ultraligera ~25KB en Storage)
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCompressingPhoto(true);
      const { blob, dataUrl } = await compressImage(file, 350, 350, 0.8);
      setPhotoBlob(blob);
      setPhotoPreview(dataUrl);
      setPhotoChanged(true);
    } catch (err) {
      console.error("Error procesando foto:", err);
      setSaveError("No se pudo procesar la fotografía seleccionada.");
    } finally {
      setCompressingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setPhotoBlob(null);
    setPhotoPreview("");
    setPhotoChanged(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => { load(); }, [sedeFilter]);

  async function load() {
    setLoading(true);
    try {
      const [allEmps, s, sv] = await Promise.all([
        sercoApi.entities.Empleado.list("-created_date").catch(() => []),
        sercoApi.entities.Sede.list(),
        sercoApi.entities.Servicio.filter(sedeFilter),
      ]);
      // Sincronizar y asignar números reales positivos a todos los empleados de la empresa (van de 1 en 1)
      const syncedAll = syncAndAssignEmpleadoNumeros(allEmps || []);
      setAllEmployees(syncedAll);

      // Filtrar por sede seleccionada si aplica
      const filteredBySede = sedeFilter?.sede_id
        ? syncedAll.filter((e) => e.sede_id === sedeFilter.sede_id)
        : syncedAll;

      setItems(filteredBySede);
      setSedes(s);
      setServicios(sv);
    } finally {
      setLoading(false);
    }
  }

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const filtered = items.filter((item) => {
    const s = search.toLowerCase().trim();
    return (
      (item.nombre_completo || "").toLowerCase().includes(s) ||
      (item.puesto || "").toLowerCase().includes(s) ||
      (item.servicio_ubicacion || "").toLowerCase().includes(s) ||
      (item.numero_empleado ? String(item.numero_empleado) : "").includes(s)
    );
  });

  // Divide into Active and Bajas
  const activos = filtered.filter(item => !item.fecha_baja || (item.fecha_reingreso && item.fecha_reingreso >= item.fecha_baja));
  const bajas = filtered.filter(item => item.fecha_baja && (!item.fecha_reingreso || item.fecha_baja > item.fecha_reingreso));

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />;
    return sortDirection === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 text-primary shrink-0" />
      : <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />;
  };

  const sortItems = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA == null) valA = "";
      if (valB == null) valB = "";

      if (sortField === "numero_empleado") {
        const nA = Number(valA) || 0;
        const nB = Number(valB) || 0;
        return sortDirection === "asc" ? nA - nB : nB - nA;
      }

      if (sortField === "sueldo") {
        return sortDirection === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }

      if (sortField === "servicio_ubicacion") {
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
      }

      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();

      return sortDirection === "asc"
        ? valA.localeCompare(valB, undefined, { numeric: true })
        : valB.localeCompare(valA, undefined, { numeric: true });
    });
  };

  const sortedActivos = sortItems(activos);
  const sortedBajas = sortItems(bajas);

  const getServiceRowColor = (serviceName) => {
    if (user?.email !== "sercoseguridad45@gmail.com") return "";
    if (!serviceName) return "bg-slate-50/40 dark:bg-slate-900/10";
    
    const colors = [
      "bg-sky-50/70 hover:bg-sky-100/70 dark:bg-sky-950/20 text-sky-950 dark:text-sky-100 border-sky-100 dark:border-sky-900/50",
      "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 border-emerald-100 dark:border-emerald-900/50",
      "bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100 border-amber-100 dark:border-amber-900/50",
      "bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/20 text-rose-950 dark:text-rose-100 border-rose-100 dark:border-rose-900/50",
      "bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-100 border-indigo-100 dark:border-indigo-900/50",
      "bg-teal-50/70 hover:bg-teal-100/70 dark:bg-teal-950/20 text-teal-950 dark:text-teal-100 border-teal-100 dark:border-teal-900/50",
      "bg-violet-50/70 hover:bg-violet-100/70 dark:bg-violet-950/20 text-violet-950 dark:text-violet-100 border-violet-100 dark:border-violet-900/50",
      "bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/20 text-orange-950 dark:text-orange-100 border-orange-100 dark:border-orange-900/50",
    ];

    let hash = 0;
    for (let i = 0; i < serviceName.length; i++) {
      hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const exportToExcel = () => {
    const listToExport = activeTab === "activos" ? sortedActivos : sortedBajas;
    const headers = [
      "No. Empleado",
      "Apellido Paterno",
      "Apellido Materno",
      "Nombre(s)",
      "Nombre Completo",
      "Estado Laboral",
      "Sede",
      "Puesto",
      "Servicio / Ubicación",
      "Turno",
      "Fecha de Ingreso",
      "Fecha de Reingreso",
      "Días en Empresa",
      "Sueldo Mensual",
      "Banco",
      "CLABE Bancaria",
      "Teléfono",
      "Correo Electrónico",
      "CURP",
      "RFC",
      "NSS",
      "Sexo",
      "Fecha de Nacimiento",
      "Edad",
      "Estado Civil",
      "Nivel de Estudios",
      "Calle",
      "Número",
      "Colonia",
      "Código Postal",
      "Ciudad",
      "Zona",
      "Contacto de Emergencia",
      "Teléfono de Emergencia",
      "Parentesco Emergencia",
      "Beneficiario",
      "Cartilla Militar",
      "Referencia",
      "Tel. Referencia",
      "Infonavit",
      "Medio de Reclutamiento",
      "Día de Capacitación 1",
      "Día de Capacitación 2",
      "Fecha Montaje",
      "Hospedaje",
      "Seguro IMSS",
      "Uniformes",
      "Actas Administrativas",
      "Fecha de Baja",
      "Motivo de Baja",
      "Historial de Bajas",
      "Registrado Por",
      "Baja Realizada Por"
    ];

    const rows = listToExport.map((emp) => {
      const parsed = parseExistingNombre(emp);
      const isActivo = !emp.fecha_baja || (emp.fecha_reingreso && emp.fecha_reingreso >= emp.fecha_baja);
      return [
        emp.numero_empleado || "",
        emp.apellido_paterno || parsed.apellido_paterno || "",
        emp.apellido_materno || parsed.apellido_materno || "",
        emp.nombres || parsed.nombres || "",
        emp.nombre_completo || "",
        isActivo ? "Activo" : "Baja",
        sedeNombre(emp.sede_id),
        emp.puesto || "",
        emp.servicio_ubicacion || "Sin Asignar",
        emp.turno || "",
        emp.fecha_ingreso || "",
        emp.fecha_reingreso || "",
        calcularDiasEnEmpresa(emp.fecha_ingreso, emp.fecha_baja, emp.fecha_reingreso),
        emp.sueldo ? `$${emp.sueldo}` : "—",
        emp.banco || "",
        emp.clabe_bancaria ? `\t${emp.clabe_bancaria}` : "",
        emp.telefono ? `\t${emp.telefono}` : "",
        emp.email || "",
        emp.curp || "",
        emp.rfc || "",
        emp.nss ? `\t${emp.nss}` : "",
        emp.sexo || "",
        emp.fecha_nacimiento || "",
        calcularEdad(emp.fecha_nacimiento),
        emp.estado_civil || "",
        emp.nivel_estudios || "",
        emp.calle || "",
        emp.numero || "",
        emp.colonia || "",
        emp.codigo_postal || "",
        emp.ciudad || "",
        emp.zona || "",
        emp.contacto_emergencia || "",
        emp.telefono_emergencia ? `\t${emp.telefono_emergencia}` : "",
        emp.parentesco || "",
        emp.beneficiario || "",
        emp.carta_militar || "No",
        emp.referencia || "",
        emp.referencia_telefono ? `\t${emp.referencia_telefono}` : "",
        emp.infonavit || "",
        emp.medio_reclutamiento || "",
        emp.dia_capacitacion || "",
        emp.dia_capacitacion_2 || "",
        emp.fecha_montaje || "",
        emp.hospedaje ? "Sí" : "No",
        emp.seguro ? "Sí" : "No",
        emp.uniformes || "Sin uniformes",
        emp.actas_administrativas || 0,
        emp.fecha_baja || "",
        emp.motivo_baja || "",
        emp.historial_bajas || "",
        emp.usuario_alta || "",
        emp.usuario_baja || ""
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map((e) => e.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `empleados_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function openCreate() {
    setSaveError("");
    setEditing(null);
    setPhotoPreview("");
    setPhotoBlob(null);
    setPhotoChanged(false);
    const pool = allEmployees.length > 0 ? allEmployees : items;
    const autoNum = getNextEmpleadoNumero(pool);
    setForm({ 
      ...emptyForm, 
      sede_id: defaultSedeId,
      numero_empleado: autoNum,
    });
    setServiceComboboxOpen(false);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setPhotoPreview(item.foto_url || "");
    setPhotoBlob(null);
    setPhotoChanged(false);
    const parsed = parseExistingNombre(item);
    const pool = allEmployees.length > 0 ? allEmployees : items;
    const empNum = resolveEmpleadoNumero(item) || getNextEmpleadoNumero(pool, item.id);
    setForm({ 
      ...emptyForm, 
      ...item, 
      numero_empleado: empNum,
      foto_url: item.foto_url || "",
      nombres: item.nombres || parsed.nombres || "",
      apellido_paterno: item.apellido_paterno || parsed.apellido_paterno || "",
      apellido_materno: item.apellido_materno || parsed.apellido_materno || "",
      turno: item.turno || "matutino",
      sueldo: item.sueldo ?? "",
      clabe_bancaria: item.clabe_bancaria || "",
      banco: item.banco || "",
      beneficiario: item.beneficiario || "",
      carta_militar: item.carta_militar || "No",
      referencia: item.referencia || "",
      referencia_telefono: item.referencia_telefono || "",
      actas_administrativas: String(item.actas_administrativas ?? 0),
      fecha_baja: item.fecha_baja || "",
      motivo_baja: item.motivo_baja || "",
      uniformes: item.uniformes || "",
      hospedaje: !!item.hospedaje,
      seguro: !!item.seguro
    });
    setSaveError("");
    setServiceComboboxOpen(false);
    setModalOpen(true);
  }

  function openEditNumero(emp) {
    if (!isAdmin || !emp) return;
    setEditNumeroEmpleado(emp);
    const currentNum = resolveEmpleadoNumero(emp) || "";
    setNewNumeroInput(String(currentNum));
    setEditNumeroError("");
  }

  async function handleSaveNumero() {
    if (!editNumeroEmpleado || !isAdmin) return;
    const num = parseInt(newNumeroInput, 10);
    if (isNaN(num) || num < 1) {
      setEditNumeroError("Ingresa un número real positivo válido (mayor o igual a 1).");
      return;
    }
    setSavingNumero(true);
    setEditNumeroError("");
    try {
      setStoredEmpleadoNumero(editNumeroEmpleado.id, num);
      try {
        await sercoApi.entities.Empleado.update(editNumeroEmpleado.id, { numero_empleado: num });
      } catch (e) {
        console.warn("No se pudo actualizar columna numero_empleado en DB:", e?.message);
      }

      if (viewEmpleado?.id === editNumeroEmpleado.id) {
        setViewEmpleado(prev => prev ? ({ ...prev, numero_empleado: num }) : null);
      }

      setItems(prev => prev.map(e => e.id === editNumeroEmpleado.id ? ({ ...e, numero_empleado: num }) : e));
      setAllEmployees(prev => prev.map(e => e.id === editNumeroEmpleado.id ? ({ ...e, numero_empleado: num }) : e));

      toast({
        title: "Número actualizado",
        description: `El número de empleado para ${formatUserDisplayName(editNumeroEmpleado.nombre_completo, user?.role)} se actualizó a #${num}.`,
      });

      setEditNumeroEmpleado(null);
    } catch (err) {
      console.error("Error guardando número:", err);
      setEditNumeroError("Error al guardar el número de empleado.");
    } finally {
      setSavingNumero(false);
    }
  }

const getMissingFields = (emp) => {
  if (!emp) return [];
  const missing = [];

  // Datos Personales
  if (!emp.curp?.trim()) missing.push("CURP");
  if (!emp.rfc?.trim()) missing.push("RFC");
  if (!emp.nss?.trim()) missing.push("NSS");
  if (!emp.fecha_nacimiento?.trim()) missing.push("Fecha de Nacimiento");
  if (!emp.telefono?.trim()) missing.push("Teléfono");

  // Datos Laborales (Infonavit NO es requisito)
  if (emp.sueldo === null || emp.sueldo === undefined || String(emp.sueldo).trim() === "") missing.push("Sueldo");
  if (!emp.fecha_ingreso?.trim()) missing.push("Fecha de Ingreso");
  if (!emp.sede_id?.trim()) missing.push("Sede");
  if (!emp.puesto?.trim()) missing.push("Puesto");
  if (!emp.clabe_bancaria?.trim()) missing.push("CLABE Bancaria");

  return missing;
};

const hasPendingInfo = (emp) => {
  return getMissingFields(emp).length > 0;
};

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "—";

  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);

  let edad = hoy.getFullYear() - nacimiento.getFullYear();

  const mes = hoy.getMonth() - nacimiento.getMonth();

  if (
    mes < 0 ||
    (mes === 0 && hoy.getDate() < nacimiento.getDate())
  ) {
    edad--;
  }

  return `${edad} años`;
}

function calcularDiasEnEmpresa(fechaIngreso, fechaBaja, fechaReingreso) {
  if (!fechaIngreso) return "—";
  const start = new Date(fechaIngreso);
  
  const isActive = !fechaBaja || (fechaReingreso && fechaReingreso >= fechaBaja);
  const end = isActive ? new Date() : new Date(fechaBaja);
  
  // Set times to midnight to calculate purely by calendar days
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? `${diffDays} días` : "—";
}
  
  async function handleSave() {
    console.log("ENTRÓ A GUARDAR", form);

    setSaving(true);
    setSaveError("");

    try {
      // Format names properly (Title Case: Capitalize first letter, lowercase rest)
      const cleanNombres = formatProperName(form.nombres || "");
      const cleanPaterno = formatProperName(form.apellido_paterno || "");
      const cleanMaterno = formatProperName(form.apellido_materno || "");

      // Validate that at least Nombres and Apellido Paterno are provided
      if (!cleanNombres || !cleanPaterno) {
        setSaveError("Por favor ingresa al menos Nombre(s) y Apellido Paterno.");
        setSaving(false);
        return;
      }

      // Assemble nombre_completo in order: [Apellido Paterno] [Apellido Materno] [Nombre(s)]
      const computedNombreCompleto = [cleanPaterno, cleanMaterno, cleanNombres]
        .filter(Boolean)
        .join(" ");

      let finalFotoUrl = form.foto_url || null;

      if (photoChanged) {
        if (!photoPreview) {
          finalFotoUrl = null;
        } else if (photoBlob) {
          // Subir fotografía ultraligera (~25KB) a Supabase Storage
          const ext = photoBlob.type === "image/webp" ? "webp" : "jpg";
          const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const fileName = `emp_${fileId}.${ext}`;

          let uploadedUrl = null;
          // 1. Intentar subir al bucket fotos_empleados
          try {
            const { error: upErr } = await supabase.storage
              .from("fotos_empleados")
              .upload(fileName, photoBlob, {
                contentType: photoBlob.type || "image/webp",
                upsert: true,
              });
            if (!upErr) {
              const { data: pubData } = supabase.storage
                .from("fotos_empleados")
                .getPublicUrl(fileName);
              if (pubData?.publicUrl) uploadedUrl = pubData.publicUrl;
            }
          } catch (err) {
            console.warn("Subida a fotos_empleados falló, intentando documentos:", err);
          }

          // 2. Intentar carpeta fotos/ en bucket documentos como respaldo
          if (!uploadedUrl) {
            try {
              const { error: docErr } = await supabase.storage
                .from("documentos")
                .upload(`fotos/${fileName}`, photoBlob, {
                  contentType: photoBlob.type || "image/webp",
                  upsert: true,
                });
              if (!docErr) {
                const { data: pubData } = supabase.storage
                  .from("documentos")
                  .getPublicUrl(`fotos/${fileName}`);
                if (pubData?.publicUrl) uploadedUrl = pubData.publicUrl;
              }
            } catch (err) {
              console.warn("Subida a documentos falló:", err);
            }
          }

          // 3. Respaldo de seguridad: guardar WebP ultraligero (~25KB) si Storage no está disponible
          finalFotoUrl = uploadedUrl || photoPreview;
        }
      }

      const cleanNumeroEmpleado = form.numero_empleado != null && form.numero_empleado !== ""
        ? Math.max(1, parseInt(form.numero_empleado, 10) || 1)
        : null;

      const payload = {
        ...form,
        numero_empleado: cleanNumeroEmpleado,
        nombres: cleanNombres,
        apellido_paterno: cleanPaterno,
        apellido_materno: cleanMaterno || null,
        nombre_completo: computedNombreCompleto,
        turno: form.turno || "matutino",
        sueldo: form.sueldo === "" ? null : Number(form.sueldo),
        clabe_bancaria: form.clabe_bancaria || null,
        banco: form.banco || null,
        beneficiario: form.beneficiario || null,
        carta_militar: form.carta_militar || "No",
        referencia: form.referencia || null,
        referencia_telefono: form.referencia_telefono || null,
        actas_administrativas: Number(form.actas_administrativas || 0),
        fecha_ingreso: form.fecha_ingreso || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        fecha_baja: form.fecha_baja || null,
        motivo_baja: form.motivo_baja || null,
        fecha_reingreso: form.fecha_reingreso || null,
        uniformes: form.uniformes || null,
        infonavit: form.infonavit || null,
        medio_reclutamiento: form.medio_reclutamiento || null,
        dia_capacitacion: form.dia_capacitacion || null,
        dia_capacitacion_2: form.dia_capacitacion_2 || null,
        fecha_montaje: form.fecha_montaje || null,
        historial_bajas: form.historial_bajas || null,
        hospedaje: form.hospedaje ? true : false,
        seguro: form.seguro ? true : false,
        foto_url: finalFotoUrl
      };

      const currentUserName = user?.full_name || user?.nombre || user?.email?.split('@')[0] || "Usuario";

      console.log("PAYLOAD:", JSON.stringify(payload, null, 2));

      // In the database table 'empleados', 'turno' belongs to AsignacionTurno (Plantilla) rather than empleados table.
      // Omit 'turno' from the payload so Supabase does not fail with PGRST204 ("Could not find the 'turno' column").
      const { turno: _unusedTurno, ...cleanPayload } = payload;

      if (editing) {
        if (cleanPayload.fecha_baja && !editing.fecha_baja) {
          cleanPayload.usuario_baja = currentUserName;
        }
        if (cleanNumeroEmpleado) {
          setStoredEmpleadoNumero(editing.id, cleanNumeroEmpleado);
        }
        try {
          await sercoApi.entities.Empleado.update(editing.id, cleanPayload);
        } catch (err) {
          if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
            // Remove optional audit or new columns if not present in older schemas
            const fallback = { ...cleanPayload };
            delete fallback.usuario_alta;
            delete fallback.usuario_baja;
            delete fallback.nombres;
            delete fallback.apellido_paterno;
            delete fallback.apellido_materno;
            delete fallback.numero_empleado;
            await sercoApi.entities.Empleado.update(editing.id, fallback);
          } else {
            throw err;
          }
        }
        if (cleanPayload.seguro && cleanPayload.fecha_baja && !editing.fecha_baja) {
          setImssAlertEmpleado({ ...editing, ...cleanPayload });
        }
      } else {
        cleanPayload.usuario_alta = currentUserName;
        let createdRecord = null;
        try {
          createdRecord = await sercoApi.entities.Empleado.create(cleanPayload);
        } catch (err) {
          if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
            // Remove optional audit or new columns if not present in older schemas
            const fallback = { ...cleanPayload };
            delete fallback.usuario_alta;
            delete fallback.usuario_baja;
            delete fallback.nombres;
            delete fallback.apellido_paterno;
            delete fallback.apellido_materno;
            delete fallback.numero_empleado;
            createdRecord = await sercoApi.entities.Empleado.create(fallback);
          } else {
            throw err;
          }
        }
        if (createdRecord?.id && cleanNumeroEmpleado) {
          setStoredEmpleadoNumero(createdRecord.id, cleanNumeroEmpleado);
        }
      }

      // Sincronización automática con Plantilla (AsignacionTurno)
      const oldEmpName = editing?.nombre_completo?.trim();
      const newEmpName = payload.nombre_completo?.trim();

      if (newEmpName || oldEmpName) {
        const isBaja = Boolean(payload.fecha_baja && (!payload.fecha_reingreso || payload.fecha_baja > payload.fecha_reingreso));
        const matchedServ = servicios.find((s) => s.nombre === payload.servicio_ubicacion);

        try {
          // Buscar asignaciones con todas las variaciones de nombres (nuevo, anterior, mayúsculas, etc.)
          const candidateNames = Array.from(
            new Set([
              newEmpName,
              oldEmpName,
              editing?.nombre_completo,
              payload.nombre_completo,
              oldEmpName ? oldEmpName.toUpperCase() : null,
              oldEmpName ? toTitleCase(oldEmpName) : null,
              newEmpName ? newEmpName.toUpperCase() : null,
            ].filter(Boolean))
          );

          let existingAsigs = [];
          for (const name of candidateNames) {
            const asigs = await sercoApi.entities.AsignacionTurno.filter({ empleado_nombre: name }).catch(() => []);
            existingAsigs.push(...asigs);
          }

          // Desduplicar por id
          const uniqueAsigsMap = new Map();
          for (const asig of existingAsigs) {
            if (asig?.id) uniqueAsigsMap.set(asig.id, asig);
          }
          existingAsigs = Array.from(uniqueAsigsMap.values());

          if (isBaja || !matchedServ) {
            // Si es baja o no es un servicio registrado en Plantilla, limpiar todas las asignaciones existentes
            for (const asig of existingAsigs) {
              await sercoApi.entities.AsignacionTurno.delete(asig.id).catch(() => {});
            }
          } else if (matchedServ) {
            const targetTurno = form.turno || "matutino";
            const targetSedeId = matchedServ.sede_id || payload.sede_id || "";
            const now = new Date();
            const horaStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
            const isoStr = now.toISOString();

            if (existingAsigs.length > 0) {
              const [firstAsig, ...rest] = existingAsigs;
              await sercoApi.entities.AsignacionTurno.update(firstAsig.id, {
                servicio_id: matchedServ.id,
                servicio_nombre: matchedServ.nombre,
                sede_id: targetSedeId,
                turno: targetTurno,
                empleado_nombre: newEmpName,
                usuario_asignacion: currentUserName,
                creado_por: currentUserName,
                hora: horaStr,
                fecha_asignacion: isoStr,
              }).catch(async () => {
                await sercoApi.entities.AsignacionTurno.delete(firstAsig.id).catch(() => {});
                await sercoApi.entities.AsignacionTurno.create({
                  servicio_id: matchedServ.id,
                  servicio_nombre: matchedServ.nombre,
                  sede_id: targetSedeId,
                  turno: targetTurno,
                  empleado_nombre: newEmpName,
                  usuario_asignacion: currentUserName,
                  creado_por: currentUserName,
                  hora: horaStr,
                  fecha_asignacion: isoStr,
                }).catch(async () => {
                  await sercoApi.entities.AsignacionTurno.create({
                    servicio_id: matchedServ.id,
                    servicio_nombre: matchedServ.nombre,
                    sede_id: targetSedeId,
                    turno: targetTurno,
                    empleado_nombre: newEmpName,
                  }).catch(() => {});
                });
              });
              for (const dup of rest) {
                await sercoApi.entities.AsignacionTurno.delete(dup.id).catch(() => {});
              }
            } else {
              try {
                await sercoApi.entities.AsignacionTurno.create({
                  servicio_id: matchedServ.id,
                  servicio_nombre: matchedServ.nombre,
                  sede_id: targetSedeId,
                  turno: targetTurno,
                  empleado_nombre: newEmpName,
                  usuario_asignacion: currentUserName,
                  creado_por: currentUserName,
                  hora: horaStr,
                  fecha_asignacion: isoStr,
                });
              } catch {
                await sercoApi.entities.AsignacionTurno.create({
                  servicio_id: matchedServ.id,
                  servicio_nombre: matchedServ.nombre,
                  sede_id: targetSedeId,
                  turno: targetTurno,
                  empleado_nombre: newEmpName,
                }).catch(() => {});
              }
            }
          }
        } catch (syncErr) {
          console.warn("No se pudo sincronizar automáticamente con Plantilla:", syncErr);
        }
      }

      console.log("GUARDADO CORRECTAMENTE");

      setModalOpen(false);
      await load();

    } catch (error) {
      console.error("ERROR COMPLETO:", JSON.stringify(error, null, 2));
      setSaveError(error.message || "Error al guardar el empleado. Verifica los campos.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const empToDelete = items.find((e) => e.id === deleteId);
    if (empToDelete?.nombre_completo) {
      try {
        const candidateNames = Array.from(
          new Set([
            empToDelete.nombre_completo,
            empToDelete.nombre_completo.trim(),
            empToDelete.nombre_completo.toUpperCase(),
            toTitleCase(empToDelete.nombre_completo)
          ].filter(Boolean))
        );
        for (const name of candidateNames) {
          const existingAsigs = await sercoApi.entities.AsignacionTurno.filter({ empleado_nombre: name }).catch(() => []);
          for (const asig of existingAsigs) {
            await sercoApi.entities.AsignacionTurno.delete(asig.id).catch(() => {});
          }
        }
      } catch (err) {
        console.warn("Error al limpiar asignaciones de plantilla:", err);
      }
    }
    await sercoApi.entities.Empleado.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  async function handleConfirmBaja() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const currentUserName = user?.full_name || user?.nombre || user?.email?.split('@')[0] || "Usuario";
      const emp = items.find((e) => e.id === bajaConfirmId);
      const prevHistorial = emp?.historial_bajas ? emp.historial_bajas + ", " : "";
      const newHistorial = prevHistorial + todayStr;

      if (emp?.nombre_completo) {
        try {
          const candidateNames = Array.from(
            new Set([
              emp.nombre_completo,
              emp.nombre_completo.trim(),
              emp.nombre_completo.toUpperCase(),
              toTitleCase(emp.nombre_completo)
            ].filter(Boolean))
          );
          for (const name of candidateNames) {
            const existingAsigs = await sercoApi.entities.AsignacionTurno.filter({ empleado_nombre: name }).catch(() => []);
            for (const asig of existingAsigs) {
              await sercoApi.entities.AsignacionTurno.delete(asig.id).catch(() => {});
            }
          }
        } catch (err) {
          console.warn("Error al limpiar asignaciones en baja:", err);
        }
      }

      const now = new Date();
      const horaStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      const isoStr = now.toISOString();

      try {
        await sercoApi.entities.Empleado.update(bajaConfirmId, {
          fecha_baja: todayStr,
          fecha_reingreso: null,
          historial_bajas: newHistorial,
          motivo_baja: motivoBajaInput || null,
          usuario_baja: currentUserName,
          hora_baja: horaStr,
          fecha_hora_baja: isoStr
        });
      } catch (err) {
        if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
          await sercoApi.entities.Empleado.update(bajaConfirmId, {
            fecha_baja: todayStr,
            fecha_reingreso: null,
            historial_bajas: newHistorial,
            motivo_baja: motivoBajaInput || null,
            usuario_baja: currentUserName
          });
        } else {
          throw err;
        }
      }

      // Show IMSS alert if employee was registered in IMSS
      if (emp?.seguro) {
        setImssAlertEmpleado(emp);
      }

      setBajaConfirmId(null);
      setMotivoBajaInput("");
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  function openEditMotivo(emp) {
    setEditMotivoEmpleado(emp);
    setEditMotivoText(emp?.motivo_baja || "");
  }

  async function handleSaveMotivo() {
    if (!editMotivoEmpleado) return;
    setSavingMotivo(true);
    try {
      const currentUserName = user?.full_name || user?.nombre || (user?.email ? user.email.split('@')[0] : "Usuario");
      const updatePayload = {
        motivo_baja: editMotivoText || null,
        usuario_modificacion_baja: currentUserName,
      };
      try {
        await sercoApi.entities.Empleado.update(editMotivoEmpleado.id, updatePayload);
      } catch {
        await sercoApi.entities.Empleado.update(editMotivoEmpleado.id, {
          motivo_baja: editMotivoText || null,
        });
      }

      setItems((prev) =>
        prev.map((e) => (e.id === editMotivoEmpleado.id ? { ...e, motivo_baja: editMotivoText } : e))
      );
      if (viewEmpleado && viewEmpleado.id === editMotivoEmpleado.id) {
        setViewEmpleado((prev) => ({ ...prev, motivo_baja: editMotivoText }));
      }
      setEditMotivoEmpleado(null);
      toast({
        title: "Motivo actualizado",
        description: `Se actualizó el motivo de baja para ${formatUserDisplayName(editMotivoEmpleado.nombre_completo, user?.role)}.`,
      });
    } catch (err) {
      console.error("Error al actualizar motivo de baja:", err);
      toast({
        title: "Error al actualizar",
        description: err.message || "No se pudo actualizar el motivo.",
        variant: "destructive",
      });
    } finally {
      setSavingMotivo(false);
    }
  }

  async function handleConfirmReingreso() {
    try {
      const selectedDate = fechaReingresoInput || new Date().toISOString().slice(0, 10);
      const currentUserName = user?.full_name || user?.nombre || user?.email?.split('@')[0] || "Usuario";
      try {
        await sercoApi.entities.Empleado.update(reingresoConfirmId, {
          fecha_reingreso: selectedDate,
          usuario_alta: currentUserName,
          usuario_baja: null
        });
      } catch (err) {
        if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
          await sercoApi.entities.Empleado.update(reingresoConfirmId, {
            fecha_reingreso: selectedDate
          });
        } else {
          throw err;
        }
      }
      setReingresoConfirmId(null);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  // Finiquito estimation helper
  function getFiniquitoEstimation(ingreso, baja, sueldo) {
    if (!ingreso || !baja || !sueldo) return null;
    const start = new Date(ingreso);
    const end = new Date(baja);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Simple estimation (e.g. 15 days of aguinaldo per year, 6 days of vacation per year)
    const dailySueldo = sueldo / 30;
    const estimatedAguinaldo = (diffDays / 365) * 15 * dailySueldo;
    const estimatedVacacion = (diffDays / 365) * 6 * dailySueldo;
    const total = estimatedAguinaldo + estimatedVacacion;
    
    return {
      days: diffDays,
      total: Math.round(total)
    };
  }

  if (!canAccess) {
    return <AccessRestricted />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Empleados</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activos.length} activos · {bajas.length} bajas
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          {can("empleados", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="w-4 h-4 mr-1" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-64 grid-cols-2">
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="bajas">Bajas</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="mt-4">
          <TooltipProvider delayDuration={150}>
            <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none hover:text-foreground w-16" onClick={() => handleSort("numero_empleado")}>
                    <div className="flex items-center gap-1">
                      No. {renderSortIcon("numero_empleado")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("nombre_completo")}>
                    <div className="flex items-center gap-1.5">
                      Nombre {renderSortIcon("nombre_completo")}
                    </div>
                  </TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("fecha_ingreso")}>
                    <div className="flex items-center gap-1.5">
                      Fecha Ingreso {renderSortIcon("fecha_ingreso")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("fecha_nacimiento")}>
                    <div className="flex items-center gap-1.5">
                      Edad {renderSortIcon("fecha_nacimiento")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("servicio_ubicacion")}>
                    <div className="flex items-center gap-1.5">
                      Servicio {renderSortIcon("servicio_ubicacion")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("telefono")}>
                    <div className="flex items-center gap-1.5">
                      Teléfono {renderSortIcon("telefono")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("seguro")}>
                    <div className="flex items-center gap-1.5">
                      Seguro {renderSortIcon("seguro")}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : sortedActivos.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No hay empleados activos</TableCell></TableRow>
                ) : (
                  sortedActivos.map((item) => (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer ${getServiceRowColor(item.servicio_ubicacion)}`}
                      onClick={() => setViewEmpleado(item)}
                    >
                      <TableCell className="font-semibold text-xs text-muted-foreground whitespace-nowrap">
                        {item.numero_empleado ? (
                          <Badge variant="outline" className="font-mono font-bold bg-muted/60 text-foreground border-border">
                            #{item.numero_empleado}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-medium flex items-center gap-1.5">
                        {formatUserDisplayName(item.nombre_completo, user?.role)}
                        {hasPendingInfo(item) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span 
                                className="inline-flex items-center cursor-help text-red-500 hover:text-red-600 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 fill-red-100 flex-shrink-0" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="right" 
                              align="center"
                              className="bg-slate-900 text-slate-100 p-2.5 shadow-xl border border-slate-700/80 rounded-lg text-xs max-w-xs z-50 pointer-events-none"
                            >
                              <div className="font-semibold text-red-300 flex items-center gap-1.5 mb-1.5 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span>Campos pendientes:</span>
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                                {getMissingFields(item).map((field, idx) => (
                                  <li key={idx}>{field}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                      <TableCell>{item.puesto || "—"}</TableCell>
                      <TableCell>{item.fecha_ingreso || "—"}</TableCell>
                      <TableCell>
                        {calcularEdad(item.fecha_nacimiento)}
                      </TableCell>
                      <TableCell>{item.servicio_ubicacion || "—"}</TableCell>
                      <TableCell>{item.telefono || "—"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.seguro ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {item.seguro ? "SI" : "NO"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.actas_administrativas > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {item.actas_administrativas || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </TooltipProvider>
        </TabsContent>

        <TabsContent value="bajas" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none hover:text-foreground w-16" onClick={() => handleSort("numero_empleado")}>
                    <div className="flex items-center gap-1">
                      No. {renderSortIcon("numero_empleado")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("nombre_completo")}>
                    <div className="flex items-center gap-1.5">
                      Nombre {renderSortIcon("nombre_completo")}
                    </div>
                  </TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("fecha_ingreso")}>
                    <div className="flex items-center gap-1.5">
                      Fecha Ingreso {renderSortIcon("fecha_ingreso")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("fecha_baja")}>
                    <div className="flex items-center gap-1.5 text-destructive">
                      Fecha Baja {renderSortIcon("fecha_baja")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[180px]">Motivo de Baja</TableHead>
                  <TableHead>Días Laborados</TableHead>
                  <TableHead className="text-right">Finiquito Est.</TableHead>
                  <TableHead className="text-center">Actas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : sortedBajas.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No hay registros de bajas</TableCell></TableRow>
                ) : (
                  sortedBajas.map((item) => {
                    const est = getFiniquitoEstimation(item.fecha_ingreso, item.fecha_baja, item.sueldo);
                    return (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer ${getServiceRowColor(item.servicio_ubicacion)}`}
                        onClick={() => setViewEmpleado(item)}
                      >
                        <TableCell className="font-semibold text-xs text-muted-foreground whitespace-nowrap">
                          {item.numero_empleado ? (
                            <Badge variant="outline" className="font-mono font-bold bg-muted/60 text-foreground border-border">
                              #{item.numero_empleado}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{formatUserDisplayName(item.nombre_completo, user?.role)}</TableCell>
                        <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                        <TableCell>{item.fecha_ingreso || "—"}</TableCell>
                        <TableCell className="text-destructive font-semibold">{item.fecha_baja || "—"}</TableCell>
                        <TableCell className="max-w-[220px]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between gap-1.5 group">
                            <span className="truncate text-xs text-muted-foreground" title={item.motivo_baja || "Sin motivo especificado"}>
                              {item.motivo_baja || <span className="italic opacity-60">Sin motivo</span>}
                            </span>
                            {can("empleados", "edit") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-60 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"
                                onClick={() => openEditMotivo(item)}
                                title="Editar motivo de baja"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{est ? `${est.days} días` : "—"}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {est ? `$${est.total.toLocaleString("es-MX")}` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700`}>
                            {item.actas_administrativas || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {can("empleados", "edit") && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs px-2 text-primary hover:bg-primary/10"
                                  onClick={() => openEditMotivo(item)}
                                  title="Editar motivo de baja"
                                >
                                  <Pencil className="w-3 h-3 mr-1" /> Editar Motivo
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                  onClick={() => {
                                    setReingresoConfirmId(item.id);
                                    setFechaReingresoInput(new Date().toISOString().slice(0, 10));
                                  }}
                                  title="Registrar reingreso con fecha"
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Reingreso
                                </Button>
                              </>
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
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
         <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
          <DialogDescription>
            Completa los datos del empleado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* INFORMACIÓN PERSONAL */}

          <div>
            <h3 className="font-semibold border-b pb-2 mb-4">
              Información Personal
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* FOTOGRAFÍA DEL EMPLEADO */}
              <div className="sm:col-span-2 flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-muted/40 rounded-xl border border-dashed border-border/80">
                <div className="relative group shrink-0">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Fotografía del empleado"
                      className="w-20 h-20 rounded-lg object-cover border border-border/60 shadow-xs bg-background"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex flex-col items-center justify-center text-muted-foreground border border-border/40">
                      <Camera className="w-6 h-6 stroke-[1.5]" />
                      <span className="text-[10px] mt-1 font-medium">Sin foto</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <Label className="font-semibold text-xs text-foreground">Fotografía del Empleado</Label>
                    <span className="text-[11px] text-muted-foreground">(Opcional)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Se redimensiona y comprime automáticamente (~25 KB) para no saturar la base de datos.
                  </p>
                  <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex items-center gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={compressingPhoto}
                    >
                      {compressingPhoto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Procesando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          {photoPreview ? "Cambiar fotografía" : "Subir fotografía"}
                        </>
                      )}
                    </Button>

                    {photoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleRemovePhoto}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Quitar
                      </Button>
                    )}

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelected}
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Nombre(s) *</Label>
                  <Input
                    placeholder="Ej. Juan Carlos"
                    value={form.nombres || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        nombres: e.target.value,
                      })
                    }
                    onBlur={(e) =>
                      setForm({
                        ...form,
                        nombres: formatProperName(e.target.value),
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Apellido Paterno *</Label>
                  <Input
                    placeholder="Ej. Pérez"
                    value={form.apellido_paterno || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        apellido_paterno: e.target.value,
                      })
                    }
                    onBlur={(e) =>
                      setForm({
                        ...form,
                        apellido_paterno: formatProperName(e.target.value),
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Apellido Materno</Label>
                  <Input
                    placeholder="Ej. Gómez"
                    value={form.apellido_materno || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        apellido_materno: e.target.value,
                      })
                    }
                    onBlur={(e) =>
                      setForm({
                        ...form,
                        apellido_materno: formatProperName(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              {(form.nombres || form.apellido_paterno || form.apellido_materno) && (
                <div className="sm:col-span-2 -mt-2">
                  <p className="text-xs text-muted-foreground">
                    Vista en sistema: <strong className="text-foreground">
                      {[formatProperName(form.apellido_paterno), formatProperName(form.apellido_materno), formatProperName(form.nombres)].filter(Boolean).join(" ")}
                    </strong>
                  </p>
                </div>
              )}

              {!defaultSedeId && (
                <div className="sm:col-span-2">
                  <SedeSelector
                    value={form.sede_id}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        sede_id: v,
                      })
                    }
                    sedes={sedes}
                  />
                </div>
              )}

              <div>
                <Label>Sexo</Label>

                <Select
                  value={form.sexo}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      sexo: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                  </SelectContent>

                </Select>
              </div>

              <div>
                <Label>Fecha de Nacimiento</Label>

                <Input
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_nacimiento: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Estado Civil</Label>

                <Select
                  value={form.estado_civil}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      estado_civil: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Soltero">Soltero(a)</SelectItem>
                    <SelectItem value="Casado">Casado(a)</SelectItem>
                    <SelectItem value="Divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="Viudo">Viudo(a)</SelectItem>
                    <SelectItem value="Separado">Separado(a)</SelectItem>
                    <SelectItem value="Conyuge">Cónyuge</SelectItem>
                    <SelectItem value="Union Libre">Unión libre</SelectItem>
                  </SelectContent>

                </Select>
              </div>

              <div>
                <Label>Nivel de Estudios</Label>

                <Select
                  value={form.nivel_estudios}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      nivel_estudios: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Primaria">Primaria</SelectItem>
                    <SelectItem value="Secundaria">Secundaria</SelectItem>
                    <SelectItem value="Preparatoria">Preparatoria</SelectItem>
                    <SelectItem value="Carrera Técnica">Carrera técnica</SelectItem>
                    <SelectItem value="Licenciatura">Licenciatura</SelectItem>
                    <SelectItem value="Maestría">Maestría</SelectItem>
                    <SelectItem value="Doctorado">Doctorado</SelectItem>
                  </SelectContent>

                </Select>
              </div>

              <div>
                <Label>CURP</Label>

                <Input
                  value={form.curp}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      curp: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>RFC</Label>

                <Input
                  value={form.rfc}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rfc: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>NSS</Label>

                <Input
                  value={form.nss}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nss: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Infonavit</Label>
                <Input
                  value={form.infonavit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      infonavit: e.target.value,
                    })
                  }
                />
              </div>
              
              <div>
                <Label>Banco</Label>
                <Input
                  placeholder="Ej. BBVA, Santander, Banorte..."
                  value={form.banco || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      banco: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>CLABE Bancaria</Label>
                <Input
                  placeholder="18 dígitos"
                  value={form.clabe_bancaria || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      clabe_bancaria: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Teléfono</Label>

                <Input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefono: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Email</Label>

                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Cartilla Militar</Label>
                <Select
                  value={form.carta_militar || "No"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      carta_militar: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sí">Sí</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Beneficiario</Label>
                <Input
                  placeholder="Nombre completo del beneficiario"
                  value={form.beneficiario || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      beneficiario: e.target.value,
                    })
                  }
                />
              </div>

            </div>
          </div>

          {/* DOMICILIO */}

          <div>

            <h3 className="font-semibold border-b pb-2 mb-4">
              Domicilio
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <Label>Zona</Label>
                <Input
                  value={form.zona}
                  onChange={(e) =>
                    setForm({ ...form, zona: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Calle</Label>
                <Input
                  value={form.calle}
                  onChange={(e) =>
                    setForm({ ...form, calle: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Número</Label>
                <Input
                  value={form.numero}
                  onChange={(e) =>
                    setForm({ ...form, numero: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Colonia</Label>
                <Input
                  value={form.colonia}
                  onChange={(e) =>
                    setForm({ ...form, colonia: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Código Postal</Label>
                <Input
                  value={form.codigo_postal}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      codigo_postal: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Ciudad</Label>
                <Input
                  value={form.ciudad}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ciudad: e.target.value,
                    })
                  }
                />
              </div>

            </div>
          </div>
              {/* CONTACTO DE EMERGENCIA */}

          <div>

            <h3 className="font-semibold border-b pb-2 mb-4">
              Contacto de Emergencia
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <Label>Contacto de Emergencia</Label>
                <Input
                  value={form.contacto_emergencia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contacto_emergencia: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Parentesco</Label>
                <Input
                  value={form.parentesco}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parentesco: e.target.value,
                    })
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <Label>Número de Contacto</Label>
                <Input
                  value={form.telefono_emergencia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefono_emergencia: e.target.value,
                    })
                  }
                />
              </div>

            </div>

          </div>

          {/* REFERENCIAS */}
          <div>

            <h3 className="font-semibold border-b pb-2 mb-4">
              Referencias
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <Label>Referencia</Label>
                <Input
                  placeholder="Ej. Juan Pérez (Ex-jefe / Conocido)"
                  value={form.referencia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      referencia: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Número de Contacto de Referencia</Label>
                <Input
                  placeholder="10 dígitos"
                  value={form.referencia_telefono}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      referencia_telefono: e.target.value,
                    })
                  }
                />
              </div>

            </div>

          </div>

          {/* INFORMACIÓN LABORAL */}

          <div>

            <h3 className="font-semibold border-b pb-2 mb-4">
              Información Laboral
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* NÚMERO DE EMPLEADO */}
              <div className="sm:col-span-2 p-3 bg-muted/40 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="numero_empleado" className="font-semibold text-sm">
                      Número de Empleado
                    </Label>
                    <Badge variant={isAdmin ? "default" : "secondary"} className={`text-[10px] font-bold ${isAdmin ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      {isAdmin ? "Editable por Admin" : "Automático"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin
                      ? "Número real positivo consecutivo (van de 1 en 1). Como Administrador puedes modificarlo libremente."
                      : "Número real positivo consecutivo generado automáticamente por el sistema (van de 1 en 1)."}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    id="numero_empleado"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ej. 1"
                    disabled={!isAdmin}
                    className={`w-28 font-mono font-bold text-center bg-background text-base h-9 ${!isAdmin ? "opacity-75 cursor-not-allowed" : ""}`}
                    value={form.numero_empleado ?? ""}
                    onChange={(e) => {
                      if (!isAdmin) return;
                      const val = e.target.value;
                      setForm({
                        ...form,
                        numero_empleado: val === "" ? "" : Math.max(1, parseInt(val, 10) || 1),
                      });
                    }}
                  />
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs shrink-0 h-9"
                      onClick={() => {
                        const pool = allEmployees.length > 0 ? allEmployees : items;
                        const autoNum = getNextEmpleadoNumero(pool, editing?.id);
                        setForm({ ...form, numero_empleado: autoNum });
                      }}
                      title="Generar el siguiente número positivo disponible (secuencia de 1 en 1)"
                    >
                      Autogenerar
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label>Puesto</Label>
                <Input
                  value={form.puesto}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      puesto: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Servicio</Label>
                <Popover open={serviceComboboxOpen} onOpenChange={setServiceComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={serviceComboboxOpen}
                      className="w-full justify-between font-normal h-10 px-3 bg-background"
                    >
                      <span className="truncate">
                        {form.servicio_ubicacion
                          ? form.servicio_ubicacion
                          : "Selecciona o busca un servicio..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        const normalize = (str) =>
                          (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        return normalize(value).includes(normalize(search)) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Escribe para buscar servicio..." />
                      <CommandList>
                        <CommandEmpty>No se encontró ningún servicio.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="ninguno sin asignar"
                            onSelect={() => {
                              setForm({ ...form, servicio_ubicacion: "" });
                              setServiceComboboxOpen(false);
                            }}
                            className="cursor-pointer text-muted-foreground"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !form.servicio_ubicacion ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Ninguno / Sin asignar
                          </CommandItem>

                          <CommandItem
                            value="cubredescansos"
                            onSelect={() => {
                              setForm({ ...form, servicio_ubicacion: "Cubredescansos" });
                              setServiceComboboxOpen(false);
                            }}
                            className="cursor-pointer font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary",
                                form.servicio_ubicacion === "Cubredescansos"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Cubredescansos
                          </CommandItem>

                          <CommandItem
                            value="oficina"
                            onSelect={() => {
                              setForm({ ...form, servicio_ubicacion: "Oficina" });
                              setServiceComboboxOpen(false);
                            }}
                            className="cursor-pointer font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary",
                                form.servicio_ubicacion === "Oficina"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Oficina
                          </CommandItem>

                          <CommandItem
                            value="supervisor"
                            onSelect={() => {
                              setForm({ ...form, servicio_ubicacion: "Supervisor" });
                              setServiceComboboxOpen(false);
                            }}
                            className="cursor-pointer font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary",
                                form.servicio_ubicacion === "Supervisor"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Supervisor
                          </CommandItem>

                          {servicios
                            .filter((s) => s.nombre !== "Cubredescansos" && s.nombre !== "Oficina" && s.nombre !== "Supervisor")
                            .map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.nombre}
                                onSelect={() => {
                                  setForm({ ...form, servicio_ubicacion: s.nombre });
                                  setServiceComboboxOpen(false);
                                }}
                                className="cursor-pointer font-medium"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 text-primary",
                                    form.servicio_ubicacion === s.nombre
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {s.nombre}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Turno en Plantilla</Label>
                <Select
                  value={form.turno || "matutino"}
                  onValueChange={(val) => setForm({ ...form, turno: val })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecciona turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="cubre_descansos">Cubre Descansos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fecha de Ingreso</Label>
                <Input
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_ingreso: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Sueldo Mensual</Label>
                <Input
                  type="number"
                  value={form.sueldo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sueldo: e.target.value,
                    })
                  }
                />
              </div>

              {form.fecha_baja && (
                <div>
                  <Label className="text-destructive font-semibold">Fecha de Baja</Label>
                  <Input
                    type="date"
                    value={form.fecha_baja}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fecha_baja: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {form.fecha_baja && (
                <div className="sm:col-span-2">
                  <Label className="text-destructive font-semibold">Motivo de la Baja</Label>
                  <Textarea
                    placeholder="Describe el motivo de la baja..."
                    value={form.motivo_baja || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        motivo_baja: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <div>
                <Label className="font-semibold text-foreground">Fecha de Reingreso</Label>
                <Input
                  type="date"
                  value={form.fecha_reingreso || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_reingreso: e.target.value,
                    })
                  }
                />
                <span className="text-[11px] text-muted-foreground">
                  Opcional. Se utiliza si el colaborador reingresó a la empresa.
                </span>
              </div>

              <div>
                <Label>Medio de Reclutamiento</Label>
                <Input
                  value={form.medio_reclutamiento}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      medio_reclutamiento: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Día de Capacitación 1</Label>
                <Input
                  type="date"
                  value={form.dia_capacitacion}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dia_capacitacion: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Día de Capacitación 2</Label>
                <Input
                  type="date"
                  value={form.dia_capacitacion_2}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dia_capacitacion_2: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Fecha de Montaje</Label>
                <Input
                  type="date"
                  value={form.fecha_montaje}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha_montaje: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Actas Administrativas</Label>
                <Input
                  type="number"
                  value={form.actas_administrativas}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      actas_administrativas: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex items-center space-x-2 pt-8 sm:col-span-2">
                <input
                  type="checkbox"
                  id="seguro"
                  checked={!!form.seguro}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      seguro: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <Label htmlFor="seguro" className="cursor-pointer font-semibold text-sm">
                  ¿Dado de alta en el seguro? (IMSS)
                </Label>
              </div>

              {sedes.find((s) => s.id === form.sede_id)?.nombre?.toLowerCase() === "monterrey" && (
                <div className="flex items-center space-x-2 pt-8 sm:col-span-2">
                  <input
                    type="checkbox"
                    id="hospedaje"
                    checked={!!form.hospedaje}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        hospedaje: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <Label htmlFor="hospedaje" className="cursor-pointer font-semibold text-sm">
                    ¿Tiene Hospedaje?
                  </Label>
                </div>
              )}

              <div className="sm:col-span-2">
                <Label>Uniformes Asignados</Label>
                <Textarea
                  
                  value={form.uniformes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      uniformes: e.target.value,
                    })
                  }
                />
              </div>

            </div>

          </div>

        </div>

        {saveError && (
          <div className="mx-6 mb-3 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm font-medium">
            {saveError}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setModalOpen(false)}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
          >
             {saving ? "Guardando..." : "Guardar"}
          
            
          </Button>
        </DialogFooter>

        </DialogContent>
        </Dialog>
        <Dialog
          open={!!viewEmpleado}
          onOpenChange={(v) => !v && setViewEmpleado(null)}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">

            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{formatUserDisplayName(viewEmpleado?.nombre_completo, user?.role)}</span>
                {viewEmpleado?.numero_empleado && (
                  <Badge variant="outline" className="font-mono font-bold bg-muted/60 text-foreground border-border text-sm">
                    #{viewEmpleado.numero_empleado}
                  </Badge>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => openEditNumero(viewEmpleado)}
                    title="Editar número de empleado"
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Editar No.
                  </Button>
                )}
              </DialogTitle>

              <DialogDescription>
                Información del empleado
              </DialogDescription>
            </DialogHeader>
                <div className="space-y-6 py-2">

    {/* Información General */}
    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Información General
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>No. Empleado</Label>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm font-bold text-primary font-mono">
              {viewEmpleado?.numero_empleado ? `#${viewEmpleado.numero_empleado}` : "—"}
            </p>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-primary hover:bg-primary/10"
                onClick={() => openEditNumero(viewEmpleado)}
                title="Editar número de empleado"
              >
                <Pencil className="w-3 h-3 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>

        <div>
          <Label>Nombre</Label>
          <p className="text-sm text-muted-foreground">
            {formatUserDisplayName(viewEmpleado?.nombre_completo, user?.role) || "—"}
          </p>
        </div>

        <div>
          <Label>Puesto</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.puesto || "—"}
          </p>
        </div>

        <div>
          <Label>Servicio</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.servicio_ubicacion || "—"}
          </p>
        </div>

        <div>
          <Label>Sede</Label>
          <p className="text-sm text-muted-foreground">
            {sedeNombre(viewEmpleado?.sede_id)}
          </p>
        </div>

        <div>
          <Label>Fecha de ingreso</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_ingreso || "—"}
          </p>
        </div>

        <div>
          <Label>Días en la Empresa</Label>
          <p className="text-sm text-muted-foreground font-semibold text-primary">
            {calcularDiasEnEmpresa(viewEmpleado?.fecha_ingreso, viewEmpleado?.fecha_baja, viewEmpleado?.fecha_reingreso)}
          </p>
        </div>

        {viewEmpleado?.fecha_reingreso && (
          <div>
            <Label>Fecha de reingreso</Label>
            <p className="text-sm text-muted-foreground">
              {viewEmpleado.fecha_reingreso}
            </p>
          </div>
        )}

        {(viewEmpleado?.historial_bajas || viewEmpleado?.fecha_baja) && (
          <div>
            <Label>{viewEmpleado.historial_bajas?.includes(",") ? "Historial de Bajas" : "Fecha de Baja"}</Label>
            <p className="text-sm text-muted-foreground font-semibold text-rose-600">
              {viewEmpleado.historial_bajas || viewEmpleado.fecha_baja}
            </p>
          </div>
        )}

        {sedes.find((s) => s.id === viewEmpleado?.sede_id)?.nombre?.toLowerCase() === "monterrey" && (
          <div>
            <Label>Hospedaje</Label>
            <p className="text-sm text-muted-foreground font-semibold">
              {viewEmpleado?.hospedaje ? "Sí" : "No"}
            </p>
          </div>
        )}

        <div>
          <Label>Seguro (IMSS)</Label>
          <p className={`text-sm font-semibold ${viewEmpleado?.seguro ? "text-emerald-600" : "text-red-500"}`}>
            {viewEmpleado?.seguro ? "Sí" : "No"}
          </p>
        </div>

        {(viewEmpleado?.fecha_baja || viewEmpleado?.motivo_baja) && (
          <div className="col-span-2 p-3 rounded-lg border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 mt-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <Label className="text-xs font-semibold text-rose-800 dark:text-rose-300">Motivo de la Baja</Label>
              {can("empleados", "edit") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2 text-rose-700 border-rose-300 hover:bg-rose-100 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-900/40"
                  onClick={() => openEditMotivo(viewEmpleado)}
                >
                  <Pencil className="w-3 h-3 mr-1" /> Editar motivo
                </Button>
              )}
            </div>
            <p className="text-sm text-rose-950 dark:text-rose-100 font-medium">
              {viewEmpleado.motivo_baja || <span className="italic text-muted-foreground text-xs">Sin motivo especificado</span>}
            </p>
          </div>
        )}

      </div>
    </div>

    {/* Información Laboral */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Información Laboral
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Sueldo</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.sueldo ?? "—"}
          </p>
        </div>

        <div>
          <Label>Actas administrativas</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.actas_administrativas}
          </p>
        </div>

        <div>
          <Label>Uniformes</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.uniformes || "—"}
          </p>
        </div>

        <div>
          <Label>Medio de Reclutamiento</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.medio_reclutamiento || "—"}
          </p>
        </div>

        <div>
          <Label>Día de Capacitación 1</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.dia_capacitacion || "—"}
          </p>
        </div>

        <div>
          <Label>Día de Capacitación 2</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.dia_capacitacion_2 || "—"}
          </p>
        </div>

        <div>
          <Label>Fecha de Montaje</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_montaje || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Información Personal */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Información Personal
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Sexo</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.sexo || "—"}
          </p>
        </div>

        <div>
          <Label>Fecha de nacimiento</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.fecha_nacimiento || "—"}
          </p>
        </div>

        <div>
          <Label>Edad</Label>
          <p className="text-sm text-muted-foreground">
            {calcularEdad(viewEmpleado?.fecha_nacimiento)}
          </p>
        </div>

        <div>
          <Label>Estado civil</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.estado_civil || "—"}
          </p>
        </div>

        <div>
          <Label>Nivel de estudios</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.nivel_estudios || "—"}
          </p>
        </div>

        <div>
          <Label>Teléfono</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.telefono || "—"}
          </p>
        </div>

        <div>
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.email || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Documentación */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Documentación
      </h3>

      <div className="grid grid-cols-3 gap-4 mt-3">

        <div>
          <Label>CURP</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.curp || "—"}
          </p>
        </div>

        <div>
          <Label>RFC</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.rfc || "—"}
          </p>
        </div>

        <div>
          <Label>NSS</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.nss || "—"}
          </p>
        </div>

        <div>
          <Label>Infonavit</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.infonavit || "—"}
          </p>
        </div>

        <div>
          <Label>Banco</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.banco || "—"}
          </p>
        </div>

        <div>
          <Label>CLABE Bancaria</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.clabe_bancaria || "—"}
          </p>
        </div>

        <div>
          <Label>Cartilla Militar</Label>
          <p className="text-sm text-muted-foreground font-medium">
            {viewEmpleado?.carta_militar || "No"}
          </p>
        </div>

        <div>
          <Label>Beneficiario</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.beneficiario || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Domicilio */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Domicilio
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Calle</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.calle || "—"}
          </p>
        </div>

        <div>
          <Label>Número</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.numero || "—"}
          </p>
        </div>

        <div>
          <Label>Colonia</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.colonia || "—"}
          </p>
        </div>

        <div>
          <Label>Código Postal</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.codigo_postal || "—"}
          </p>
        </div>

        <div>
          <Label>Ciudad</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.ciudad || "—"}
          </p>
        </div>

        <div>
          <Label>Zona</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.zona || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Contacto de Emergencia */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Contacto de Emergencia
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Nombre</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.contacto_emergencia || "—"}
          </p>
        </div>

        <div>
          <Label>Teléfono</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.telefono_emergencia || "—"}
          </p>
        </div>

        <div>
          <Label>Parentesco</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.parentesco || "—"}
          </p>
        </div>

      </div>
    </div>

    {/* Referencias */}

    <div>
      <h3 className="font-semibold text-base border-b pb-2">
        Referencias
      </h3>

      <div className="grid grid-cols-2 gap-4 mt-3">

        <div>
          <Label>Referencia</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.referencia || "—"}
          </p>
        </div>

        <div>
          <Label>Teléfono de Contacto</Label>
          <p className="text-sm text-muted-foreground">
            {viewEmpleado?.referencia_telefono || "—"}
          </p>
        </div>

      </div>
    </div>

  </div>
            
            <DialogFooter>
              {!viewEmpleado?.fecha_baja || (viewEmpleado?.fecha_reingreso && viewEmpleado?.fecha_reingreso >= viewEmpleado?.fecha_baja) ? (
                (can("empleados", "edit") || user?.role?.toLowerCase() === "supervisor") && (
                  <Button
                    variant="outline"
                    className="border-rose-300 text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      setBajaConfirmId(viewEmpleado.id);
                      setMotivoBajaInput("");
                      setViewEmpleado(null);
                    }}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Baja
                  </Button>
                )
              ) : (
                can("empleados", "edit") && (
                  <Button
                    variant="outline"
                    className="border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => {
                      setReingresoConfirmId(viewEmpleado.id);
                      setViewEmpleado(null);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Reingreso
                  </Button>
                )
              )}

              {can("empleados", "delete") && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewEmpleado(null);
                    setDeleteId(viewEmpleado.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              )}

              {can("empleados", "edit") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewEmpleado(null);
                    openEdit(viewEmpleado);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}

              <Button onClick={() => setViewEmpleado(null)}>
                Cerrar
              </Button>

            </DialogFooter>

          </DialogContent>
        </Dialog>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar empleado?"
        description="Esta acción no se puede deshacer y borrará permanentemente la información."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!bajaConfirmId}
        onOpenChange={(v) => !v && setBajaConfirmId(null)}
        title="¿Dar de baja al empleado?"
        description="Esta acción registrará la baja del empleado con la fecha de hoy automáticamente y lo moverá a la sección de bajas."
        confirmLabel="Dar de Baja"
        onConfirm={handleConfirmBaja}
      >
        <div className="space-y-2 py-3 px-1">
          <Label htmlFor="motivo-baja-confirm">Motivo de la Baja</Label>
          <Textarea
            id="motivo-baja-confirm"
            placeholder="Escribe el motivo de la baja..."
            value={motivoBajaInput}
            onChange={(e) => setMotivoBajaInput(e.target.value)}
          />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!reingresoConfirmId}
        onOpenChange={(v) => {
          if (!v) {
            setReingresoConfirmId(null);
            setFechaReingresoInput(new Date().toISOString().slice(0, 10));
          }
        }}
        title="¿Confirmar reingreso del empleado?"
        description="Indica la fecha en que el colaborador se reincorpora. Se reactivará en la plantilla y asistencias."
        confirmLabel="Confirmar Reingreso"
        variant="success"
        loadingLabel="Guardando..."
        onConfirm={handleConfirmReingreso}
      >
        <div className="space-y-2 py-3 px-1">
          <Label htmlFor="fecha-reingreso-confirm" className="font-semibold text-foreground">
            Fecha de Reingreso
          </Label>
          <Input
            id="fecha-reingreso-confirm"
            type="date"
            value={fechaReingresoInput}
            onChange={(e) => setFechaReingresoInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Por defecto se sugiere la fecha de hoy, pero puedes elegir cualquier fecha exacta en que reingresó.
          </p>
        </div>
      </ConfirmDialog>

      {/* IMSS Baja Alert Dialog */}
      <Dialog open={!!imssAlertEmpleado} onOpenChange={(v) => !v && setImssAlertEmpleado(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Alerta: Dar de baja del IMSS
            </DialogTitle>
            <DialogDescription>
              Este empleado está dado de alta en el seguro (IMSS). Es necesario tramitar su baja del seguro social.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-orange-800">
                          {formatUserDisplayName(imssAlertEmpleado?.nombre_completo, user?.role)}
            </p>
            <p className="text-sm text-orange-700">
              <strong>NSS:</strong> {imssAlertEmpleado?.nss || "No registrado"}
            </p>
            <p className="text-sm text-orange-700">
              <strong>CURP:</strong> {imssAlertEmpleado?.curp || "No registrado"}
            </p>
            <p className="text-sm text-orange-700">
              <strong>Puesto:</strong> {imssAlertEmpleado?.puesto || "—"}
            </p>
            <div className="mt-3 pt-3 border-t border-orange-200">
              <p className="text-sm font-semibold text-orange-900">
                📋 Recuerda dar de baja a este empleado ante el IMSS lo antes posible para evitar cargos adicionales.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setImssAlertEmpleado(null)} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Motivo Baja Dialog */}
      <Dialog open={!!editMotivoEmpleado} onOpenChange={(v) => !v && setEditMotivoEmpleado(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="w-4 h-4 text-primary" /> Editar Motivo de Baja
            </DialogTitle>
            <DialogDescription>
                          Empleado: <strong className="text-foreground">{formatUserDisplayName(editMotivoEmpleado?.nombre_completo, user?.role)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <Label htmlFor="modal-edit-motivo-text">Motivo de la Baja</Label>
            <Textarea
              id="modal-edit-motivo-text"
              rows={4}
              placeholder="Escribe o actualiza el motivo detallado de la baja..."
              value={editMotivoText}
              onChange={(e) => setEditMotivoText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMotivoEmpleado(null)} disabled={savingMotivo}>
              Cancelar
            </Button>
            <Button onClick={handleSaveMotivo} disabled={savingMotivo}>
              {savingMotivo ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Numero Empleado Dialog (Admin Only) */}
      <Dialog open={!!editNumeroEmpleado} onOpenChange={(v) => !v && setEditNumeroEmpleado(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="w-4 h-4 text-primary" /> Editar Número de Empleado
            </DialogTitle>
            <DialogDescription>
              Modificar el número asignado a <strong className="text-foreground">{formatUserDisplayName(editNumeroEmpleado?.nombre_completo, user?.role)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="input-new-numero-emp" className="text-sm font-semibold">
                Número de Empleado (Entero positivo)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="input-new-numero-emp"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ej. 1"
                  className="font-mono font-bold text-center text-lg h-10 w-32"
                  value={newNumeroInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewNumeroInput(val === "" ? "" : String(Math.max(1, parseInt(val, 10) || 1)));
                  }}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs shrink-0"
                  onClick={() => {
                    const pool = allEmployees.length > 0 ? allEmployees : items;
                    const nextNum = getNextEmpleadoNumero(pool, editNumeroEmpleado?.id);
                    setNewNumeroInput(String(nextNum));
                  }}
                  title="Asignar el siguiente consecutivo disponible"
                >
                  Siguiente Consecutivo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Recuerda que por regla del sistema los empleados se registran consecutivamente de 1 en 1.
              </p>
            </div>

            {(() => {
              const currentVal = parseInt(newNumeroInput, 10);
              if (!currentVal || isNaN(currentVal)) return null;
              const pool = allEmployees.length > 0 ? allEmployees : items;
              const conflict = pool.find(
                (e) => e.id !== editNumeroEmpleado?.id && resolveEmpleadoNumero(e) === currentVal
              );
              if (conflict) {
                return (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Aviso: El número <strong>#{currentVal}</strong> ya está asignado a <strong>{conflict.nombre_completo}</strong>.
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {editNumeroError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {editNumeroError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNumeroEmpleado(null)} disabled={savingNumero}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNumero} disabled={savingNumero || !newNumeroInput}>
              {savingNumero ? "Guardando..." : "Guardar Número"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}