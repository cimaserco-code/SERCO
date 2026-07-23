import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionsContext";
import { Plus, Pencil, Search, Lock, KeyRound } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const { canView } = usePermissions();
  const isAdmin = canView("administracion");
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);
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
      const [u, s, r] = await Promise.all([
        sercoApi.entities.User.list(),
        sercoApi.entities.Sede.list(),
        sercoApi.entities.Rol.list(),
      ]);
      setUsers(u);
      setSedes(s);
      setRoles(r);
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
      role: u.role || "",
      sede_ids: u.sede_ids || (u.sede_id ? [u.sede_id] : []),
      estado: u.estado || "active",
    });
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await sercoApi.entities.User.update(editUser.id, {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold">Usuarios</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} usuario(s)</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full sm:w-64" />
          </div>
          <Button onClick={openInvite}>
            <Plus className="w-4 h-4 mr-1" /> Invitar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Sedes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay usuarios. Invita usuarios con el botón "Invitar".</TableCell></TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
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