import { useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";

/**
 * Centralized sede-based access control.
 * Users with the "todas_sedes" view permission see all sedes.
 * Other users are scoped to their assigned sede_ids.
 * Future modules can use this hook to inherit sede filtering automatically.
 */
export function useSedeScope() {
  const { user } = useAuth();
  const { canView } = usePermissions();
  const isSuperAdmin = canView("todas_sedes");

  const userSedeIds = useMemo(
    () => user?.sede_ids || (user?.sede_id ? [user.sede_id] : []),
    [user?.sede_ids, user?.sede_id]
  );

  const sedeFilter = useMemo(() => {
    if (isSuperAdmin || userSedeIds.length === 0) return {};
    return { sede_id: { $in: userSedeIds } };
  }, [isSuperAdmin, userSedeIds]);

  const defaultSedeId = userSedeIds.length === 1 ? userSedeIds[0] : "";
  const showSedeSelector = isSuperAdmin || userSedeIds.length > 1;

  const canAccessRecord = (record) => {
    if (isSuperAdmin) return true;
    return userSedeIds.includes(record?.sede_id);
  };

  const selectableSedeIds = isSuperAdmin ? null : userSedeIds;

  return {
    isSuperAdmin,
    userSedeIds,
    sedeFilter,
    defaultSedeId,
    showSedeSelector,
    canAccessRecord,
    selectableSedeIds,
  };
}