import { createFileRoute, Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BRAND = "oklch(62% .18 145)";

type Mode = "signin" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } =>
    s.mode === "signup" || s.mode === "signin" ? { mode: s.mode } : {},
  head: () => ({
    meta: [
      { title: "Sign in — ZiiDi Trader" },
      { name: "description", content: "Sign in or create a ZiiDi Trader account to buy, sell, and manage your NSE share investments." },
      { property: "og:title", content: "Sign in — ZiiDi Trader" },
      { property: "og:description", content: "Access your ZiiDi Trader account." },
      { property: "og:url", content: "/auth" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="block text-center text-2xl font-black tracking-tight text-slate-900">
          ZiiDi <span style={{ color: BRAND }}>Trader</span>
        </Link>
        <div className="mt-8">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">
        {label} {required && <span style={{ color: "#e11d48" }}>*</span>}
      </span>
      <input
        {...props}
        required={required}
        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-transparent focus:ring-2"
        style={{ boxShadow: "none", ["--tw-ring-color" as string]: BRAND } as React.CSSProperties}
      />
    </label>
  );
}

function PrimaryButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={busy}
      className="w-full rounded-md py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ backgroundColor: BRAND }}
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}

function AuthPage() {
  const { mode: initialMode } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const navigate = useNavigate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // signin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  // signup
  const [name, setName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (remember) localStorage.setItem("ziidi:remember-email", email.trim());
      else localStorage.removeItem("ziidi:remember-email");
      toast.success("Welcome back");
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (uid) {
          const { notify } = await import("@/lib/notify");
          await notify(
            uid,
            "auth",
            "New sign-in to your account",
            `You signed in on ${new Date().toLocaleString()} from this device. If this wasn't you, reset your password immediately.`,
          );
        }
      } catch {}
      router.invalidate();
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (suPassword !== suConfirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: suEmail.trim(),
        password: suPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            username: name.trim() || suEmail.split("@")[0],
            full_name: name.trim(),
            phone: phone.trim(),
          },
        },
      });
      if (error) throw error;
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: suEmail.trim(),
          password: suPassword,
        });
        if (signInError) throw signInError;
      }
      toast.success("Account created");
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (uid) {
          const { notify } = await import("@/lib/notify");
          await notify(
            uid,
            "auth",
            "Welcome to Safaricom Ziidi Trader",
            `Your account (${suEmail.trim()}) has been created successfully. Complete verification to start trading.`,
          );
        }
      } catch {}
      router.invalidate();
      navigate({ to: "/verify" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("ziidi:remember-email");
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  if (mode === "signup") {
    return (
      <AuthShell title="Create an account" subtitle="Enter your details below to create your account">
        <form onSubmit={signUp} className="space-y-4">
          <Field label="Name" placeholder="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Email address"
            type="email"
            placeholder="email@example.com"
            required
            value={suEmail}
            onChange={(e) => setSuEmail(e.target.value)}
          />
          <Field
            label="Phone number"
            type="tel"
            placeholder="e.g. 254712345678"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={suPassword}
            onChange={(e) => setSuPassword(e.target.value)}
          />
          <Field
            label="Confirm password"
            type="password"
            placeholder="Confirm password"
            required
            minLength={6}
            value={suConfirm}
            onChange={(e) => setSuConfirm(e.target.value)}
          />
          <PrimaryButton busy={busy}>Create account</PrimaryButton>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="font-bold"
            style={{ color: BRAND }}
          >
            Log in
          </button>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Log in to your account" subtitle="Enter your email and password below to log in">
      <form onSubmit={signIn} className="space-y-4">
        <Field
          label="Email address"
          type="email"
          placeholder="email@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Field
            label="Password"
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            to="/forgot-password"
            className="mt-2 inline-block text-sm font-bold"
            style={{ color: BRAND }}
          >
            Forgot your password?
          </Link>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
            style={{ accentColor: BRAND }}
          />
          Remember me
        </label>
        <PrimaryButton busy={busy}>Log in</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={() => setMode("signup")}
          className="font-bold"
          style={{ color: BRAND }}
        >
          Sign up
        </button>
      </p>
    </AuthShell>
  );
}