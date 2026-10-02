import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import {
  FileText,
  Check,
  ChevronsUpDown,
  Eye,
  Download,
  Printer,
  Loader2,
  FileCheck,
  CreditCard,
  UserCheck,
  Shield,
  FileSignature,
  Upload,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { usePermissions } from "@/lib/PermissionsContext";
import { useAuth } from "@/lib/AuthContext";
import AccessRestricted from "@/components/AccessRestricted";
import { useToast } from "@/components/ui/use-toast";
import { useSedeScope } from "@/hooks/useSedeScope";
import { formatNombreNatural } from "@/lib/userNameFormatting";
import { resolveEmpleadoNumero } from "@/lib/empleadoNumero";
import { generateContractPDF } from "@/lib/contratoTemplate";
import { generateFichaTecnicaPDF } from "@/lib/fichaTecnicaTemplate";
import { generateGafetePDF } from "@/lib/gafeteTemplate";
import { cn } from "@/lib/utils";

const defaultContractForm = {
  sede_tipo: "otras_sedes",
  tipo_contrato_otras: "prueba",
  bono_mensual: "2000",
  salario_quincenal: "",
  fecha_inicio_prueba: new Date().toISOString().split("T")[0],
  duracion_dias_prueba: "30",
  beneficiario: "",
  parentesco: "",
  porcentaje: "100",
  duracion_meses: "3",
};

const defaultFichaForm = {
  tipo_movimiento: "ALTA",
  fecha_movimiento: new Date().toISOString().split("T")[0],
  servicio_capacita: "",
  dias_capacitacion: "",
  observaciones: "",
};

export default function Documentos() {
  const { user } = useAuth();
  const { sedeFilter, defaultSedeId } = useSedeScope();
  const { canView, isAdmin } = usePermissions();
  const { toast } = useToast();

  const isSuperOrAdmin = Boolean(
    isAdmin ||
    ["admin", "administrador", "ceo", "director general"].includes((user?.role || "").toLowerCase().trim())
  );

  const [empleados, setEmpleados] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Contract Generation States
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [empComboboxOpen, setEmpComboboxOpen] = useState(false);
  const [contractForm, setContractForm] = useState(defaultContractForm);

  // Ficha Tecnica Generation States
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const [selectedFichaEmpId, setSelectedFichaEmpId] = useState("");
  const [fichaComboboxOpen, setFichaComboboxOpen] = useState(false);
  const [fichaForm, setFichaForm] = useState(defaultFichaForm);

  // Gafete Generation States
  const [gafeteModalOpen, setGafeteModalOpen] = useState(false);
  const [selectedGafeteEmpId, setSelectedGafeteEmpId] = useState("");
  const [gafeteComboboxOpen, setGafeteComboboxOpen] = useState(false);
  const [gafeteForm, setGafeteForm] = useState({
    sede_tipo: "otras_sedes",
    layout: "tarjeta",
    vigencia: "31/12/2026",
    foto_url: "",
  });
  const [customPhotoPreview, setCustomPhotoPreview] = useState("");

  // General Document Preview Modal States
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [currentDocToSave, setCurrentDocToSave] = useState(null);
  const [downloadFilename, setDownloadFilename] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [emps, s] = await Promise.all([
        sercoApi.entities.Empleado.filter(sedeFilter, "nombre_completo"),
        sercoApi.entities.Sede.list(),
      ]);
      const employeesWithNumero = (emps || []).map((emp) => ({
        ...emp,
        numero_empleado: resolveEmpleadoNumero(emp),
      }));
      const activeEmps = employeesWithNumero.filter(
        (e) => !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja)
      );
      setEmpleados(activeEmps.length > 0 ? activeEmps : employeesWithNumero);
      setSedes(s || []);
    } finally {
      setLoading(false);
    }
  }

  // ══════════════════════════════════════════════════════════
  // HANDLERS: CONTRATO LABORAL
  // ══════════════════════════════════════════════════════════
  function openContractGenerator() {
    setSelectedEmpId("");
    setContractForm(defaultContractForm);
    setEmpComboboxOpen(false);
    setContractModalOpen(true);
  }

  function handleSelectEmployee(emp) {
    setSelectedEmpId(emp.id);
    const empSede = sedes.find((s) => s.id === (emp.sede_id || defaultSedeId));
    const isMty = (empSede?.nombre || "").toLowerCase().includes("monterrey");
    const sueldoNum = Number(emp.sueldo) || 0;
    const defaultQuincenal = sueldoNum > 0 ? String(Math.round(sueldoNum / 2)) : "";

    setContractForm((prev) => ({
      ...prev,
      sede_tipo: isMty ? "monterrey" : "otras_sedes",
      tipo_contrato_otras: prev.tipo_contrato_otras || "prueba",
      bono_mensual: "2000",
      salario_quincenal: defaultQuincenal,
      fecha_inicio_prueba: emp.fecha_ingreso || new Date().toISOString().split("T")[0],
      duracion_dias_prueba: "30",
      beneficiario: emp.beneficiario || emp.contacto_emergencia || "",
      parentesco: emp.parentesco_beneficiario || emp.parentesco || "",
      porcentaje: "100",
      duracion_meses: "3",
    }));
    setEmpComboboxOpen(false);
  }

  async function handleGenerateContract() {
    const emp = empleados.find((e) => e.id === selectedEmpId);
    if (!emp) {
      toast({
        title: "Error",
        description: "Por favor selecciona un empleado para generar el contrato.",
        variant: "destructive",
      });
      return;
    }
    setGeneratingPdf(true);
    try {
      const result = await generateContractPDF(emp, contractForm, sedes, { 
        returnDoc: true,
        defaultSedeId 
      });
      setContractModalOpen(false);
      setCurrentDocToSave(result.doc);
      setPreviewPdfUrl(result.blobUrl);
      setDownloadFilename(result.filename);
      const tipoLabel = contractForm.sede_tipo === "monterrey"
        ? "Sede Monterrey"
        : contractForm.tipo_contrato_otras === "indeterminado"
          ? "Tiempo Indeterminado"
          : "Periodo de Prueba";
      setPreviewTitle(`Contrato Laboral (${tipoLabel}) - ${formatNombreNatural(emp)}`);
      setPreviewModalOpen(true);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al generar vista previa",
        description: "No se pudo generar el contrato en PDF.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  }

  // ══════════════════════════════════════════════════════════
  // HANDLERS: FICHA TÉCNICA
  // ══════════════════════════════════════════════════════════
  function openFichaGenerator() {
    setSelectedFichaEmpId("");
    setFichaForm({
      ...defaultFichaForm,
      fecha_movimiento: new Date().toISOString().split("T")[0],
    });
    setFichaComboboxOpen(false);
    setFichaModalOpen(true);
  }

  function handleSelectFichaEmployee(emp) {
    setSelectedFichaEmpId(emp.id);
    const isBaja = !!emp.fecha_baja;
    setFichaForm({
      tipo_movimiento: isBaja ? "BAJA" : "ALTA",
      fecha_movimiento: (isBaja ? emp.fecha_baja : emp.fecha_ingreso) || new Date().toISOString().split("T")[0],
      servicio_capacita: emp.servicio_ubicacion || "",
      dias_capacitacion: [emp.dia_capacitacion, emp.dia_capacitacion_2].filter(Boolean).join(" y ") || "3 días inducción RH",
      observaciones: isBaja && emp.motivo_baja ? `Motivo de baja: ${emp.motivo_baja}` : "",
    });
    setFichaComboboxOpen(false);
  }

  async function handleGenerateFicha() {
    const emp = empleados.find((e) => e.id === selectedFichaEmpId);
    if (!emp) {
      toast({
        title: "Error",
        description: "Por favor selecciona un empleado para generar la ficha técnica.",
        variant: "destructive",
      });
      return;
    }
    setGeneratingPdf(true);
    try {
      const sedeObj = sedes.find((s) => s.id === (emp.sede_id || defaultSedeId));
      const result = await generateFichaTecnicaPDF(
        emp,
        { ...fichaForm, sede_nombre: sedeObj?.nombre || "Monterrey" },
        { returnDoc: true }
      );
      setFichaModalOpen(false);
      setCurrentDocToSave(result.doc);
      setPreviewPdfUrl(result.blobUrl);
      setDownloadFilename(result.filename);
      setPreviewTitle(`Ficha Técnica (${fichaForm.tipo_movimiento}) - ${formatNombreNatural(emp)}`);
      setPreviewModalOpen(true);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al generar vista previa",
        description: "No se pudo generar la ficha técnica en PDF.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  }

  // ══════════════════════════════════════════════════════════
  // HANDLERS: GAFETE DE IDENTIFICACIÓN
  // ══════════════════════════════════════════════════════════
  function openGafeteGenerator() {
    setSelectedGafeteEmpId("");
    setGafeteForm({
      sede_tipo: "otras_sedes",
      layout: "tarjeta",
      vigencia: "31/12/2026",
      foto_url: "",
    });
    setCustomPhotoPreview("");
    setGafeteComboboxOpen(false);
    setGafeteModalOpen(true);
  }

  function handleSelectGafeteEmployee(emp) {
    setSelectedGafeteEmpId(emp.id);
    const empSede = sedes.find((s) => s.id === (emp.sede_id || defaultSedeId));
    const isMty = (empSede?.nombre || "").toLowerCase().includes("monterrey");
    setGafeteForm((prev) => ({
      ...prev,
      sede_tipo: isMty ? "monterrey" : "otras_sedes",
      foto_url: emp.foto_url || "",
      vigencia: prev.vigencia || "31/12/2026",
    }));
    setCustomPhotoPreview(emp.foto_url || "");
    setGafeteComboboxOpen(false);
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === "string") {
        setCustomPhotoPreview(dataUrl);
        setGafeteForm((prev) => ({ ...prev, foto_url: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerateGafete() {
    const emp = empleados.find((e) => e.id === selectedGafeteEmpId);
    if (!emp) {
      toast({
        title: "Error",
        description: "Por favor selecciona un empleado para generar el gafete.",
        variant: "destructive",
      });
      return;
    }
    setGeneratingPdf(true);
    try {
      const result = await generateGafetePDF(
        emp,
        {
          ...gafeteForm,
          foto_url: customPhotoPreview || gafeteForm.foto_url || emp.foto_url,
        },
        sedes,
        {
          returnDoc: true,
          defaultSedeId,
          layout: gafeteForm.layout,
        }
      );
      setGafeteModalOpen(false);
      setCurrentDocToSave(result.doc);
      setPreviewPdfUrl(result.blobUrl);
      setDownloadFilename(result.filename);
      const sedeText = gafeteForm.sede_tipo === "monterrey" ? "Monterrey" : "Otras Sedes";
      setPreviewTitle(`Gafete de Identificación (${sedeText}) - ${formatNombreNatural(emp)}`);
      setPreviewModalOpen(true);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error al generar vista previa",
        description: "No se pudo generar el gafete en PDF.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  }

  const selectedEmpleadoObj = empleados.find((e) => e.id === selectedEmpId);
  const selectedFichaEmpObj = empleados.find((e) => e.id === selectedFichaEmpId);
  const selectedGafeteEmpObj = empleados.find((e) => e.id === selectedGafeteEmpId);

  if (!canView("documentos")) return <AccessRestricted />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
            Documentos y Plantillas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generación y descarga de formatos oficiales SERCO con vista previa
          </p>
        </div>
      </div>

      {/* Botones de Documentos Directos */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs h-11 px-5"
          onClick={openContractGenerator}
        >
          <FileSignature className="w-4 h-4 mr-2" />
          Contrato Laboral
        </Button>

        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs h-11 px-5"
          onClick={openFichaGenerator}
        >
          <FileCheck className="w-4 h-4 mr-2" />
          Ficha Técnica
        </Button>

        <Button
          size="lg"
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs h-11 px-5"
          onClick={openGafeteGenerator}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Gafete
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="font-medium h-11 px-5"
          onClick={() => {
            toast({
              title: "Próximamente",
              description: "Generación de carta de renuncia en desarrollo.",
            });
          }}
        >
          <FileText className="w-4 h-4 mr-2" />
          Carta de Renuncia
        </Button>
      </div>

      {/* ══════════════════ MODAL: CONTRATO LABORAL ══════════════════ */}
      <Dialog open={contractModalOpen} onOpenChange={setContractModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generar Contrato Laboral</DialogTitle>
            <DialogDescription>
              Selecciona el empleado para generar la vista previa del contrato en PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Searchable Empleado Combobox */}
            <div className="flex flex-col gap-1.5">
              <Label>Empleado *</Label>
              <Popover open={empComboboxOpen} onOpenChange={setEmpComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={empComboboxOpen}
                    className="w-full justify-between font-normal h-10 px-3 bg-background"
                  >
                    <span className="truncate">
                      {selectedEmpleadoObj
                        ? `${formatNombreNatural(selectedEmpleadoObj)} (${selectedEmpleadoObj.puesto || "Guardia"})`
                        : "Selecciona o busca un empleado..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const normalize = (str) =>
                        (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      return normalize(value).includes(normalize(search)) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Escribe el nombre del empleado..." />
                    <CommandList>
                      <CommandEmpty>No se encontró ningún empleado.</CommandEmpty>
                      <CommandGroup>
                        {empleados.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${formatNombreNatural(emp)} ${emp.nombre_completo} ${emp.puesto || ""} ${emp.curp || ""}`}
                            onSelect={() => handleSelectEmployee(emp)}
                            className="cursor-pointer font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary",
                                selectedEmpId === emp.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{formatNombreNatural(emp)}</span>
                              <span className="text-xs text-muted-foreground">
                                {emp.puesto || "Guardia"} · {emp.servicio_ubicacion || "Sin servicio"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Si es Admin, permitir alternar de sede */}
            {isSuperOrAdmin ? (
              <div className="p-2.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Sede del Contrato (Exclusivo Administrador)
                  </Label>
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">
                    Admin
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={contractForm.sede_tipo === "otras_sedes" ? "default" : "outline"}
                    className={cn(
                      "h-8 text-xs font-medium",
                      contractForm.sede_tipo === "otras_sedes" && "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                    onClick={() => setContractForm({ ...contractForm, sede_tipo: "otras_sedes" })}
                  >
                    Otras Sedes (Xalapa / Veracruz)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={contractForm.sede_tipo === "monterrey" ? "default" : "outline"}
                    className={cn(
                      "h-8 text-xs font-medium",
                      contractForm.sede_tipo === "monterrey" && "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                    onClick={() => setContractForm({ ...contractForm, sede_tipo: "monterrey" })}
                  >
                    Sede Monterrey (NL)
                  </Button>
                </div>
              </div>
            ) : (
              selectedEmpleadoObj && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 py-0.5">
                  <span>
                    Sede: <strong className="text-foreground">{sedes.find((s) => s.id === (selectedEmpleadoObj.sede_id || defaultSedeId))?.nombre || "Otras Sedes"}</strong>
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {contractForm.sede_tipo === "monterrey" ? "Plantilla Monterrey" : "Plantilla Otras Sedes"}
                  </Badge>
                </div>
              )
            )}

            {/* Si es Otras Sedes, mostrar botones de tipo de contrato (Periodo de Prueba vs Tiempo Indeterminado) */}
            {contractForm.sede_tipo === "otras_sedes" && (
              <div>
                <Label className="mb-1.5 block">Tipo de Contrato</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={contractForm.tipo_contrato_otras === "prueba" ? "default" : "outline"}
                    className={cn(
                      "h-auto py-2 px-3 flex flex-col items-start text-left gap-0.5",
                      contractForm.tipo_contrato_otras === "prueba"
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "hover:bg-accent"
                    )}
                    onClick={() => setContractForm({ ...contractForm, tipo_contrato_otras: "prueba" })}
                  >
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      Periodo de Prueba
                      <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-white/20 text-inherit border-0">
                        30 días
                      </Badge>
                    </span>
                    <span className="text-[11px] opacity-80 font-normal">
                      Art. 39-A LFT · Cláusula de prueba
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant={contractForm.tipo_contrato_otras === "indeterminado" ? "default" : "outline"}
                    className={cn(
                      "h-auto py-2 px-3 flex flex-col items-start text-left gap-0.5",
                      contractForm.tipo_contrato_otras === "indeterminado"
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "hover:bg-accent"
                    )}
                    onClick={() => setContractForm({ ...contractForm, tipo_contrato_otras: "indeterminado" })}
                  >
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      Tiempo Indeterminado
                      <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-white/20 text-inherit border-0">
                        Planta
                      </Badge>
                    </span>
                    <span className="text-[11px] opacity-80 font-normal">
                      Art. 39-A LFT · Sin periodo de prueba
                    </span>
                  </Button>
                </div>
              </div>
            )}

            {contractForm.sede_tipo === "otras_sedes" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border border-border/60">
                <div>
                  <Label>Salario Quincenal Neto ($)</Label>
                  <Input
                    type="number"
                    value={contractForm.salario_quincenal}
                    placeholder="Ej. 4500"
                    onChange={(e) => setContractForm({ ...contractForm, salario_quincenal: e.target.value })}
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Pagadero los días 03 y 18 de cada mes
                  </span>
                </div>
                <div>
                  <Label>
                    {contractForm.tipo_contrato_otras === "indeterminado"
                      ? "Fecha de Inicio de Labores"
                      : "Fecha Inicio Periodo de Prueba"}
                  </Label>
                  <Input
                    type="date"
                    value={contractForm.fecha_inicio_prueba}
                    onChange={(e) => setContractForm({ ...contractForm, fecha_inicio_prueba: e.target.value })}
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    {contractForm.tipo_contrato_otras === "indeterminado"
                      ? "Modalidad de tiempo indeterminado"
                      : "Duración: 30 días naturales (Art. 39-A LFT)"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border border-border/60">
                <div>
                  <Label>Bono Mensual Puntualidad ($)</Label>
                  <Input
                    type="number"
                    value={contractForm.bono_mensual}
                    onChange={(e) => setContractForm({ ...contractForm, bono_mensual: e.target.value })}
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Bono semanal de asignación proporcional
                  </span>
                </div>
                <div>
                  <Label>Duración Inicial (Meses)</Label>
                  <Input
                    type="number"
                    value={contractForm.duracion_meses}
                    onChange={(e) => setContractForm({ ...contractForm, duracion_meses: e.target.value })}
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Contrato por tiempo determinado inicial
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label>Beneficiario en caso de fallecimiento</Label>
              <Input
                value={contractForm.beneficiario}
                placeholder="Nombre completo del beneficiario"
                onChange={(e) => setContractForm({ ...contractForm, beneficiario: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Parentesco</Label>
                <Input
                  value={contractForm.parentesco}
                  placeholder="Ej. Esposa, Madre, Hijo"
                  onChange={(e) => setContractForm({ ...contractForm, parentesco: e.target.value })}
                />
              </div>
              <div>
                <Label>Porcentaje (%)</Label>
                <Input
                  type="number"
                  value={contractForm.porcentaje}
                  onChange={(e) => setContractForm({ ...contractForm, porcentaje: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setContractModalOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={handleGenerateContract}
              disabled={!selectedEmpId || generatingPdf}
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1.5" /> Generar Vista Previa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ MODAL: FICHA TÉCNICA ══════════════════ */}
      <Dialog open={fichaModalOpen} onOpenChange={setFichaModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formato de Movimiento de Personal (Ficha Técnica)</DialogTitle>
            <DialogDescription>
              Selecciona el empleado y tipo de movimiento para generar la vista previa oficial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Searchable Empleado Combobox */}
            <div className="flex flex-col gap-1.5">
              <Label>Empleado *</Label>
              <Popover open={fichaComboboxOpen} onOpenChange={setFichaComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={fichaComboboxOpen}
                    className="w-full justify-between font-normal h-10 px-3 bg-background"
                  >
                    <span className="truncate">
                      {selectedFichaEmpObj
                        ? `${formatNombreNatural(selectedFichaEmpObj)} (${selectedFichaEmpObj.puesto || "Guardia"})`
                        : "Selecciona o busca un empleado..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const normalize = (str) =>
                        (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      return normalize(value).includes(normalize(search)) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Escribe el nombre del empleado..." />
                    <CommandList>
                      <CommandEmpty>No se encontró ningún empleado.</CommandEmpty>
                      <CommandGroup>
                        {empleados.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${formatNombreNatural(emp)} ${emp.nombre_completo} ${emp.puesto || ""} ${emp.curp || ""}`}
                            onSelect={() => handleSelectFichaEmployee(emp)}
                            className="cursor-pointer font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary",
                                selectedFichaEmpId === emp.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{formatNombreNatural(emp)}</span>
                              <span className="text-xs text-muted-foreground">
                                {emp.puesto || "Guardia"} · {emp.servicio_ubicacion || "Sin servicio"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Selector de Tipo de Movimiento */}
            <div>
              <Label className="block mb-1.5">Tipo de Movimiento *</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={fichaForm.tipo_movimiento === "ALTA" ? "default" : "outline"}
                  className={cn(
                    "w-full font-bold",
                    fichaForm.tipo_movimiento === "ALTA"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-emerald-700 border-emerald-300 dark:border-emerald-800"
                  )}
                  onClick={() => setFichaForm({ ...fichaForm, tipo_movimiento: "ALTA" })}
                >
                  ✓ ALTA DE PERSONAL
                </Button>
                <Button
                  type="button"
                  variant={fichaForm.tipo_movimiento === "BAJA" ? "default" : "outline"}
                  className={cn(
                    "w-full font-bold",
                    fichaForm.tipo_movimiento === "BAJA"
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "text-red-700 border-red-300 dark:border-red-800"
                  )}
                  onClick={() => setFichaForm({ ...fichaForm, tipo_movimiento: "BAJA" })}
                >
                  ✕ BAJA DE PERSONAL
                </Button>
              </div>
            </div>

            {/* Fecha del Movimiento y Servicio de Capacitación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Fecha Efectiva del Movimiento</Label>
                <Input
                  type="date"
                  value={fichaForm.fecha_movimiento}
                  onChange={(e) => setFichaForm({ ...fichaForm, fecha_movimiento: e.target.value })}
                />
              </div>
              <div>
                <Label>Servicio en el que se capacita</Label>
                <Input
                  value={fichaForm.servicio_capacita}
                  placeholder="Ej. Oficina / Centro Operativo"
                  onChange={(e) => setFichaForm({ ...fichaForm, servicio_capacita: e.target.value })}
                />
              </div>
            </div>

            {/* Días de Capacitación RH */}
            <div>
              <Label>Días de Capacitación RH</Label>
              <Input
                value={fichaForm.dias_capacitacion}
                placeholder="Ej. 3 días teórico / práctico en base"
                onChange={(e) => setFichaForm({ ...fichaForm, dias_capacitacion: e.target.value })}
              />
            </div>

            {/* Observaciones */}
            <div>
              <Label>Observaciones / Comentarios</Label>
              <Textarea
                rows={3}
                value={fichaForm.observaciones}
                placeholder="Indica cualquier anotación, motivo de baja o detalle relevante..."
                onChange={(e) => setFichaForm({ ...fichaForm, observaciones: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFichaModalOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              onClick={handleGenerateFicha}
              disabled={!selectedFichaEmpId || generatingPdf}
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1.5" /> Generar Vista Previa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ MODAL: GAFETE DE IDENTIFICACIÓN ══════════════════ */}
      <Dialog open={gafeteModalOpen} onOpenChange={setGafeteModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generar Gafete de Identificación</DialogTitle>
            <DialogDescription>
              Selecciona el empleado y revisa los datos y fotografía para emitir su gafete oficial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Searchable Empleado Combobox */}
            <div className="flex flex-col gap-1.5">
              <Label>Empleado *</Label>
              <Popover open={gafeteComboboxOpen} onOpenChange={setGafeteComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={gafeteComboboxOpen}
                    className="w-full justify-between font-normal h-10 px-3 bg-background"
                  >
                    <span className="truncate">
                      {selectedGafeteEmpObj
                        ? `${formatNombreNatural(selectedGafeteEmpObj)} (${selectedGafeteEmpObj.puesto || "Guardia"})`
                        : "Selecciona o busca un empleado..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const normalize = (str) =>
                        (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      return normalize(value).includes(normalize(search)) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Escribe el nombre del empleado..." />
                    <CommandList>
                      <CommandEmpty>No se encontró ningún empleado.</CommandEmpty>
                      <CommandGroup>
                        {empleados.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${formatNombreNatural(emp)} ${emp.nombre_completo} ${emp.puesto || ""} ${emp.curp || ""}`}
                            onSelect={() => handleSelectGafeteEmployee(emp)}
                            className="cursor-pointer font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary",
                                selectedGafeteEmpId === emp.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{formatNombreNatural(emp)}</span>
                              <span className="text-xs text-muted-foreground">
                                {emp.puesto || "Guardia"} · {emp.servicio_ubicacion || "Sin servicio"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sede del Gafete (Exclusivo Administrador para alternar) */}
            {isSuperOrAdmin ? (
              <div className="p-2.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Sede de la Plantilla (Exclusivo Administrador)
                  </Label>
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">
                    Admin
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={gafeteForm.sede_tipo === "otras_sedes" ? "default" : "outline"}
                    className={cn(
                      "h-8 text-xs font-medium",
                      gafeteForm.sede_tipo === "otras_sedes" && "bg-amber-600 hover:bg-amber-700 text-white"
                    )}
                    onClick={() => setGafeteForm({ ...gafeteForm, sede_tipo: "otras_sedes" })}
                  >
                    Otras Sedes (Veracruz / Xalapa)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={gafeteForm.sede_tipo === "monterrey" ? "default" : "outline"}
                    className={cn(
                      "h-8 text-xs font-medium",
                      gafeteForm.sede_tipo === "monterrey" && "bg-amber-600 hover:bg-amber-700 text-white"
                    )}
                    onClick={() => setGafeteForm({ ...gafeteForm, sede_tipo: "monterrey" })}
                  >
                    Sede Monterrey (NL)
                  </Button>
                </div>
              </div>
            ) : (
              selectedGafeteEmpObj && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 py-0.5">
                  <span>
                    Sede: <strong className="text-foreground">{sedes.find((s) => s.id === (selectedGafeteEmpObj.sede_id || defaultSedeId))?.nombre || "Otras Sedes"}</strong>
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {gafeteForm.sede_tipo === "monterrey" ? "Plantilla Monterrey" : "Plantilla Otras Sedes"}
                  </Badge>
                </div>
              )
            )}

            {/* Formato / Tamaño de Salida */}
            <div>
              <Label className="mb-1.5 block">Formato de Impresión</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={gafeteForm.layout === "tarjeta" ? "default" : "outline"}
                  className={cn(
                    "h-auto py-2 px-3 flex flex-col items-start text-left gap-0.5",
                    gafeteForm.layout === "tarjeta" && "bg-amber-600 hover:bg-amber-700 text-white"
                  )}
                  onClick={() => setGafeteForm({ ...gafeteForm, layout: "tarjeta" })}
                >
                  <span className="font-semibold text-xs">Tarjeta PVC (CR-80)</span>
                  <span className="text-[11px] opacity-80 font-normal">Frente y Reverso (2 páginas tamaño estándar)</span>
                </Button>
                <Button
                  type="button"
                  variant={gafeteForm.layout === "hoja_carta" ? "default" : "outline"}
                  className={cn(
                    "h-auto py-2 px-3 flex flex-col items-start text-left gap-0.5",
                    gafeteForm.layout === "hoja_carta" && "bg-amber-600 hover:bg-amber-700 text-white"
                  )}
                  onClick={() => setGafeteForm({ ...gafeteForm, layout: "hoja_carta" })}
                >
                  <span className="font-semibold text-xs">Hoja Imprimible (Carta)</span>
                  <span className="text-[11px] opacity-80 font-normal">Frente y Reverso lado a lado con guías</span>
                </Button>
              </div>
            </div>

            {/* Fotografía del Empleado */}
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 flex items-center gap-4">
              <div className="w-16 h-20 bg-muted rounded-md border border-border/80 overflow-hidden flex items-center justify-center shrink-0">
                {customPhotoPreview || selectedGafeteEmpObj?.foto_url ? (
                  <img
                    src={customPhotoPreview || selectedGafeteEmpObj?.foto_url}
                    alt="Foto Gafete"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground/60" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold">Fotografía para el Gafete</Label>
                <p className="text-[11px] text-muted-foreground">
                  {customPhotoPreview || selectedGafeteEmpObj?.foto_url
                    ? "Fotografía cargada. Puedes reemplazarla si deseas usar otra imagen."
                    : "El empleado no tiene foto registrada. Puedes subir una para este gafete."}
                </p>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-input hover:bg-accent transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Subir Fotografía
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  {(customPhotoPreview && customPhotoPreview !== selectedGafeteEmpObj?.foto_url) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => {
                        setCustomPhotoPreview(selectedGafeteEmpObj?.foto_url || "");
                        setGafeteForm({ ...gafeteForm, foto_url: selectedGafeteEmpObj?.foto_url || "" });
                      }}
                    >
                      Restaurar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Vigencia */}
            <div>
              <Label>Vigencia en el Gafete</Label>
              <Input
                value={gafeteForm.vigencia}
                placeholder="Ej. 31/12/2026"
                onChange={(e) => setGafeteForm({ ...gafeteForm, vigencia: e.target.value })}
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Aparece al pie del frente del gafete junto al número de permiso estatal.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGafeteModalOpen(false)}>Cancelar</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              onClick={handleGenerateGafete}
              disabled={!selectedGafeteEmpId || generatingPdf}
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1.5" /> Generar Vista Previa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ MODAL: VISTA PREVIA PDF ══════════════════ */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <DialogTitle className="text-base sm:text-lg font-bold truncate">
                  {previewTitle || "Vista Previa de Documento"}
                </DialogTitle>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex text-xs shrink-0">
                Documento Oficial SERCO
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Revisa el formato antes de descargarlo o imprimirlo.
            </DialogDescription>
          </DialogHeader>

          {/* PDF Viewer Container */}
          <div className="flex-1 w-full my-2 bg-muted/30 rounded-xl overflow-hidden border border-border min-h-[400px]">
            {previewPdfUrl ? (
              <iframe
                src={previewPdfUrl}
                className="w-full h-full border-0 rounded-lg"
                title="Vista previa del documento generado"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                Cargando vista previa del documento...
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border flex flex-row items-center justify-between gap-2 w-full">
            <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
              Cerrar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (previewPdfUrl) {
                    window.open(previewPdfUrl, "_blank");
                  }
                }}
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir
              </Button>
              <Button
                className="bg-primary text-primary-foreground font-semibold"
                onClick={() => {
                  if (currentDocToSave && downloadFilename) {
                    currentDocToSave.save(downloadFilename);
                    toast({
                      title: "Descarga iniciada",
                      description: `Se ha descargado el archivo ${downloadFilename}.`,
                    });
                  }
                }}
              >
                <Download className="w-4 h-4 mr-1.5" />
                Descargar PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}