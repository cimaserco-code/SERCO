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

export default async function handler(req, res) {
  if (applyPostCors(req, res)) return;

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const callerCtx = await authenticateCaller(req, supabaseAdmin);
    if (callerCtx.error) {
      return res.status(callerCtx.errorStatus || 401).json({ error: callerCtx.error });
    }

    if (!hasModulePermission(callerCtx, "usuarios", "reset_password")) {
      return res.status(403).json({
        error: "No tienes permiso para actualizar contraseñas de usuarios.",
      });
    }

    const { userId, email, newPassword, reason } = parseJsonBody(req);

    if (reason !== "password_forgotten") {
      return res.status(400).json({
        error:
          "Solo se permite actualizar contraseñas cuando el usuario olvidó la suya (confirmación requerida).",
      });
    }

    if (typeof newPassword !== "string" || !newPassword.trim() || newPassword.length < 6) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 6 caracteres.",
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        error: "La contraseña no puede superar los 128 caracteres.",
      });
    }

    const cleanUserId = normalizeText(userId);
    const cleanEmail = normalizeLower(email);

    if (!cleanUserId && !cleanEmail) {
      return res.status(400).json({
        error: "Debes especificar el usuario (userId o email).",
      });
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

    if (!targetRole) {
      const { data: authTarget } = await supabaseAdmin.auth.admin.getUserById(targetAuthId);
      if (!authTarget?.user) {
        return res.status(404).json({ error: "Usuario no encontrado en autenticación." });
      }
      targetRole = authTarget.user.user_metadata?.role || "";
      targetEmail = targetEmail || authTarget.user.email;
    }

    if (isSuperAdminRole(targetRole) && !callerCtx.isSuperAdmin) {
      return res.status(403).json({
        error: "No tienes permiso para cambiar la contraseña de un Administrador.",
      });
    }

    const { data: updatedData, error: updateErr } =
      await supabaseAdmin.auth.admin.updateUserById(targetAuthId, {
        password: newPassword,
      });

    if (updateErr) {
      return res.status(400).json({ error: describeError(updateErr) });
    }

    return res.status(200).json({
      success: true,
      userId: targetAuthId,
      email: updatedData?.user?.email || targetEmail,
    });
  } catch (err) {
    console.error("Error en /api/update-user-password:", err);
    return res.status(500).json({ error: describeError(err) });
  }
}
