import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { getServicioCobroConfig, setServicioCobroConfig } from "@/pages/Cobros";
import { Plus, Pencil, Trash2, Search, } from "lucide-react";
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
import SedeSelector from "@/components/SedeSelector";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

async function fetchGeocode(query, sedeName) {
  try {
    let bbox = "";
    if (sedeName) {
      const name = sedeName.toLowerCase();
      if (name.includes("monterrey")) {
        bbox = "&viewbox=-100.5,25.8,-100.1,25.5&bounded=1";
      } else if (name.includes("cdmx") || name.includes("mexico") || name.includes("ciudad de")) {
        bbox = "&viewbox=-99.4,19.6,-99.0,19.2&bounded=1";
      }
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=es&email=info@cimaserco.com${bbox}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
  } catch (err) {
    console.error("Single fetch geocode error for query:", query, err);
  }
  return null;
}

async function geocodeAddressWithFallbacks(address, sedeName) {
  const clean = cleanAddressForGeocoding(address, sedeName);
  if (!clean) return null;
  
  // Try 1: Full cleaned address
  let coords = await fetchGeocode(clean, sedeName);
  if (coords) return coords;

  // Try 2: Strip secondary details (splits by comma and keeps street + city/state)
  const parts = clean.split(",");
  if (parts.length > 2) {
    const simplified = `${parts[0].trim()}, ${parts.slice(-3).join(", ").trim()}`;
    coords = await fetchGeocode(simplified, sedeName);
    if (coords) return coords;
    
    // Try 3: Just the street name (removes numbers from street part)
    const streetOnly = parts[0].replace(/\d+/g, "").trim();
    if (streetOnly.length > 3) {
      const streetClean = `${streetOnly}, ${parts.slice(-3).join(", ").trim()}`;
      coords = await fetchGeocode(streetClean, sedeName);
      if (coords) return coords;
    }
  }

  // Try 4: Sede city as fallback
  if (sedeName) {
    coords = await fetchGeocode(`${sedeName}, México`, sedeName);
    if (coords) return coords;
  }

  return null;
}

function MapChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function FormMapPicker({ lat, lon, onChange }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) {
      map.setView([Number(lat), Number(lon)], 15);
    }
  }, [lat, lon, map]);

  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    }
  });

  return null;
}

function cleanAddressForGeocoding(address, sedeName) {
  if (!address) return "";
  let clean = address;
  
  // 1. Remove text inside parentheses (e.g., descriptions or references)
  clean = clean.replace(/\([^)]*\)/g, "");
  
  // 2. Remove common descriptive noise words in Mexican addresses
  const noiseWords = [
    /bodega\s+\d+/gi,
    /bodega/gi,
    /frente\s+a/gi,
    /esquina\s+con/gi,
    /junto\s+al?/gi,
    /detrás\s+de/gi,
    /detras\s+de/gi,
    /casi\s+esq/gi,
    /lote\s+\d+/gi,
    /manzana\s+\d+/gi,
    /mza\s+\d+/gi,
    /lt\s+\d+/gi
  ];
  
  noiseWords.forEach(pattern => {
    clean = clean.replace(pattern, "");
  });
  
  clean = clean.replace(/#/g, "");
  
  // 3. Clean up multiple spaces and clean commas
  clean = clean.replace(/\s+/g, " ").trim();
  
  // 4. Append State/Country context if not already present
  const lowercaseClean = clean.toLowerCase();
  const lowercaseSede = (sedeName || "").toLowerCase();
  
  if (!lowercaseClean.includes("méxico") && !lowercaseClean.includes("mexico")) {
    if (lowercaseSede.includes("monterrey")) {
      // Append Nuevo León instead of Monterrey city to support municipalities (San Pedro, Guadalupe, San Nicolas, etc.)
      if (!lowercaseClean.includes("nuevo león") && !lowercaseClean.includes("nuevo leon")) {
        clean += ", Nuevo León";
      }
      clean += ", México";
    } else if (lowercaseSede.includes("cdmx") || lowercaseSede.includes("mexico") || lowercaseSede.includes("ciudad de")) {
      if (!lowercaseClean.includes("ciudad de méxico") && !lowercaseClean.includes("cdmx") && !lowercaseClean.includes("estado de méxico") && !lowercaseClean.includes("estado de mexico")) {
        clean += ", Estado de México";
      }
      clean += ", México";
    } else {
      if (sedeName && !lowercaseClean.includes(lowercaseSede)) {
        clean += `, ${sedeName}`;
      }
      clean += ", México";
    }
  }
  
  return clean.trim();
}

