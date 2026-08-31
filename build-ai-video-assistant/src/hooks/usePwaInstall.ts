// PWA 安裝 Hook:攔截 beforeinstallprompt,提供「安裝 App」能力。
// Chrome / Edge 桌面版會觸發此事件;不支援時由 UI 提供手動安裝教學。

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const nav = navigator as Navigator & { standalone?: boolean };
    setInstalled(mq.matches || nav.standalone === true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const onModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mq.addEventListener("change", onModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener("change", onModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
      return true;
    }
    return false;
  }, [deferred]);

  return { canInstall: deferred !== null, installed, promptInstall };
}
