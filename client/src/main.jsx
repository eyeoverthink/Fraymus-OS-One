import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Studio login: any same-origin /api or /live call that comes back 401 with
// auth "required" sends the browser to /login, which sets the session cookie.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const res = await nativeFetch(input, init);
  if (res.status === 401) {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin === window.location.origin && /^\/(api|live)\//.test(url.pathname) && !window.__frayLoginRedirect) {
      const body = await res.clone().json().catch(() => ({}));
      if (body.auth === "required") {
        window.__frayLoginRedirect = true;
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
    }
  }
  return res;
};

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