const emptyForm = {
  nombre: "", direccion: "", admin_nombre: "", telefono: "", telefono_2: "", correo: "", correo_2: "", fecha_inicio: "", estado: "activo", fecha_baja: "", sede_id: "",
  dia_costo: "", dia_pago: "", costo: "", pago: "", turnos_autorizados: "",
  metodo_pago: "transferencia", nombre_constancia: ""
};

export default function Servicios() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView, can } = usePermissions();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [activeTab, setActiveTab] = useState("activos");
  const [geocodedServices, setGeocodedServices] = useState([]);
  const [mapCenter, setMapCenter] = useState([23.6345, -102.5528]);
  const [mapZoom, setMapZoom] = useState(5);

  useEffect(() => {
    if (activeTab === "mapa") {
      geocodeAllServices();
    }
  }, [activeTab, items]);

  async function geocodeAllServices() {
    const list = [];
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      if (s.estado !== "activo") continue; // only active services on map
      let lat = 25.6866;
      let lon = -100.3161;
      
      let success = false;
      if (s.latitud !== null && s.latitud !== undefined && s.longitud !== null && s.longitud !== undefined) {
        lat = Number(s.latitud);
        lon = Number(s.longitud);
        success = true;
      }
      
      if (!success) {
        const seed = s.nombre + s.id;
        let hash = 0;
        for (let j = 0; j < seed.length; j++) {
          hash = seed.charCodeAt(j) + ((hash << 5) - hash);
        }
        const offsetLat = ((hash % 100) / 1000) * (hash > 0 ? 1 : -1);
        const offsetLon = (((hash >> 8) % 100) / 1000) * (hash > 0 ? 1 : -1);
        
        const nameSede = (sedeNombre(s.sede_id) || "").toLowerCase();
        if (nameSede.includes("monterrey")) {
          lat = 25.6866 + offsetLat;
          lon = -100.3161 + offsetLon;
        } else if (nameSede.includes("cdmx") || nameSede.includes("mexico")) {
          lat = 19.4326 + offsetLat;
          lon = -99.1332 + offsetLon;
        } else {
          lat = 23.6345 + offsetLat;
          lon = -102.5528 + offsetLon;
        }
      }
      
      list.push({
        ...s,
        position: [lat, lon]
      });
    }
    setGeocodedServices(list);

    if (list.length > 0) {
      const avgLat = list.reduce((sum, item) => sum + item.position[0], 0) / list.length;
      const avgLon = list.reduce((sum, item) => sum + item.position[1], 0) / list.length;
      setMapCenter([avgLat, avgLon]);
      setMapZoom(list.length === 1 ? 13 : 11);
    } else {
      setMapCenter([23.6345, -102.5528]);
      setMapZoom(5);
    }
  }

  const customMarkerIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class='w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-lg transform transition hover:scale-110'><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
    console.log("sedeFilter completo:", JSON.stringify(sedeFilter));

    const [data, s] = await Promise.all([
      sercoApi.entities.Servicio.filter(sedeFilter),
      sercoApi.entities.Sede.list(),
    ]);

    console.log("servicios encontrados:", data);

      console.log("DATOS SERVICIOS:", data);
      setItems(data);
      setSedes(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const servicioId = searchParams.get("registro");
    if (!servicioId || loading) return;
    const servicio = items.find((item) => item.id === servicioId);
    if (!servicio) return;

    setViewItem(servicio);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("registro");
    setSearchParams(nextParams, { replace: true });
  }, [items, loading, searchParams, setSearchParams]);


  const sedeNombre = (sedeId) => sedes.find((s) => s.id === sedeId)?.nombre || "—";

  const filtered = items.filter((item) => {
    const coincideBusqueda =
      (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.admin_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.direccion || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.telefono || "").includes(search) ||
      (item.telefono_2 || "").includes(search) ||
      (item.correo || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.correo_2 || "").toLowerCase().includes(search.toLowerCase());
 
    const statusNormalized = (item.estado || "activo").toLowerCase();
    const coincideEstado = activeTab === "activos"
      ? statusNormalized === "activo"
      : statusNormalized === "suspendido";
 
    return coincideBusqueda && coincideEstado;
  });

  
  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sede_id: defaultSedeId });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    const cfg = getServicioCobroConfig(item.id) || {};
    setForm({ 
      ...emptyForm, 
      ...item, 
      telefono: item.telefono || "",
      telefono_2: item.telefono_2 || "",
      correo: item.correo || "",
      correo_2: item.correo_2 || "",
      estado: item.estado || "activo",
      fecha_baja: item.fecha_baja ?? "",
      latitud: item.latitud ?? "",
      longitud: item.longitud ?? "",
      metodo_pago: cfg.metodo_pago || item.metodo_pago || "transferencia",
      nombre_constancia: cfg.nombre_constancia || item.nombre_constancia || ""
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let finalLat = null;
      let finalLon = null;

      // Always geocode on save if address is present using step-down fallbacks
      if (form.direccion) {
        try {
          const nameSede = sedes.find(s => s.id === form.sede_id || String(s.id) === String(form.sede_id))?.nombre || "";
          const coords = await geocodeAddressWithFallbacks(form.direccion, nameSede);
          if (coords) {
            finalLat = coords.lat;
            finalLon = coords.lon;
          }
        } catch (e) {
          console.error("Geocoding failed during save:", e);
        }
      }

      const payload = {
        nombre: (form.nombre || "").trim(),
        direccion: (form.direccion || "").trim() || null,
        admin_nombre: (form.admin_nombre || "").trim() || null,
        telefono: (form.telefono || "").trim() || null,
        telefono_2: (form.telefono_2 || "").trim() || null,
        correo: (form.correo || "").trim() || null,
        correo_2: (form.correo_2 || "").trim() || null,
        estado: form.estado || "activo",
        fecha_inicio: form.fecha_inicio || null,
        fecha_baja: form.estado === "suspendido" ? (form.fecha_baja || null) : null,
        latitud: finalLat,
        longitud: finalLon,
        nombre_constancia: (form.nombre_constancia || "").trim() || null,
        metodo_pago: form.metodo_pago || "transferencia"
      };

      if (form.sede_id) {
        payload.sede_id = form.sede_id;
      }

      let savedItem = null;

      if (editing) {
        try {
          savedItem = await sercoApi.entities.Servicio.update(editing.id, payload);
        } catch (err) {
          if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
            const fallback = { ...payload };
            delete fallback.telefono_2;
            delete fallback.correo_2;
            delete fallback.nombre_constancia;
            delete fallback.metodo_pago;
            savedItem = await sercoApi.entities.Servicio.update(editing.id, fallback);
          } else {
            throw err;
          }
        }
        toast({ title: "Servicio actualizado con éxito" });
      } else {
        try {
          savedItem = await sercoApi.entities.Servicio.create(payload);
        } catch (err) {
          if (err?.message?.includes("PGRST204") || err?.message?.includes("column")) {
            const fallback = { ...payload };
            delete fallback.telefono_2;
            delete fallback.correo_2;
            delete fallback.nombre_constancia;
            delete fallback.metodo_pago;
            savedItem = await sercoApi.entities.Servicio.create(fallback);
          } else {
            throw err;
          }
        }

        try {
          const [startYear, startMonth] = (payload.fecha_inicio || "").split("-");
          const targetMonth = `${startYear}-${startMonth}`;
          if (startYear && startMonth) {
            const initialCobro = await sercoApi.entities.Cobro.create({
              servicio_id: savedItem.id,
              servicio_nombre: savedItem.nombre,
              mes: targetMonth,
              fecha_factura: null,
              monto: 0,
              estado: "pendiente",
              fecha_limite_pago: null,
              fecha_pago: null,
              sede_id: savedItem.sede_id,
            });
            if (initialCobro?.id) {
              try {
                localStorage.setItem(`serco_cobro_meta_${initialCobro.id}`, JSON.stringify({
                  metodo_pago: form.metodo_pago || "transferencia",
                  nombre_constancia: (form.nombre_constancia || "").trim(),
                  calcular_iva: form.metodo_pago !== "efectivo",
                }));
              } catch (_) {}
            }
          }
        } catch (cobroError) {
          console.error("No se pudo crear el cobro inicial para el servicio:", cobroError);
        }

        toast({ title: "Servicio creado con éxito" });
      }

      // Guardar configuración de cobro y constancia del servicio
      if (savedItem?.id) {
        const existingCfg = getServicioCobroConfig(savedItem.id) || {};
        setServicioCobroConfig(savedItem.id, {
          ...existingCfg,
          metodo_pago: form.metodo_pago || "transferencia",
          nombre_constancia: (form.nombre_constancia || "").trim()
        });
      }

      // Si el servicio fue suspendido, desvincular a los elementos asignados y limpiar asignaciones de plantilla
      if (savedItem && (payload.estado === "suspendido" || (savedItem.estado || "").toLowerCase() === "suspendido")) {
        const serviceId = savedItem.id;
        const serviceName = (savedItem.nombre || "").trim().toLowerCase();
        const oldName = editing ? (editing.nombre || "").trim().toLowerCase() : serviceName;

        try {
          // 1. Eliminar asignaciones de turno vinculadas a este servicio en Plantilla
          const [asigsById, asigsByName] = await Promise.all([
            sercoApi.entities.AsignacionTurno.filter({ servicio_id: serviceId }).catch(() => []),
            sercoApi.entities.AsignacionTurno.filter({ servicio_nombre: savedItem.nombre }).catch(() => []),
          ]);
          const asigsMap = new Map();
          [...(asigsById || []), ...(asigsByName || [])].forEach((a) => asigsMap.set(a.id, a));
          for (const asigId of asigsMap.keys()) {
            await sercoApi.entities.AsignacionTurno.delete(asigId).catch(() => {});
          }
        } catch (asigErr) {
          console.warn("Error al limpiar asignaciones de turno del servicio suspendido:", asigErr);
        }

        try {
          // 2. Desvincular empleados asignados a este servicio para que queden sin servicio
          const allEmps = await sercoApi.entities.Empleado.list().catch(() => []);
          const affectedEmps = (allEmps || []).filter((e) => {
            const loc = (e.servicio_ubicacion || "").trim().toLowerCase();
            return loc === serviceName || (oldName && loc === oldName);
          });

          for (const emp of affectedEmps) {
            await sercoApi.entities.Empleado.update(emp.id, {
              servicio_ubicacion: "",
            }).catch(() => {});
          }
        } catch (empErr) {
          console.warn("Error al desvincular empleados del servicio suspendido:", empErr);
        }

        toast({
          title: "Servicio Suspendido",
          description: "El servicio fue suspendido. Los elementos asignados quedaron sin servicio y ya no aparecerá en Facturas, Plantilla ni Asistencias.",
        });
      }

      setEditing(null);
      setForm(emptyForm);
      setModalOpen(false);

      if (savedItem) {
        setItems((prev) => {
          if (editing) {
            return prev.map((item) => (item.id === savedItem.id ? savedItem : item));
          }

          return prev.some((item) => item.id === savedItem.id)
            ? prev.map((item) => (item.id === savedItem.id ? savedItem : item))
            : [...prev, savedItem];
        });
      }

      try {
        await load();
      } catch (loadError) {
        console.error("No se pudo recargar la lista de servicios:", loadError?.message || loadError);
      }
    } catch (error) {
      console.error("Error al guardar servicio:", error?.message || error);
      setEditing(null);
      setForm(emptyForm);
      setModalOpen(false);

      try {
        await load();
      } catch (loadError) {
        console.error("No se pudo recargar la lista de servicios:", loadError?.message || loadError);
      }

      toast({
        title: "Error al guardar servicio",
        description: error?.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await sercoApi.entities.Servicio.delete(deleteId);
    setDeleteId(null);
    await load();
  }

  async function handleSuspendServiceDirect(item) {
    if (!item?.id) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      await sercoApi.entities.Servicio.update(item.id, {
        estado: "suspendido",
        fecha_baja: today,
      });

      const serviceId = item.id;
      const serviceName = (item.nombre || "").trim().toLowerCase();

      // 1. Limpiar turnos en Plantilla
      try {
        const [asigsById, asigsByName] = await Promise.all([
          sercoApi.entities.AsignacionTurno.filter({ servicio_id: serviceId }).catch(() => []),
          sercoApi.entities.AsignacionTurno.filter({ servicio_nombre: item.nombre }).catch(() => []),
        ]);
        const asigsMap = new Map();
        [...(asigsById || []), ...(asigsByName || [])].forEach((a) => asigsMap.set(a.id, a));
        for (const asigId of asigsMap.keys()) {
          await sercoApi.entities.AsignacionTurno.delete(asigId).catch(() => {});
        }
      } catch (asigErr) {
        console.warn("Error al limpiar asignaciones de turno:", asigErr);
      }

      // 2. Desvincular empleados
      try {
        const allEmps = await sercoApi.entities.Empleado.list().catch(() => []);
        const affectedEmps = (allEmps || []).filter((e) => {
          const loc = (e.servicio_ubicacion || "").trim().toLowerCase();
          return loc === serviceName;
        });

        for (const emp of affectedEmps) {
          await sercoApi.entities.Empleado.update(emp.id, {
            servicio_ubicacion: "",
          }).catch(() => {});
        }
      } catch (empErr) {
        console.warn("Error al desvincular empleados:", empErr);
      }

      toast({
        title: "Servicio Suspendido",
        description: "El servicio fue suspendido. Los elementos asignados quedaron sin servicio y ya no aparecerá en Facturas, Plantilla ni Asistencias.",
      });

      await load();
    } catch (err) {
      console.error("Error al suspender servicio:", err);
      toast({
        title: "Error al suspender",
        description: err.message || "Ocurrió un error inesperado al suspender el servicio.",
        variant: "destructive",
      });
    }
  }

  if (!canView("servicios")) return <AccessRestricted />;

  const estadoBadge = (estado) => {
    switch (estado) {
      case "suspendido":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Suspendido</Badge>;
      case "inactivo":
        return <Badge variant="secondary" className="bg-red-100 text-red-700">Inactivo</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>;
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Servicios</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} servicio(s)</p>
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
          {can("servicios", "create") && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-96 grid-cols-3">
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="suspendidos">Suspendidos</TabsTrigger>
          <TabsTrigger value="mapa">Mapa</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activos" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Administrador</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay servicios registrados</TableCell></TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setViewItem(item)}
                    >
                      <TableCell className="font-medium">{item.nombre}</TableCell>
                      <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.direccion || "—"}</TableCell>
                      <TableCell>{item.admin_nombre || "—"}</TableCell>
                      <TableCell>{estadoBadge(item.estado)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="suspendidos" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Administrador</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay servicios registrados</TableCell></TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setViewItem(item)}
                    >
                      <TableCell className="font-medium">{item.nombre}</TableCell>
                      <TableCell>{sedeNombre(item.sede_id)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.direccion || "—"}</TableCell>
                      <TableCell>{item.admin_nombre || "—"}</TableCell>
                      <TableCell>{estadoBadge(item.estado)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="mapa" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden h-[550px] shadow-sm relative z-0">
            <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
              <MapChangeView center={mapCenter} zoom={mapZoom} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {geocodedServices.map((service) => (
                <Marker 
                  key={service.id} 
                  position={service.position}
                  icon={customMarkerIcon}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                    <div className="font-semibold text-sm">{service.nombre}</div>
                    <div className="text-xs text-muted-foreground">{service.direccion || "Sin dirección"}</div>
                  </Tooltip>
                  <Popup>
                    <div className="p-2 space-y-1">
                      <h4 className="font-bold text-sm text-emerald-700">{service.nombre}</h4>
                      <p className="text-xs"><strong>Dirección:</strong> {service.direccion || "—"}</p>
                      <p className="text-xs"><strong>Administrador:</strong> {service.admin_nombre || "—"}</p>
                      <p className="text-xs"><strong>Sede:</strong> {sedeNombre(service.sede_id)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
            <DialogDescription>Completa los datos operativos del servicio</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label>Nombre del Servicio *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <SedeSelector value={form.sede_id} onChange={(v) => setForm({ ...form, sede_id: v })} sedes={sedes} />
            </div>
            <div>
              <Label>Dirección</Label>
              <div className="flex gap-2">
                <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="flex-1" />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={async () => {
                    if (!form.direccion) return;
                    const nameSede = sedes.find(s => s.id === form.sede_id || String(s.id) === String(form.sede_id))?.nombre || "";
                    try {
                      const coords = await geocodeAddressWithFallbacks(form.direccion, nameSede);
                      if (coords) {
                        setForm({
                          ...form,
                          latitud: coords.lat,
                          longitud: coords.lon
                        });
                        toast({ title: "Dirección ubicada en el mapa" });
                      } else {
                        toast({ title: "No se pudo ubicar la dirección", description: "Por favor marca el punto en el mapa manualmente", variant: "destructive" });
                      }
                    } catch (err) {
                      console.error(err);
                      toast({ 
                        title: "Error de conexión", 
                        description: "No se pudo conectar con el servidor de mapas. Inténtalo de nuevo o marca el punto manualmente.", 
                        variant: "destructive" 
                      });
                    }
                  }}
                >
                  Ubicar
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Marca la ubicación en el mapa (Haz clic para mover el pin)</Label>
              <div className="h-[200px] w-full rounded border overflow-hidden relative z-0">
                <MapContainer 
                  center={form.latitud && form.longitud ? [Number(form.latitud), Number(form.longitud)] : [23.6345, -102.5528]} 
                  zoom={form.latitud && form.longitud ? 15 : 5} 
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FormMapPicker 
                    lat={form.latitud} 
                    lon={form.longitud} 
                    onChange={(lat, lon) => setForm({ ...form, latitud: lat, longitud: lon })} 
                  />
                  {form.latitud && form.longitud && (
                    <Marker position={[Number(form.latitud), Number(form.longitud)]} icon={customMarkerIcon} />
                  )}
                </MapContainer>
              </div>
            </div>
            <div>
              <Label>Administrador</Label>
              <Input value={form.admin_nombre} onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Teléfono 1</Label>
                <Input placeholder="Teléfono principal" value={form.telefono || ""} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div>
                <Label>Teléfono 2 (Opcional)</Label>
                <Input placeholder="Teléfono secundario" value={form.telefono_2 || ""} onChange={(e) => setForm({ ...form, telefono_2: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Correo 1</Label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.correo || ""}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                />
              </div>
              <div>
                <Label>Correo 2 (Opcional)</Label>
                <Input
                  type="email"
                  placeholder="correo2@ejemplo.com"
                  value={form.correo_2 || ""}
                  onChange={(e) => setForm({ ...form, correo_2: e.target.value })}
                />
              </div>
            </div>
            <div>
              <div>
                <Label>Fecha de inicio *</Label>
                <Input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                />
              </div>
              <Label className="mt-2 block">Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v, fecha_baja: v === "suspendido" ? new Date().toISOString().slice(0, 10) : "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="suspendido">Baja / Suspendido</SelectItem>
                </SelectContent>
              </Select>
              {form.estado === "suspendido" && (
                <div className="mt-2">
                  <Label>Fecha de Baja *</Label>
                  <Input
                    type="date"
                    value={form.fecha_baja}
                    onChange={(e) => setForm({ ...form, fecha_baja: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>

            {/* CONFIGURACIÓN DE FACTURACIÓN Y PAGO */}
            <div className="rounded-lg border p-3.5 bg-slate-50 dark:bg-slate-900/40 space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Facturación y Método de Pago
              </Label>
              <div>
                <Label>Método de Pago Habitual</Label>
                <Select
                  value={form.metodo_pago || "transferencia"}
                  onValueChange={(v) => setForm({ ...form, metodo_pago: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(form.metodo_pago === "transferencia" || form.metodo_pago === "cheque" || !form.metodo_pago) && (
                <div className="space-y-1">
                  <Label htmlFor="nombre_constancia_serv">
                    Nombre en Constancia de Situación Fiscal (Razón Social Receptor)
                  </Label>
                  <Input
                    id="nombre_constancia_serv"
                    placeholder="Ej. GRUPO INDUSTRIAL DEL NORTE S.A. DE C.V."
                    value={form.nombre_constancia || ""}
                    onChange={(e) => setForm({ ...form, nombre_constancia: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Se utilizará automáticamente como "RECEPTOR" al descargar el archivo Excel de facturas.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre || !form.fecha_inicio || !form.sede_id}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            <Dialog open={!!viewItem} onOpenChange={(v) => !v && setViewItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{viewItem?.nombre}</DialogTitle>
            <DialogDescription>
              Información del servicio
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">

            <div>
              <Label>Dirección</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.direccion || "—"}
              </p>
            </div>

            {viewItem?.latitud && viewItem?.longitud && (
              <div>
                <Label>Ubicación Geográfica (Manual)</Label>
                <p className="text-sm text-muted-foreground font-mono">
                  {viewItem.latitud}, {viewItem.longitud}
                </p>
              </div>
            )}

            <div>
              <Label>Administrador</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.admin_nombre || "—"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Teléfono 1</Label>
                <p className="text-sm text-muted-foreground">
                  {viewItem?.telefono || "—"}
                </p>
              </div>
              <div>
                <Label>Teléfono 2</Label>
                <p className="text-sm text-muted-foreground">
                  {viewItem?.telefono_2 || "—"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Correo 1</Label>
                <p className="text-sm text-muted-foreground">
                  {viewItem?.correo || "—"}
                </p>
              </div>
              <div>
                <Label>Correo 2</Label>
                <p className="text-sm text-muted-foreground">
                  {viewItem?.correo_2 || "—"}
                </p>
              </div>
            </div>

            <div>
              <Label>Fecha de inicio</Label>
              <p className="text-sm text-muted-foreground">
                {viewItem?.fecha_inicio || "—"}
              </p>
            </div>

             <div>
              <Label>Estado</Label>
              <div className="mt-1">
                {estadoBadge(viewItem?.estado)}
              </div>
            </div>

            {viewItem?.estado === "suspendido" && viewItem?.fecha_baja && (
              <div>
                <Label>Fecha de Baja</Label>
                <p className="text-sm text-muted-foreground">
                  {viewItem.fecha_baja}
                </p>
              </div>
            )}

            {(() => {
              const cfg = viewItem?.id ? getServicioCobroConfig(viewItem.id) : null;
              const constancia = viewItem?.nombre_constancia || cfg?.nombre_constancia;
              const metodo = viewItem?.metodo_pago || cfg?.metodo_pago;
              if (!constancia && !metodo) return null;
              return (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Facturación y Cobro</Label>
                  {metodo && (
                    <div>
                      <span className="text-xs text-muted-foreground">Método de pago: </span>
                      <span className="text-sm font-semibold capitalize">{metodo}</span>
                    </div>
                  )}
                  {constancia && (
                    <div>
                      <span className="text-xs text-muted-foreground">Nombre en Constancia (Receptor): </span>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{constancia}</p>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>

          <DialogFooter>
            {can("servicios", "delete") && (
              <Button
                variant="destructive"
                onClick={() => {
                  setViewItem(null);
                  setDeleteId(viewItem.id);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}

            {can("servicios", "edit") && (
              <Button
                variant="outline"
                onClick={() => {
                  setViewItem(null);
                  openEdit(viewItem);
                }}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}

            {can("servicios", "edit") && (viewItem?.estado || "activo") === "activo" && (
              <Button
                variant="outline"
                className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950"
                onClick={() => {
                  const target = viewItem;
                  setViewItem(null);
                  handleSuspendServiceDirect(target);
                }}
              >
                Suspender Servicio
              </Button>
            )}

            <Button onClick={() => setViewItem(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="¿Eliminar servicio?"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  );
}