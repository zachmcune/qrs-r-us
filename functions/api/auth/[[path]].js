import {
  json, error, cors, handleOptions, id, newSalt, hashPassword, verifyPassword,
  createSession, getSessionUser, sessionCookie, clearSessionCookie, isValidEmail,
} from "../../_utils.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const opt = handleOptions(request);
  if (opt) return opt;

  const action = (params.path || [])[0] || "";

  try {
    let response;
    if (action === "signup" && request.method === "POST") response = await handleSignup(request, env);
    else if (action === "login" && request.method === "POST") response = await handleLogin(request, env);
    else if (action === "logout" && request.method === "POST") response = await handleLogout(request, env);
    else if (action === "me" && request.method === "GET") response = await handleMe(request, env);
    else response = error("Not found", 404);
    return cors(request, response);
  } catch (e) {
    console.error(e);
    return cors(request, error("Internal server error", 500));
  }
}

async function handleSignup(request, env) {
  const { email, password } = await request.json();
  if (!email || !password) return error("Email and password are required");
  if (!isValidEmail(email)) return error("Invalid email address");
  if (password.length < 8) return error("Password must be at least 8 characters");

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email.toLowerCase()).first();
  if (existing) return error("Email already registered", 409);

  const userId = id();
  const salt = newSalt();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(userId, email.toLowerCase(), await hashPassword(password, salt), salt, now).run();

  const sessionId = await createSession(env, userId);
  return json({ user: { id: userId, email: email.toLowerCase() } }, 201, { "Set-Cookie": sessionCookie(sessionId) });
}

async function handleLogin(request, env) {
  const { email, password } = await request.json();
  if (!email || !password) return error("Email and password are required");

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, salt FROM users WHERE email = ?"
  ).bind(email.toLowerCase()).first();
  if (!user) return error("Invalid email or password", 401);

  if (!(await verifyPassword(password, user.salt, user.password_hash))) {
    return error("Invalid email or password", 401);
  }

  const sessionId = await createSession(env, user.id);
  return json({ user: { id: user.id, email: user.email } }, 200, { "Set-Cookie": sessionCookie(sessionId) });
}

async function handleLogout(request, env) {
  const user = await getSessionUser(request, env);
  if (user?.sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(user.sessionId).run();
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  return json({ user: user ? { id: user.id, email: user.email } : null });
}
