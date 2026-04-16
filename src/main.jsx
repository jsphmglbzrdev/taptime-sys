import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { LoadingProvider } from "./context/LoadingContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AppShellProvider } from "./context/AppShellContext.jsx";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore service worker registration failures in unsupported environments.
      });
      return;
    }

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .then(() => window.caches?.keys?.())
      .then((cacheKeys) =>
        Promise.all(
          (cacheKeys ?? []).map((cacheKey) => window.caches.delete(cacheKey)),
        ),
      )
      .catch(() => {
        // Ignore cleanup failures in local development.
      });
  });
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <StrictMode>
      <LoadingProvider>
        <AuthProvider>
          <AppShellProvider>
            <App />
          </AppShellProvider>
        </AuthProvider>
      </LoadingProvider>
    </StrictMode>
  </BrowserRouter>,
);
