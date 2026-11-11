import {
  applyPostCors,
  authenticateCaller,
  createSupabaseAdminClient,
  describeError,
  findAuthUserIdByEmail,
  hasModulePermission,
  isSuperAdminRole,
  normalizeLower,
  normalizeText,
  parseJsonBody,
} from "./_auth.js";

function extractServiceEmails(service) {
  if (!service) return [];
  return [service.correo, service.correo_2]
    .map((e) => normalizeLower(e))
    .filter((e) => e && e.includes("@"));
}

async function deleteProfileAndAuthUser(supabaseAdmin, userId) {
  const { error: profileDeleteErr } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileDeleteErr) {
    throw new Error(
      `No se pudo eliminar el perfil del usuario: ${describeError(profileDeleteErr)}`
    );
  }

  const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteErr) {
    const msg = describeError(authDeleteErr);
    if (!normalizeLower(msg).includes("not found")) {
      throw new Error(`Perfil eliminado, pero falló en Auth: ${msg}`);
    }
  }
}

async function handleManualUserDelete(req, res, supabaseAdmin, callerCtx, body) {
  if (!hasModulePermission(callerCtx, "usuarios", "delete")) {
    return res.status(403).json({
      error: "No tienes permiso para eliminar usuarios.",
    });
  }

  const cleanUserId = normalizeText(body.userId);
  const cleanEmail = normalizeLower(body.email);

  if (!cleanUserId && !cleanEmail) {
    return res.status(400).json({ error: "Debes indicar el usuario a eliminar." });
  }

  let targetProfile = null;
  if (cleanUserId) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nombre_completo, role, status")
      .eq("id", cleanUserId)
      .maybeSingle();
    targetProfile = data || null;
  } else if (cleanEmail) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nombre_completo, role, status")
      .ilike("email", cleanEmail)
      .maybeSingle();
    targetProfile = data || null;
  }

  let targetAuthId = targetProfile?.id || cleanUserId || null;
  let targetEmail = targetProfile?.email || cleanEmail;
  let targetRole = targetProfile?.role || "";

  if (!targetAuthId && cleanEmail) {
    targetAuthId = await findAuthUserIdByEmail(supabaseAdmin, cleanEmail);
  }

  if (!targetAuthId) {
    return res.status(404).json({ error: "Usuario no encontrado." });
  }

  if (targetAuthId === callerCtx.callerUser.id) {
    return res.status(400).json({
      error: "No puedes eliminar tu propio usuario mientras tienes sesión iniciada.",
    });
  }

  if (!targetRole) {
    const { data: authTarget } = await supabaseAdmin.auth.admin.getUserById(targetAuthId);
    targetRole = authTarget?.user?.user_metadata?.role || "";
    targetEmail = targetEmail || authTarget?.user?.email;
  }

  if (normalizeLower(targetRole) === "cliente") {
    return res.status(403).json({
      error:
        "Los usuarios cliente no se eliminan manualmente; se autoeliminan al dar de baja o eliminar su servicio.",
    });
  }

  if (isSuperAdminRole(targetRole) && !callerCtx.isSuperAdmin) {
    return res.status(403).json({
      error: "No tienes permiso para eliminar a un Administrador.",
    });
  }

  await deleteProfileAndAuthUser(supabaseAdmin, targetAuthId);

  return res.status(200).json({
    success: true,
    mode: "manual",
    deletedUserId: targetAuthId,
    email: targetEmail,
    nombre_completo: targetProfile?.nombre_completo || "",
  });
}

