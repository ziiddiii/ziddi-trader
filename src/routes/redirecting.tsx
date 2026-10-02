import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import safaricomLogo from "@/assets/safaricom-main-logo.png.asset.json";

const BRAND = "oklch(62% .18 145)";

export const Route = createFileRoute("/redirecting")({
  head: () => ({ meta: [{ title: "Redirecting — ZiiDi Trader" }] }),
  component: RedirectingPage,
});

function RedirectingPage() {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  // Loader first, then the success popup for 5 seconds, then the dashboard.
  useEffect(() => {
    const loader = setTimeout(() => setShowSuccess(true), 4000);
    return () => clearTimeout(loader);
  }, []);

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => navigate({ to: "/dashboard" }), 5000);
    return () => clearTimeout(t);
  }, [showSuccess, navigate]);

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden"
      style={{ backgroundColor: BRAND }}
    >
      {/* Wordmark */}
      <div className="flex justify-center pt-10">
        <h1 className="text-3xl font-black tracking-tight text-white">
          ZiiDi <span className="font-light">Trader</span>
        </h1>
      </div>

      {/* Centered loader card */}
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        {!showSuccess ? (
          <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-xl">
            <div className="mx-auto mb-6 h-16 w-16">
              <div
                className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200"
                style={{ borderTopColor: BRAND }}
                role="status"
                aria-label="Loading"
              />
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              Please wait as <span className="font-semibold">Safaricom ZiiDi Trader</span>{" "}
              redirects you to your live dashboard.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Establishing a secure session · Loading market data
            </p>
          </div>
        ) : (
          <div
            className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl"
            role="status"
            aria-live="polite"
          >
            <img
              src={safaricomLogo.url}
              alt="Safaricom"
              className="mx-auto h-14 w-auto"
            />
            <div
              className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "color-mix(in oklch, " + BRAND + " 18%, white)" }}
            >
              <CheckCircle2 className="h-9 w-9" style={{ color: BRAND }} />
            </div>
            <p className="mt-5 text-lg font-bold leading-snug text-slate-900">
              Congratulations! Your Safaricom ZiiDi Trader Account Created Successfully
            </p>
            <p className="mt-3 text-xs text-slate-500">Opening your dashboard…</p>
          </div>
        )}
      </div>

      <p className="pb-8 text-center text-xs text-white/80">
        Powered by M-PESA · Safaricom PLC
      </p>
    </main>
  );
}
