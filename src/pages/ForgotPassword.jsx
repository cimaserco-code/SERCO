import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

function maskEmail(email) {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const value = identifier.trim();
    if (!value) {
      setError("Por favor ingresa tu correo electrónico o tu nombre de usuario.");
      return;
    }

    setLoading(true);
    try {
      const result = await sercoApi.auth.resetPasswordRequest(value);
      if (result?.email) {
        setSentEmail(result.email);
      }
      setSent(true);
    } catch (err) {
      setError(err?.message || "Ocurrió un error al enviar el enlace. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={sent ? CheckCircle2 : Mail}
      title={sent ? "Enlace enviado" : "Reinicia tu contraseña"}
      subtitle={
        sent
          ? "Revisa tu correo para continuar"
          : "Ingresa tu usuario o correo para enviarte un enlace de restablecimiento"
      }
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">
            Si existe una cuenta asociada a{" "}
            <span className="font-semibold text-primary">
              {sentEmail ? maskEmail(sentEmail) : identifier}
            </span>
            , recibirás un enlace para restablecer tu contraseña en breve.
          </p>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs text-left space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              ¿No recibes el correo?
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Revisa tu carpeta de <strong>Correo no deseado (Spam)</strong> o Promociones.</li>
              <li>El correo puede demorar un par de minutos en llegar.</li>
              <li>Asegúrate de que tu cuenta esté registrada con ese correo.</li>
            </ul>
          </div>

          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => {
              setSent(false);
              setError("");
            }}
          >
            Intentar con otro correo o usuario
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="identifier">Usuario o Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="tu@ejemplo.com o tu usuario"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando enlace...
              </>
            ) : (
              "Enviar enlace de restablecimiento"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
