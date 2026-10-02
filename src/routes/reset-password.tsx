import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BRAND = "oklch(62% .18 145)";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — ZiiDi Trader" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase auto-signs in via the recovery link and fires PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
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
          <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a strong password you don't use elsewhere.</p>
          {!ready ? (
            <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Open this page from the reset link we emailed you.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  New password <span style={{ color: "#e11d48" }}>*</span>
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{ ["--tw-ring-color" as string]: BRAND } as React.CSSProperties}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Confirm password <span style={{ color: "#e11d48" }}>*</span>
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{ ["--tw-ring-color" as string]: BRAND } as React.CSSProperties}
                />
              </label>
              <button
                disabled={busy}
                className="w-full rounded-md py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}