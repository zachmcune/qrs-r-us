const SESSION_COOKIE = "qrs_session";
const SESSION_DAYS = 30;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export function cors(request, response) {
  const origin = request.headers.get("Origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export function handleOptions(request) {
  if (request.method === "OPTIONS") {
    return cors(request, new Response(null, { status: 204 }));
  }
  return null;
}

export function id() {
  return crypto.randomUUID();
}

export async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export function newSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...salt));
}

export async function verifyPassword(password, salt, hash) {
  return (await hashPassword(password, salt)) === hash;
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [k, ...v] = part.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    }).filter(([k]) => k)
  );
}

export function sessionCookie(sessionId) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getSessionUser(request, env) {
  const sessionId = parseCookies(request)[SESSION_COOKIE];
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT s.id as session_id, s.expires_at, u.id, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).bind(sessionId).first();

  if (!row || row.expires_at < Date.now()) {
    if (row) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return null;
  }

  return { id: row.id, email: row.email, sessionId: row.session_id };
}

export async function createSession(env, userId) {
  const sessionId = id();
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).bind(sessionId, userId, expiresAt, now).run();
  return sessionId;
}

export function requireAuth(user) {
  return user ? null : error("Unauthorized", 401);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
