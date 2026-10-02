import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    if (isIos) {
      setShowIosHint(true);
      return;
    }
    setShowIosHint(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
        }
      >
        <Download className="h-4 w-4" /> Install App
      </button>

      {showIosHint && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"
          onClick={() => setShowIosHint(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card p-5 text-sm text-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Smartphone className="h-4 w-4" /> Install ZiiDi Trader
            </div>
            {isIos ? (
              <p className="text-muted-foreground">
                In Safari, tap the <b>Share</b> icon, then choose{" "}
                <b>Add to Home Screen</b> to install ZiiDi Trader as an app.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Open your browser menu and choose <b>Install app</b> or{" "}
                <b>Add to Home Screen</b>. On Chrome, look for the install icon
                in the address bar.
              </p>
            )}
            <button
              onClick={() => setShowIosHint(false)}
              className="mt-4 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}