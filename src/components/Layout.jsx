import React, { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Users, Briefcase, Package, FileText, Home, Menu, X, Clock, Shield, ChevronDown, Building2, ShieldCheck, DollarSign, Calendar, LogOut, TrendingDown, LayoutGrid, Megaphone, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";

const allNavItems = [
  { to: "/", label: "Inicio", icon: Home, module: "inicio" },
  { to: "/overview", label: "Overview", icon: LayoutGrid, module: "overview" },
  { to: "/empleados", label: "Empleados", icon: Users, module: "empleados" },
  { to: "/asistencias", label: "Asistencias", icon: Calendar, module: "asistencias" },
  { to: "/nominas", label: "Nóminas", icon: Calculator, module: "nominas" },
  { to: "/servicios", label: "Servicios", icon: Briefcase, module: "servicios" },
  { to: "/facturas", label: "Facturas", icon: DollarSign, module: "cobros" },
  { to: "/servicios/turnos", label: "Turnos", icon: Clock, module: "turnos" },
  { to: "/inventario", label: "Inventario", icon: Package, module: "inventario" },
  { to: "/documentos", label: "Documentos", icon: FileText, module: "documentos" },
  { to: "/egresos", label: "Egresos", icon: TrendingDown, module: "egresos" },
];

const adminNavItems = [
  { to: "/administracion/usuarios", label: "Usuarios", icon: Users },
  { to: "/administracion/roles", label: "Roles", icon: ShieldCheck },
  { to: "/administracion/sedes", label: "Sedes", icon: Building2 },
  { to: "/administracion/comunicados", label: "Comunicados", icon: Megaphone },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canView } = usePermissions();
  const navItems = allNavItems.filter((item) => !item.module || canView(item.module));

  const active = navItems.find((item) => {
    if (item.to === "/") return location.pathname === "/";
    if (item.to === "/servicios") return location.pathname === "/servicios";
    return location.pathname.startsWith(item.to);
  });

  const renderNavItems = (onNavigate) =>
    navItems.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/" || item.to === "/servicios"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
          }
        >
          <Icon className="w-4 h-4 shrink-0" />
          {item.label}
        </NavLink>
      );
    });

  const renderAdminNav = (onNavigate) =>
    canView("administracion") && (
      <div className="pt-3 mt-3 border-t border-sidebar-border">
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
            <Shield className="w-4 h-4 shrink-0" />
            Administración
            <ChevronDown className="w-4 h-4 ml-auto transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 space-y-1 ml-4 border-l border-sidebar-border pl-3">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`
                    }
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-sidebar-border">
          <img
            src="/favicon.png"
            alt="SERCO"
            className="h-10 w-auto object-contain"
          />
          <span className="font-heading font-bold text-sidebar-foreground">
            SERCO
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
            {renderNavItems()}
            {renderAdminNav()}
          </nav>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <img
                    src="/favicon.png"
                    alt="SERCO"
                    className="h-10 w-auto object-contain"
                  />
                <span className="font-heading font-bold text-sidebar-foreground">SERCO</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {renderNavItems(() => setSidebarOpen(false))}
              {renderAdminNav(() => setSidebarOpen(false))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              {active && <active.icon className="w-5 h-5 text-muted-foreground" />}
              <h1 className="font-heading font-semibold text-lg">{active?.label || "Inicio"}</h1>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold hidden sm:block">{user.full_name}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize">
                {user.role}
              </span>
              <Button
                onClick={() => logout(true)}
                title="Cerrar Sesión"
                className="
                  h-9
                  px-3
                  bg-black
                  text-white
                  hover:bg-gray-800
                  flex
                  items-center
                  gap-2
                  rounded-lg
                "
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Salir
                </span>
              </Button>
            </div>
          )}
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}