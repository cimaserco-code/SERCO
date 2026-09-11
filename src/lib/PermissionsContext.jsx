import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";

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
    const roleConfig = roles.find((r) => r.nombre === user?.role);
    return roleConfig?.permisos || {};
  }, [roles, user?.role]);

  const isAdmin = useMemo(() => {
    const role = (user?.role || "").toLowerCase().trim();
    return role === "admin" || role === "administrador" || role === "super administrador";
  }, [user?.role]);

  const can = useCallback(
    (module, action) => {
      // Los botones y acciones de eliminar sólo están permitidos para el rol Admin
      if (action === "delete") {
        return isAdmin;
      }
      if (roles.length === 0) return true;
      return permisos?.[module]?.[action] === true;
    },
    [permisos, roles.length, isAdmin]
  );

  const canView = useCallback(
    (module) => {
      if (roles.length === 0) return true;
      return permisos?.[module]?.view === true;
    },
    [permisos, roles.length]
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