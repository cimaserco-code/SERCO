import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetToken = searchParams.get("token") || searchParams.get("reset_token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Contraseña demasiado corta. Debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!resetToken) {
      setError("Token invalido. Vuelve a pedir enlace.");
      return;
    }

    setLoading(true);
    try {
      await sercoApi.auth.resetPassword({ resetToken, newPassword: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch {
      setError("No pudimos restablecer tu contraseña. Es posible que el enlace haya expirado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={done ? CheckCircle2 : Lock}
      title={done ? "Contraseña actualizada" : "Establecer una nueva contraseña"}
      subtitle={done ? "Te estamos redirigiendo para iniciar sesión" : "Elige una contraseña segura para tu cuenta"}
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Volver a iniciar sesión
        </Link>
      }
    >
      {done ? (
        <p className="text-sm text-foreground text-center">
          Tu contraseña ha sido restablecida con éxito. Ahora puedes iniciar sesión con tu nueva contraseña.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                placeholder="Al menos 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Escribe la misma contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Actualizando...
              </>
            ) : (
              "Reiniciar contraseña"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
