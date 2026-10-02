import { useEffect, useState } from "react";
import { Download, X, Smartphone, ShieldCheck, Zap } from "lucide-react";
import safaricomLogo from "@/assets/safaricom-logo.png";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ziidi_install_promo_dismissed_at";
const SNOOZE_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

export function InstallPromoPopup() {
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    } catch {}
    if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setOpen(false);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    const t = setTimeout(() => setOpen(true), 5000);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      dismiss();
      return;
    }
    setShowSteps(true);
  };

  if (!open) return null;

  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] flex justify-center p-3 pb-24 md:justify-end md:p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-emerald-900/25">
        <div className="flex items-center justify-between bg-gradient-to-r from-primary to-emerald-500 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground/15">
              <Smartphone className="h-4 w-4 text-primary-foreground" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-primary-foreground">Get the ZiiDi Trader App</div>
              <div className="text-[11px] text-primary-foreground/85">Powered by M-PESA · Safaricom</div>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close install promo"
            className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          {showSteps ? (
            <p className="text-sm text-muted-foreground">
              {isIos ? (
                <>
                  In Safari tap the <b className="text-foreground">Share</b> icon, then{" "}
                  <b className="text-foreground">Add to Home Screen</b> to install ZiiDi Trader.
                </>
              ) : (
                <>
                  Open your browser menu and tap <b className="text-foreground">Install app</b> or{" "}
                  <b className="text-foreground">Add to Home Screen</b>.
                </>
              )}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Install the app for faster deposits, instant stock buying and real-time market surge alerts.
              </p>
              <ul className="mt-3 grid gap-1.5 text-xs text-foreground">
                <li className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Instant M-PESA deposits & withdrawals
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Secure, verified ZiiDi account
                </li>
              </ul>
            </>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={install}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
            >
              <Download className="h-4 w-4" /> {showSteps ? "Show me how" : "Install now"}
            </button>
            <button
              onClick={dismiss}
              className="rounded-xl border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              Later
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <img src={safaricomLogo} alt="Safaricom M-PESA" className="h-4 w-auto" loading="lazy" />
            <span className="text-[10px] text-muted-foreground">Payments secured by Safaricom M-PESA</span>
          </div>
        </div>
      </div>
    </div>
  );
}