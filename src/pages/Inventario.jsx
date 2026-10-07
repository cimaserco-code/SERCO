import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import {
  Plus,
  Trash2,
  Search,
  ClipboardList,
  Check,
  X,
  DollarSign,
  Package,
  PackageCheck,
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Palette,
  LayoutGrid,
  List,
  Layers
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSedeScope } from "@/hooks/useSedeScope";
import SedeSelector from "@/components/SedeSelector";
import { usePermissions } from "@/lib/PermissionsContext";
import { useAuth } from "@/lib/AuthContext";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const emptyForm = {
  nombre: "",
  categoria: "Uniforme",
  cantidad: "",
  precio_unitario: "",
  descripcion: "",
  ubicacion: "",
  sede_id: ""
};

export default function Inventario() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { sedeFilter, defaultSedeId, userSedeIds } = useSedeScope();
  const { canView, can, isAdmin } = usePermissions();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Inventory Item Create/Edit Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formVariantes, setFormVariantes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState("Uniforme");

  // Requests Sub-tab ("pedidos" vs "compras")
  const [solicitudesTab, setSolicitudesTab] = useState("pedidos");
  const [solicitudSearch, setSolicitudSearch] = useState("");
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [purchasePriceEdits, setPurchasePriceEdits] = useState(/** @type {Record<string, string | number>} */ ({}));

  // New Solicitar Modal States
  const [solicitarModalOpen, setSolicitarModalOpen] = useState(false);
  const [isCompra, setIsCompra] = useState(false);
  const [solicitudServicioId, setSolicitudServicioId] = useState("");
  const [solicitudSedeId, setSolicitudSedeId] = useState("");
  const [solicitudComentarios, setSolicitudComentarios] = useState("");
  const [articulosList, setArticulosList] = useState([]);
  const [solicitudError, setSolicitudError] = useState("");

  // Sub-form for adding an article to the request
  const [compraModoNuevo, setCompraModoNuevo] = useState(false);
  const [busquedaArticulo, setBusquedaArticulo] = useState("");
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [inputNombreNuevo, setInputNombreNuevo] = useState("");
  const [inputColor, setInputColor] = useState("");
  const [inputTalla, setInputTalla] = useState("");
  const [inputCantidad, setInputCantidad] = useState("1");
  const [inputPrecioUnitario, setInputPrecioUnitario] = useState("");

  // User Role checks: visibilidad de montos financieros exclusiva para finanzas, admin y ceo
  const userRole = (user?.role || "").toLowerCase().trim();
  const canViewMonto = Boolean(
    isAdmin ||
    [
      "admin",
      "administrador",
      "super administrador",
      "superadmin",
      "finanzas",
      "dueño",
      "dueno",
      "owner",
      "ceo",
      "director general",
      "director_general",
      "director"
    ].includes(userRole)
  );

  const canEditPurchasePrice = userRole === "finanzas";
  const canApproveCompra = Boolean(
    isAdmin ||
    [
      "admin",
      "administrador",
      "super administrador",
      "superadmin",
      "dueño",
      "dueno",
      "owner",
      "ceo",
      "director general",
      "director_general",
      "director"
    ].includes(userRole)
  );

  const canViewAllSolicitudes = Boolean(
    isAdmin ||
    [
      "admin",
      "administrador",
      "super administrador",
      "dueño",
      "dueno",
      "owner",
      "finanzas",
      "ceo",
      "director general",
      "director_general",
      "director"
    ].includes(userRole)
  );

  useEffect(() => {
    load();
  }, [sedeFilter]);

  async function load() {
    setLoading(true);
    try {
      const [data, vars, s, sols, servs] = await Promise.all([
        sercoApi.entities.InventarioItem.filter(sedeFilter, "-created_date").catch(() => []),
        sercoApi.entities.InventarioVariante.list("-created_date").catch(() => []),
        sercoApi.entities.Sede.list().catch(() => []),
        sercoApi.entities.SolicitudInventario.list("-created_at").catch(() => []),
        sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
      ]);

      setItems(data || []);
      setVariantes(vars || []);
      setSedes(s || []);
      setSolicitudes(sols || []);
      setServicios(servs || []);
    } finally {
      setLoading(false);
    }
  }

  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const getDisplayCantidad = (item) => {
    if (!item) return 0;
    if (item.categoria === "Uniforme") {
      const itemVars = (variantes || []).filter((v) => v && v.inventario_item_id === item.id);
      if (itemVars.length > 0) {
        return itemVars.reduce((sum, v) => sum + (Number(v.cantidad) || 0), 0);
      }
    }
    return Number(item.cantidad) || 0;
  };

  // ── Totales Invertidos ──
  const totalInvertidoGlobal = useMemo(() => {
    return (items || []).reduce((acc, item) => {
      if (!item) return acc;
      const qty = getDisplayCantidad(item);
      const price = Number(item.precio_unitario || item.precio_por_unidad || 0);
      return acc + (qty * price);
    }, 0);
  }, [items, variantes]);

  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => {
      if (!item) return false;
      return (
        (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.categoria || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.ubicacion || "").toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [items, search]);

  const tabFiltered = useMemo(() => {
    return (filteredItems || []).filter((item) => {
      if (!item) return false;
      const cat = (item.categoria || "").toLowerCase();
      if (activeCategoryTab === "Uniforme") return cat.includes("uniforme");
      if (activeCategoryTab === "Papelería") return cat.includes("papeler");
      return !cat.includes("uniforme") && !cat.includes("papeler");
    });
  }, [filteredItems, activeCategoryTab]);

  const totalInvertidoCategoria = useMemo(() => {
    return (tabFiltered || []).reduce((acc, item) => {
      if (!item) return acc;
      const qty = getDisplayCantidad(item);
      const price = Number(item.precio_unitario || item.precio_por_unidad || 0);
      return acc + (qty * price);
    }, 0);
  }, [tabFiltered, variantes]);

  // ── PRENDAS DE UNIFORMES ACOMODADAS POR COLOR (TASK 2) ──
  const [selectedColorFilter, setSelectedColorFilter] = useState("todos");
  const [uniformViewMode, setUniformViewMode] = useState("agrupado"); // 'agrupado' | 'lista'

  const getColorStyle = (colorName = "") => {
    const c = (colorName || "").toLowerCase().trim();
    if (c.includes("azul") || c.includes("marino") || c.includes("navy")) {
      return {
        dot: "bg-blue-900 border-blue-950",
        badge: "bg-blue-900/10 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
        cardBorder: "border-blue-200 dark:border-blue-900/60",
        headerBg: "bg-blue-50/70 dark:bg-blue-950/30",
        label: "Azul Marino",
      };
    }
    if (c.includes("negro") || c.includes("black")) {
      return {
        dot: "bg-slate-900 border-slate-700",
        badge: "bg-slate-900/10 text-slate-900 border-slate-300 dark:bg-slate-900/80 dark:text-slate-100 dark:border-slate-700",
        cardBorder: "border-slate-300 dark:border-slate-800",
        headerBg: "bg-slate-100/70 dark:bg-slate-900/40",
        label: "Negro",
      };
    }
    if (c.includes("blanco") || c.includes("white")) {
      return {
        dot: "bg-white border-2 border-slate-400",
        badge: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
        cardBorder: "border-slate-200 dark:border-slate-800",
        headerBg: "bg-slate-50 dark:bg-slate-900/20",
        label: "Blanco",
      };
    }
    if (c.includes("caqui") || c.includes("beige") || c.includes("khaki") || c.includes("arena")) {
      return {
        dot: "bg-amber-600 border-amber-700",
        badge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
        cardBorder: "border-amber-200 dark:border-amber-900/60",
        headerBg: "bg-amber-50/70 dark:bg-amber-950/30",
        label: "Caqui / Beige",
      };
    }
    if (c.includes("gris") || c.includes("gray") || c.includes("grey") || c.includes("oxford")) {
      return {
        dot: "bg-slate-500 border-slate-600",
        badge: "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
        cardBorder: "border-slate-200 dark:border-slate-800",
        headerBg: "bg-slate-100/60 dark:bg-slate-900/30",
        label: "Gris",
      };
    }
    if (c.includes("verde") || c.includes("olivo") || c.includes("green")) {
      return {
        dot: "bg-emerald-700 border-emerald-800",
        badge: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800",
        cardBorder: "border-emerald-200 dark:border-emerald-900/60",
        headerBg: "bg-emerald-50/70 dark:bg-emerald-950/30",
        label: "Verde Olivo",
      };
    }
    if (c.includes("rojo") || c.includes("vino") || c.includes("red") || c.includes("guinda")) {
      return {
        dot: "bg-rose-700 border-rose-800",
        badge: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800",
        cardBorder: "border-rose-200 dark:border-rose-900/60",
        headerBg: "bg-rose-50/70 dark:bg-rose-950/30",
        label: "Rojo / Vino",
      };
    }
    return {
      dot: "bg-primary border-primary/50",
      badge: "bg-primary/10 text-primary border-primary/20",
      cardBorder: "border-border",
      headerBg: "bg-muted/40",
      label: colorName || "Sin color asignado",
    };
  };

  const prendasPorColor = useMemo(() => {
    if (activeCategoryTab !== "Uniforme") return [];

    const colorGroupsMap = new Map();

    const getOrCreateGroup = (rawColor) => {
      const trimmed = (rawColor || "").trim();
      const colorName = trimmed ? trimmed : "Sin color asignado";
      const key = colorName.toLowerCase();

      if (!colorGroupsMap.has(key)) {
        colorGroupsMap.set(key, {
          key,
          colorName,
          totalPiezas: 0,
          totalInvertido: 0,
          prendas: []
        });
      }
      return colorGroupsMap.get(key);
    };

    (tabFiltered || []).forEach((item) => {
      const itemVars = (variantes || []).filter((v) => v && v.inventario_item_id === item.id);
      const unitPrice = Number(item.precio_unitario || item.precio_por_unidad || 0);

      if (itemVars.length > 0) {
        const varsByColor = new Map();
        itemVars.forEach((v) => {
          const cName = (v.color || "").trim() || "Sin color asignado";
          const cKey = cName.toLowerCase();
          if (!varsByColor.has(cKey)) {
            varsByColor.set(cKey, { colorName: cName, variants: [] });
          }
          varsByColor.get(cKey).variants.push(v);
        });

        varsByColor.forEach(({ colorName, variants }) => {
          const colorTotalQty = variants.reduce((sum, v) => sum + (Number(v.cantidad) || 0), 0);
          const colorInvertido = colorTotalQty * unitPrice;

          const group = getOrCreateGroup(colorName);
          group.totalPiezas += colorTotalQty;
          group.totalInvertido += colorInvertido;

          const tallasMap = new Map();
          variants.forEach((v) => {
            const t = (v.talla || "Única").trim();
            const qty = Number(v.cantidad) || 0;
            tallasMap.set(t, (tallasMap.get(t) || 0) + qty);
          });

          const tallasList = Array.from(tallasMap.entries()).map(([talla, cantidad]) => ({
            talla,
            cantidad,
          }));

          group.prendas.push({
            item,
            colorName,
            tallas: tallasList,
            totalPiezas: colorTotalQty,
            precioUnitario: unitPrice,
            subtotalInvertido: colorInvertido,
          });
        });
      } else {
        const itemQty = Number(item.cantidad) || 0;
        const colorInvertido = itemQty * unitPrice;
        let detectedColor = "Sin color asignado";

        const nLower = (item.nombre || "").toLowerCase();
        if (nLower.includes("azul") || nLower.includes("marino")) detectedColor = "Azul Marino";
        else if (nLower.includes("negro")) detectedColor = "Negro";
        else if (nLower.includes("blanco")) detectedColor = "Blanco";
        else if (nLower.includes("caqui") || nLower.includes("beige")) detectedColor = "Caqui";
        else if (nLower.includes("gris") || nLower.includes("oxford")) detectedColor = "Gris";
        else if (nLower.includes("verde") || nLower.includes("olivo")) detectedColor = "Verde Olivo";

        const group = getOrCreateGroup(detectedColor);
        group.totalPiezas += itemQty;
        group.totalInvertido += colorInvertido;
        group.prendas.push({
          item,
          colorName: detectedColor,
          tallas: [{ talla: "General", cantidad: itemQty }],
          totalPiezas: itemQty,
          precioUnitario: unitPrice,
          subtotalInvertido: colorInvertido,
        });
      }
    });

    const priority = ["azul marino", "negro", "blanco", "caqui", "beige", "gris", "verde", "rojo", "sin color asignado"];
    const groups = Array.from(colorGroupsMap.values());
    groups.sort((a, b) => {
      const idxA = priority.findIndex((p) => a.key.includes(p));
      const idxB = priority.findIndex((p) => b.key.includes(p));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.colorName.localeCompare(b.colorName);
    });

    return groups;
  }, [tabFiltered, variantes, activeCategoryTab]);

  const availableUniformColors = useMemo(() => {
    return (prendasPorColor || []).map((g) => ({
      key: g.key,
      name: g.colorName,
      totalPiezas: g.totalPiezas,
      prendasCount: g.prendas.length,
    }));
  }, [prendasPorColor]);

  const filteredColorGroups = useMemo(() => {
    if (selectedColorFilter === "todos") return prendasPorColor;
    return (prendasPorColor || []).filter((g) => g.key === selectedColorFilter);
  }, [prendasPorColor, selectedColorFilter]);

  const flatPrendasSorted = useMemo(() => {
    if (activeCategoryTab !== "Uniforme") return [];
    const list = [];
    (prendasPorColor || []).forEach((g) => {
      g.prendas.forEach((p) => {
        list.push({ ...p, colorGroupKey: g.key });
      });
    });
    return list.sort((a, b) => {
      const cComp = (a.colorName || "").localeCompare(b.colorName || "");
      if (cComp !== 0) return cComp;
      return (a.item?.nombre || "").localeCompare(b.item?.nombre || "");
    });
  }, [prendasPorColor, activeCategoryTab]);

  // ── Parse Solicitud Articulos helper (backward compatible) ──
  const getSolicitudArticulos = (sol) => {
    if (!sol) return [];
    if (Array.isArray(sol.articulos) && sol.articulos.length > 0) {
      return sol.articulos;
    }
    // Check if comments contains metadata JSON
    if (sol.comentarios && sol.comentarios.includes("__META_ARTICULOS__:")) {
      try {
        const parts = sol.comentarios.split("__META_ARTICULOS__:");
        const parsed = JSON.parse(parts[1].replace(/\s*__TIPO_COMPRA__.*/, "").trim());
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return [
      {
        id: "1",
        inventario_item_id: sol.inventario_item_id || null,
        nombre: sol.item_nombre || "Artículo sin especificar",
        cantidad: Number(sol.cantidad) || 1,
        precio_unitario: sol.costo ? Number(sol.costo) / (Number(sol.cantidad) || 1) : null,
        subtotal: sol.costo ? Number(sol.costo) : null
      }
    ];
  };

  const getCleanComentarios = (comentarios) => {
    if (!comentarios) return "";
    if (comentarios.includes("__META_ARTICULOS__:")) {
      return comentarios.split("__META_ARTICULOS__:")[0].trim();
    }
    return comentarios;
  };

  /** @param {Array<Record<string, any>> | null | undefined} articulos */
  const getCompraTotal = (articulos) => {
    if (!articulos?.length) return null;
    let total = 0;
    for (const articulo of articulos) {
      const precio = articulo?.precio_unitario;
      if (precio === null || precio === undefined || precio === "" || !Number.isFinite(Number(precio))) {
        return null;
      }
      total += (Number(articulo.cantidad) || 0) * Number(precio);
    }
    return total;
  };

  /** @param {Record<string, any> | null | undefined} sol */
  const getSolicitudCompraTotal = (sol) => {
    const calculatedTotal = getCompraTotal(getSolicitudArticulos(sol));
    if (calculatedTotal != null) return calculatedTotal;
    const historicalTotal = Number(sol?.costo);
    return historicalTotal > 0 ? historicalTotal : null;
  };

  /** @param {Record<string, any> | null | undefined} sol */
  const solicitudEsPropia = (sol) => {
    if (!sol) return false;
    const myId = user?.id;
    const myEmail = (user?.email || "").toLowerCase();
    const myName = (user?.full_name || user?.nombre || "").toLowerCase();
    return Boolean(
      (myId && sol.solicitante_id === myId) ||
      (myEmail && (sol.solicitante_email || "").toLowerCase() === myEmail) ||
      (myName && (sol.solicitante_nombre || "").toLowerCase() === myName)
    );
  };

  /** @param {string} comentarios @param {Array<Record<string, any>>} articulos @param {boolean} isCompra */
  const getComentariosConArticulos = (comentarios, articulos, isCompra) => {
    const cleanComentarios = getCleanComentarios(comentarios);
    const metaTag = `__META_ARTICULOS__:${JSON.stringify(articulos)}${isCompra ? " __TIPO_COMPRA__" : ""}`;
    return [cleanComentarios, metaTag].filter(Boolean).join("\n\n");
  };

  const isCompraSolicitud = (sol) => {
    if (!sol) return false;
    if (sol.tipo === "compra") return true;
    if (sol.tipo === "pedido") return false;
    if (sol.comentarios && sol.comentarios.includes("__TIPO_COMPRA__")) return true;
    if (Number(sol.costo || 0) > 0) return true;
    return false;
  };

  // ── Filtered Solicitudes (Permissions + Search) ──
  const visibleSolicitudes = useMemo(() => {
    return (solicitudes || []).filter((sol) => {
      if (!sol) return false;
      if (userSedeIds?.length > 0 && sol.sede_id && !userSedeIds.includes(sol.sede_id)) {
        return false;
      }

      if (!canViewAllSolicitudes) {
        const myId = user?.id;
        const myEmail = (user?.email || "").toLowerCase();
        const myName = (user?.full_name || user?.nombre || "").toLowerCase();
        const solId = sol.solicitante_id;
        const solEmail = (sol.solicitante_email || "").toLowerCase();
        const solName = (sol.solicitante_nombre || "").toLowerCase();

        const isMine =
          (myId && solId === myId) ||
          (myEmail && solEmail && solEmail === myEmail) ||
          (myName && solName && solName === myName) ||
          (myEmail && solName && solName.includes(myEmail));

        if (!isMine) return false;
      }

      if (solicitudSearch) {
        const q = solicitudSearch.toLowerCase();
        const arts = getSolicitudArticulos(sol);
        const matchArt = arts.some((a) => (a?.nombre || "").toLowerCase().includes(q));
        const matchSol =
          (sol.item_nombre || "").toLowerCase().includes(q) ||
          (sol.solicitante_nombre || "").toLowerCase().includes(q) ||
          (sol.servicio_nombre || "").toLowerCase().includes(q) ||
          (sol.comentarios || "").toLowerCase().includes(q);

        return matchArt || matchSol;
      }

      return true;
    });
  }, [solicitudes, userSedeIds, canViewAllSolicitudes, user, solicitudSearch]);

  useEffect(() => {
    const solicitudId = searchParams.get("solicitud");
    if (!solicitudId || loading) return;
    const solicitud = visibleSolicitudes.find((item) => item.id === solicitudId);
    if (!solicitud) return;

    setActiveCategoryTab("Solicitudes");
    setSolicitudesTab(isCompraSolicitud(solicitud) ? "compras" : "pedidos");
    setSelectedSolicitud(solicitud);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("solicitud");
    setSearchParams(nextParams, { replace: true });
  }, [isCompraSolicitud, loading, searchParams, setSearchParams, visibleSolicitudes]);

  const pedidosList = useMemo(() => {
    return (visibleSolicitudes || []).filter((s) => !isCompraSolicitud(s));
  }, [visibleSolicitudes]);

  const comprasList = useMemo(() => {
    return (visibleSolicitudes || []).filter((s) => isCompraSolicitud(s));
  }, [visibleSolicitudes]);

  // ── Inventory Item CRUD ──
  function openCreate() {
    setEditing(null);
    const defaultCategoria = activeCategoryTab === "Solicitudes" ? "Uniforme" : activeCategoryTab;
    setForm({
      ...emptyForm,
      sede_id: defaultSedeId || (sedes[0]?.id || ""),
      categoria: defaultCategoria,
      precio_unitario: ""
    });
    setFormVariantes([]);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      ...emptyForm,
      ...item,
      cantidad: item.cantidad ?? "",
      precio_unitario: item.precio_unitario ?? item.precio_por_unidad ?? ""
    });

    const itemVariantes = variantes
      .filter((v) => v.inventario_item_id === item.id)
      .map((v) => ({
        id: v.id,
        color: v.color || "",
        talla: v.talla || "",
        cantidad: v.cantidad ?? "",
      }));

    setFormVariantes(itemVariantes);
    setModalOpen(true);
  }

  function agregarVariante() {
    setFormVariantes([...formVariantes, { color: "", talla: "", cantidad: "" }]);
  }

  function actualizarVariante(index, campo, valor) {
    const nuevasVariantes = [...formVariantes];
    nuevasVariantes[index] = { ...nuevasVariantes[index], [campo]: valor };
    setFormVariantes(nuevasVariantes);
  }

  function eliminarVariante(index) {
    setFormVariantes(formVariantes.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const isUniforme = form.categoria === "Uniforme";
      const totalVariantQty =
        isUniforme && formVariantes.length > 0
          ? formVariantes.reduce((sum, v) => sum + (v.cantidad === "" ? 0 : Number(v.cantidad)), 0)
          : null;

      const precioUnitario = form.precio_unitario === "" ? 0 : Number(form.precio_unitario) || 0;

      const payload = {
        ...form,
        precio_unitario: precioUnitario,
        cantidad: totalVariantQty !== null ? totalVariantQty : (form.cantidad === "" ? 0 : Number(form.cantidad)),
      };

      let itemGuardado;
      try {
        if (editing) {
          itemGuardado = await sercoApi.entities.InventarioItem.update(editing.id, payload);
          await Promise.all(
            variantes
              .filter((v) => v.inventario_item_id === editing.id)
              .map((v) => sercoApi.entities.InventarioVariante.delete(v.id))
          );
        } else {
          itemGuardado = await sercoApi.entities.InventarioItem.create(payload);
        }
      } catch (err) {
        if (err?.message?.includes("precio_unitario") || err?.message?.includes("PGRST204")) {
          const { precio_unitario: _unused_precio, ...fallbackPayload } = payload;
          if (editing) {
            itemGuardado = await sercoApi.entities.InventarioItem.update(editing.id, fallbackPayload);
          } else {
            itemGuardado = await sercoApi.entities.InventarioItem.create(fallbackPayload);
          }
        } else {
          throw err;
        }
      }

      if (form.categoria === "Uniforme" && formVariantes.length > 0 && itemGuardado) {
        const variantesValidas = formVariantes.filter((v) => v.color || v.talla || v.cantidad !== "");
        await Promise.all(
          variantesValidas.map((v) =>
            sercoApi.entities.InventarioVariante.create({
              inventario_item_id: itemGuardado.id,
              color: v.color || null,
              talla: v.talla || null,
              cantidad: v.cantidad === "" ? 0 : Number(v.cantidad),
            })
          )
        );
      }

      setModalOpen(false);
      setFormVariantes([]);
      await load();
      toast({ title: "Artículo guardado exitosamente" });
    } catch (e) {
      console.error("Error al guardar artículo:", e);
      toast({
        title: "Error al guardar",
        description: e?.message || "No se pudo guardar el artículo.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await sercoApi.entities.InventarioItem.delete(deleteId);
      setDeleteId(null);
      await load();
      toast({ title: "Artículo eliminado" });
    } catch (e) {
      toast({
        title: "Error al eliminar",
        description: e?.message || "No se pudo eliminar el artículo",
        variant: "destructive"
      });
    }
  }

  // ── Solicitar Flow ──
  const openSolicitar = () => {
    setSolicitudError("");
    setIsCompra(false);
    setCompraModoNuevo(false);
    setSolicitudServicioId("");
    setSolicitudSedeId(defaultSedeId || (sedes[0]?.id || ""));
    setSolicitudComentarios("");
    setArticulosList([]);
    resetSubFormArticulo();
    setSolicitarModalOpen(true);
  };

  const resetSubFormArticulo = () => {
    setBusquedaArticulo("");
    setArticuloSeleccionado(null);
    setInputNombreNuevo("");
    setInputColor("");
    setInputTalla("");
    setInputCantidad("1");
    setInputPrecioUnitario("");
  };

  // Filtered available items for the search dropdown
  const articulosBuscados = useMemo(() => {
    if (!busquedaArticulo.trim()) return [];
    const q = busquedaArticulo.toLowerCase().trim();
    return items
      .filter((i) => (i.nombre || "").toLowerCase().includes(q) || (i.categoria || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, busquedaArticulo]);

  const handleSeleccionarArticuloExistente = (art) => {
    setArticuloSeleccionado(art);
    setBusquedaArticulo(art.nombre);
    setInputColor("");
    setInputTalla("");
    setInputCantidad("1");

    // Only expose the registered inventory price to financial roles.
    if (isCompra) {
      const p = art.precio_unitario ?? art.precio_por_unidad;
      setInputPrecioUnitario(canViewMonto && p != null ? String(p) : "");
    }
  };

  const handleAgregarArticuloALista = () => {
    setSolicitudError("");
    const qty = Number(inputCantidad);
    if (!qty || qty <= 0) {
      setSolicitudError("Ingresa una cantidad válida mayor a 0.");
      return;
    }

    if (!isCompra) {
      // ── MODO PEDIDO: Requiere artículo existente
      if (!articuloSeleccionado) {
        setSolicitudError("Selecciona un artículo disponible del inventario.");
        return;
      }

      const isUniforme = articuloSeleccionado.categoria === "Uniforme";
      if (isUniforme) {
        if (!inputColor || !inputTalla) {
          setSolicitudError("Selecciona el color y la talla del uniforme.");
          return;
        }

        const variant = variantes.find(
          (v) =>
            v.inventario_item_id === articuloSeleccionado.id &&
            v.color === inputColor &&
            v.talla === inputTalla
        );

        const stockDisponible = Number(variant?.cantidad) || 0;
        if (stockDisponible <= 0) {
          setSolicitudError(`No hay existencias disponibles para ${articuloSeleccionado.nombre} (${inputColor}, Talla ${inputTalla}).`);
          return;
        }

        if (qty > stockDisponible) {
          setSolicitudError(`Solo hay ${stockDisponible} unidad(es) disponibles en inventario.`);
          return;
        }
      } else {
        const stockActual = Number(articuloSeleccionado.cantidad) || 0;
        if (stockActual <= 0) {
          setSolicitudError(`El artículo "${articuloSeleccionado.nombre}" no tiene existencias.`);
          return;
        }
        if (qty > stockActual) {
          setSolicitudError(`Solo hay ${stockActual} unidad(es) disponibles de "${articuloSeleccionado.nombre}".`);
          return;
        }
      }

      const nombreCompleto = isUniforme
        ? `${articuloSeleccionado.nombre} - ${inputColor} (Talla ${inputTalla})`
        : articuloSeleccionado.nombre;

      setArticulosList((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2, 9),
          inventario_item_id: articuloSeleccionado.id,
          nombre: nombreCompleto,
          nombre_base: articuloSeleccionado.nombre,
          categoria: articuloSeleccionado.categoria,
          color: inputColor || null,
          talla: inputTalla || null,
          cantidad: qty,
          precio_unitario: null,
          subtotal: null,
        },
      ]);
      resetSubFormArticulo();
    } else {
      // ── MODO COMPRA: Puede ser existente (sin stock o reabastecimiento) o nuevo no registrado
      let nombreItem = "";
      let itemId = null;
      let precioUnit = null;

      if (compraModoNuevo) {
        if (!inputNombreNuevo.trim()) {
          setSolicitudError("Ingresa el nombre del artículo a comprar.");
          return;
        }
        nombreItem = inputNombreNuevo.trim();
        if (inputColor || inputTalla) {
          nombreItem += ` ${[inputColor, inputTalla && `Talla ${inputTalla}`].filter(Boolean).join(" - ")}`;
        }
        if (inputPrecioUnitario.trim() !== "") {
          precioUnit = Number(inputPrecioUnitario);
          if (!Number.isFinite(precioUnit) || precioUnit < 0) {
            setSolicitudError("Ingresa un precio unitario válido o déjalo pendiente de cotizar.");
            return;
          }
        }
      } else {
        if (!articuloSeleccionado) {
          setSolicitudError("Selecciona un artículo registrado o activa la opción de material nuevo.");
          return;
        }
        itemId = articuloSeleccionado.id;
        const isUniforme = articuloSeleccionado.categoria === "Uniforme";
        nombreItem = isUniforme && (inputColor || inputTalla)
          ? `${articuloSeleccionado.nombre} - ${inputColor || ""} (Talla ${inputTalla || ""})`.trim()
          : articuloSeleccionado.nombre;

        const precioInventario = articuloSeleccionado.precio_unitario ?? articuloSeleccionado.precio_por_unidad;
        if (canViewMonto && inputPrecioUnitario.trim() !== "") {
          precioUnit = Number(inputPrecioUnitario);
          if (!Number.isFinite(precioUnit) || precioUnit < 0) {
            setSolicitudError("Ingresa un precio unitario válido o déjalo pendiente de cotizar.");
            return;
          }
        } else if (precioInventario != null && precioInventario !== "") {
          precioUnit = Number(precioInventario);
        }
      }

      setArticulosList((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2, 9),
          inventario_item_id: itemId,
          nombre: nombreItem,
          nombre_base: compraModoNuevo ? inputNombreNuevo : (articuloSeleccionado?.nombre || nombreItem),
          categoria: articuloSeleccionado?.categoria || "Compra",
          color: inputColor || null,
          talla: inputTalla || null,
          cantidad: qty,
          precio_unitario: precioUnit,
          subtotal: precioUnit == null ? null : qty * precioUnit,
        },
      ]);
      resetSubFormArticulo();
    }
  };

  const handleQuitarArticuloDeLista = (id) => {
    setArticulosList((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveSolicitud = async () => {
    if (articulosList.length === 0) {
      setSolicitudError("Agrega al menos un artículo a la solicitud.");
      return;
    }

    if (!solicitudServicioId) {
      setSolicitudError("Selecciona el servicio para el cual se hace la solicitud.");
      return;
    }

    setSaving(true);
    setSolicitudError("");

    try {
      const servicioObj = servicios.find((s) => s.id === solicitudServicioId);
      const servicioNombre = servicioObj ? servicioObj.nombre : (solicitudServicioId === "oficina" ? "Oficina / General" : "Sin asignar");

      const totalCantidad = articulosList.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
      const totalCosto = isCompra ? getCompraTotal(articulosList) : null;

      const resumenArticulos = articulosList
        .map((a) => `${a.nombre} (x${a.cantidad})`)
        .join(", ");

      const itemPrincipal = articulosList[0];
      const tipo = isCompra ? "compra" : "pedido";

      // Meta tag for fallback if columns do not exist yet in DB
      const finalComentarios = getComentariosConArticulos(solicitudComentarios.trim(), articulosList, isCompra);

      const payload = {
        tipo,
        servicio_id: solicitudServicioId === "oficina" ? null : solicitudServicioId,
        servicio_nombre: servicioNombre,
        articulos: articulosList,
        inventario_item_id: itemPrincipal.inventario_item_id || null,
        item_nombre: resumenArticulos,
        cantidad: totalCantidad,
        costo: totalCosto,
        comentarios: finalComentarios,
        sede_id: solicitudSedeId || defaultSedeId,
        solicitante_nombre: user?.full_name || user?.nombre || user?.email || "Usuario",
        solicitante_id: user?.id || null,
        solicitante_email: user?.email || null,
        estado: "pendiente"
      };

      try {
        await sercoApi.entities.SolicitudInventario.create(payload);
      } catch (err) {
        if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
          // Fallback removing un-migrated columns
          const { tipo: _t, servicio_id: _sid, servicio_nombre: _sn, articulos: _arts, ...fallbackPayload } = payload;
          await sercoApi.entities.SolicitudInventario.create(fallbackPayload);
        } else {
          throw err;
        }
      }

      setSolicitarModalOpen(false);
      await load();
      toast({
        title: isCompra ? "Solicitud de compra enviada" : "Pedido de inventario enviado",
        description: `Se registraron ${articulosList.length} artículo(s) exitosamente.`,
      });
    } catch (e) {
      console.error(e);
      setSolicitudError(e.message || "No se pudo enviar la solicitud.");
    } finally {
      setSaving(false);
    }
  };

  // ── Actions on Solicitudes ──
  // Compras: Aprobar / Rechazar
  const handleUpdateCompraEstado = async (id, nuevoEstado) => {
    const solicitud = selectedSolicitud?.id === id
      ? selectedSolicitud
      : solicitudes.find((sol) => sol.id === id);
    if (!canApproveCompra || solicitud?.estado !== "pendiente") return;
    if (nuevoEstado === "aprobado" && getSolicitudCompraTotal(solicitud) == null) {
      toast({
        title: "Cotización pendiente",
        description: "No se puede aprobar la compra hasta que todos los artículos tengan precio.",
        variant: "destructive"
      });
      return;
    }
    try {
      await sercoApi.entities.SolicitudInventario.update(id, { estado: nuevoEstado });
      if (selectedSolicitud?.id === id) {
        setSelectedSolicitud((prev) => prev ? { ...prev, estado: nuevoEstado } : null);
      }
      await load();
      toast({
        title: nuevoEstado === "aprobado" ? "Solicitud de compra aprobada" : "Solicitud de compra rechazada",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al actualizar estado",
        description: e?.message,
        variant: "destructive"
      });
    }
  };

  /** @param {Record<string, any>} sol */
  const handleSavePurchasePrices = async (sol) => {
    if (sol.estado !== "pendiente") return;
    const articulos = getSolicitudArticulos(sol);
    const puedeEditarPropia = Boolean(
      solicitudEsPropia(sol) &&
      sol.estado === "pendiente" &&
      articulos.some((art) => !art.inventario_item_id)
    );
    if (!canEditPurchasePrice && !puedeEditarPropia) return;

    let articulosActualizados;
    try {
      articulosActualizados = articulos.map((art, index) => {
        const puedeEditarArticulo = canEditPurchasePrice || (!art.inventario_item_id && puedeEditarPropia);
        if (!puedeEditarArticulo) return art;
        const editKey = `${sol.id}-${index}`;
        const rawPrice = Object.prototype.hasOwnProperty.call(purchasePriceEdits, editKey)
          ? purchasePriceEdits[editKey]
          : (art.precio_unitario ?? "");
        const precio = rawPrice === "" ? null : Number(rawPrice);
        if (precio !== null && (!Number.isFinite(precio) || precio < 0)) {
          throw new Error("Ingresa un precio válido o deja el campo pendiente de cotizar.");
        }
        return {
          ...art,
          precio_unitario: precio,
          subtotal: precio == null ? null : (Number(art.cantidad) || 0) * precio
        };
      });
    } catch (error) {
      toast({ title: "Precio no válido", description: error.message, variant: "destructive" });
      return;
    }
    const costo = getCompraTotal(articulosActualizados);
    const comentarios = getComentariosConArticulos(sol.comentarios, articulosActualizados, true);
    const payload = { articulos: articulosActualizados, costo, comentarios };

    setSaving(true);
    try {
      try {
        await sercoApi.entities.SolicitudInventario.update(sol.id, payload);
      } catch (err) {
        if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
          const { articulos: _articulos, ...fallbackPayload } = payload;
          await sercoApi.entities.SolicitudInventario.update(sol.id, fallbackPayload);
        } else {
          throw err;
        }
      }
      const updatedSolicitud = { ...sol, ...payload };
      setSelectedSolicitud(updatedSolicitud);
      await load();
      toast({ title: "Cotización actualizada" });
    } catch (error) {
      toast({
        title: "Error al guardar la cotización",
        description: error?.message || "No se pudo actualizar la solicitud.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Pedidos: Entregar y DESCONTAR DEL INVENTARIO
  const handleEntregarPedido = async (sol) => {
    if (sol.estado === "entregado") return;
    setSaving(true);
    try {
      const articulos = getSolicitudArticulos(sol);

      // Descontar cada artículo del inventario
      for (const art of articulos) {
        if (art.inventario_item_id) {
          const dbItem = items.find((i) => i.id === art.inventario_item_id);
          if (dbItem) {
            const isUniforme = dbItem.categoria === "Uniforme";
            if (isUniforme && (art.color || art.talla)) {
              const variant = variantes.find(
                (v) =>
                  v.inventario_item_id === art.inventario_item_id &&
                  v.color === art.color &&
                  v.talla === art.talla
              );

              if (variant) {
                const currentVarQty = Number(variant.cantidad) || 0;
                const newVarQty = Math.max(0, currentVarQty - Number(art.cantidad || 0));
                await sercoApi.entities.InventarioVariante.update(variant.id, { cantidad: newVarQty });
              }

              // Recalcular total item
              const itemVars = variantes
                .filter((v) => v.inventario_item_id === art.inventario_item_id)
                .map((v) =>
                  v.color === art.color && v.talla === art.talla
                    ? { ...v, cantidad: Math.max(0, (Number(v.cantidad) || 0) - Number(art.cantidad || 0)) }
                    : v
                );
              const newTotalQty = itemVars.reduce((sum, v) => sum + (Number(v.cantidad) || 0), 0);
              await sercoApi.entities.InventarioItem.update(dbItem.id, { cantidad: newTotalQty });
            } else {
              const currentQty = Number(dbItem.cantidad) || 0;
              const newQty = Math.max(0, currentQty - Number(art.cantidad || 0));
              await sercoApi.entities.InventarioItem.update(dbItem.id, { cantidad: newQty });
            }
          }
        }
      }

      // Actualizar estado del pedido a entregado
      await sercoApi.entities.SolicitudInventario.update(sol.id, {
        estado: "entregado",
        fecha_entrega: new Date().toISOString(),
        entregado_por: user?.full_name || user?.email || "Usuario"
      });

      if (selectedSolicitud?.id === sol.id) {
        setSelectedSolicitud((prev) => prev ? { ...prev, estado: "entregado" } : null);
      }

      await load();
      toast({
        title: "Pedido entregado",
        description: "El pedido ha sido marcado como entregado y los artículos se descontaron del inventario.",
      });
    } catch (e) {
      console.error("Error al entregar pedido:", e);
      toast({
        title: "Error al entregar pedido",
        description: e?.message || "No se pudo actualizar el inventario",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canView("inventario")) return <AccessRestricted />;

  const pendingPedidosCount = pedidosList.filter((s) => s.estado === "pendiente").length;
  const pendingComprasCount = comprasList.filter((s) => s.estado === "pendiente").length;
  const totalPendingSolicitudes = pendingPedidosCount + pendingComprasCount;
  const canEditOwnPurchasePrice = Boolean(
    selectedSolicitud &&
    isCompraSolicitud(selectedSolicitud) &&
    selectedSolicitud.estado === "pendiente" &&
    solicitudEsPropia(selectedSolicitud) &&
    getSolicitudArticulos(selectedSolicitud).some((art) => !art.inventario_item_id)
  );

  /** @param {Record<string, any>} sol */
  const openSolicitudDetalle = (sol) => {
    setPurchasePriceEdits(Object.fromEntries(
      getSolicitudArticulos(sol).map((art, index) => [`${sol.id}-${index}`, art.precio_unitario ?? ""])
    ));
    setSelectedSolicitud(sol);
  };

  return (
    <div className="space-y-4">
      {/* ── HEADER & ACCIONES ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Inventario</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCategoryTab === "Solicitudes"
              ? `${visibleSolicitudes.length} solicitud(es) visible(s)`
              : `${tabFiltered.length} artículo(s) en ${activeCategoryTab}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openSolicitar} className="border-primary/30 text-primary hover:bg-primary/5">
            <ClipboardList className="w-4 h-4 mr-1.5" /> Solicitar
          </Button>
          {can("inventario", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Agregar Artículo
            </Button>
          )}
        </div>
      </div>

      {/* ── CARD: TOTAL INVERTIDO (TASK 1: Solo visible para finanzas, admin y ceo) ── */}
      {canViewMonto && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-card shadow-sm border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Invertido (General)
                </p>
                <h3 className="text-2xl font-bold tracking-tight mt-1 text-foreground">
                  ${totalInvertidoGlobal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-muted-foreground ml-1">MXN</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Valor total de todos los artículos en stock
                </p>
              </div>
              <div className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          {activeCategoryTab !== "Solicitudes" && (
            <Card className="bg-card shadow-sm border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Invertido en {activeCategoryTab}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight mt-1 text-primary">
                    ${totalInvertidoCategoria.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs font-normal text-muted-foreground ml-1">MXN</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tabFiltered.length} tipo(s) de artículo en esta categoría
                  </p>
                </div>
                <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TABS PRINCIPALES ── */}
      <Tabs value={activeCategoryTab} onValueChange={setActiveCategoryTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-3">
          <TabsList className="grid w-full sm:w-[620px] grid-cols-4">
            <TabsTrigger value="Uniforme">Uniformes</TabsTrigger>
            <TabsTrigger value="Papelería">Papelería</TabsTrigger>
            <TabsTrigger value="Material extra">Material Extra</TabsTrigger>
            <TabsTrigger value="Solicitudes" className="relative flex items-center justify-center gap-1.5">
              <ClipboardList className="w-4 h-4" />
              <span>Solicitudes</span>
              {totalPendingSolicitudes > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                  {totalPendingSolicitudes}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {activeCategoryTab !== "Solicitudes" && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar artículo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
          )}
        </div>

        {/* ── CATEGORÍA UNIFORMES: ACOMODADA POR COLOR (TASK 2) ── */}
        <TabsContent value="Uniforme" className="mt-4 space-y-4">
          {/* Controls: Color Filter Chips & View Mode Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border">
            {/* Color Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                Color:
              </span>
              <Button
                variant={selectedColorFilter === "todos" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5 rounded-full"
                onClick={() => setSelectedColorFilter("todos")}
              >
                Todos los colores
                <span className="ml-1.5 text-[11px] opacity-80">
                  ({prendasPorColor.reduce((sum, g) => sum + g.totalPiezas, 0)})
                </span>
              </Button>

              {availableUniformColors.map((col) => {
                const style = getColorStyle(col.name);
                const isSelected = selectedColorFilter === col.key;
                return (
                  <Button
                    key={col.key}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-full gap-1.5"
                    onClick={() => setSelectedColorFilter(col.key)}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                    <span>{col.name}</span>
                    <span className="text-[11px] opacity-80 font-semibold">({col.totalPiezas})</span>
                  </Button>
                );
              })}
            </div>

            {/* View Mode Toggle: Agrupado vs Lista */}
            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
              <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Vista:</span>
              <Button
                variant={uniformViewMode === "agrupado" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1"
                onClick={() => setUniformViewMode("agrupado")}
                title="Agrupar prendas por color"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Agrupado</span>
              </Button>
              <Button
                variant={uniformViewMode === "lista" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1"
                onClick={() => setUniformViewMode("lista")}
                title="Ver lista de prendas ordenada por color"
              >
                <List className="w-3.5 h-3.5" />
                <span>Lista</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground text-sm">
              Cargando prendas de uniformes...
            </div>
          ) : filteredColorGroups.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground text-sm">
              No hay prendas registradas para este filtro de color.
            </div>
          ) : uniformViewMode === "agrupado" ? (
            /* ══════ VISTA AGRUPADA POR COLOR ══════ */
            <div className="space-y-4">
              {filteredColorGroups.map((group) => {
                const style = getColorStyle(group.colorName);
                return (
                  <div
                    key={group.key}
                    className={`rounded-xl border bg-card shadow-xs overflow-hidden ${style.cardBorder}`}
                  >
                    {/* Color Group Header */}
                    <div className={`px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${style.headerBg}`}>
                      <div className="flex items-center gap-2.5">
                        <span className={`w-4 h-4 rounded-full shadow-xs ${style.dot}`} />
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>Prendas en {group.colorName}</span>
                          <Badge variant="outline" className={`text-[11px] font-semibold ${style.badge}`}>
                            {group.prendas.length} {group.prendas.length === 1 ? "prenda" : "prendas"}
                          </Badge>
                        </h4>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Piezas en stock: </span>
                          <span className="font-bold text-foreground">{group.totalPiezas}</span>
                        </div>
                        {canViewMonto && group.totalInvertido > 0 && (
                          <div>
                            <span className="text-muted-foreground">Total invertido: </span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              ${group.totalInvertido.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Table of Garments in this Color */}
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-muted/20">
                          <TableHead>Prenda</TableHead>
                          {!defaultSedeId && <TableHead>Sede</TableHead>}
                          <TableHead>Tallas Disponibles</TableHead>
                          <TableHead className="text-right">Cantidad ({group.colorName})</TableHead>
                          {canViewMonto && (
                            <>
                              <TableHead className="text-right">Precio unitario</TableHead>
                              <TableHead className="text-right">Total Invertido</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.prendas.map((p, pIdx) => {
                          const item = p.item;
                          return (
                            <TableRow
                              key={`${group.key}-${item.id}-${pIdx}`}
                              className="cursor-pointer hover:bg-muted/40 transition-colors text-xs"
                              onClick={() => can("inventario", "edit") && openEdit(item)}
                            >
                              <TableCell className="font-semibold text-foreground py-3">
                                <div>
                                  <span>{item.nombre}</span>
                                  {item.descripcion && (
                                    <p className="text-[11px] text-muted-foreground font-normal line-clamp-1">
                                      {item.descripcion}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              {!defaultSedeId && (
                                <TableCell className="text-muted-foreground py-3">
                                  {sedeNombre(item.sede_id)}
                                </TableCell>
                              )}
                              <TableCell className="py-3">
                                <div className="flex flex-wrap gap-1">
                                  {p.tallas.length > 0 ? (
                                    p.tallas.map((t, tIdx) => (
                                      <span
                                        key={tIdx}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                      >
                                        <span className="font-bold mr-1">{t.talla}:</span>
                                        <span>{t.cantidad}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground/60 text-[11px]">Única</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-bold text-sm py-3">
                                {p.totalPiezas}
                              </TableCell>
                              {canViewMonto && (
                                <>
                                  <TableCell className="text-right py-3">
                                    {p.precioUnitario > 0 ? (
                                      `$${p.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    ) : (
                                      <span className="text-muted-foreground/60">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400 py-3">
                                    {p.subtotalInvertido > 0 ? (
                                      `$${p.subtotalInvertido.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    ) : (
                                      <span className="text-muted-foreground/60 font-normal">—</span>
                                    )}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ══════ VISTA LISTA PLANA ORDENADA POR COLOR ══════ */
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Prenda</TableHead>
                    {!defaultSedeId && <TableHead>Sede</TableHead>}
                    <TableHead>Tallas</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    {canViewMonto && (
                      <>
                        <TableHead className="text-right">Precio por unidad</TableHead>
                        <TableHead className="text-right">Total Invertido</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flatPrendasSorted.map((p, idx) => {
                    const item = p.item;
                    const style = getColorStyle(p.colorName);
                    return (
                      <TableRow
                        key={`flat-${idx}-${item.id}`}
                        className="cursor-pointer hover:bg-muted/50 text-xs"
                        onClick={() => can("inventario", "edit") && openEdit(item)}
                      >
                        <TableCell className="font-medium">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}>
                            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                            {p.colorName}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {item.nombre}
                        </TableCell>
                        {!defaultSedeId && <TableCell>{sedeNombre(item.sede_id)}</TableCell>}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.tallas.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                <span className="font-bold mr-1">{t.talla}:</span>
                                <span>{t.cantidad}</span>
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">{p.totalPiezas}</TableCell>
                        {canViewMonto && (
                          <>
                            <TableCell className="text-right">
                              {p.precioUnitario > 0 ? (
                                `$${p.precioUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              ) : (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                              {p.subtotalInvertido > 0 ? (
                                `$${p.subtotalInvertido.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              ) : (
                                <span className="text-muted-foreground/60 font-normal">—</span>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── CATEGORÍAS (Papelería, Material Extra) ── */}
        {["Papelería", "Material extra"].map((tabVal) => (
          <TabsContent key={tabVal} value={tabVal} className="mt-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    {!defaultSedeId && <TableHead>Sede</TableHead>}
                    <TableHead className="text-right">Cantidad</TableHead>
                    {canViewMonto && (
                      <>
                        <TableHead className="text-right">Precio por unidad</TableHead>
                        <TableHead className="text-right">Total Invertido</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={(!defaultSedeId ? 3 : 2) + (canViewMonto ? 2 : 0)} className="text-center text-muted-foreground py-8">
                        Cargando inventario...
                      </TableCell>
                    </TableRow>
                  ) : tabFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(!defaultSedeId ? 3 : 2) + (canViewMonto ? 2 : 0)} className="text-center text-muted-foreground py-8">
                        No hay artículos en esta categoría
                      </TableCell>
                    </TableRow>
                  ) : (
                    tabFiltered.map((item) => {
                      const qty = getDisplayCantidad(item);
                      const price = Number(item.precio_unitario || item.precio_por_unidad || 0);
                      const invertido = qty * price;
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => can("inventario", "edit") && openEdit(item)}
                        >
                          <TableCell className="font-medium">{item.nombre}</TableCell>
                          {!defaultSedeId && <TableCell>{sedeNombre(item.sede_id)}</TableCell>}
                          <TableCell className="text-right font-semibold">{qty}</TableCell>
                          {canViewMonto && (
                            <>
                              <TableCell className="text-right">
                                {price > 0 ? (
                                  `$${price.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-emerald-700">
                                {invertido > 0 ? (
                                  `$${invertido.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                ) : (
                                  <span className="text-muted-foreground/60 font-normal">—</span>
                                )}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}

        {/* ── SOLICITUDES TAB: PEDIDOS Y COMPRAS (TASKS 2, 4, 5) ── */}
        <TabsContent value="Solicitudes" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20 p-3 rounded-lg border">
            {/* Sub-tabs Pedidos vs Compras */}
            <div className="flex items-center gap-2">
              <Button
                variant={solicitudesTab === "pedidos" ? "default" : "outline"}
                size="sm"
                onClick={() => setSolicitudesTab("pedidos")}
                className="gap-1.5 text-xs font-semibold"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Pedidos (Material en Existencia)</span>
                {pendingPedidosCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-amber-500 text-white">
                    {pendingPedidosCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant={solicitudesTab === "compras" ? "default" : "outline"}
                size="sm"
                onClick={() => setSolicitudesTab("compras")}
                className="gap-1.5 text-xs font-semibold"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Compras (Sin Existencia / Nuevo)</span>
                {pendingComprasCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-amber-500 text-white">
                    {pendingComprasCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Buscador de solicitudes */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar solicitud..."
                value={solicitudSearch}
                onChange={(e) => setSolicitudSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Sub-view: PEDIDOS */}
          {solicitudesTab === "pedidos" && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículos Pedidos</TableHead>
                    <TableHead>Servicio</TableHead>
                    {!defaultSedeId && <TableHead>Sede</TableHead>}
                    <TableHead>Solicitado por</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 6 : 5} className="text-center text-muted-foreground py-8">
                        Cargando pedidos...
                      </TableCell>
                    </TableRow>
                  ) : pedidosList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={!defaultSedeId ? 6 : 5} className="text-center text-muted-foreground py-8">
                        No hay pedidos de inventario registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    pedidosList.map((sol) => {
                      const arts = getSolicitudArticulos(sol);
                      const totalQty = arts.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
                      const isEntregado = sol.estado === "entregado";

                      return (
                        <TableRow
                          key={sol.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSolicitud(sol)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="line-clamp-1">{sol.item_nombre || arts.map(a => a.nombre).join(", ")}</span>
                              <span className="text-xs text-muted-foreground">
                                {arts.length} artículo(s) • Total: {totalQty} unidad(es)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal text-xs">
                              {sol.servicio_nombre || "Oficina / General"}
                            </Badge>
                          </TableCell>
                          {!defaultSedeId && <TableCell>{sedeNombre(sol.sede_id)}</TableCell>}
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-medium text-foreground">{sol.solicitante_nombre}</p>
                              {sol.created_at && (
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(sol.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isEntregado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-semibold gap-1 text-xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Entregado
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 font-semibold gap-1 text-xs animate-pulse">
                                <Clock className="w-3 h-3 text-amber-600" /> Pendiente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {!isEntregado && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50 font-semibold"
                                onClick={() => handleEntregarPedido(sol)}
                                title="Marcar como entregado y descontar artículos del inventario"
                                disabled={saving}
                              >
                                <Truck className="w-3.5 h-3.5 mr-1" /> Entregado
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
          )}

          {/* Sub-view: COMPRAS */}
          {solicitudesTab === "compras" && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículos a Comprar</TableHead>
                    {canViewMonto && <TableHead className="text-right">Total Estimado</TableHead>}
                    <TableHead>Servicio</TableHead>
                    {!defaultSedeId && <TableHead>Sede</TableHead>}
                    <TableHead>Solicitado por</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={(!defaultSedeId ? 6 : 5) + (canViewMonto ? 1 : 0)} className="text-center text-muted-foreground py-8">
                        Cargando solicitudes de compra...
                      </TableCell>
                    </TableRow>
                  ) : comprasList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(!defaultSedeId ? 6 : 5) + (canViewMonto ? 1 : 0)} className="text-center text-muted-foreground py-8">
                        No hay solicitudes de compra registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    comprasList.map((sol) => {
                      const arts = getSolicitudArticulos(sol);
                      const isPendiente = sol.estado === "pendiente";
                      const costoCompra = getSolicitudCompraTotal(sol);
                      const requiereCotizacion = costoCompra == null;

                      return (
                        <TableRow
                          key={sol.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openSolicitudDetalle(sol)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="line-clamp-1">{sol.item_nombre || arts.map(a => a.nombre).join(", ")}</span>
                              <span className="text-xs text-muted-foreground">
                                {arts.length} artículo(s)
                              </span>
                            </div>
                          </TableCell>
                          {canViewMonto && (
                            <TableCell className="text-right font-semibold text-foreground">
                              {!requiereCotizacion ? (
                                `$${costoCompra.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              ) : (
                                <span className="text-muted-foreground font-normal">Pendiente de cotizar</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline" className="font-normal text-xs">
                              {sol.servicio_nombre || "Oficina / General"}
                            </Badge>
                          </TableCell>
                          {!defaultSedeId && <TableCell>{sedeNombre(sol.sede_id)}</TableCell>}
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-medium text-foreground">{sol.solicitante_nombre}</p>
                              {sol.created_at && (
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(sol.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs font-semibold ${
                                sol.estado === "aprobado"
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                  : sol.estado === "rechazado"
                                  ? "bg-rose-100 text-rose-800 hover:bg-rose-100"
                                  : "bg-amber-100 text-amber-800 hover:bg-amber-100 animate-pulse"
                              }`}
                            >
                              {sol.estado === "aprobado" ? "Aprobada" : sol.estado === "rechazado" ? "Rechazada" : "Pendiente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {isPendiente && canApproveCompra && (
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7 border-emerald-300 hover:bg-emerald-50 text-emerald-600"
                                  onClick={() => handleUpdateCompraEstado(sol.id, "aprobado")}
                                  title="Aprobar Compra"
                                  disabled={requiereCotizacion}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7 border-rose-300 hover:bg-rose-50 text-rose-600"
                                  onClick={() => handleUpdateCompraEstado(sol.id, "rechazado")}
                                  title="Rechazar Compra"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOG: DETALLE DE SOLICITUD (TASK 4 & 5)
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedSolicitud && (
        <Dialog open={!!selectedSolicitud} onOpenChange={(v) => !v && setSelectedSolicitud(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant={isCompraSolicitud(selectedSolicitud) ? "secondary" : "outline"} className="text-xs uppercase">
                  {isCompraSolicitud(selectedSolicitud) ? "Solicitud de Compra" : "Pedido de Inventario"}
                </Badge>
                <Badge
                  className={`text-xs ${
                    selectedSolicitud.estado === "entregado" || selectedSolicitud.estado === "aprobado"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedSolicitud.estado === "rechazado"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {selectedSolicitud.estado === "entregado"
                    ? "Entregado"
                    : selectedSolicitud.estado === "aprobado"
                    ? "Aprobada"
                    : selectedSolicitud.estado === "rechazado"
                    ? "Rechazada"
                    : "Pendiente"}
                </Badge>
              </div>
              <DialogTitle className="text-lg mt-1">Detalles de la Solicitud</DialogTitle>
              <DialogDescription>
                Información completa de los artículos solicitados y su estado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {(() => {
                const selectedArticles = getSolicitudArticulos(selectedSolicitud);
                const hasQuoteEdits = selectedArticles.some((art, index) => {
                  const editKey = `${selectedSolicitud.id}-${index}`;
                  const currentPrice = Object.prototype.hasOwnProperty.call(purchasePriceEdits, editKey)
                    ? purchasePriceEdits[editKey]
                    : (art.precio_unitario ?? "");
                  return currentPrice !== (art.precio_unitario ?? "");
                });
                const editedArticles = selectedArticles.map((art, index) => {
                  const editKey = `${selectedSolicitud.id}-${index}`;
                  const rawPrice = Object.prototype.hasOwnProperty.call(purchasePriceEdits, editKey)
                    ? purchasePriceEdits[editKey]
                    : (art.precio_unitario ?? "");
                  return { ...art, precio_unitario: rawPrice === "" ? null : rawPrice };
                });
                const quoteTotal = hasQuoteEdits
                  ? getCompraTotal(editedArticles)
                  : getSolicitudCompraTotal(selectedSolicitud);
                const ownOnlyNewItems = selectedArticles.length > 0 && selectedArticles.every((art) => !art.inventario_item_id);
                const canShowRequestPrices = canViewMonto || canEditOwnPurchasePrice;
                const isPendingPurchase = isCompraSolicitud(selectedSolicitud) && selectedSolicitud.estado === "pendiente";
                return (
                  <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground block">Solicitante:</span>
                  <span className="font-semibold text-foreground">{selectedSolicitud.solicitante_nombre}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Servicio:</span>
                  <span className="font-semibold text-foreground">{selectedSolicitud.servicio_nombre || "Oficina / General"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Sede:</span>
                  <span className="font-semibold text-foreground">{sedeNombre(selectedSolicitud.sede_id)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Fecha:</span>
                  <span className="font-semibold text-foreground">
                    {selectedSolicitud.created_at ? new Date(selectedSolicitud.created_at).toLocaleDateString("es-MX") : "—"}
                  </span>
                </div>
              </div>

              {/* Lista de artículos pedidos */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Artículos Solicitados ({getSolicitudArticulos(selectedSolicitud).length})
                </Label>
                <div className="rounded-lg border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-xs">
                        <TableHead>Artículo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        {isCompraSolicitud(selectedSolicitud) && canShowRequestPrices && (
                          <>
                            <TableHead className="text-right">Precio Unitario</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedArticles.map((art, idx) => {
                        const editKey = `${selectedSolicitud.id}-${idx}`;
                        const canEditLinePrice = isPendingPurchase && (
                          canEditPurchasePrice || (canEditOwnPurchasePrice && !art.inventario_item_id)
                        );
                        const rawEditedPrice = Object.prototype.hasOwnProperty.call(purchasePriceEdits, editKey)
                          ? purchasePriceEdits[editKey]
                          : (art.precio_unitario ?? "");
                        const editedPrice = rawEditedPrice === "" ? null : Number(rawEditedPrice);
                        const lineSubtotal = editedPrice == null || !Number.isFinite(editedPrice)
                          ? null
                          : editedPrice * (Number(art.cantidad) || 0);
                        return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs">
                            {art.nombre}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-xs">
                            {art.cantidad}
                          </TableCell>
                          {isCompraSolicitud(selectedSolicitud) && canShowRequestPrices && (
                            <>
                              <TableCell className="text-right text-xs">
                                {canEditLinePrice ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Pendiente de cotizar"
                                    value={rawEditedPrice}
                                    onChange={(event) => setPurchasePriceEdits((prev) => ({ ...prev, [editKey]: event.target.value }))}
                                    aria-label={`Precio unitario de ${art.nombre}`}
                                    className="h-8 min-w-36 text-right"
                                  />
                                ) : canViewMonto ? (
                                  art.precio_unitario != null && art.precio_unitario !== ""
                                    ? `$${Number(art.precio_unitario).toFixed(2)}`
                                    : <span className="text-amber-700">Pendiente de cotizar</span>
                                ) : (
                                  <span className="text-muted-foreground">No visible</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-xs">
                                {canViewMonto || !art.inventario_item_id
                                  ? lineSubtotal != null && Number.isFinite(lineSubtotal)
                                    ? `$${lineSubtotal.toFixed(2)}`
                                    : <span className="text-amber-700 font-normal">Pendiente</span>
                                  : <span className="text-muted-foreground font-normal">No visible</span>}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {isCompraSolicitud(selectedSolicitud) && (canViewMonto || (canEditOwnPurchasePrice && ownOnlyNewItems)) && (
                <div className="flex justify-end pr-2 text-sm font-bold text-foreground">
                  {quoteTotal == null
                    ? <span className="text-amber-700">Total pendiente de cotización</span>
                    : `Total estimado de compra: $${quoteTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`}
                </div>
              )}
              {canViewMonto && canEditPurchasePrice && isPendingPurchase && (
                <div className="flex justify-end">
                  <Button onClick={() => handleSavePurchasePrices(selectedSolicitud)} disabled={saving}>
                    Guardar cotización
                  </Button>
                </div>
              )}
              {!canViewMonto && canEditOwnPurchasePrice && isPendingPurchase && (
                <div className="flex justify-end">
                  <Button onClick={() => handleSavePurchasePrices(selectedSolicitud)} disabled={saving}>
                    Guardar precio
                  </Button>
                </div>
              )}

              {/* Comentarios */}
              {getCleanComentarios(selectedSolicitud.comentarios) && (
                <div className="bg-muted/20 p-3 rounded-lg border">
                  <Label className="text-xs text-muted-foreground block mb-1">Comentarios / Observaciones:</Label>
                  <p className="text-xs text-foreground whitespace-pre-line">
                    {getCleanComentarios(selectedSolicitud.comentarios)}
                  </p>
                </div>
              )}
                  </>
                );
              })()}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-2 pt-2 border-t">
              <div className="flex gap-2">
                {!isCompraSolicitud(selectedSolicitud) && selectedSolicitud.estado === "pendiente" && (
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                    onClick={() => handleEntregarPedido(selectedSolicitud)}
                    disabled={saving}
                  >
                    <Truck className="w-4 h-4" /> Marcar como Entregado (Descontar Inventario)
                  </Button>
                )}

                {isCompraSolicitud(selectedSolicitud) && selectedSolicitud.estado === "pendiente" && canApproveCompra && (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                      onClick={() => handleUpdateCompraEstado(selectedSolicitud.id, "aprobado")}
                      disabled={saving || getSolicitudCompraTotal(selectedSolicitud) == null}
                      title={getSolicitudCompraTotal(selectedSolicitud) == null ? "Pendiente de cotización" : "Aprobar compra"}
                    >
                      <Check className="w-4 h-4" /> Aprobar Compra
                    </Button>
                    <Button
                      variant="destructive"
                      className="font-semibold gap-1.5"
                      onClick={() => handleUpdateCompraEstado(selectedSolicitud.id, "rechazado")}
                      disabled={saving}
                    >
                      <X className="w-4 h-4" /> Rechazar Compra
                    </Button>
                  </div>
                )}
              </div>

              <Button variant="outline" onClick={() => setSelectedSolicitud(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOG: NUEVA SOLICITUD (TASK 3) - PEDIDOS Y COMPRAS
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={solicitarModalOpen} onOpenChange={setSolicitarModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {isCompra ? (
                <>
                  <ShoppingCart className="w-5 h-5 text-amber-600" />
                  <span>Solicitud de Compra de Material</span>
                </>
              ) : (
                <>
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <span>Pedido de Inventario en Existencia</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isCompra
                ? "Solicita la compra de artículos sin existencia o material nuevo que no está registrado en el inventario."
                : "Solicita artículos que actualmente se encuentran en existencia en el inventario."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── CASILLA DE COMPRA (HASTA MERO ARRIBA) ── */}
            <div className="flex items-center space-x-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Checkbox
                id="check-es-compra"
                checked={isCompra}
                onCheckedChange={(checked) => {
                  setIsCompra(!!checked);
                  resetSubFormArticulo();
                  setSolicitudError("");
                }}
              />
              <div className="grid gap-0.5 leading-none">
                <label htmlFor="check-es-compra" className="text-sm font-bold text-amber-900 dark:text-amber-300 cursor-pointer">
                  ¿Es solicitud de compra? (Material sin existencia o nuevo)
                </label>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                  Activa esta casilla para comprar artículos agotados en catálogo o material nuevo no registrado.
                </p>
              </div>
            </div>

            {/* Servicio y Sede */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Servicio Asignado *</Label>
                <Select value={solicitudServicioId} onValueChange={setSolicitudServicioId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecciona para qué servicio es..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oficina">Oficina / General</SelectItem>
                    {servicios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!defaultSedeId && (
                <div>
                  <Label>Sede *</Label>
                  <div className="mt-1">
                    <SedeSelector
                      value={solicitudSedeId}
                      onChange={setSolicitudSedeId}
                      sedes={sedes}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── SECCIÓN DE BÚSQUEDA Y AGREGAR ARTÍCULO ── */}
            <div className="border rounded-lg p-3.5 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  {isCompra ? "Agregar Artículo a Comprar" : "Buscar y Agregar Artículo en Existencia"}
                </Label>
                {isCompra && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary"
                    onClick={() => {
                      setCompraModoNuevo(!compraModoNuevo);
                      resetSubFormArticulo();
                    }}
                  >
                    {compraModoNuevo ? "Buscar de catálogo registrado" : "+ Escribir artículo no registrado"}
                  </Button>
                )}
              </div>

              {/* Input de búsqueda o nombre */}
              {!isCompra || !compraModoNuevo ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Buscar artículo (escribe el nombre):</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Escribe para buscar (ej. Camisola, Libreta, Chaleco)..."
                      value={busquedaArticulo}
                      onChange={(e) => {
                        setBusquedaArticulo(e.target.value);
                        setArticuloSeleccionado(null);
                      }}
                      className="pl-9"
                    />
                  </div>

                  {/* Resultados de búsqueda */}
                  {busquedaArticulo.trim() && !articuloSeleccionado && (
                    <div className="border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto divide-y mt-1 z-10">
                      {articulosBuscados.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3 text-center">
                          No se encontraron artículos con ese nombre.
                        </p>
                      ) : (
                        articulosBuscados.map((item) => {
                          const stock = getDisplayCantidad(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full text-left p-2.5 hover:bg-muted text-xs flex justify-between items-center transition-colors"
                              onClick={() => handleSeleccionarArticuloExistente(item)}
                            >
                              <div>
                                <p className="font-semibold text-foreground">{item.nombre}</p>
                                <p className="text-muted-foreground text-[11px]">{item.categoria}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant={stock > 0 ? "outline" : "secondary"} className="text-[10px]">
                                  Stock: {stock}
                                </Badge>
                                {isCompra && canViewMonto && (item.precio_unitario || item.precio_por_unidad) && (
                                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                                    ${Number(item.precio_unitario || item.precio_por_unidad).toFixed(2)} c/u
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}

                  {articuloSeleccionado && (
                    <div className="flex items-center justify-between p-2.5 bg-primary/10 rounded-md border border-primary/20 text-xs">
                      <div>
                        <span className="font-bold text-primary">{articuloSeleccionado.nombre}</span>
                        <span className="text-muted-foreground ml-2">({articuloSeleccionado.categoria})</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Existencia actual en almacén: <span className="font-semibold">{getDisplayCantidad(articuloSeleccionado)}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                        onClick={resetSubFormArticulo}
                      >
                        Cambiar
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* Modo Compra - Artículo nuevo no registrado */
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Nombre del artículo nuevo o descripción *</Label>
                    <Input
                      placeholder="Ej. Candados de seguridad, Baterías 9V..."
                      value={inputNombreNuevo}
                      onChange={(e) => setInputNombreNuevo(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Si es Uniforme, mostrar selector de color y talla */}
              {articuloSeleccionado && articuloSeleccionado.categoria === "Uniforme" && (() => {
                const itemVars = variantes.filter((v) => v.inventario_item_id === articuloSeleccionado.id);
                const colores = [...new Set(itemVars.map((v) => v.color).filter(Boolean))];
                const tallas = [...new Set(itemVars.map((v) => v.talla).filter(Boolean))];

                return (
                  <div className="p-3 bg-muted/40 rounded-md border space-y-2.5 text-xs">
                    {colores.length > 0 && (
                      <div>
                        <Label className="text-xs block mb-1">Color:</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {colores.map((c) => (
                            <Button
                              key={c}
                              type="button"
                              size="sm"
                              variant={inputColor === c ? "default" : "outline"}
                              className="h-7 text-xs px-2.5"
                              onClick={() => setInputColor(c)}
                            >
                              {c}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {tallas.length > 0 && (
                      <div>
                        <Label className="text-xs block mb-1">Talla:</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {tallas.map((t) => {
                            const matching = itemVars.find((v) => v.color === inputColor && v.talla === t);
                            const stockVar = Number(matching?.cantidad) || 0;
                            return (
                              <Button
                                key={t}
                                type="button"
                                size="sm"
                                variant={inputTalla === t ? "default" : "outline"}
                                className={`h-7 text-xs px-2.5 ${!isCompra && stockVar <= 0 ? "opacity-50" : ""}`}
                                onClick={() => setInputTalla(t)}
                              >
                                {t} {!isCompra && `(${stockVar})`}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cantidad y Precio (en compras, solo visible para finanzas, admin y ceo) */}
              <div className={`grid ${isCompra && (canViewMonto || compraModoNuevo) ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"} gap-3 pt-1`}>
                <div>
                  <Label className="text-xs">Cantidad *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={inputCantidad}
                    onChange={(e) => setInputCantidad(e.target.value)}
                  />
                </div>

                {/* Las compras nuevas aceptan un precio opcional sin exponer precios de inventario. */}
                {isCompra && (canViewMonto || compraModoNuevo) && (
                  <div>
                    <Label className="text-xs">Precio unitario estimado ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Pendiente de cotizar"
                      value={inputPrecioUnitario}
                      onChange={(e) => setInputPrecioUnitario(e.target.value)}
                    />
                  </div>
                )}

                <div className={`flex items-end ${isCompra && (canViewMonto || compraModoNuevo) ? "col-span-2 sm:col-span-1" : "col-span-1"}`}>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleAgregarArticuloALista}
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar a la lista
                  </Button>
                </div>
              </div>
            </div>

            {/* ── LISTA DE ARTÍCULOS AGREGADOS (SE PUEDE SELECCIONAR MÁS DE UNO) ── */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Artículos en la solicitud ({articulosList.length}):
              </Label>

              {articulosList.length === 0 ? (
                <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
                  Aún no has agregado artículos a la lista. Busca un artículo arriba y presiona "Agregar a la lista".
                </div>
              ) : (
                <div className="border rounded-lg bg-card overflow-hidden">
                  {(() => {
                    const mostrarPreciosSolicitud = isCompra && (
                      canViewMonto || articulosList.some((art) => !art.inventario_item_id)
                    );
                    return (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-xs">
                        <TableHead>Artículo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        {mostrarPreciosSolicitud && (
                          <>
                            <TableHead className="text-right">Precio c/u</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </>
                        )}
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {articulosList.map((art) => (
                        <TableRow key={art.id}>
                          <TableCell className="font-medium text-xs">
                            {art.nombre}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-xs">
                            {art.cantidad}
                          </TableCell>
                          {mostrarPreciosSolicitud && (
                            <>
                              <TableCell className="text-right text-xs">
                                {canViewMonto || !art.inventario_item_id
                                  ? art.precio_unitario != null
                                    ? `$${Number(art.precio_unitario).toFixed(2)}`
                                    : <span className="text-amber-700">Pendiente de cotizar</span>
                                  : <span className="text-muted-foreground">No visible</span>}
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs text-emerald-700">
                                {canViewMonto || !art.inventario_item_id
                                  ? art.subtotal != null
                                    ? `$${Number(art.subtotal).toFixed(2)}`
                                    : <span className="text-amber-700 font-normal">Pendiente</span>
                                  : <span className="text-muted-foreground font-normal">No visible</span>}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleQuitarArticuloDeLista(art.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    );
                  })()}
                </div>
              )}

              {isCompra && articulosList.length > 0 && (canViewMonto || articulosList.every((art) => !art.inventario_item_id)) && (
                <div className="flex justify-end p-2 text-sm font-bold text-foreground">
                  {getCompraTotal(articulosList) == null
                    ? <span className="text-amber-700">Total pendiente de cotización</span>
                    : `Total estimado de compra: $${getCompraTotal(articulosList).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`}
                </div>
              )}
            </div>

            {/* Comentarios */}
            <div>
              <Label className="text-xs">Comentarios / Justificación</Label>
              <Input
                placeholder="Indica el motivo del pedido, detalles de entrega, etc."
                value={solicitudComentarios}
                onChange={(e) => setSolicitudComentarios(e.target.value)}
              />
            </div>

            {solicitudError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{solicitudError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setSolicitarModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSolicitud}
              disabled={saving || articulosList.length === 0 || !solicitudServicioId}
              className="font-semibold gap-1.5"
            >
              {saving
                ? "Enviando..."
                : isCompra
                ? `Enviar Solicitud de Compra (${articulosList.length})`
                : `Enviar Pedido (${articulosList.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOG: CREAR / EDITAR ARTÍCULO DE INVENTARIO (TASK 1)
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Artículo" : "Nuevo Artículo"}</DialogTitle>
            <DialogDescription>Completa los datos del artículo de inventario.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Pantalón de Guardia, Cuaderno..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Categoría *</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(val) => setForm({ ...form, categoria: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Uniforme">Uniforme</SelectItem>
                    <SelectItem value="Papelería">Papelería</SelectItem>
                    <SelectItem value="Material extra">Material Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!defaultSedeId && (
                <div>
                  <Label>Sede *</Label>
                  <div className="mt-1">
                    <SedeSelector
                      value={form.sede_id}
                      onChange={(v) => setForm({ ...form, sede_id: v })}
                      sedes={sedes}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* PRECIO POR UNIDAD (Solo visible para finanzas, admin y ceo) */}
            {canViewMonto && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Precio por unidad ($ MXN)</Label>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio_unitario}
                  onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}

            {form.categoria !== "Uniforme" && (
              <div>
                <Label>Cantidad en Stock</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.cantidad}
                  onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                  placeholder="0"
                />
              </div>
            )}

            <div>
              <Label>Ubicación / Almacén</Label>
              <Input
                value={form.ubicacion || ""}
                onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                placeholder="Ej. Estante A-2, Almacén Central..."
              />
            </div>

            <div>
              <Label>Descripción / Notas</Label>
              <Input
                value={form.descripcion || ""}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>

            {/* Variantes si es Uniforme */}
            {form.categoria === "Uniforme" && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Variantes por color y talla
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={agregarVariante} className="h-7 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Agregar combinación
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {formVariantes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-2">
                      Sin variantes agregadas. Presiona "Agregar combinación" para definir colores y tallas.
                    </p>
                  ) : (
                    formVariantes.map((v, index) => (
                      <div key={v.id || index} className="grid grid-cols-[1fr_1fr_90px_auto] gap-2 items-center">
                        <Input
                          placeholder="Color (Azul, Negro)"
                          value={v.color}
                          onChange={(e) => actualizarVariante(index, "color", e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="Talla (M, G, 32)"
                          value={v.talla}
                          onChange={(e) => actualizarVariante(index, "talla", e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Cantidad"
                          value={v.cantidad}
                          onChange={(e) => actualizarVariante(index, "cantidad", e.target.value)}
                          className="h-8 text-xs text-right font-semibold"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => eliminarVariante(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center w-full gap-2 pt-2 border-t">
            {editing && can("inventario", "delete") && (
              <Button
                variant="destructive"
                onClick={() => {
                  setModalOpen(false);
                  setDeleteId(editing.id);
                }}
                className="mr-auto"
              >
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 justify-end ml-auto">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.nombre || (!defaultSedeId && !form.sede_id)}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE ── */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar artículo de inventario?"
        description="Esta acción eliminará el artículo y todas sus variantes de forma permanente."
        onConfirm={handleDelete}
      />
    </div>
  );
}