import {
  json, error, cors, handleOptions, id, getSessionUser, requireAuth,
} from "../../_utils.js";

const MAX_LOGO_BYTES = 500_000;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const opt = handleOptions(request);
  if (opt) return opt;

  const logoId = (params.path || [])[0] || null;

  try {
    const user = await getSessionUser(request, env);
    let response;

    if (!logoId && request.method === "POST") response = await handleUpload(request, env, user);
    else if (logoId && request.method === "GET") response = await handleGet(env, user, logoId);
    else response = error("Not found", 404);

    return cors(request, response);
  } catch (e) {
    console.error(e);
    return cors(request, error("Internal server error", 500));
  }
}

async function handleUpload(request, env, user) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") return error("Logo file is required");

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType)) return error("Unsupported image type");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length) return error("Logo file is empty");
  if (bytes.length > MAX_LOGO_BYTES) return error("Logo must be under 500KB");

  const contentHash = await sha256Hex(bytes);
  const existing = await env.DB.prepare(
    "SELECT id, mime_type, byte_size, created_at FROM logos WHERE user_id = ? AND content_hash = ?"
  ).bind(user.id, contentHash).first();

  if (existing) {
    return json({ logo: formatLogoRow(existing) }, 200);
  }

  const ext = EXT_BY_TYPE[mimeType] || "bin";
  const r2Key = `${user.id}/${contentHash}.${ext}`;
  await env.LOGOS.put(r2Key, bytes, {
    httpMetadata: { contentType: mimeType },
  });

  const logoId = id();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO logos (id, user_id, content_hash, r2_key, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(logoId, user.id, contentHash, r2Key, mimeType, bytes.length, now).run();

  return json({
    logo: formatLogoRow({
      id: logoId,
      mime_type: mimeType,
      byte_size: bytes.length,
      created_at: now,
    }),
  }, 201);
}

async function handleGet(env, user, logoId) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const row = await env.DB.prepare(
    "SELECT id, r2_key, mime_type FROM logos WHERE id = ? AND user_id = ?"
  ).bind(logoId, user.id).first();
  if (!row) return error("Logo not found", 404);

  const object = await env.LOGOS.get(row.r2_key);
  if (!object) return error("Logo file missing", 404);

  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": row.mime_type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function formatLogoRow(row) {
  return {
    id: row.id,
    url: `/api/logos/${row.id}`,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  };
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
