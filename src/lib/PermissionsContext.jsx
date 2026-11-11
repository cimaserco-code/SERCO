import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";
import { isAreaDirectorRole, normalizeRoleName } from "@/lib/overviewRoles";

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async () => {
    try {
      const data = await sercoApi.entities.Rol.list();
      setRoles(data);
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
    const unsubscribe = sercoApi.entities.Rol.subscribe(() => loadRoles());
    return unsubscribe;
  }, [loadRoles]);

  const permisos = useMemo(() => {
    const exactMatch = roles.find((r) => r.nombre === user?.role);
    if (exactMatch) return exactMatch.permisos || {};
    const normTarget = normalizeRoleName(user?.role);
    const normMatch = normTarget
      ? roles.find((r) => normalizeRoleName(r.nombre) === normTarget)
      : null;
    return normMatch?.permisos || {};
  }, [roles, user?.role]);

  const isAdmin = useMemo(() => {
    const role = (user?.role || "").toLowerCase().trim();
    return role === "admin" || role === "administrador" || role === "super administrador";
  }, [user?.role]);

  const can = useCallback(
    (module, action) => {
      // Si es Admin, tiene acceso total a todas las acciones (incluyendo eliminar)
      if (isAdmin) return true;
      if (roles.length === 0) return true;
      // Para los demás roles, se respeta la configuración de permisos del rol
      return permisos?.[module]?.[action] === true;
    },
    [permisos, roles.length, isAdmin]
  );

  const canView = useCallback(
    (module) => {
      if (roles.length === 0) return true;
      if (module === "overview" && isAreaDirectorRole(user?.role)) {
        return permisos?.overview?.view !== false;
      }
      return permisos?.[module]?.view === true;
    },
    [permisos, roles.length, user?.role]
  );

  if (loading && user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <PermissionsContext.Provider value={{ can, canView, permisos, loading, refresh: loadRoles, isAdmin }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
}