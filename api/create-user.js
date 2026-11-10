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
    return response.status(500).json({ error: "El servicio de creación de usuarios no está configurado en el servidor." });
  }

  const accessToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return response.status(401).json({ error: "Se requiere una sesión activa de administrador." });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verificar identidad del solicitante
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return response.status(401).json({ error: "La sesión no es válida o expiró." });
    }

    // 2. Verificar permisos del solicitante
    const { data: profile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;
    if (!profile?.role) {
      return response.status(403).json({ error: "No tienes permisos para crear usuarios." });
    }

    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("nombre, permisos");
    if (rolesError) throw rolesError;

    const roleConfig = roles.find((role) => role.nombre === profile.role);
    const allowed = roleConfig?.permisos?.administracion?.view === true ||
      (roles.length === 0 && adminRoles.has(profile.role.toLowerCase().trim()));
    if (!allowed) {
      return response.status(403).json({ error: "No tienes permisos de administración para crear usuarios." });
    }

    // 3. Procesar payload
    let body = request.body;
    if (typeof body === "string") body = JSON.parse(body);

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const fullName = typeof body?.fullName === "string" && body.fullName.trim()
      ? body.fullName.trim()
      : (typeof body?.full_name === "string" && body.full_name.trim() ? body.full_name.trim() : email.split("@")[0]);
    const targetRole = typeof body?.role === "string" && body.role.trim()
      ? body.role.trim()
      : "user";
    const sedeIds = Array.isArray(body?.sede_ids) ? body.sede_ids : [];
    const servicioId = body?.servicio_id || null;

    if (!email || !password) {
      return response.status(400).json({ error: "El correo electrónico y la contraseña son obligatorios." });
    }

    if (password.length < 6) {
      return response.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    // 4. Crear usuario en Supabase Auth con confirmación automática
    const { data: createdAuth, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: targetRole,
        full_name: fullName,
        usuario: email.split("@")[0],
      },
    });

    if (createAuthError) {
      const authErrorMessage = describeError(createAuthError);
      const alreadyExists = createAuthError.code === "email_exists" ||
        /already registered|already been registered|user exists|email.*exists|email.*registered/i.test(authErrorMessage);
      return response.status(alreadyExists ? 409 : 400).json({
        error: alreadyExists ? "Este correo electrónico ya está registrado en el sistema." : authErrorMessage,
      });
    }

    const authUserId = createdAuth.user?.id;
    if (!authUserId) throw new Error("Supabase Auth no devolvió el ID del usuario creado.");

    // 5. Garantizar confirmación de correo
    const { data: confirmedAuth, error: confirmationError } = await supabase.auth.admin.updateUserById(
      authUserId,
      { email_confirm: true }
    );
    if (confirmationError || !confirmedAuth.user?.email_confirmed_at) {
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(authUserId);
      const confirmationMessage = confirmationError
        ? describeError(confirmationError)
        : "Supabase no devolvió email_confirmed_at.";
      const cleanupMessage = cleanupError ? ` Limpieza incompleta: ${cleanupError.message}` : "";
      throw new Error(`No se pudo confirmar el correo del usuario: ${confirmationMessage}.${cleanupMessage}`);
    }

    // 6. Crear o actualizar perfil en la tabla profiles
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: authUserId,
        email,
        full_name: fullName,
        role: targetRole,
        usuario: email.split("@")[0],
        sede_ids: sedeIds,
        estado: "active",
      });
      if (profileError) throw profileError;
    } catch (profileError) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUserId);
      const profileErrorMessage = describeError(profileError);
      console.error("Error al crear perfil de usuario:", profileErrorMessage, deleteAuthError);
      return response.status(500).json({
        error: `Falló la creación del perfil (${profileErrorMessage}). La creación en Auth fue revertida.`,
      });
    }

    // 7. Si se especificó un servicio (para clientes), vincular si corresponde
    if (servicioId) {
      try {
        const { data: targetServ } = await supabase
          .from("servicios")
          .select("id, correo, correo_2")
          .eq("id", servicioId)
          .maybeSingle();
        if (targetServ && !targetServ.correo && !targetServ.correo_2) {
          await supabase.from("servicios").update({ correo: email }).eq("id", servicioId);
        }
      } catch (srvErr) {
        console.warn("No se pudo vincular correo al servicio:", srvErr);
      }
    }

    return response.status(201).json({
      id: authUserId,
      email,
      role: targetRole,
      full_name: fullName,
      sede_ids: sedeIds,
    });
  } catch (error) {
    const errorMessage = describeError(error);
    console.error("Error en creación administrativa de usuario:", errorMessage);
    return response.status(500).json({ error: errorMessage });
  }
}
