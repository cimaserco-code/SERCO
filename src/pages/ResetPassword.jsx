import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checking, setChecking] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function evaluateRecoverySession() {
      // 1. Revisar si hay error en hash o en query params (p. ej. token expirado)
      const rawHash = window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(rawHash);

      const urlErrorDesc = hashParams.get("error_description") || searchParams.get("error_description");
      const urlError = hashParams.get("error") || searchParams.get("error");

      if (urlErrorDesc || urlError) {
        if (isMounted) {
          const cleanDesc = (urlErrorDesc || urlError || "").replace(/\+/g, " ");
          if (/expired|invalid|token/i.test(cleanDesc)) {
            setError("El enlace de restablecimiento es inválido o ha expirado. Por favor solicita uno nuevo.");
          } else {
            setError(cleanDesc || "El enlace no es válido. Por favor solicita uno nuevo.");
          }
          setCanReset(false);
          setChecking(false);
        }
        return;
      }

      // 2. Si viene un código PKCE (?code=...), intercambiarlo por sesión
      const code = searchParams.get("code");
      if (code) {
        try {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (codeErr) {
            console.error("Error intercambiando código auth:", codeErr);
          }
        } catch (e) {
          console.error("Error procesando código auth:", e);
        }
      }

      // 3. Revisar si ya existe sesión activa de recuperación o hash con token
      const hasRecoveryHash =
        rawHash.includes("type=recovery") ||
        rawHash.includes("access_token=") ||
        rawHash.includes("refresh_token=");

      const { data: { session } } = await supabase.auth.getSession();

      if (session || hasRecoveryHash) {
        if (isMounted) {
          setCanReset(true);
          setChecking(false);
        }
        return;
      }

      // 4. Suscribirse a cambios en caso de que supabase-js tarde unos ms en procesar el hash
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if (!isMounted) return;
        if (event === "PASSWORD_RECOVERY" || (s && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED"))) {
          setCanReset(true);
          setChecking(false);
        }
      });

      // 5. Si tras 1.5s no hay sesión ni hash de recuperación, marcar como no válido
      const timeoutId = setTimeout(async () => {
        if (!isMounted) return;
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (finalSession) {
          setCanReset(true);
        } else {
          setCanReset(false);
          setError("No se detectó un enlace de restablecimiento activo o la sesión ha expirado.");
        }
        setChecking(false);
      }, 1500);

      return () => {
        subscription?.unsubscribe();
        clearTimeout(timeoutId);
      };
    }

    const cleanupPromise = evaluateRecoverySession();

    return () => {
      isMounted = false;
      cleanupPromise.then((clean) => clean && clean());
    };
  }, [searchParams]);

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

    setLoading(true);
    try {
      await sercoApi.auth.resetPassword({ newPassword: password });
      setDone(true);
      // Limpiamos la sesión temporal de recuperación para ingresar con nueva credencial
      try {
        await supabase.auth.signOut();
      } catch {}
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      console.error("Error al restablecer contraseña:", err);
      const msg = err?.message || "";
      if (/same_password|same as/i.test(msg)) {
        setError("La nueva contraseña no puede ser idéntica a la anterior.");
      } else if (/expired|invalid|session/i.test(msg)) {
        setError("El enlace ha expirado o ya no es válido. Por favor vuelve a solicitar uno.");
      } else {
        setError(msg || "No pudimos restablecer tu contraseña. Es posible que el enlace haya expirado.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={done ? CheckCircle2 : Lock}
      title={
        done
          ? "Contraseña actualizada"
          : checking
          ? "Verificando enlace..."
          : !canReset
          ? "Enlace no válido"
          : "Establecer nueva contraseña"
      }
      subtitle={
        done
          ? "Tu contraseña ha sido cambiada exitosamente"
          : checking
          ? "Por favor espera mientras comprobamos tu enlace de recuperación"
          : !canReset
          ? "El enlace ha expirado o no es válido"
          : "Elige una contraseña segura de al menos 8 caracteres"
      }
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Volver a iniciar sesión
        </Link>
      }
    >
      {checking ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Validando token de seguridad...</p>
        </div>
      ) : done ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">
            Tu contraseña ha sido restablecida con éxito. Te estamos redirigiendo para que inicies sesión.
          </p>
          <Button asChild className="w-full h-11 font-medium">
            <Link to="/login">Iniciar sesión ahora</Link>
          </Button>
        </div>
      ) : !canReset ? (
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No se pudo validar el enlace</p>
              <p className="text-xs mt-0.5 opacity-90">
                {error || "El enlace para restablecer tu contraseña no es válido, ya fue utilizado o ha expirado."}
              </p>
            </div>
          </div>
          <Button asChild className="w-full h-12 font-medium">
            <Link to="/forgot-password">Solicitar un nuevo enlace</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                placeholder="Al menos 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repite la misma contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Actualizando contraseña...
              </>
            ) : (
              "Guardar nueva contraseña"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
