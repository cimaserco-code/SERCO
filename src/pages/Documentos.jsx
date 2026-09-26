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
  FileSignature
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
import { cn } from "@/lib/utils";

const defaultContractForm = {
  bono_mensual: "2000",
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
  const { canView } = usePermissions();
  const { toast } = useToast();

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
    setContractForm({
      bono_mensual: "2000",
      beneficiario: emp.beneficiario || emp.contacto_emergencia || "",
      parentesco: emp.parentesco || "",
      porcentaje: "100",
      duracion_meses: "3",
    });
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
      const result = await generateContractPDF(emp, contractForm, sedes, { returnDoc: true });
      setContractModalOpen(false);
      setCurrentDocToSave(result.doc);
      setPreviewPdfUrl(result.blobUrl);
      setDownloadFilename(result.filename);
      setPreviewTitle(`Contrato Laboral - ${formatNombreNatural(emp)}`);
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

  const selectedEmpleadoObj = empleados.find((e) => e.id === selectedEmpId);
  const selectedFichaEmpObj = empleados.find((e) => e.id === selectedFichaEmpId);

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
          variant="outline"
          className="font-medium h-11 px-5"
          onClick={() => {
            toast({
              title: "Próximamente",
              description: "Generación de gafete en desarrollo.",
            });
          }}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Bono Mensual Puntualidad ($)</Label>
                <Input
                  type="number"
                  value={contractForm.bono_mensual}
                  onChange={(e) => setContractForm({ ...contractForm, bono_mensual: e.target.value })}
                />
              </div>
              <div>
                <Label>Duración Inicial (Meses)</Label>
                <Input
                  type="number"
                  value={contractForm.duracion_meses}
                  onChange={(e) => setContractForm({ ...contractForm, duracion_meses: e.target.value })}
                />
              </div>
            </div>

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