// Wipes every piece of data this origin holds: caches, IndexedDB, storage and
// service worker registrations, then reloads into a clean state.

async function clearIndexedDB() {
  if (typeof indexedDB === "undefined") return;
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<{ name?: string }[]>;
  };
  const databases = await factory.databases?.();
  if (!databases?.length) return;

  await Promise.all(
    databases.map(
      (database) =>
        new Promise<void>((resolve) => {
          if (!database.name) return resolve();
          const request = indexedDB.deleteDatabase(database.name);
          request.addEventListener("success", () => resolve(), { once: true });
          request.addEventListener("error", () => resolve(), { once: true });
          request.addEventListener("blocked", () => resolve(), { once: true });
        }),
    ),
  );
}

async function clearCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function clearServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

export async function clearAllSiteData(): Promise<void> {
  try {
    localStorage.clear();
  } catch {}
  try {
    sessionStorage.clear();
  } catch {}

  await Promise.allSettled([clearCaches(), clearIndexedDB(), clearServiceWorkers()]);

  // Reload with a fresh query so the document itself bypasses the HTTP cache,
  // then re-register the worker and start from a clean state.
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("cleared", Date.now().toString());
  location.replace(url.href);
}
