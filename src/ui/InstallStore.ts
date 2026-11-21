// Tracks installability so the App settings panel can offer a real install
// button on Chromium-based browsers, with instructions elsewhere.
import { signal } from "@preact/signals";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    /** iOS Safari exposes installation state directly on navigator. */
    standalone?: boolean;
  }
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return navigator.standalone === true;
}

export const InstallPrompt = signal<BeforeInstallPromptEvent | null>(null);
export const IsStandalone = signal(isStandalone());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    InstallPrompt.value = event;
  });

  window.addEventListener("appinstalled", () => {
    InstallPrompt.value = null;
    IsStandalone.value = true;
  });

  const media = window.matchMedia?.("(display-mode: standalone)");
  media?.addEventListener?.("change", () => {
    IsStandalone.value = isStandalone();
  });
}

export async function promptInstall(): Promise<boolean> {
  const event = InstallPrompt.value;
  if (!event) return false;

  await event.prompt();
  const choice = await event.userChoice;
  InstallPrompt.value = null;
  return choice.outcome === "accepted";
}
