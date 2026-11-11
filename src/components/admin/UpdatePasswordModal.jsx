import React, { useEffect, useState } from "react";
import { sercoApi } from "@/api/sercoClient";
import { updateForgottenUserPassword } from "@/lib/adminUserApi";
import { formatUserDisplayName } from "@/lib/userNameFormatting";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Sparkles,
} from "lucide-react";

function generateSecurePassword(length = 12) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => charset[n % charset.length]).join("");
}

export default function UpdatePasswordModal({ user, onClose }) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmedForgotten, setConfirmedForgotten] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [updatedCredentials, setUpdatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setConfirmedForgotten(false);
    setSaving(false);
    setSendingLink(false);
    setUpdatedCredentials(null);
    setCopied(false);
  }, [user]);

  const passwordsMatch = newPassword.length >= 6 && newPassword === confirmPassword;
  const canSubmit = confirmedForgotten && passwordsMatch && !saving && !sendingLink;

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!user) return;
    if (!confirmedForgotten) {
      toast({
        title: "Confirmación requerida",
        description: "Debes confirmar que el usuario olvidó su contraseña.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Contraseña demasiado corta",
        description: "Debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Verifica ambos campos de contraseña.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await updateForgottenUserPassword({
        userId: user.id,
        email: user.email,
        newPassword,
      });

      setUpdatedCredentials({
        email: result?.email || user.email,
        password: newPassword,
      });

      toast({
        title: "Contraseña actualizada",
        description: `Se asignó la nueva contraseña para ${result?.email || user.email}.`,
      });
    } catch (err) {
      toast({
        title: "Error al actualizar contraseña",
        description: err?.message || "No se pudo cambiar la contraseña.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendResetEmail() {
    if (!user?.email) return;
    setSendingLink(true);
    try {
      await sercoApi.auth.resetPasswordRequest(user.email);
      toast({
        title: "Enlace enviado",
        description: `Se envió un enlace de recuperación a ${user.email}.`,
      });
      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "No se pudo enviar el enlace de recuperación.",
        variant: "destructive",
      });
    } finally {
      setSendingLink(false);
    }
  }

  async function handleCopyCredentials() {
    if (!updatedCredentials) return;
    const text = `Acceso SERCO\nCorreo: ${updatedCredentials.email}\nNueva contraseña: ${updatedCredentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "No se pudo copiar automáticamente",
        description: "Copia los datos manualmente desde pantalla.",
        variant: "destructive",
      });
    }
  }

  function applyQuickPassword(pwd) {
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
  }

  const displayName = user
    ? formatUserDisplayName(user.nombre_completo) || user.email
    : "";

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600" />
            Actualizar Contraseña
          </DialogTitle>
          <DialogDescription>
            Recuperación de acceso para <strong>{displayName}</strong> ({user?.email}).
          </DialogDescription>
        </DialogHeader>

        {updatedCredentials ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900 space-y-2">
              <p className="font-semibold">Contraseña actualizada correctamente</p>
              <div className="rounded bg-white border border-emerald-200 p-2.5 font-mono text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">Correo:</span>{" "}
                  {updatedCredentials.email}
                </div>
                <div>
                  <span className="text-muted-foreground">Nueva contraseña:</span>{" "}
                  {updatedCredentials.password}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs bg-white"
                onClick={handleCopyCredentials}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Copiado al portapapeles
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copiar credenciales
                  </>
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Solo para olvido de contraseña</p>
                <p className="mt-0.5 text-amber-800">
                  Esta acción reemplaza directamente la contraseña actual. Úsala únicamente
                  cuando la persona olvidó su clave y necesita recuperar acceso.
                </p>
              </div>
            </div>

            {user?.role && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Rol de cuenta:</span>
                <Badge variant="outline" className="capitalize">
                  {user.role}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-user-password">Nueva contraseña</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-indigo-600"
                    onClick={() => applyQuickPassword("Serco2026")}
                  >
                    Usar Serco2026
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-emerald-700"
                    onClick={() => applyQuickPassword(generateSecurePassword())}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Generar segura
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="new-user-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={showPassword ? "Ocultar" : "Mostrar"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-user-password">Confirmar nueva contraseña</Label>
              <Input
                id="confirm-user-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                minLength={6}
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
              )}
            </div>

            <label className="flex items-start gap-2.5 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
              <Checkbox
                checked={confirmedForgotten}
                onCheckedChange={(checked) => setConfirmedForgotten(checked === true)}
                className="mt-0.5"
              />
              <span className="text-xs leading-relaxed text-foreground">
                Confirmo que el usuario <strong>olvidó su contraseña</strong> y solicitó este
                cambio para recuperar su acceso.
              </span>
            </label>

            <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground justify-start px-2"
                onClick={handleSendResetEmail}
                disabled={saving || sendingLink}
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                {sendingLink ? "Enviando correo..." : "Enviar enlace por correo"}
              </Button>
              <div className="flex items-center gap-2 justify-end">
                <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {saving ? "Actualizando..." : "Actualizar Contraseña"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
