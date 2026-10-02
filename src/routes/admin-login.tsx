import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Lock, Mail, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Login | ZiiDi Trader" },
      { name: "description", content: "Restricted access — ZiiDi Trader administrators only." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        toast.error(error?.message ?? "Invalid credentials");
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        await supabase.auth.signOut();
        toast.error("This account does not have admin access.");
        return;
      }
      toast.success("Welcome back, admin");
      navigate({ to: "/admin-panel" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">ZiiDi Trader — Admin</h1>
          <p className="mt-1 text-sm text-slate-400">Restricted portal. Authorized personnel only.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur">
          <label className="block text-xs font-medium text-slate-300">Admin email
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gmail.com"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
              />
            </div>
          </label>
          <label className="mt-4 block text-xs font-medium text-slate-300">Password
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
              <Lock className="h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {busy ? "Verifying…" : "Sign in to admin"}
          </button>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Not an admin? <Link to="/auth" className="text-primary hover:underline">Go to member login</Link>
          </p>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-600">
          Protected area. All activity is logged and monitored.
        </p>
      </div>
    </div>
  );
}