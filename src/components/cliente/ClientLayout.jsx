import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  CalendarDays,
  Headphones,
  Shield,
  Bell,
  LogOut,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  X,
  CheckCircle2,
  DollarSign,
  User,
  BookOpen,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/AuthContext";
import { formatUserDisplayName } from "@/lib/userNameFormatting";
import { ClientPortalProvider, useClientPortal } from "@/context/ClientPortalContext";

class ClientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Client Portal Error Caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 text-center bg-card border border-border rounded-2xl shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <X className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Ocurrió un inconveniente al cargar esta sección</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {this.state.error?.message || "Error inesperado al procesar los datos del portal de cliente."}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Button size="sm" onClick={() => window.location.reload()}>
              Recargar Portal
            </Button>
            <Button size="sm" variant="outline" onClick={() => this.setState({ hasError: false })}>
              Reintentar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ClientLayoutContent() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Modal para cambiar contraseña
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleChangePassword = async (e) => {
    e?.preventDefault?.();
    setPasswordError("");
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido actualizada con éxito.",
      });
      setChangePasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Error al cambiar contraseña:", err);
      setPasswordError(err.message || "No se pudo actualizar la contraseña.");
    } finally {
      setSavingPassword(false);
    }
  };

  const {
    isAdmin,
    allServices,
    clientServices,
    selectedServicio,
    setSelectedServiceId,
    notificaciones,
    dismissNotification,
  } = useClientPortal();

  // Exactly 3 modules for client portal
  const navItems = [
    { to: "/cliente", label: "Inicio", icon: Home, end: true },
    { to: "/cliente/agenda", label: "Agenda", icon: CalendarDays, end: false },
    { to: "/cliente/atencion", label: "Atención", icon: Headphones, end: false },
  ];

  const getNotifIcon = (tipo) => {
    switch (tipo) {
      case "finanzas":
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case "personal":
        return <User className="w-4 h-4 text-blue-600" />;
      case "supervision":
        return <Eye className="w-4 h-4 text-indigo-600" />;
      case "capacitacion":
        return <BookOpen className="w-4 h-4 text-amber-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  const getNotifBg = (tipo) => {
    switch (tipo) {
      case "finanzas":
        return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40";
      case "personal":
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/40";
      case "supervision":
        return "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40";
      case "capacitacion":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/40";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  const renderNavList = (onNavigate) => (
    <div className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.end
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex overflow-hidden">
      {/* ══════════════════ DESKTOP SIDEBAR (BARRA LATERAL IZQUIERDA EN LISTA) ══════════════════ */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border shrink-0 select-none">
        {/* Sidebar Header: Logo & Brand */}
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <img
              src="/favicon.png"
              alt="SERCO"
              className="h-9 w-auto object-contain"
            />
            <div>
              <span className="font-heading font-bold text-sidebar-foreground block leading-tight text-base">
                SERCO
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Portal Cliente
              </span>
            </div>
          </div>
        </div>

        {/* ─── VISTA PREVIA ADMIN EN SIDEBAR (SIN BARRA SUPERIOR) ─── */}
        {isAdmin && (
          <div className="p-3 border-b border-sidebar-border bg-amber-500/10 dark:bg-amber-950/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Eye className="w-3 h-3" /> Modo Admin
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="h-6 text-[10px] text-amber-800 dark:text-amber-300 hover:underline p-0"
              >
                Volver al Panel
              </Button>
            </div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
              Simular Servicio:
            </label>
            <Select
              value={selectedServicio?.id ? String(selectedServicio.id) : undefined}
              onValueChange={(val) => setSelectedServiceId(val)}
            >
              <SelectTrigger className="h-7 text-xs font-semibold w-full bg-card border-amber-300 dark:border-amber-800">
                <Building2 className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
                <SelectValue placeholder="Seleccionar servicio..." />
              </SelectTrigger>
              <SelectContent>
                {(allServices || []).filter((s) => s && s.id).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Multi-service switcher for regular client (if has > 1 service) */}
        {!isAdmin && clientServices.length > 1 && (
          <div className="p-3 border-b border-sidebar-border bg-sidebar-accent/30">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Servicio Activo:
            </label>
            <Select
              value={selectedServicio?.id ? String(selectedServicio.id) : undefined}
              onValueChange={(val) => setSelectedServiceId(val)}
            >
              <SelectTrigger className="h-8 text-xs font-semibold w-full bg-sidebar border-sidebar-border">
                <Building2 className="w-3.5 h-3.5 mr-1 text-primary shrink-0" />
                <SelectValue placeholder="Seleccionar servicio..." />
              </SelectTrigger>
              <SelectContent>
                {(clientServices || []).filter((s) => s && s.id).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation Items (Lista vertical de módulos: Inicio, Agenda, Atención) */}
        <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
          <div className="px-2 pt-1 pb-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Módulos
            </span>
          </div>
          {renderNavList()}
        </nav>

        {/* Sidebar Footer: User info & Logout */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar/50 space-y-2">
          <div className="px-2 py-1 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
                Administrador
              </span>
              <span className="text-xs font-bold text-sidebar-foreground truncate block">
                {formatUserDisplayName(user?.full_name || user?.nombre || "Cliente", user?.role)}
              </span>
            </div>
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
              {(user?.full_name || user?.nombre || "C").charAt(0).toUpperCase()}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPasswordError("");
              setNewPassword("");
              setConfirmPassword("");
              setChangePasswordOpen(true);
            }}
            className="w-full justify-start text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent h-8"
          >
            <KeyRound className="w-3.5 h-3.5 mr-2 text-primary" />
            Cambiar Contraseña
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="w-full justify-start text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-8"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* ══════════════════ MOBILE SIDEBAR DRAWER ══════════════════ */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex flex-col w-64 max-w-[80%] bg-sidebar border-r border-sidebar-border z-10 p-0 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <img src="/favicon.png" alt="SERCO" className="h-8 w-auto object-contain" />
                <span className="font-heading font-bold text-sidebar-foreground text-sm">
                  Portal Cliente
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {isAdmin && (
              <div className="p-3 border-b border-sidebar-border bg-amber-500/10">
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Simular Servicio:
                </label>
                <Select
                  value={selectedServicio?.id ? String(selectedServicio.id) : undefined}
                  onValueChange={(val) => {
                    setSelectedServiceId(val);
                    setMobileSidebarOpen(false);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-semibold w-full bg-card">
                    <Building2 className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(allServices || []).filter((s) => s && s.id).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
              {renderNavList(() => setMobileSidebarOpen(false))}
            </nav>

            <div className="p-3 border-t border-sidebar-border space-y-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  setPasswordError("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setChangePasswordOpen(true);
                }}
                className="w-full justify-start text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent h-8"
              >
                <KeyRound className="w-3.5 h-3.5 mr-2 text-primary" />
                Cambiar Contraseña
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="w-full justify-start text-xs font-semibold text-red-600 hover:text-red-700 h-8"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MAIN CONTENT AREA (SIN BARRA SUPERIOR EN DESKTOP) ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Solo en móviles: pequeño botón de menú superior */}
        <div className="md:hidden h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            className="h-9 w-9 text-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
            {selectedServicio?.nombre || "SERCO"}
          </span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 text-foreground"
              >
                <Bell className="w-4 h-4" />
                {notificaciones.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notificaciones.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-0 shadow-xl z-50">
              <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
                <span className="font-semibold text-xs">Notificaciones ({notificaciones.length})</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
                {notificaciones.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-xs">
                    Sin notificaciones pendientes.
                  </div>
                ) : (
                  notificaciones.map((notif) => (
                    <div key={notif.id} className="p-3 text-xs flex items-start gap-2">
                      <div className="flex-1">
                        <span className="font-bold text-foreground block">{notif.titulo}</span>
                        <p className="text-muted-foreground">{notif.mensaje}</p>
                      </div>
                      <button
                        onClick={() => dismissNotification(notif.id)}
                        className="text-muted-foreground p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Contenido Principal a Pantalla Completa */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <ClientErrorBoundary>
            <Outlet />
          </ClientErrorBoundary>
        </main>
      </div>

      {/* Modal para Cambiar Contraseña del Cliente */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Cambiar Contraseña
            </DialogTitle>
            <DialogDescription>
              Ingresa tu nueva contraseña para la cuenta <strong>{user?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          {passwordError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-md font-medium">
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="clientNewPassword">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="clientNewPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientConfirmPassword">Confirmar Nueva Contraseña</Label>
              <Input
                id="clientConfirmPassword"
                type={showNewPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu nueva contraseña"
                required
                minLength={6}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setChangePasswordOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Guardando..." : "Actualizar Contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientLayout() {
  return (
    <ClientPortalProvider>
      <ClientLayoutContent />
    </ClientPortalProvider>
  );
}
