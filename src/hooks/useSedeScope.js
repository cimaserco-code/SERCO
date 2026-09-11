import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { sercoApi } from "@/api/sercoClient";

const SedeScopeContext = createContext(null);

export function SedeScopeProvider({ children }) {
  const { user } = useAuth();
  const { canView } = usePermissions();
  const isSuperAdmin = canView("todas_sedes");

  const [allSedes, setAllSedes] = useState([]);
  const [activeSedeId, setActiveSedeIdState] = useState(() => {
    return localStorage.getItem("serco_active_sede_id") || "all";
  });

  useEffect(() => {
    sercoApi.entities.Sede.list()
      .then((data) => setAllSedes(data || []))
      .catch(() => setAllSedes([]));
  }, []);

  const userSedeIds = useMemo(
    () => user?.sede_ids || (user?.sede_id ? [user.sede_id] : []),
    [user?.sede_ids, user?.sede_id]
  );

  const availableSedes = useMemo(() => {
    if (isSuperAdmin) return allSedes;
    if (userSedeIds.length === 0) return allSedes;
    return allSedes.filter((s) => userSedeIds.includes(s.id));
  }, [isSuperAdmin, allSedes, userSedeIds]);

  const showSedeSelector = isSuperAdmin || userSedeIds.length > 1;

  // Validate activeSedeId against available sedes
  const effectiveActiveSedeId = useMemo(() => {
    if (!showSedeSelector) {
      return userSedeIds.length === 1 ? userSedeIds[0] : "all";
    }
    if (activeSedeId === "all") return "all";
    const exists = availableSedes.some((s) => s.id === activeSedeId);
    return exists ? activeSedeId : "all";
  }, [showSedeSelector, userSedeIds, activeSedeId, availableSedes]);

  const setActiveSedeId = (newId) => {
    setActiveSedeIdState(newId || "all");
    if (newId && newId !== "all") {
      localStorage.setItem("serco_active_sede_id", newId);
    } else {
      localStorage.removeItem("serco_active_sede_id");
    }
  };

  const sedeFilter = useMemo(() => {
    if (effectiveActiveSedeId && effectiveActiveSedeId !== "all") {
      return { sede_id: effectiveActiveSedeId };
    }
    if (isSuperAdmin || userSedeIds.length === 0) return {};
    return { sede_id: { $in: userSedeIds } };
  }, [effectiveActiveSedeId, isSuperAdmin, userSedeIds]);

  const defaultSedeId = useMemo(() => {
    if (effectiveActiveSedeId && effectiveActiveSedeId !== "all") {
      return effectiveActiveSedeId;
    }
    return userSedeIds.length === 1 ? userSedeIds[0] : "";
  }, [effectiveActiveSedeId, userSedeIds]);

  const canAccessRecord = (record) => {
    if (isSuperAdmin) return true;
    return userSedeIds.includes(record?.sede_id);
  };

  const selectableSedeIds = isSuperAdmin ? null : userSedeIds;

  const value = {
    isSuperAdmin,
    userSedeIds,
    sedeFilter,
    defaultSedeId,
    showSedeSelector,
    canAccessRecord,
    selectableSedeIds,
    allSedes,
    availableSedes,
    activeSedeId: effectiveActiveSedeId,
    setActiveSedeId,
  };

  return React.createElement(SedeScopeContext.Provider, { value }, children);
}

export function useSedeScope() {
  const context = useContext(SedeScopeContext);
  if (context) return context;

  return {
    isSuperAdmin: false,
    userSedeIds: [],
    sedeFilter: {},
    defaultSedeId: "",
    showSedeSelector: false,
    canAccessRecord: () => true,
    selectableSedeIds: null,
    allSedes: [],
    availableSedes: [],
    activeSedeId: "all",
    setActiveSedeId: () => {},
  };
}