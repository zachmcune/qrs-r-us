import { api } from "./api.js";

const form = document.getElementById("auth-form");
const messageEl = document.getElementById("message");
const isSignup = document.body.dataset.mode === "signup";
const next = new URLSearchParams(location.search).get("next") || "dashboard.html";

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    if (isSignup) await api.signup(form.email.value.trim(), form.password.value);
    else await api.login(form.email.value.trim(), form.password.value);
    location.href = next;
  } catch (err) {
    messageEl.textContent = err.message;
    messageEl.hidden = false;
  }
});
