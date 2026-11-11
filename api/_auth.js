import { createClient } from "@supabase/supabase-js";

export const SUPER_ADMIN_ROLES = new Set([
  "admin",
  "administrador",
  "super administrador",
  "super_admin",
  "superadmin",
]);

export function normalizeText(value) {
  return (value ?? "").toString().trim();
}

export function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

export function isSuperAdminRole(role) {
  return SUPER_ADMIN_ROLES.has(normalizeLower(role));
}

export function describeError(err) {
  if (!err) return "Error desconocido";
  if (typeof err === "string") return err;
  return err.message || err.error_description || err.error || "Error interno del servidor";
}

export function applyPostCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return true;
  }
  return false;
}

export function parseJsonBody(req) {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Configuración incompleta en el servidor: falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function authenticateCaller(req, supabaseAdmin) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { errorStatus: 401, error: "Token de autorización requerido." };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { errorStatus: 401, error: "Token de autorización vacío." };
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user) {
    return { errorStatus: 401, error: "Sesión inválida o expirada." };
  }

  const callerUser = authData.user;
  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, nombre_completo, role, status")
    .eq("id", callerUser.id)
    .maybeSingle();

  if (profileErr || !callerProfile) {
    return { errorStatus: 403, error: "No se encontró el perfil del usuario autenticado." };
  }

  const callerStatus = normalizeLower(callerProfile.status);
  if (callerStatus === "inactivo" || callerStatus === "suspendido" || callerStatus === "suspended") {
    return { errorStatus: 403, error: "Tu cuenta no está activa para realizar esta acción." };
  }

  const callerRole = normalizeText(callerProfile.role || callerUser.user_metadata?.role);
  const isSuperAdmin = isSuperAdminRole(callerRole);

  let roleConfig = null;
  if (!isSuperAdmin && callerRole) {
    const { data: rolesList } = await supabaseAdmin
      .from("roles")
      .select("id, nombre, permisos");

    if (Array.isArray(rolesList)) {
      const targetRoleLower = normalizeLower(callerRole);
      roleConfig =
        rolesList.find((r) => normalizeLower(r.nombre) === targetRoleLower) || null;
    }
  }

  const permisos = roleConfig?.permisos || {};

  return {
    callerUser,
    callerProfile,
    callerRole,
    isSuperAdmin,
    roleConfig,
    permisos,
  };
}

export function hasModulePermission(callerCtx, moduleKey, actionKey = "view") {
  if (!callerCtx) return false;
  if (callerCtx.isSuperAdmin) return true;
  return callerCtx.permisos?.[moduleKey]?.[actionKey] === true;
}

export async function findAuthUserIdByEmail(supabaseAdmin, email) {
  const targetEmail = normalizeLower(email);
  if (!targetEmail) return null;

  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u) => normalizeLower(u.email) === targetEmail);
    if (match) return match.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}
