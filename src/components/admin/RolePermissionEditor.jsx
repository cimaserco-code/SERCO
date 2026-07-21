import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

// Modules and the actions each one supports, matching the permission checks
// used across the app (canView / can(module, action)).
const MODULES = [
  { key: "empleados", label: "Empleados", actions: ["view", "create", "edit", "delete"] },
  { key: "servicios", label: "Servicios", actions: ["view", "create", "edit", "delete"] },
  { key: "cobros", label: "Cobros", actions: ["view", "create", "edit", "delete"] },
  { key: "turnos", label: "Turnos", actions: ["view", "create", "delete"] },
  { key: "inventario", label: "Inventario", actions: ["view", "create", "edit", "delete"] },
  { key: "documentos", label: "Documentos", actions: ["view", "create", "edit", "delete"] },
  { key: "administracion", label: "Administración", actions: ["view"] },
  { key: "todas_sedes", label: "Todas las sedes", actions: ["view"] },
];

const ACTION_LABELS = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
};

export default function RolePermissionEditor({ permissions = {}, onChange }) {
  const toggle = (moduleKey, action, checked) => {
    const current = permissions?.[moduleKey] || {};
    const nextModule = { ...current, [action]: checked === true };

    // Turning off "view" clears the rest of the actions for that module,
    // since a user cannot act on a module they cannot see.
    if (action === "view" && checked !== true) {
      Object.keys(nextModule).forEach((k) => {
        nextModule[k] = false;
      });
    }

    onChange?.({ ...permissions, [moduleKey]: nextModule });
  };

  return (
    <div className="rounded-lg border divide-y">
      {MODULES.map((mod) => {
        const modPerms = permissions?.[mod.key] || {};
        return (
          <div
            key={mod.key}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium">{mod.label}</span>
            <div className="flex flex-wrap gap-4">
              {mod.actions.map((action) => {
                const id = `${mod.key}-${action}`;
                const viewDisabled = action !== "view" && modPerms.view !== true;
                return (
                  <label
                    key={action}
                    htmlFor={id}
                    className={`flex items-center gap-2 text-sm ${
                      viewDisabled ? "opacity-40" : "cursor-pointer"
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
  );
}