async function handleServiceBajaCleanup(res, supabaseAdmin, callerCtx, body) {
  const canDeactivateService =
    callerCtx.isSuperAdmin ||
    hasModulePermission(callerCtx, "administracion", "view") ||
    hasModulePermission(callerCtx, "servicios", "edit") ||
    hasModulePermission(callerCtx, "servicios", "delete") ||
    hasModulePermission(callerCtx, "usuarios", "delete");

  if (!canDeactivateService) {
    return res.status(403).json({
      error: "No tienes permiso para dar de baja cuentas de clientes de un servicio.",
    });
  }

  const servicioId = normalizeText(body.servicioId);
  const serviceSnapshot = body.serviceSnapshot || null;

  if (!servicioId) {
    return res.status(400).json({ error: "Falta el ID del servicio dado de baja." });
  }

  const { data: allServices, error: servicesErr } = await supabaseAdmin
    .from("servicios")
    .select("id, nombre, correo, correo_2, admin_nombre, estado");

  if (servicesErr) {
    return res.status(500).json({ error: describeError(servicesErr) });
  }

  const dbService = (allServices || []).find((s) => String(s.id) === String(servicioId));

  if (dbService && normalizeLower(dbService.estado) === "activo") {
    return res.status(400).json({
      error: "El servicio aún aparece como activo; suspéndelo antes de eliminar clientes.",
    });
  }

  const targetService = dbService || serviceSnapshot;
  if (!targetService) {
    return res.status(404).json({
      error: "No se encontraron datos del servicio dado de baja.",
    });
  }

  const targetEmails = new Set(extractServiceEmails(targetService));
  const targetAdminName = normalizeLower(targetService.admin_nombre);

  const otherServices = (allServices || []).filter((s) => String(s.id) !== String(servicioId));
  const activeServices = otherServices.filter((s) => normalizeLower(s.estado) === "activo");

  const activeEmails = new Set();
  const activeAdminNames = new Set();
  for (const srv of activeServices) {
    for (const email of extractServiceEmails(srv)) {
      activeEmails.add(email);
    }
    const adminName = normalizeLower(srv.admin_nombre);
    if (adminName.length >= 4) {
      activeAdminNames.add(adminName);
    }
  }

  const otherEmails = new Set();
  for (const srv of otherServices) {
    for (const email of extractServiceEmails(srv)) {
      otherEmails.add(email);
    }
  }

  const { data: allProfiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, nombre_completo, role");

  if (profilesErr) {
    return res.status(500).json({ error: describeError(profilesErr) });
  }

  const clientProfiles = (allProfiles || []).filter(
    (p) => normalizeLower(p.role) === "cliente"
  );

  const deletedClients = [];
  const skippedActiveClients = [];
  const errors = [];

  for (const profile of clientProfiles) {
    const pEmail = normalizeLower(profile.email);
    const pName = normalizeLower(profile.nombre_completo);

    const matchedByEmail = pEmail && targetEmails.has(pEmail);
    const matchedByUniqueName =
      !matchedByEmail &&
      targetAdminName.length >= 4 &&
      pName === targetAdminName &&
      !otherEmails.has(pEmail);

    if (!matchedByEmail && !matchedByUniqueName) {
      continue;
    }

    const stillActiveByEmail = pEmail && activeEmails.has(pEmail);
    const stillActiveByName =
      matchedByUniqueName && pName.length >= 4 && activeAdminNames.has(pName);

    if (stillActiveByEmail || stillActiveByName) {
      skippedActiveClients.push({
        id: profile.id,
        email: profile.email,
        nombre_completo: profile.nombre_completo,
      });
      continue;
    }

    try {
      await deleteProfileAndAuthUser(supabaseAdmin, profile.id);
      deletedClients.push({
        id: profile.id,
        email: profile.email,
        nombre_completo: profile.nombre_completo,
      });
    } catch (delErr) {
      errors.push({
        id: profile.id,
        email: profile.email,
        error: describeError(delErr),
      });
    }
  }

  return res.status(200).json({
    success: errors.length === 0,
    mode: "service-baja",
    servicioId,
    deletedClients,
    skippedActiveClients,
    errors,
  });
}

export default async function handler(req, res) {
  if (applyPostCors(req, res)) return;

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const callerCtx = await authenticateCaller(req, supabaseAdmin);
    if (callerCtx.error) {
      return res.status(callerCtx.errorStatus || 401).json({ error: callerCtx.error });
    }

    const body = parseJsonBody(req);
    if (body.mode === "service-baja") {
      return await handleServiceBajaCleanup(res, supabaseAdmin, callerCtx, body);
    }

    return await handleManualUserDelete(req, res, supabaseAdmin, callerCtx, body);
  } catch (err) {
    console.error("Error en /api/delete-user:", err);
    return res.status(500).json({ error: describeError(err) });
  }
}
