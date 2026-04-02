import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
});

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("pwa-dismissed") === "1",
  );

  useEffect(() => {
    // Already installed as standalone
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const check = () => setCanInstall(deferredPrompt !== null);
    check();

    const handler = () => check();
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
    deferredPrompt = null;
  };

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-dismissed", "1");
  };

  return {
    showBanner: canInstall && !dismissed,
    install,
    dismiss,
  };
}
