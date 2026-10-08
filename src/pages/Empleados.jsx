import React, { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Pencil, Trash2, Search, FileText, UserX, Download, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Check, Camera, Upload, Loader2, Shirt, Calendar, Building2, Phone, Mail, MapPin, CreditCard, Briefcase, UserCheck, User } from "lucide-react";
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
import { generateFichaTecnicaPDF } from "@/lib/fichaTecnicaTemplate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  resolveEmpleadoNumero,
  getNextEmpleadoNumero,
  setStoredEmpleadoNumero,
  syncAndAssignEmpleadoNumeros,
} from "@/lib/empleadoNumero";
import {
  getStoredEmpleadoMeta,
  setStoredEmpleadoMeta,
  enrichEmpleadoWithMeta,
  enrichEmpleadosListWithMeta,
} from "@/lib/empleadoMetadata";

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

/**
 * Retorna la fecha local en formato YYYY-MM-DD en la zona horaria de México (UTC-6)
 * para evitar desfases de día después de las 6:00 PM al usar toISOString().
 */
export function getLocalDateString(date = new Date()) {
  try {
    return date.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Parsea el campo uniformes soportando formato estructurado JSON y texto plano anterior.
 */
export function parseUniformes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [{
        id: "legacy_0",
        articulo: trimmed,
        talla: "—",
        cantidad: 1,
        fecha_entrega: "Registro anterior",
        es_legacy: true
      }];
    }
  }
  return [];
}

/**
 * Formatea uniformes a un resumen de texto legible para exportaciones CSV/Excel.
 */
export function formatUniformesSummary(raw) {
  const list = parseUniformes(raw);
  if (!list || list.length === 0) return "Sin uniformes";
  return list
    .map((u) => `${u.cantidad || 1}x ${u.articulo}${u.talla && u.talla !== "—" ? ` (${u.talla})` : ""}${u.fecha_entrega ? ` [${u.fecha_entrega}]` : ""}`)
    .join("; ");
}

export const DEFAULT_UNIFORME_CATALOG = [
  "Camisola táctica manga larga",
  "Camisola táctica manga corta",
  "Playera tipo polo SERCO",
  "Pantalón táctico / operativo",
  "Botas tácticas",
  "Calzado de seguridad",
  "Gorra SERCO / Kepí",
  "Chamarra operativa / Rompevientos",
  "Chaleco táctico / reflejante",
  "Fornitura táctica completa",
  "Cinturón táctico policial",
  "Cordón de mando con silbato",
  "Lámpara táctica recargable",
  "Bastón PR-24 / Tonfa",
  "Gas pimienta con funda",
  "Porta credencial / gafete",
];

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
  experiencia: "",
  observaciones: "",
};

