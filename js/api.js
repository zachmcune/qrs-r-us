const API_BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  signup: (email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  listQrCodes: () => request("/qr"),
  getQrCode: (id) => request(`/qr/${id}`),
  createQrCode: (payload) => request("/qr", { method: "POST", body: JSON.stringify(payload) }),
  updateQrCode: (id, payload) => request(`/qr/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteQrCode: (id) => request(`/qr/${id}`, { method: "DELETE" }),
};
