import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BRAND = "oklch(62% .18 145)";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — ZiiDi Trader" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent — check your inbox");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="block text-center text-2xl font-black tracking-tight text-slate-900">
          ZiiDi <span style={{ color: BRAND }}>Trader</span>
        </Link>
        <div className="mt-8">
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your email and we'll send you a link to set a new password.
          </p>
          {sent ? (
            <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              We sent a password reset link to <strong>{email}</strong>. Click the link to continue.
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="mt-3 block font-bold"
                style={{ color: BRAND }}
              >
                Back to log in
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Email address <span style={{ color: "#e11d48" }}>*</span>
                </span>
                <input
                  type="email"
                  required
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{ ["--tw-ring-color" as string]: BRAND } as React.CSSProperties}
                />
              </label>
              <button
                disabled={busy}
                className="w-full rounded-md py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-slate-600">
            Remembered it?{" "}
            <Link to="/auth" className="font-bold" style={{ color: BRAND }}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}