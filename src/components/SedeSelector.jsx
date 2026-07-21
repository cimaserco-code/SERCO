import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSedeScope } from "@/hooks/useSedeScope";

/**
 * Sede selector that respects the user's sede scope.
 * - Super admin: can pick any sede (all sedes listed)
 * - Single-sede user: auto-assigned, selector disabled
 * - Multi-sede user: can pick among their own sedes only
 */
export default function SedeSelector({ value, onChange, sedes, required = true }) {
  const { isSuperAdmin, userSedeIds, showSedeSelector } = useSedeScope();

  const availableSedes = isSuperAdmin
    ? sedes
    : sedes.filter((s) => userSedeIds.includes(s.id));

  return (
    <div>
      <Label>Sede {required && "*"}</Label>
      <Select value={value} onValueChange={onChange} disabled={!showSedeSelector}>
        <SelectTrigger><SelectValue placeholder="Selecciona una sede" /></SelectTrigger>
        <SelectContent>
          {availableSedes.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}