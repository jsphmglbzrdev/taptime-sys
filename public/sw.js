const STATIC_CACHE = "taptime-static-v3";
const SHELL_CACHE = "taptime-shell-v3";
const APP_SHELL = [
  "/index.html",
  "/manifest.webmanifest",
  "/logo.png",
  "/surf2sawa.png",
];

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isStaticAssetRequest(requestUrl, request) {
  if (requestUrl.pathname.startsWith("/assets/")) return true;

  return ["style", "script", "worker", "font", "image"].includes(
    request.destination,
  );
}

async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(APP_SHELL);
}

async function cleanupOldCaches() {
  const validCaches = new Set([STATIC_CACHE, SHELL_CACHE]);
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => !validCaches.has(key))
      .map((key) => caches.delete(key)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanupOldCaches());
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (!isSameOrigin(requestUrl)) {
    return;
  }

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response?.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put("/index.html", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return cache.match("/index.html");
        }),
    );
    return;
  }

  if (!isStaticAssetRequest(requestUrl, event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then(async (response) => {
          if (response?.ok) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients[0];
      if (existing) {
        existing.focus();
        return existing.navigate("/");
      }
      return self.clients.openWindow("/");
    }),
  );
});
