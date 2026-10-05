import React, { useEffect, useState, useMemo } from "react";
import { sercoApi } from "@/api/sercoClient";
import { formatUserDisplayName } from "@/lib/userNameFormatting";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { 
  Plus, 
  Pencil, 
  Search, 
  Lock, 
  KeyRound, 
  Building2, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  UserPlus, 
  ShieldCheck, 
  Sparkles 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const { canView } = usePermissions();
  const isAdmin = canView("administracion");
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("personal");

  // Invitación normal (personal interno)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);

  // Creación de cliente con contraseña genérica Serco2026
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    email: "",
    full_name: "",
    servicio_id: "",
    password: "Serco2026",
  });
  const [creatingClient, setCreatingClient] = useState(false);
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(null);

  // Edición y Reseteo
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: "user", sede_ids: [], estado: "active" });
  const [saving, setSaving] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    load();
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    try {
      const [u, s, r, servs] = await Promise.all([
        sercoApi.entities.User.list(),
        sercoApi.entities.Sede.list(),
        sercoApi.entities.Rol.list(),
        sercoApi.entities.Servicio.list().catch(() => []),
      ]);
      setUsers(u || []);
      setSedes(s || []);
      setRoles(r || []);
      setServices(servs || []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter((u) =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const sedeNombres = (sedeIds) => {
    const ids = sedeIds || [];
    if (!ids.length) return "—";
    const names = sedes.filter((s) => ids.includes(s.id)).map((s) => s.nombre);
    return names.length ? names.join(", ") : "—";
  };

  function openInvite() {
    setInviteEmail("");
    setInviteRole(roles.length > 0 ? roles[0].nombre : "");
    setInviteOpen(true);
  }

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await sercoApi.users.inviteUser(inviteEmail, "user");
      if (inviteRole) {
        try {
          const allUsers = await sercoApi.entities.User.list();
          const newUser = allUsers.find((u) => u.email === inviteEmail);
          if (newUser) {
            await sercoApi.entities.User.update(newUser.id, { role: inviteRole });
          }
        } catch {}
      }
      toast({
        title: "Invitación enviada",
        description: `Se envió una invitación a ${inviteEmail}. El usuario aparecerá en la lista cuando acepte.`,
      });
      setInviteOpen(false);
      await load();
    } catch (e) {
      toast({
        title: "Error",
        description: e.message || "No se pudo enviar la invitación",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  }

  function openEdit(u) {
    setEditUser(u);
    setEditForm({
      full_name: u.full_name || "",
      role: u.role || "",
      sede_ids: u.sede_ids || (u.sede_id ? [u.sede_id] : []),
      estado: u.estado || "active",
    });
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await sercoApi.entities.User.update(editUser.id, {
        full_name: editForm.full_name,
        role: editForm.role,
        sede_ids: editForm.sede_ids,
        estado: editForm.estado,
      });
      toast({ title: "Usuario actualizado" });
      setEditUser(null);
      await load();
    } catch (e) {
      toast({
        title: "Error",
        description: e.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function openReset(u) {
    setResetUser(u);
  }

  async function handleReset() {
    setResetting(true);
    try {
      await sercoApi.auth.resetPasswordRequest(resetUser.email);
      toast({ title: "Enlace enviado", description: `Se envió un enlace de restablecimiento a ${resetUser.email}` });
      setResetUser(null);
    } catch (e) {
      toast({ title: "Error", description: e.message || "No se pudo enviar el enlace", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  const isClientUser = (u) => (u.role || "").toLowerCase().trim() === "cliente";
  const internalUsers = filtered.filter((u) => !isClientUser(u));
  const clientUsers = filtered.filter(isClientUser);

  // Servicios vinculados al correo del cliente
  const getLinkedServices = (userEmail, userFullName) => {
    const em = (userEmail || "").toLowerCase().trim();
    const fn = (userFullName || "").toLowerCase().trim();
    if (!em && !fn) return [];
    return services.filter((s) => {
      const c1 = (s.correo || "").toLowerCase().trim();
      const c2 = (s.correo_2 || "").toLowerCase().trim();
      const admin = (s.admin_nombre || "").toLowerCase().trim();
      return (em && (c1 === em || c2 === em)) || (fn && admin === fn);
    });
  };

  // Servicios con correo registrado que aún no tienen usuario cliente
  const servicesWithoutUser = useMemo(() => {
    const clientEmails = new Set(
      users.map((u) => (u.email || "").toLowerCase().trim()).filter(Boolean)
    );
    return services.filter((s) => {
      const c1 = (s.correo || "").toLowerCase().trim();
      const c2 = (s.correo_2 || "").toLowerCase().trim();
      const hasEmail = c1 || c2;
      const alreadyExists = (c1 && clientEmails.has(c1)) || (c2 && clientEmails.has(c2));
      return hasEmail && !alreadyExists;
    });
  }, [services, users]);

  function openCreateClient(defaultService = null) {
    if (defaultService) {
      setClientForm({
        servicio_id: defaultService.id,
        full_name: defaultService.admin_nombre || defaultService.nombre || "",
        email: defaultService.correo || defaultService.correo_2 || "",
        password: "Serco2026",
      });
    } else {
      setClientForm({
        servicio_id: "",
        full_name: "",
        email: "",
        password: "Serco2026",
      });
    }
    setClientModalOpen(true);
  }

  async function handleCreateClient(customData = null) {
    const dataToCreate = customData || clientForm;
    const email = (dataToCreate.email || "").trim().toLowerCase();
    const fullName = (dataToCreate.full_name || "").trim() || "Cliente SERCO";
    const password = dataToCreate.password || "Serco2026";
    const servicioId = dataToCreate.servicio_id || null;

    if (!email) {
      toast({
        title: "Correo requerido",
        description: "Por favor proporciona un correo electrónico para el cliente.",
        variant: "destructive",
      });
      return;
    }

    setCreatingClient(true);
    try {
      // 1. Crear en Supabase Auth mediante cliente aislado para no cerrar la sesión del admin actual
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
      const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: authData, error: authError } = await tempAuthClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "cliente",
            full_name: fullName,
            usuario: email.split("@")[0],
          },
        },
      });

      if (authError && !authError.message?.toLowerCase().includes("already registered")) {
        throw authError;
      }

      const authUserId = authData?.user?.id;

      // 2. Guardar o actualizar en la tabla profiles con role = "cliente"
      if (authUserId) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .upsert({
            id: authUserId,
            email,
            full_name: fullName,
            role: "cliente",
            usuario: email.split("@")[0],
            estado: "active",
          });
        if (profileErr) console.warn("Aviso al actualizar profiles:", profileErr.message);
      } else {
        const { error: directErr } = await supabase
          .from("profiles")
          .upsert(
            {
              email,
              full_name: fullName,
              role: "cliente",
              usuario: email.split("@")[0],
              estado: "active",
            },
            { onConflict: "email" }
          );
        if (directErr) {
          await sercoApi.entities.User.create({
            email,
            full_name: fullName,
            role: "cliente",
            usuario: email.split("@")[0],
            estado: "active",
          }).catch(() => {});
        }
      }

      // Si seleccionó un servicio y no tenía correo, guardarlo para sincronización
      if (servicioId) {
        const targetServ = services.find((s) => s.id === servicioId);
        if (targetServ && !targetServ.correo && !targetServ.correo_2) {
          await sercoApi.entities.Servicio.update(servicioId, { correo: email }).catch(() => {});
        }
      }

      toast({
        title: "Cliente creado exitosamente",
        description: `Usuario ${email} habilitado con contraseña genérica "${password}".`,
      });

      setClientModalOpen(false);
      setClientForm({ email: "", full_name: "", servicio_id: "", password: "Serco2026" });
      await load();
    } catch (err) {
      console.error("Error al crear usuario cliente:", err);
      toast({
        title: "Error al crear cliente",
        description: err.message || "No se pudo registrar el usuario cliente.",
        variant: "destructive",
      });
    } finally {
      setCreatingClient(false);
    }
  }

  function handleCopyCredentials(u) {
    const text = `Acceso al Portal de Clientes SERCO:\n\nUsuario / Correo: ${u.email}\nContraseña inicial: Serco2026\nEnlace de acceso: ${window.location.origin}/login\n\n(Puedes cambiar tu contraseña en cualquier momento desde tu menú en el portal).`;
    navigator.clipboard.writeText(text);
    setCopiedUserId(u.id);
    setTimeout(() => setCopiedUserId(null), 2500);
    toast({
      title: "Credenciales copiadas",
      description: `Se copiaron los datos de acceso para ${u.email}`,
    });
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg">Acceso restringido</h3>
          <p className="text-muted-foreground text-sm mt-1">No tienes permiso para ver esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* CABECERA SUPERIOR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Usuarios y Accesos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de cuentas para personal operativo y clientes de servicios SERCO.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64 h-9 text-xs"
            />
          </div>
          {activeTab === "personal" ? (
            <Button onClick={openInvite} className="h-9 text-xs">
              <Plus className="w-4 h-4 mr-1" /> Invitar Personal
            </Button>
          ) : (
            <Button onClick={() => openCreateClient()} className="h-9 text-xs">
              <UserPlus className="w-4 h-4 mr-1" /> Nuevo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* PESTAÑAS: PERSONAL INTERNO VS CLIENTES */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
          <TabsTrigger value="personal" className="text-xs">
            Personal Interno ({internalUsers.length})
          </TabsTrigger>
          <TabsTrigger value="clientes" className="text-xs">
            Clientes ({clientUsers.length})
          </TabsTrigger>
        </TabsList>

        {/* ══════════ TAB 1: PERSONAL INTERNO ══════════ */}
        <TabsContent value="personal" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Sedes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando usuarios...</TableCell></TableRow>
                ) : internalUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay usuarios del personal interno registrados.</TableCell></TableRow>
                ) : (
                  internalUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{formatUserDisplayName(u.full_name, u.role) || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{u.usuario || u.email?.split("@")[0] || "—"}</TableCell>
                      <TableCell>{u.email || "—"}</TableCell>
                      <TableCell>
                        <Badge className="bg-slate-100 text-slate-700 capitalize">
                          {u.role || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">{sedeNombres(u.sede_ids || (u.sede_id ? [u.sede_id] : []))}</TableCell>
                      <TableCell>
                        {u.estado === "inactive" ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-700">Inactivo</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openReset(u)} title="Restablecer contraseña">
                            <KeyRound className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ══════════ TAB 2: CLIENTES (APARTADO EXCLUSIVO) ══════════ */}
        <TabsContent value="clientes" className="mt-4 space-y-4">
          {/* Banner de sugerencias automáticas si hay servicios con correo sin cuenta creada */}
          {servicesWithoutUser.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
              <CardContent className="p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start sm:items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 sm:mt-0 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {servicesWithoutUser.length} servicio(s) con correo registrado listos para habilitar acceso
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Puedes crearlos automáticamente con 1 clic con la contraseña genérica "Serco2026".
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {servicesWithoutUser.slice(0, 3).map((serv) => (
                      <Button
                        key={serv.id}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] bg-white dark:bg-slate-900 border-amber-300 hover:bg-amber-100"
                        onClick={() => openCreateClient(serv)}
                      >
                        ⚡ Habilitar {serv.nombre}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de Clientes */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / Contacto</TableHead>
                  <TableHead>Correo de Acceso</TableHead>
                  <TableHead>Servicios Vinculados</TableHead>
                  <TableHead>Contraseña Inicial</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando clientes...</TableCell></TableRow>
                ) : clientUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10 space-y-2">
                      <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm font-semibold text-foreground">No hay clientes dados de alta todavía</p>
                      <p className="text-xs text-muted-foreground">
                        Crea una cuenta de cliente con la contraseña genérica "Serco2026" para darle acceso a su portal.
                      </p>
                      <Button size="sm" onClick={() => openCreateClient()} className="mt-2 text-xs">
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Crear Primer Cliente
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  clientUsers.map((u) => {
                    const linked = getLinkedServices(u.email, u.full_name);
                    const isCopied = copiedUserId === u.id;

                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-semibold text-foreground">
                          {formatUserDisplayName(u.full_name, "cliente") || "Cliente"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.email || "—"}</TableCell>
                        <TableCell>
                          {linked.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {linked.map((s) => (
                                <Badge key={s.id} variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/20">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {s.nombre}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sin servicio vinculado aún</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono font-normal bg-muted">
                            Serco2026
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.estado === "inactive" ? (
                            <Badge variant="secondary" className="bg-red-100 text-red-700">Inactivo</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyCredentials(u)}
                              title="Copiar credenciales de acceso"
                            >
                              {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openReset(u)} title="Restablecer contraseña">
                              <KeyRound className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal para Crear Cuenta de Cliente (Contraseña genérica Serco2026) */}
      <Dialog open={clientModalOpen} onOpenChange={setClientModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Crear Usuario para Cliente
            </DialogTitle>
            <DialogDescription>
              Se creará la cuenta con rol de <strong>Cliente</strong> y la contraseña genérica <strong>Serco2026</strong> lista para ingresar al portal.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateClient();
            }}
            className="space-y-4 py-2"
          >
            {/* Opcional: seleccionar un servicio existente para autocompletar */}
            {services.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Vincular a un Servicio Existente (Opcional)</Label>
                <Select
                  value={clientForm.servicio_id}
                  onValueChange={(srvId) => {
                    if (srvId === "ninguno") {
                      setClientForm((prev) => ({ ...prev, servicio_id: "" }));
                      return;
                    }
                    const sel = services.find((s) => s.id === srvId);
                    if (sel) {
                      setClientForm((prev) => ({
                        ...prev,
                        servicio_id: srvId,
                        full_name: prev.full_name || sel.admin_nombre || sel.nombre,
                        email: prev.email || sel.correo || sel.correo_2 || "",
                      }));
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Seleccionar servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">-- Ninguno (Captura Manual) --</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.nombre} {s.correo ? `(${s.correo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="clientFullName" className="text-xs">Nombre / Empresa del Cliente *</Label>
              <Input
                id="clientFullName"
                value={clientForm.full_name}
                onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                placeholder="Ej. Distribuidora del Norte o Lic. Roberto Silva"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientEmail" className="text-xs">Correo Electrónico (Usuario de Login) *</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="cliente@empresa.com"
                className="h-9 text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Este correo debe coincidir con el Correo 1 o Correo 2 de su servicio para vincular sus datos.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="clientPassword" className="text-xs">Contraseña Inicial</Label>
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                  Genérica: Serco2026
                </span>
              </div>
              <div className="relative">
                <Input
                  id="clientPassword"
                  type={showClientPassword ? "text" : "password"}
                  value={clientForm.password}
                  onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                  placeholder="Serco2026"
                  className="h-9 text-xs pr-10 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowClientPassword(!showClientPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showClientPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                El cliente podrá cambiar esta contraseña en cualquier momento directamente desde su portal.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setClientModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={creatingClient || !clientForm.email}>
                {creatingClient ? "Creando..." : "Crear Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar Usuario</DialogTitle>
            <DialogDescription>
              Se enviará una invitación por correo. El usuario aparecerá en la lista cuando acepte.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.nombre}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Podrás asignar sede y estado después de que acepte la invitación.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail || !inviteRole}>
              {inviting ? "Enviando..." : "Enviar invitación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
            <Label>Nombre</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    full_name: e.target.value,
                  })
                }
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.nombre}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sedes</Label>
              <div className="rounded-lg border p-3 max-h-48 overflow-y-auto space-y-2">
                {sedes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay sedes registradas.</p>
                ) : (
                  sedes.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`sede-${s.id}`}
                        checked={editForm.sede_ids.includes(s.id)}
                        onCheckedChange={(checked) => {
                          setEditForm((prev) => ({
                            ...prev,
                            sede_ids: checked
                              ? [...prev.sede_ids, s.id]
                              : prev.sede_ids.filter((id) => id !== s.id),
                          }));
                        }}
                      />
                      <Label htmlFor={`sede-${s.id}`} className="cursor-pointer font-normal">{s.nombre}</Label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={editForm.estado} onValueChange={(v) => setEditForm({ ...editForm, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Se enviará un enlace de restablecimiento a <strong>{resetUser?.email}</strong> para que el usuario pueda asignar una nueva contraseña.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button>
            <Button onClick={handleReset} disabled={resetting}>
              {resetting ? "Enviando..." : "Enviar enlace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}