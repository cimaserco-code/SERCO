import React, { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Users, Briefcase, Package, FileText, Home, Menu, X, Clock, Shield, ChevronDown, Building2, ShieldCheck, DollarSign, Calendar, LogOut, TrendingDown, LayoutGrid, Megaphone, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { User as UserIcon, Key, Mail, AlertTriangle, Eye } from "lucide-react";
import { sercoApi } from "@/api/sercoClient";

const flatNavItems = [
  { to: "/", label: "Inicio", icon: Home, module: "inicio" },
  { to: "/overview", label: "Overview", icon: LayoutGrid, module: "overview" },
];

const navigationSections = [
  {
    title: "Operaciones",
    icon: Briefcase,
    items: [
      { to: "/servicios", label: "Servicios", icon: Briefcase, module: "servicios" },
      { to: "/servicios/plantilla", label: "Plantilla", icon: Clock, module: "turnos" },
      { to: "/asistencias", label: "Asistencias", icon: Calendar, module: "asistencias" },
      { to: "/empleados", label: "Empleados", icon: Users, module: "empleados" },
      { to: "/supervisiones", label: "Supervisiones", icon: Eye, module: "supervisiones" },
    ]
  },
  {
    title: "Finanzas",
    icon: DollarSign,
    items: [
      { to: "/facturas", label: "Facturas", icon: DollarSign, module: "cobros" },
      { to: "/nominas", label: "Nóminas", icon: Calculator, module: "nominas" },
      { to: "/egresos", label: "Egresos", icon: TrendingDown, module: "egresos" },
    ]
  },
  {
    title: "Recursos",
    icon: Package,
    items: [
      { to: "/inventario", label: "Inventario", icon: Package, module: "inventario" },
      { to: "/documentos", label: "Documentos", icon: FileText, module: "documentos" },
    ]
  }
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

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", email: "", password: "", username: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const openProfile = () => {
    setProfileForm({
      full_name: user?.full_name || "",
      email: user?.email || "",
      password: "",
      username: user?.nombre || user?.full_name?.split(" ")[0]?.toLowerCase() || ""
    });
    setProfileError("");
    setIsEditingProfile(false);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      await sercoApi.auth.updateProfile({
        email: profileForm.email !== user?.email ? profileForm.email : undefined,
        password: profileForm.password || undefined,
        full_name: profileForm.full_name,
        username: profileForm.username !== user?.nombre ? profileForm.username : undefined,
        userId: user?.id
      });
      setProfileModalOpen(false);
      window.location.reload();
    } catch (e) {
      setProfileError(e.message || "Error al actualizar perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await sercoApi.auth.deleteAccount(user?.id);
      window.location.href = "/login";
    } catch (e) {
      setProfileError(e.message || "Error al eliminar la cuenta");
    }
  };

  const allFlatItems = [...flatNavItems, ...navigationSections.flatMap(section => section.items)];

  const active = allFlatItems.find((item) => {
    if (item.to === "/") return location.pathname === "/";
    if (item.to === "/servicios") return location.pathname === "/servicios";
    return location.pathname.startsWith(item.to);
  });

  const renderFlatNavItems = (onNavigate) => {
    const visibleItems = flatNavItems.filter((item) => !item.module || canView(item.module));
    return visibleItems.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
  };

  const renderNavSections = (onNavigate) =>
    navigationSections.map((section) => {
      const visibleItems = section.items.filter((item) => !item.module || canView(item.module));
      if (visibleItems.length === 0) return null;

      const SectionIcon = section.icon;

      return (
        <div key={section.title} className="pt-2 border-t border-sidebar-border first:border-0 first:pt-0">
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
              <SectionIcon className="w-4 h-4 shrink-0" />
              <span>{section.title}</span>
              <ChevronDown className="w-4 h-4 ml-auto transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-1 ml-4 border-l border-sidebar-border pl-3">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/servicios"}
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
        <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
            <div className="space-y-0.5">
              {renderFlatNavItems()}
            </div>
            {renderNavSections()}
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
            <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
              <div className="space-y-0.5">
                {renderFlatNavItems(() => setSidebarOpen(false))}
              </div>
              {renderNavSections(() => setSidebarOpen(false))}
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
                onClick={openProfile}
                title="Mi Perfil"
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
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Perfil
                </span>
              </Button>
            </div>
          )}
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Dialog: Mi Perfil */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mi Perfil</DialogTitle>
            <DialogDescription>Actualiza tus datos personales o cambia tu contraseña</DialogDescription>
          </DialogHeader>

          {profileError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            {!isEditingProfile ? (
              <div className="space-y-3 bg-muted/40 p-4 rounded-lg border">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5" /> Nombre Completo
                  </span>
                  <span className="text-sm font-medium">{user?.full_name}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5" /> Usuario (Login)
                  </span>
                  <span className="text-sm font-bold text-primary font-mono">{user?.nombre || user?.full_name?.split(" ")[0]?.toLowerCase()}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Correo
                  </span>
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Rol de Acceso
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-muted-foreground" /> Nombre Completo</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Tu nombre completo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-muted-foreground" /> Nombre de Usuario (Login)</Label>
                  <Input
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    placeholder="Ej. emmanuel123"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> Correo Electrónico</Label>
                  <Input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="tu@correo.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-muted-foreground" /> Nueva Contraseña (Opcional)</Label>
                  <Input
                    type="password"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres si deseas cambiarla"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <div className="flex gap-2 w-full justify-between items-center flex-wrap sm:flex-nowrap">
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 border-red-200"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Eliminar Cuenta
              </Button>
              
              <div className="flex gap-2 justify-end ml-auto">
                {!isEditingProfile ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
                      Editar Perfil
                    </Button>
                    <Button variant="ghost" onClick={() => { setProfileModalOpen(false); logout(true); }}>
                      Cerrar Sesión
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setIsEditingProfile(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={savingProfile || !profileForm.full_name || !profileForm.email || !profileForm.username}>
                      {savingProfile ? "Guardando..." : "Guardar"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deleting Account */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> ¿Eliminar Cuenta?
            </DialogTitle>
            <DialogDescription>
              Esta acción es permanente y eliminará tu acceso al sistema. ¿Estás seguro de que deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>Eliminar Permanente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}