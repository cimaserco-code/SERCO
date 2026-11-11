import { supabase } from "@/lib/supabaseClient";

async function postAuthorizedJson(endpoint, payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    throw new Error("Tu sesión expiró. Inicia sesión nuevamente para continuar.");
  }

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw new Error(
      `No se pudo conectar con ${endpoint}: ${networkErr?.message || "error de red"}`
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.status === 404
        ? `La función ${endpoint} no está disponible en este entorno (requiere Vercel / servidor API activo).`
        : `Respuesta inesperada del servidor (${res.status}) en ${endpoint}.`
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Error ${res.status} al ejecutar la operación.`);
  }

  return data;
}

/**
 * Updates a user's password directly only when the user forgot their password.
 */
export function updateForgottenUserPassword({ userId, email, newPassword }) {
  return postAuthorizedJson("/api/update-user-password", {
    userId,
    email,
    newPassword,
    reason: "password_forgotten",
  });
}

/**
 * Deletes an internal (non-client) user profile and Auth account.
 */
export function deleteInternalUser({ userId, email }) {
  return postAuthorizedJson("/api/delete-user", {
    userId,
    email,
  });
}

/**
 * Automatically deletes orphaned client accounts linked to a suspended/deleted service.
 */
export function cleanupServiceClientsOnBaja({ servicioId, serviceSnapshot }) {
  return postAuthorizedJson("/api/delete-user", {
    mode: "service-baja",
    servicioId,
    serviceSnapshot,
  });
}
