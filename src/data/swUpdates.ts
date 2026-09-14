// Registro del service worker y consulta de versiones (research R5).

export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    // Sin service worker la app sigue funcionando con red.
  }
}

function askVersion(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve((e.data as { version?: string }).version ?? null);
    };
    worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
  });
}

export interface SwVersions {
  active: string | null;
  waiting: string | null;
}

export async function getSwVersions(): Promise<SwVersions> {
  if (!("serviceWorker" in navigator)) return { active: null, waiting: null };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { active: null, waiting: null };
  const [active, waiting] = await Promise.all([
    reg.active ? askVersion(reg.active) : Promise.resolve(null),
    reg.waiting ? askVersion(reg.waiting) : Promise.resolve(null),
  ]);
  return { active, waiting };
}

/** Activa la versión en espera y recarga cuando toma el control. */
export async function activateWaiting(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.waiting) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  reg.waiting.postMessage({ type: "ACTIVATE" });
}
