import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";

const BRAND = "oklch(62% .18 145)";

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "Account Verification — ZiiDi Trader" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const code = useMemo(
    () =>
      Array.from({ length: 6 }, () => Math.floor(Math.random() * 10).toString()).join(""),
    [],
  );
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    // pretend to email the code
    try {
      console.info(`[ZiiDi] Verification code sent to your email: ${code}`);
    } catch {}
  }, [code]);

  useEffect(() => {
    if (filled >= 6) {
      const t = setTimeout(() => navigate({ to: "/redirecting" }), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setFilled((n) => n + 1), 600);
    return () => clearTimeout(t);
  }, [filled, navigate]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-14">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          ZiiDi <span style={{ color: BRAND }}>Trader</span>
        </h1>
        <h2 className="mt-8 text-xl font-bold text-slate-900">Account Verification</h2>

        <div
          className="mt-6 rounded-2xl border bg-white p-8 shadow-sm"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in oklch, oklch(62% .18 145) 18%, white)" }}
          >
            <Lock className="h-7 w-7" style={{ color: BRAND }} />
          </div>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-slate-600">
            Your Ziidi account is being verified automatically. Please be patient and
            kindly do not leave this page until the process is complete.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => {
              const isFilled = i < filled;
              return (
                <div
                  key={i}
                  className="flex h-12 w-10 items-center justify-center rounded-md border bg-white text-lg font-bold transition-all"
                  style={{
                    borderColor: isFilled ? BRAND : "rgb(203 213 225)",
                    color: BRAND,
                    boxShadow: isFilled ? `0 0 0 2px color-mix(in oklch, ${BRAND} 25%, white)` : "none",
                  }}
                >
                  {isFilled ? code[i] : ""}
                </div>
              );
            })}
          </div>
          {filled >= 6 && (
            <p className="mt-5 text-sm font-semibold" style={{ color: BRAND }}>
              Verified — activating your account…
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          A verification code was sent to your email.
        </p>
      </div>
    </main>
  );
}