export default function Empleados() {
  const { user } = useAuth();
  const { canView, can } = usePermissions();
  const canAccess = canView("empleados");
  const { sedeFilter, defaultSedeId, isSuperAdmin } = useSedeScope();
  const userRole = (user?.role || "").toLowerCase();
  const isAdmin = userRole === "admin" || userRole === "administrador" || userRole === "super administrador" || isSuperAdmin;

  const [searchParams, setSearchParams] = useSearchParams();
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
  const [fichaPreviewOpen, setFichaPreviewOpen] = useState(false);
  const [fichaPreview, setFichaPreview] = useState(null);
  const [generatingFicha, setGeneratingFicha] = useState(false);
  const [bajaConfirmId, setBajaConfirmId] = useState(null);
  const [reingresoConfirmId, setReingresoConfirmId] = useState(null);
  const [fechaReingresoInput, setFechaReingresoInput] = useState(() => getLocalDateString());
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

  // Inventario y Uniformes estructurados con fecha
  const [inventarioItems, setInventarioItems] = useState([]);
  const [inventarioVariantes, setInventarioVariantes] = useState([]);
  const [uniformesList, setUniformesList] = useState([]);
  const [newUniformeItem, setNewUniformeItem] = useState("");
  const [newUniformeTalla, setNewUniformeTalla] = useState("Unitalla");
  const [newUniformeCantidad, setNewUniformeCantidad] = useState(1);
  const [newUniformeFecha, setNewUniformeFecha] = useState(() => getLocalDateString());

  // Estado para visualización en cascada de información de empleado
  const [cascadaOpen, setCascadaOpen] = useState({
    general: true,
    laboral: true,
    uniformes: true,
    personal: true,
    documentacion: false,
    domicilio: false,
    emergencia: false,
    referencias: false,
  });

  const toggleCascada = (sec) => {
    setCascadaOpen((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const expandAllCascada = () => {
    setCascadaOpen({
      general: true,
      laboral: true,
      uniformes: true,
      personal: true,
      documentacion: true,
      domicilio: true,
      emergencia: true,
      referencias: true,
    });
  };

  const collapseAllCascada = () => {
    setCascadaOpen({
      general: false,
      laboral: false,
      uniformes: false,
      personal: false,
      documentacion: false,
      domicilio: false,
      emergencia: false,
      referencias: false,
    });
  };

  // Artículos de uniformes disponibles (inventario + catálogo SERCO)
  const availableUniformeArticulos = useMemo(() => {
    const fromInv = (inventarioItems || [])
      .filter(
        (i) =>
          i.categoria === "Uniforme" ||
          /uniforme|camisola|pantal[oó]n|bota|chamarra|gorra|chaleco|fornitura/i.test(i.nombre || "")
      )
      .map((i) => i.nombre);

    return Array.from(new Set([...fromInv, ...DEFAULT_UNIFORME_CATALOG]));
  }, [inventarioItems]);

  // Tallas disponibles según el uniforme seleccionado
  const availableTallasForSelected = useMemo(() => {
    if (!newUniformeItem) return ["Unitalla", "CH", "M", "G", "XL", "XXL"];

    const matched = (inventarioItems || []).find(
      (i) => i.nombre?.toLowerCase() === newUniformeItem.toLowerCase()
    );
    if (matched) {
      const vars = (inventarioVariantes || []).filter((v) => v.item_id === matched.id);
      if (vars.length > 0) {
        const distinct = Array.from(new Set(vars.map((v) => v.talla).filter(Boolean)));
        if (distinct.length > 0) return distinct;
      }
    }

    if (/bota|calzado|zapato/i.test(newUniformeItem)) {
      return ["24", "24.5", "25", "25.5", "26", "26.5", "27", "27.5", "28", "28.5", "29", "29.5", "30"];
    }

    if (/pantal[oó]n/i.test(newUniformeItem)) {
      return ["28", "30", "32", "34", "36", "38", "40", "42"];
    }

    return ["Unitalla", "CH (Chica)", "M (Mediana)", "G (Grande)", "XL (Extra Grande)", "XXL"];
  }, [newUniformeItem, inventarioItems, inventarioVariantes]);

  const handleAddUniforme = () => {
    if (!newUniformeItem.trim()) {
      toast({
        variant: "destructive",
        title: "Selecciona una prenda",
        description: "Por favor selecciona una prenda de uniforme del catálogo.",
      });
      return;
    }
    const newItem = {
      id: `uni_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      articulo: newUniformeItem.trim(),
      talla: newUniformeTalla || "Unitalla",
      cantidad: Math.max(1, parseInt(newUniformeCantidad, 10) || 1),
      fecha_entrega: newUniformeFecha || new Date().toISOString().slice(0, 10),
      estado: "Entregado"
    };
    const updated = [...uniformesList, newItem];
    setUniformesList(updated);
    setForm((prev) => ({ ...prev, uniformes: JSON.stringify(updated) }));
    setNewUniformeItem("");
    setNewUniformeTalla("Unitalla");
    setNewUniformeCantidad(1);
    toast({
      title: "Prenda asignada",
      description: `${newItem.cantidad}x ${newItem.articulo} (${newItem.talla}) con fecha ${newItem.fecha_entrega}.`,
    });
  };

  const handleRemoveUniforme = (idToRemove) => {
    const updated = uniformesList.filter((u) => u.id !== idToRemove);
    setUniformesList(updated);
    setForm((prev) => ({ ...prev, uniformes: updated.length > 0 ? JSON.stringify(updated) : "" }));
  };

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

  useEffect(() => {
    const handleMetaUpdated = () => {
      setItems((prev) => enrichEmpleadosListWithMeta(prev));
      setAllEmployees((prev) => enrichEmpleadosListWithMeta(prev));
      setViewEmpleado((prev) => (prev ? enrichEmpleadoWithMeta(prev) : null));
    };
    window.addEventListener("serco_empleados_metadata_updated", handleMetaUpdated);
    return () => {
      window.removeEventListener("serco_empleados_metadata_updated", handleMetaUpdated);
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [allEmps, s, sv, invItems, invVars] = await Promise.all([
        sercoApi.entities.Empleado.list("-created_date").catch(() => []),
        sercoApi.entities.Sede.list().catch(() => []),
        sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
        sercoApi.entities.InventarioItem.list().catch(() => []),
        sercoApi.entities.InventarioVariante.list().catch(() => []),
      ]);
      // Sincronizar y asignar números reales positivos a todos los empleados de la empresa (van de 1 en 1)
      const syncedAll = enrichEmpleadosListWithMeta(syncAndAssignEmpleadoNumeros(allEmps || []));
      setAllEmployees(syncedAll);

      // Filtrar por sede seleccionada si aplica
      const filteredBySede = sedeFilter?.sede_id
        ? syncedAll.filter((e) => e.sede_id === sedeFilter.sede_id)
        : syncedAll;

      setItems(filteredBySede);
      setSedes(s || []);
      setServicios(sv || []);
      setInventarioItems(invItems || []);
      setInventarioVariantes(invVars || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const empleadoId = searchParams.get("registro");
    if (!empleadoId || loading) return;
    const empleado = items.find((item) => item.id === empleadoId);
    if (!empleado) return;

    const estaDeBaja = empleado.fecha_baja && (!empleado.fecha_reingreso || empleado.fecha_baja > empleado.fecha_reingreso);
    setActiveTab(estaDeBaja ? "bajas" : "activos");
    setViewEmpleado(enrichEmpleadoWithMeta(empleado));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("registro");
    setSearchParams(nextParams, { replace: true });
  }, [items, loading, searchParams, setSearchParams]);

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
        formatUniformesSummary(emp.uniformes),
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
    setUniformesList([]);
    setNewUniformeItem("");
    setNewUniformeTalla("Unitalla");
    setNewUniformeCantidad(1);
    setNewUniformeFecha(getLocalDateString());
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
    const meta = getStoredEmpleadoMeta(item?.id);
    const enrichedItem = enrichEmpleadoWithMeta(item);
    setEditing(enrichedItem);
    setPhotoPreview(enrichedItem.foto_url || "");
    setPhotoBlob(null);
    setPhotoChanged(false);
    const parsed = parseExistingNombre(enrichedItem);
    const pool = allEmployees.length > 0 ? allEmployees : items;
    const empNum = resolveEmpleadoNumero(enrichedItem) || getNextEmpleadoNumero(pool, enrichedItem.id);
    const parsedUnis = parseUniformes(enrichedItem.uniformes);
    setUniformesList(parsedUnis);
    setNewUniformeItem("");
    setNewUniformeTalla("Unitalla");
    setNewUniformeCantidad(1);
    setNewUniformeFecha(getLocalDateString());
    setForm({ 
      ...emptyForm, 
      ...enrichedItem, 
      numero_empleado: empNum,
      foto_url: enrichedItem.foto_url || "",
      nombres: enrichedItem.nombres || parsed.nombres || "",
      apellido_paterno: enrichedItem.apellido_paterno || parsed.apellido_paterno || "",
      apellido_materno: enrichedItem.apellido_materno || parsed.apellido_materno || "",
      experiencia: enrichedItem.experiencia || meta.experiencia || "",
      observaciones: enrichedItem.observaciones || meta.observaciones || "",
      turno: enrichedItem.turno || "matutino",
      sueldo: enrichedItem.sueldo ?? "",
      clabe_bancaria: enrichedItem.clabe_bancaria || "",
      banco: enrichedItem.banco || "",
      beneficiario: enrichedItem.beneficiario || "",
      carta_militar: enrichedItem.carta_militar || "No",
      referencia: enrichedItem.referencia || "",
      referencia_telefono: enrichedItem.referencia_telefono || "",
      actas_administrativas: String(enrichedItem.actas_administrativas ?? 0),
      fecha_baja: enrichedItem.fecha_baja || "",
      motivo_baja: enrichedItem.motivo_baja || "",
      uniformes: enrichedItem.uniformes || "",
      hospedaje: !!enrichedItem.hospedaje,
      seguro: !!enrichedItem.seguro
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
        uniformes: uniformesList.length > 0 ? JSON.stringify(uniformesList) : null,
        infonavit: form.infonavit || null,
        medio_reclutamiento: form.medio_reclutamiento || null,
        dia_capacitacion: form.dia_capacitacion || null,
        dia_capacitacion_2: form.dia_capacitacion_2 || null,
        fecha_montaje: form.fecha_montaje || null,
        historial_bajas: (() => {
          let h = form.historial_bajas || null;
          if (form.fecha_baja) {
            if (!h) return form.fecha_baja;
            const parts = h.split(",").map(p => p.trim()).filter(Boolean);
            if (!parts.includes(form.fecha_baja)) {
              parts[parts.length - 1] = form.fecha_baja;
              return parts.join(", ");
            }
          }
          return h;
        })(),
        hospedaje: form.hospedaje ? true : false,
        seguro: form.seguro ? true : false,
        foto_url: finalFotoUrl,
        experiencia: form.experiencia || null,
        observaciones: form.observaciones || null,
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
        await setStoredEmpleadoMeta(editing.id, {
          experiencia: form.experiencia,
          observaciones: form.observaciones,
        });
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
            delete fallback.experiencia;
            delete fallback.observaciones;
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
            delete fallback.experiencia;
            delete fallback.observaciones;
            createdRecord = await sercoApi.entities.Empleado.create(fallback);
          } else {
            throw err;
          }
        }
        if (createdRecord?.id) {
          if (cleanNumeroEmpleado) {
            setStoredEmpleadoNumero(createdRecord.id, cleanNumeroEmpleado);
          }
          await setStoredEmpleadoMeta(createdRecord.id, {
            experiencia: form.experiencia,
            observaciones: form.observaciones,
          });
        }
      }

      // Sincronización automática con Plantilla (AsignacionTurno)
      const oldEmpName = editing?.nombre_completo?.trim();
      const newEmpName = payload.nombre_completo?.trim();
      const isNameChanged = Boolean(editing && newEmpName && oldEmpName && newEmpName !== oldEmpName);

      if (newEmpName || oldEmpName) {
        const isBaja = Boolean(payload.fecha_baja && (!payload.fecha_reingreso || payload.fecha_baja > payload.fecha_reingreso));
        const matchedServ = servicios.find((s) => s.nombre === payload.servicio_ubicacion);

        try {
          // Si cambió el nombre del empleado, propagar de inmediato en la base de datos
          if (isNameChanged && editing?.id) {
            try {
              await supabase
                .from('asignacion_turnos')
                .update({ empleado_nombre: newEmpName, empleado_id: editing.id })
                .or(`empleado_id.eq.${editing.id},empleado_nombre.ilike.${oldEmpName}`);
            } catch (e) {
              console.warn("Direct supabase asignacion_turnos update warning:", e);
            }
          }

          // Buscar asignaciones con todas las variaciones de nombres y por empleado_id
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
          if (editing?.id) {
            const asigsById = await sercoApi.entities.AsignacionTurno.filter({ empleado_id: editing.id }).catch(() => []);
            existingAsigs.push(...asigsById);
          }
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

          const isCubreturnosVal = (payload.servicio_ubicacion || "").toLowerCase().includes("cubre");

          if (isBaja) {
            // Si es baja, limpiar todas las asignaciones existentes
            for (const asig of existingAsigs) {
              await sercoApi.entities.AsignacionTurno.delete(asig.id).catch(() => {});
            }
          } else if (isCubreturnosVal) {
            // Es cubreturnos: sus asignaciones de turno se gestionan en Plantilla y no deben eliminarse al guardar el perfil.
            // Si cambió su nombre, sincronizar el nuevo nombre en todas sus asignaciones activas
            if (newEmpName && oldEmpName && newEmpName !== oldEmpName) {
              for (const asig of existingAsigs) {
                await sercoApi.entities.AsignacionTurno.update(asig.id, {
                  empleado_nombre: newEmpName,
                  empleado_id: editing.id,
                }).catch(() => {});
              }
            }
          } else if (!matchedServ) {
            // Si no tiene servicio y no es cubreturnos, limpiar todas las asignaciones existentes
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
                empleado_id: editing.id,
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
                  empleado_id: editing.id,
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
                    empleado_id: editing.id,
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
                  empleado_id: editing?.id || createdRecord?.id,
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
                  empleado_id: editing?.id || createdRecord?.id,
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
      const todayStr = getLocalDateString();
      const currentUserName = user?.full_name || user?.nombre || user?.email?.split('@')[0] || "Usuario";
      const emp = items.find((e) => e.id === bajaConfirmId);
      const prevList = emp?.historial_bajas ? emp.historial_bajas.split(",").map(s => s.trim()).filter(Boolean) : [];
      if (!prevList.includes(todayStr)) {
        prevList.push(todayStr);
      }
      const newHistorial = prevList.join(", ");

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
      const selectedDate = fechaReingresoInput || getLocalDateString();
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

  async function _handleOpenEmployeeFicha(emp) {
    if (!emp) return;
    const enrichedEmp = enrichEmpleadoWithMeta(emp);
    setFichaPreview(null);
    setFichaPreviewOpen(true);
    setGeneratingFicha(true);
    const hasReingreso = Boolean(
      enrichedEmp.fecha_reingreso && (!enrichedEmp.fecha_baja || enrichedEmp.fecha_reingreso >= enrichedEmp.fecha_baja)
    );
    const isBaja = Boolean(
      enrichedEmp.fecha_baja && (!enrichedEmp.fecha_reingreso || enrichedEmp.fecha_baja > enrichedEmp.fecha_reingreso)
    );
    const sedeObj = sedes.find((sede) => sede.id === (enrichedEmp.sede_id || defaultSedeId));
    const fechaEfectiva = isBaja
      ? enrichedEmp.fecha_baja
      : (hasReingreso ? enrichedEmp.fecha_reingreso : enrichedEmp.fecha_ingreso);

    try {
      const result = await generateFichaTecnicaPDF(
        enrichedEmp,
        {
          tipo_movimiento: isBaja ? "BAJA" : "ALTA",
          fecha_movimiento: fechaEfectiva || new Date().toISOString().slice(0, 10),
          servicio_capacita: enrichedEmp.servicio_ubicacion || "",
          dias_capacitacion: [enrichedEmp.dia_capacitacion, enrichedEmp.dia_capacitacion_2].filter(Boolean).join(" y ") || "3 días inducción RH",
          experiencia: enrichedEmp.experiencia || "",
          observaciones: enrichedEmp.observaciones || (isBaja && enrichedEmp.motivo_baja ? `Motivo de baja: ${enrichedEmp.motivo_baja}` : ""),
          sede_nombre: sedeObj?.nombre || "Monterrey",
        },
        { returnDoc: true }
      );
      setFichaPreview({
        ...result,
        title: `Ficha Técnica (${isBaja ? "BAJA" : "ALTA"}) - ${formatUserDisplayName(enrichedEmp.nombre_completo, user?.role)}`,
      });
    } catch (error) {
      console.error("Error al generar ficha técnica:", error);
      setFichaPreviewOpen(false);
      toast({
        title: "Error al generar ficha técnica",
        description: "No se pudo generar la ficha del empleado seleccionado.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFicha(false);
    }
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
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : sortedActivos.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No hay empleados activos</TableCell></TableRow>
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
                        <TableCell>{item.fecha_ingreso ? item.fecha_ingreso.slice(0, 10) : "—"}</TableCell>
                        <TableCell className="text-destructive font-semibold">{item.fecha_baja ? item.fecha_baja.slice(0, 10) : "—"}</TableCell>
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
                                    setFechaReingresoInput(getLocalDateString());
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
                            value="cubreturnos cubredescansos"
                            onSelect={() => {
                              setForm({ ...form, servicio_ubicacion: "Cubreturnos" });
                              setServiceComboboxOpen(false);
                            }}
                            className="cursor-pointer font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary",
                                form.servicio_ubicacion === "Cubreturnos" || form.servicio_ubicacion === "Cubredescansos"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Cubreturnos
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

              {/* UNIFORMES ASIGNADOS CON REGISTRO DE FECHA */}
              <div className="sm:col-span-2 p-4 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                      <Shirt className="w-4 h-4" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-foreground">
                        Uniformes y Equipo de Trabajo
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Selecciona prendas del inventario con registro de fecha de entrega
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 w-fit">
                    {uniformesList.length} prenda(s) asignada(s)
                  </Badge>
                </div>

                {/* Formulario para agregar prenda */}
                <div className="p-3 bg-background rounded-lg border shadow-2xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Prenda / Artículo */}
                    <div className="sm:col-span-4">
                      <Label className="text-[11px] font-semibold">Prenda / Artículo de Inventario *</Label>
                      <Select
                        value={newUniformeItem}
                        onValueChange={(val) => setNewUniformeItem(val)}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Seleccionar prenda..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {availableUniformeArticulos.map((art, idx) => (
                            <SelectItem key={idx} value={art}>
                              {art}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Talla / Medida */}
                    <div className="sm:col-span-3">
                      <Label className="text-[11px] font-semibold">Talla / Medida</Label>
                      <Select
                        value={newUniformeTalla}
                        onValueChange={setNewUniformeTalla}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Talla" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {availableTallasForSelected.map((t, idx) => (
                            <SelectItem key={idx} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cantidad */}
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] font-semibold">Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={newUniformeCantidad}
                        onChange={(e) => setNewUniformeCantidad(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>

                    {/* Fecha de Entrega */}
                    <div className="sm:col-span-3">
                      <Label className="text-[11px] font-semibold">Fecha de Entrega *</Label>
                      <Input
                        type="date"
                        value={newUniformeFecha}
                        onChange={(e) => setNewUniformeFecha(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddUniforme}
                      className="h-8 text-xs gap-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5" /> Asignar Prenda
                    </Button>
                  </div>
                </div>

                {/* Listado de uniformes actualmente asignados */}
                {uniformesList.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {uniformesList.map((uni) => (
                      <div
                        key={uni.id}
                        className="p-2.5 rounded-lg border bg-background flex items-center justify-between gap-3 text-xs shadow-2xs hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                            <Shirt className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{uni.articulo}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span className="bg-muted px-1.5 py-0.5 rounded font-medium text-foreground">
                                Talla: {uni.talla || "—"}
                              </span>
                              <span className="font-semibold text-primary">
                                {uni.cantidad} pza(s)
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                Entrega: {uni.fecha_entrega || "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemoveUniforme(uni.id)}
                          title="Eliminar prenda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-2">
                    No hay uniformes asignados todavía. Selecciona una prenda y fecha arriba para agregarla.
                  </p>
                )}
              </div>

              {/* EXPERIENCIA LABORAL / SEGURIDAD */}
              <div className="sm:col-span-2">
                <Label>Experiencia Laboral / Seguridad</Label>
                <Textarea
                  rows={2}
                  value={form.experiencia || ""}
                  placeholder="Detalla experiencia previa en seguridad o puestos anteriores..."
                  onChange={(e) =>
                    setForm({
                      ...form,
                      experiencia: e.target.value,
                    })
                  }
                />
              </div>

              {/* OBSERVACIONES GENERALES */}
              <div className="sm:col-span-2">
                <Label>Observaciones Generales</Label>
                <Textarea
                  rows={2}
                  value={form.observaciones || ""}
                  placeholder="Observaciones de ingreso, notas operativas o de RRHH..."
                  onChange={(e) =>
                    setForm({
                      ...form,
                      observaciones: e.target.value,
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
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* ENCABEZADO TIPO PERFIL / HERO */}
            <div className="p-4 sm:p-5 rounded-2xl border bg-card/90 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    {viewEmpleado?.foto_url ? (
                      <img
                        src={viewEmpleado.foto_url}
                        alt={viewEmpleado.nombre_completo}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-primary/20 shadow-md bg-background"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shadow-xs">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground truncate">
                        {formatUserDisplayName(viewEmpleado?.nombre_completo, user?.role)}
                      </h2>
                      {viewEmpleado?.numero_empleado && (
                        <Badge variant="outline" className="font-mono font-bold bg-muted/80 text-foreground border-border text-xs px-2 py-0.5">
                          #{viewEmpleado.numero_empleado}
                        </Badge>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-primary hover:bg-primary/10"
                          onClick={() => openEditNumero(viewEmpleado)}
                          title="Editar número de empleado"
                        >
                          <Pencil className="w-3 h-3 mr-1" /> Editar No.
                        </Button>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-primary shrink-0" />
                      {viewEmpleado?.puesto || "Personal Operativo"} · <Building2 className="w-3.5 h-3.5 text-primary shrink-0 ml-1" /> {sedeNombre(viewEmpleado?.sede_id)}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {/* Estado Activo / Baja */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          !viewEmpleado?.fecha_baja || (viewEmpleado?.fecha_reingreso && viewEmpleado?.fecha_reingreso >= viewEmpleado?.fecha_baja)
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {!viewEmpleado?.fecha_baja || (viewEmpleado?.fecha_reingreso && viewEmpleado?.fecha_reingreso >= viewEmpleado?.fecha_baja) ? "● Activo" : "● Baja"}
                      </span>

                      {viewEmpleado?.servicio_ubicacion && (
                        <span className="text-[11px] font-medium bg-muted px-2 py-0.5 rounded-full text-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {viewEmpleado.servicio_ubicacion}
                        </span>
                      )}

                      <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        ⏱️ {calcularDiasEnEmpresa(viewEmpleado?.fecha_ingreso, viewEmpleado?.fecha_baja, viewEmpleado?.fecha_reingreso)}
                      </span>

                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          viewEmpleado?.seguro
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        IMSS: {viewEmpleado?.seguro ? "Afiliado" : "Pendiente"}
                      </span>
                    </div>
                  </div>
                </div>

                {can("empleados", "edit") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1.5 self-end sm:self-center shrink-0"
                    onClick={() => {
                      const emp = viewEmpleado;
                      setViewEmpleado(null);
                      openEdit(emp);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar Empleado
                  </Button>
                )}
              </div>
            </div>

            {/* BARRA DE CONTROL PARA LA VISTA EN CASCADA */}
            <div className="flex items-center justify-between pb-1 border-b">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Información en Cascada
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={expandAllCascada}
                >
                  Expandir todo
                </Button>
                <span className="text-muted-foreground/40 text-xs">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={collapseAllCascada}
                >
                  Colapsar todo
                </Button>
              </div>
            </div>

            {/* SECCIONES EN CASCADA */}
            <div className="space-y-3">
              {/* 1. INFORMACIÓN GENERAL */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleCascada("general")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">1. Información General</h4>
                      <p className="text-[11px] text-muted-foreground">Datos básicos, puesto, sede y antigüedad</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                      {viewEmpleado?.puesto || "General"}
                    </Badge>
                    {cascadaOpen.general ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.general && (
                  <div className="p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">No. Empleado</Label>
                      <p className="text-xs sm:text-sm font-bold text-primary font-mono mt-0.5">
                        {viewEmpleado?.numero_empleado ? `#${viewEmpleado.numero_empleado}` : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Nombre Completo</Label>
                      <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5">
                        {formatUserDisplayName(viewEmpleado?.nombre_completo, user?.role) || "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Puesto</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.puesto || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Servicio Asignado</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.servicio_ubicacion || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Sede Operativa</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{sedeNombre(viewEmpleado?.sede_id)}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Fecha de Ingreso</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.fecha_ingreso || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Días en la Empresa</Label>
                      <p className="text-xs sm:text-sm font-bold text-primary mt-0.5">
                        {calcularDiasEnEmpresa(viewEmpleado?.fecha_ingreso, viewEmpleado?.fecha_baja, viewEmpleado?.fecha_reingreso)}
                      </p>
                    </div>
                    {viewEmpleado?.fecha_reingreso && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Fecha de Reingreso</Label>
                        <p className="text-xs sm:text-sm font-semibold text-emerald-600 mt-0.5">{viewEmpleado.fecha_reingreso}</p>
                      </div>
                    )}
                    {viewEmpleado?.fecha_baja && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Fecha de Baja</Label>
                        <p className="text-xs sm:text-sm font-semibold text-rose-600 mt-0.5">
                          {viewEmpleado.fecha_baja.slice(0, 10)}
                        </p>
                      </div>
                    )}
                    {viewEmpleado?.historial_bajas && viewEmpleado.historial_bajas.includes(",") && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Historial de Bajas Anteriores</Label>
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
                          {viewEmpleado.historial_bajas}
                        </p>
                      </div>
                    )}
                    {sedes.find((s) => s.id === viewEmpleado?.sede_id)?.nombre?.toLowerCase() === "monterrey" && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Hospedaje</Label>
                        <p className="text-xs sm:text-sm font-semibold mt-0.5">{viewEmpleado?.hospedaje ? "Sí" : "No"}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Seguro IMSS</Label>
                      <p className={`text-xs sm:text-sm font-bold mt-0.5 ${viewEmpleado?.seguro ? "text-emerald-600" : "text-amber-600"}`}>
                        {viewEmpleado?.seguro ? "Sí (Afiliado)" : "No"}
                      </p>
                    </div>

                    {(viewEmpleado?.fecha_baja || viewEmpleado?.motivo_baja) && (
                      <div className="col-span-full p-3 rounded-lg border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 mt-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Label className="text-xs font-bold text-rose-800 dark:text-rose-300">Motivo de la Baja</Label>
                          {can("empleados", "edit") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2 text-rose-700 border-rose-300 hover:bg-rose-100 dark:text-rose-300 dark:border-rose-800"
                              onClick={() => openEditMotivo(viewEmpleado)}
                            >
                              <Pencil className="w-3 h-3 mr-1" /> Editar motivo
                            </Button>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-rose-950 dark:text-rose-100 font-medium">
                          {viewEmpleado.motivo_baja || <span className="italic text-muted-foreground text-xs">Sin motivo especificado</span>}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. INFORMACIÓN LABORAL */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleCascada("laboral")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">2. Información Laboral</h4>
                      <p className="text-[11px] text-muted-foreground">Sueldo, capacitaciones y fechas operativas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cascadaOpen.laboral ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.laboral && (
                  <div className="p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Sueldo</Label>
                      <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5">
                        {viewEmpleado?.sueldo ? `$${viewEmpleado.sueldo}` : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Actas Administrativas</Label>
                      <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5">
                        {viewEmpleado?.actas_administrativas ?? 0}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Medio de Reclutamiento</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.medio_reclutamiento || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Día de Capacitación 1</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.dia_capacitacion || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Día de Capacitación 2</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.dia_capacitacion_2 || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Fecha de Montaje</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.fecha_montaje || "—"}</p>
                    </div>
                    <div className="col-span-full p-3 rounded-lg border bg-muted/30">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase">Experiencia Laboral / Seguridad</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5 whitespace-pre-wrap">
                        {viewEmpleado?.experiencia || <span className="italic text-muted-foreground text-xs">Sin experiencia registrada</span>}
                      </p>
                    </div>
                    <div className="col-span-full p-3 rounded-lg border bg-muted/30">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase">Observaciones Generales</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5 whitespace-pre-wrap">
                        {viewEmpleado?.observaciones || <span className="italic text-muted-foreground text-xs">Sin observaciones</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. UNIFORMES Y EQUIPO ASIGNADO CON REGISTRO DE FECHA */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all border-l-4 border-l-blue-500">
                <button
                  type="button"
                  onClick={() => toggleCascada("uniformes")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                      <Shirt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">3. Uniformes y Equipo Asignado</h4>
                      <p className="text-[11px] text-muted-foreground">Prendas entregadas del inventario con registro de fecha</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {parseUniformes(viewEmpleado?.uniformes).length} prenda(s)
                    </Badge>
                    {cascadaOpen.uniformes ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.uniformes && (
                  <div className="p-4 border-t border-border/60 bg-background/50 space-y-3">
                    {(() => {
                      const uList = parseUniformes(viewEmpleado?.uniformes);
                      if (uList.length === 0) {
                        return (
                          <div className="text-center py-4 space-y-2">
                            <Shirt className="w-8 h-8 mx-auto text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground italic">
                              No hay uniformes asignados en el registro de este empleado.
                            </p>
                            {can("empleados", "edit") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  const emp = viewEmpleado;
                                  setViewEmpleado(null);
                                  openEdit(emp);
                                }}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Asignar uniformes
                              </Button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {uList.map((u, i) => (
                              <div key={i} className="p-3 rounded-lg border bg-card flex flex-col justify-between gap-2 shadow-2xs">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                    <Shirt className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    {u.articulo}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] shrink-0 font-semibold bg-muted">
                                    {u.cantidad} pza(s)
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t">
                                  <span className="flex items-center gap-1 font-medium">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    {u.fecha_entrega || "—"}
                                  </span>
                                  <span className="font-medium text-foreground bg-muted/80 px-1.5 py-0.5 rounded text-[10px]">
                                    Talla: {u.talla || "—"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* 4. INFORMACIÓN PERSONAL */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleCascada("personal")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">4. Información Personal</h4>
                      <p className="text-[11px] text-muted-foreground">Datos personales, contacto y demográficos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cascadaOpen.personal ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.personal && (
                  <div className="p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Sexo</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.sexo || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Fecha de Nacimiento</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.fecha_nacimiento || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Edad</Label>
                      <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5">
                        {calcularEdad(viewEmpleado?.fecha_nacimiento)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Estado Civil</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.estado_civil || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Nivel de Estudios</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.nivel_estudios || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Teléfono</Label>
                      {viewEmpleado?.telefono ? (
                        <a href={`tel:${viewEmpleado.telefono}`} className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {viewEmpleado.telefono}
                        </a>
                      ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">—</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Email</Label>
                      {viewEmpleado?.email ? (
                        <a href={`mailto:${viewEmpleado.email}`} className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 mt-0.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" /> {viewEmpleado.email}
                        </a>
                      ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">—</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. DOCUMENTACIÓN Y DATOS FISCALES */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleCascada("documentacion")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">5. Documentación y Datos Fiscales</h4>
                      <p className="text-[11px] text-muted-foreground">CURP, RFC, NSS, banco y beneficiario</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cascadaOpen.documentacion ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.documentacion && (
                  <div className="p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">CURP</Label>
                      <p className="text-xs sm:text-sm font-mono font-semibold text-foreground mt-0.5">{viewEmpleado?.curp || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">RFC</Label>
                      <p className="text-xs sm:text-sm font-mono font-semibold text-foreground mt-0.5">{viewEmpleado?.rfc || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">NSS (IMSS)</Label>
                      <p className="text-xs sm:text-sm font-mono font-semibold text-foreground mt-0.5">{viewEmpleado?.nss || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Infonavit</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.infonavit || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Banco</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.banco || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">CLABE Bancaria</Label>
                      <p className="text-xs sm:text-sm font-mono text-foreground mt-0.5">{viewEmpleado?.clabe_bancaria || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Cartilla Militar</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.carta_militar || "No"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Beneficiario</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.beneficiario || "—"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. DOMICILIO */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleCascada("domicilio")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">6. Domicilio</h4>
                      <p className="text-[11px] text-muted-foreground">Dirección residencial y zona geográfica</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cascadaOpen.domicilio ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.domicilio && (
                  <div className="p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Calle</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.calle || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Número</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.numero || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Colonia</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.colonia || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Código Postal</Label>
                      <p className="text-xs sm:text-sm font-mono text-foreground mt-0.5">{viewEmpleado?.codigo_postal || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Ciudad</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.ciudad || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Zona</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.zona || "—"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 7. CONTACTO DE EMERGENCIA */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleCascada("emergencia")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">7. Contacto de Emergencia</h4>
                      <p className="text-[11px] text-muted-foreground">Persona a notificar en situaciones de urgencia</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cascadaOpen.emergencia ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.emergencia && (
                  <div className="p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Nombre de Contacto</Label>
                      <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5">{viewEmpleado?.contacto_emergencia || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Teléfono de Emergencia</Label>
                      {viewEmpleado?.telefono_emergencia ? (
                        <a href={`tel:${viewEmpleado.telefono_emergencia}`} className="text-xs sm:text-sm font-bold text-red-600 hover:underline flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {viewEmpleado.telefono_emergencia}
                        </a>
                      ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">—</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Parentesco</Label>
                      <p className="text-xs sm:text-sm text-foreground mt-0.5">{viewEmpleado?.parentesco || "—"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 8. REFERENCIAS */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-2xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleCascada("referencias")}
                  className="w-full p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">8. Referencias</h4>
                      <p className="text-[11px] text-muted-foreground">Referencias laborales o personales registradas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cascadaOpen.referencias ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {cascadaOpen.referencias && (
                  <div className="p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Referencia</Label>
                      <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5">{viewEmpleado?.referencia || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Teléfono de Referencia</Label>
                      {viewEmpleado?.referencia_telefono ? (
                        <a href={`tel:${viewEmpleado.referencia_telefono}`} className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {viewEmpleado.referencia_telefono}
                        </a>
                      ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">—</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter className="gap-2 pt-2 border-t">
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
                    const id = viewEmpleado.id;
                    setViewEmpleado(null);
                    setDeleteId(id);
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
                    const emp = viewEmpleado;
                    setViewEmpleado(null);
                    openEdit(emp);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}

              <Button
                variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300"
                onClick={() => {
                  const emp = viewEmpleado;
                  setViewEmpleado(null);
                  _handleOpenEmployeeFicha(emp);
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Ficha Técnica
              </Button>

              <Button onClick={() => setViewEmpleado(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      <Dialog
        open={fichaPreviewOpen}
        onOpenChange={(open) => {
          setFichaPreviewOpen(open);
          if (!open) {
            if (fichaPreview?.blobUrl) URL.revokeObjectURL(fichaPreview.blobUrl);
            setFichaPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-2 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <DialogTitle className="text-base sm:text-lg font-bold truncate">
                {fichaPreview?.title || "Ficha Técnica del Empleado"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {generatingFicha ? "Generando ficha técnica..." : "Vista previa del empleado seleccionado."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full my-2 bg-muted/30 rounded-lg overflow-hidden border border-border min-h-[400px]">
            {fichaPreview?.blobUrl ? (
              <iframe src={fichaPreview.blobUrl} className="w-full h-full border-0" title={fichaPreview.title} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                Generando ficha técnica...
              </div>
            )}
          </div>
          <DialogFooter className="pt-2 border-t border-border flex flex-row items-center justify-between gap-2 w-full">
            <Button variant="outline" onClick={() => setFichaPreviewOpen(false)}>Cerrar</Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={!fichaPreview?.blobUrl}
                onClick={() => fichaPreview?.blobUrl && window.open(fichaPreview.blobUrl, "_blank")}
              >
                Imprimir
              </Button>
              <Button
                disabled={!fichaPreview?.doc || !fichaPreview?.filename}
                onClick={() => fichaPreview?.doc?.save(fichaPreview.filename)}
              >
                <Download className="w-4 h-4 mr-1.5" />
                Descargar PDF
              </Button>
            </div>
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
            setFechaReingresoInput(getLocalDateString());
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