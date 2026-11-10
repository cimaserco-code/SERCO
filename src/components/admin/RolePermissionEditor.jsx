import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck } from "lucide-react";

// Módulos del sistema y acciones soportadas
const MODULES = [
  { key: "inicio", label: "Inicio", actions: ["view"] },
  { key: "overview", label: "Overview", actions: ["view"] },
  { key: "administracion", label: "Administración (Panel General)", actions: ["view"] },
  { key: "sedes", label: "Sedes (Administración)", actions: ["view", "create", "edit", "delete"] },
  { key: "usuarios", label: "Usuarios y Clientes (Administración)", actions: ["view", "create", "edit", "delete"] },
  { key: "comunicados", label: "Comunicados", actions: ["view", "create", "edit", "delete"] },
  { key: "atencion", label: "Atención a Clientes (Reportes)", actions: ["view", "create", "edit", "delete"] },
  { key: "empleados", label: "Empleados", actions: ["view", "create", "edit", "delete"] },
  { key: "asistencias", label: "Asistencias", actions: ["view", "create", "edit", "delete"] },
  { key: "servicios", label: "Servicios", actions: ["view", "create", "edit", "delete"] },
  { key: "turnos", label: "Plantilla", actions: ["view", "create", "delete"] },
  { key: "cobros", label: "Facturas", actions: ["view", "create", "edit", "delete"] },
  { key: "egresos", label: "Egresos", actions: ["view", "create", "edit", "delete"] },
  { key: "nominas", label: "Nóminas", actions: ["view", "create", "edit", "delete"] },
  { key: "inventario", label: "Inventario", actions: ["view", "create", "edit", "delete"] },
  { key: "documentos", label: "Documentos", actions: ["view", "create", "edit", "delete"] },
  { key: "agenda", label: "Agenda / Calendario", actions: ["view", "create", "edit", "delete"] },
  { key: "kpi_financiero", label: "KPI Financiero (Inicio)", actions: ["view"] },
  { key: "kpi_rh", label: "KPI Recursos Humanos (Inicio)", actions: ["view"] },
  { key: "todas_sedes", label: "Todas las sedes (Ámbito global)", actions: ["view"] },
];

const ACTION_LABELS = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
};

export const ROLE_PRESETS = [
  {
    name: "Coordinador Administrativo",
    description: "Sedes, Clientes, Usuarios, Comunicados y Reportes de Clientes",
    permisos: {
      inicio: { view: true },
      overview: { view: true },
      administracion: { view: true },
      sedes: { view: true, create: true, edit: true, delete: false },
      usuarios: { view: true, create: true, edit: true, delete: false },
      comunicados: { view: true, create: true, edit: true, delete: false },
      atencion: { view: true, create: true, edit: true, delete: false },
      servicios: { view: true, create: false, edit: false, delete: false },
      todas_sedes: { view: true },
    },
  },
  {
    name: "Administrador Total",
    description: "Acceso total e irrestricto a todos los módulos",
    permisos: {
      inicio: { view: true },
      overview: { view: true },
      administracion: { view: true },
      sedes: { view: true, create: true, edit: true, delete: true },
      usuarios: { view: true, create: true, edit: true, delete: true },
      comunicados: { view: true, create: true, edit: true, delete: true },
      atencion: { view: true, create: true, edit: true, delete: true },
      empleados: { view: true, create: true, edit: true, delete: true },
      asistencias: { view: true, create: true, edit: true, delete: true },
      servicios: { view: true, create: true, edit: true, delete: true },
      turnos: { view: true, create: true, delete: true },
      cobros: { view: true, create: true, edit: true, delete: true },
      egresos: { view: true, create: true, edit: true, delete: true },
      nominas: { view: true, create: true, edit: true, delete: true },
      inventario: { view: true, create: true, edit: true, delete: true },
      documentos: { view: true, create: true, edit: true, delete: true },
      agenda: { view: true, create: true, edit: true, delete: true },
      kpi_financiero: { view: true },
      kpi_rh: { view: true },
      todas_sedes: { view: true },
    },
  },
  {
    name: "Recursos Humanos (RH)",
    description: "Gestión de personal, asistencias, documentos y agenda",
    permisos: {
      inicio: { view: true },
      empleados: { view: true, create: true, edit: true, delete: false },
      asistencias: { view: true, create: true, edit: true, delete: false },
      servicios: { view: true, create: false, edit: false, delete: false },
      turnos: { view: true, create: true, delete: false },
      inventario: { view: true, create: true, edit: true, delete: false },
      documentos: { view: true, create: true, edit: true, delete: false },
      agenda: { view: true, create: true, edit: true, delete: false },
      atencion: { view: true, create: true, edit: true, delete: false },
      kpi_rh: { view: true },
    },
  },
];

export default function RolePermissionEditor({ permissions = {}, onChange, onApplyPreset }) {
  const toggle = (moduleKey, action, checked) => {
    const current = permissions?.[moduleKey] || {};
    const nextModule = { ...current, [action]: checked === true };

    if (action === "view" && checked !== true) {
      Object.keys(nextModule).forEach((k) => {
        nextModule[k] = false;
      });
    }

    onChange?.({ ...permissions, [moduleKey]: nextModule });
  };

  const handleApplyPreset = (preset) => {
    onChange?.(preset.permisos);
    onApplyPreset?.(preset);
  };

  return (
    <div className="space-y-3">
      {/* Selector de plantillas rápidas */}
      <div className="p-2.5 rounded-lg border bg-muted/40 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Plantillas rápidas de permisos:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              onClick={() => handleApplyPreset(preset)}
              title={preset.description}
            >
              <ShieldCheck className="w-3 h-3 mr-1 text-primary" />
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista de permisos por módulo */}
      <div className="rounded-lg border divide-y max-h-[380px] overflow-y-auto bg-card">
        {MODULES.map((mod) => {
          const modPerms = permissions?.[mod.key] || {};
          return (
            <div
              key={mod.key}
              className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/20 transition-colors"
            >
              <span className="text-xs font-semibold text-foreground">{mod.label}</span>
              <div className="flex flex-wrap gap-3">
                {mod.actions.map((action) => {
                  const id = `${mod.key}-${action}`;
                  const viewDisabled = action !== "view" && modPerms.view !== true;
                  return (
                    <label
                      key={action}
                      htmlFor={id}
                      className={`flex items-center gap-1.5 text-xs ${
                        viewDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        id={id}
                        checked={modPerms[action] === true}
                        disabled={viewDisabled}
                        onCheckedChange={(checked) => toggle(mod.key, action, checked)}
                      />
                      {ACTION_LABELS[action]}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
