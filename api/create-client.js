import { createClient } from "@supabase/supabase-js";

const adminRoles = new Set(["admin", "administrador", "super administrador"]);

function describeError(error) {
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  return parts.length ? parts.join(" | ") : "Error desconocido de Supabase.";
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido." });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return response.status(500).json({ error: "El servicio de creación de clientes no está configurado." });
  }

  const accessToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return response.status(401).json({ error: "Se requiere una sesión de administrador." });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return response.status(401).json({ error: "La sesión no es válida o expiró." });
    }

    const { data: profile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;
    if (!profile?.role) {
      return response.status(403).json({ error: "No tienes permiso para crear cuentas de cliente." });
    }

    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("nombre, permisos");
    if (rolesError) throw rolesError;

    const roleConfig = roles.find((role) => role.nombre === profile.role);
    const allowed = roleConfig?.permisos?.administracion?.view === true ||
      (roles.length === 0 && adminRoles.has(profile.role.toLowerCase().trim()));
    if (!allowed) {
      return response.status(403).json({ error: "No tienes permiso para crear cuentas de cliente." });
    }

    let body = request.body;
    if (typeof body === "string") body = JSON.parse(body);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const fullName = typeof body?.fullName === "string" && body.fullName.trim()
      ? body.fullName.trim()
      : "Cliente SERCO";
    if (!email || !password) {
      return response.status(400).json({ error: "El correo y la contraseña son obligatorios." });
    }

    const { data: createdAuth, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "cliente",
        full_name: fullName,
        usuario: email.split("@")[0],
      },
    });
    if (createAuthError) {
      const authErrorMessage = describeError(createAuthError);
      const alreadyExists = createAuthError.code === "email_exists" ||
        /already registered|already been registered|user exists|email.*exists|email.*registered/i.test(authErrorMessage);
      return response.status(alreadyExists ? 409 : 400).json({
        error: alreadyExists ? "Este correo ya está registrado en Supabase Auth." : authErrorMessage,
      });
    }

    const authUserId = createdAuth.user?.id;
    if (!authUserId) throw new Error("Supabase Auth no devolvió el usuario creado.");

    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: authUserId,
        email,
        full_name: fullName,
        role: "cliente",
        usuario: email.split("@")[0],
        estado: "active",
      });
      if (profileError) throw profileError;
    } catch (profileError) {
      const cleanupErrors = [];
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", authUserId);
      if (deleteProfileError) cleanupErrors.push(deleteProfileError.message);

      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUserId);
      if (deleteAuthError) cleanupErrors.push(deleteAuthError.message);

      const profileErrorMessage = describeError(profileError);
      console.error("No se pudo crear el perfil del cliente:", profileErrorMessage, cleanupErrors);
      return response.status(500).json({
        error: cleanupErrors.length
          ? `Falló el guardado del perfil (${profileErrorMessage}) y la limpieza automática quedó incompleta (${cleanupErrors.join(" | ")}). Contacta al administrador.`
          : `Falló el guardado del perfil (${profileErrorMessage}). La creación fue revertida.`,
      });
    }

    return response.status(201).json({ id: authUserId, email });
  } catch (error) {
    const errorMessage = describeError(error);
    console.error("Error en creación administrativa de cliente:", errorMessage);
    return response.status(500).json({ error: errorMessage });
  }
}