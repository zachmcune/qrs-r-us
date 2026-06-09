import {
  json, error, cors, handleOptions, id, getSessionUser, requireAuth, isValidUrl,
} from "../../_utils.js";

const MAX_CONFIG_SIZE = 2 * 1024 * 1024;

export async function onRequest(context) {
  const { request, env, params } = context;
  const opt = handleOptions(request);
  if (opt) return opt;

  const segments = params.path || [];
  const qrId = segments[0] || null;

  try {
    const user = await getSessionUser(request, env);
    let response;

    if (!qrId && request.method === "GET") response = await listQrCodes(env, user);
    else if (!qrId && request.method === "POST") response = await createQrCode(request, env, user);
    else if (qrId && request.method === "GET") response = await getQrCode(env, user, qrId);
    else if (qrId && request.method === "PUT") response = await updateQrCode(request, env, user, qrId);
    else if (qrId && request.method === "DELETE") response = await deleteQrCode(env, user, qrId);
    else response = error("Not found", 404);

    return cors(request, response);
  } catch (e) {
    console.error(e);
    return cors(request, error("Internal server error", 500));
  }
}

async function listQrCodes(env, user) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const rows = await env.DB.prepare(
    `SELECT id, name, target_url, config, created_at, updated_at
     FROM qr_codes WHERE user_id = ? ORDER BY updated_at DESC`
  ).bind(user.id).all();

  return json({ qrCodes: (rows.results || []).map(formatQrRow) });
}

async function createQrCode(request, env, user) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { name, targetUrl, config } = await request.json();
  if (!name?.trim()) return error("Name is required");
  if (!targetUrl || !isValidUrl(targetUrl)) return error("Valid target URL is required");
  if (!config || typeof config !== "object") return error("Config is required");

  let storedConfig;
  try {
    storedConfig = await prepareConfigForStorage(config, env, user.id);
  } catch {
    return error("Invalid logo", 400);
  }

  const configStr = JSON.stringify(storedConfig);
  if (configStr.length > MAX_CONFIG_SIZE) return error("Config too large (max 2MB)");

  const qrId = id();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO qr_codes (id, user_id, name, target_url, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(qrId, user.id, name.trim(), targetUrl, configStr, now, now).run();

  const row = await env.DB.prepare(
    "SELECT id, name, target_url, config, created_at, updated_at FROM qr_codes WHERE id = ?"
  ).bind(qrId).first();

  return json({ qrCode: formatQrRow(row) }, 201);
}

async function getQrCode(env, user, qrId) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const row = await getOwnedQr(env, user.id, qrId);
  if (!row) return error("QR code not found", 404);
  return json({ qrCode: formatQrRow(row) });
}

async function updateQrCode(request, env, user, qrId) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const row = await getOwnedQr(env, user.id, qrId);
  if (!row) return error("QR code not found", 404);

  const { name, targetUrl, config } = await request.json();
  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (!name?.trim()) return error("Name cannot be empty");
    updates.push("name = ?");
    values.push(name.trim());
  }
  if (targetUrl !== undefined) {
    if (!isValidUrl(targetUrl)) return error("Valid target URL is required");
    updates.push("target_url = ?");
    values.push(targetUrl);
  }
  if (config !== undefined) {
    let storedConfig;
    try {
      storedConfig = await prepareConfigForStorage(config, env, user.id);
    } catch {
      return error("Invalid logo", 400);
    }
    const configStr = JSON.stringify(storedConfig);
    if (configStr.length > MAX_CONFIG_SIZE) return error("Config too large (max 2MB)");
    updates.push("config = ?");
    values.push(configStr);
  }

  if (!updates.length) return error("No fields to update");

  updates.push("updated_at = ?");
  values.push(Date.now(), qrId);

  await env.DB.prepare(`UPDATE qr_codes SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  return json({ qrCode: formatQrRow(await getOwnedQr(env, user.id, qrId)) });
}

async function deleteQrCode(env, user, qrId) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const row = await getOwnedQr(env, user.id, qrId);
  if (!row) return error("QR code not found", 404);

  await env.DB.prepare("DELETE FROM qr_codes WHERE id = ?").bind(qrId).run();
  return json({ ok: true });
}

async function getOwnedQr(env, userId, qrId) {
  return env.DB.prepare(
    "SELECT id, name, target_url, config, created_at, updated_at FROM qr_codes WHERE id = ? AND user_id = ?"
  ).bind(qrId, userId).first();
}

async function prepareConfigForStorage(config, env, userId) {
  const next = { ...config };
  if (!next.logo) return next;

  const logo = { ...next.logo };

  if (!logo.logoId) {
    next.logo = null;
    return next;
  }

  const owned = await env.DB.prepare(
    "SELECT id FROM logos WHERE id = ? AND user_id = ?"
  ).bind(logo.logoId, userId).first();
  if (!owned) throw new Error("INVALID_LOGO");

  logo.url = `/api/logos/${logo.logoId}`;
  next.logo = logo;
  return next;
}

function formatQrRow(row) {
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.target_url,
    config: JSON.parse(row.config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
