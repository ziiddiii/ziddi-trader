import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import kenyaFlagAsset from "@/assets/kenya-flag.webp";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  Smartphone,
  Wallet,
  User as UserIcon,
  Mail,
  Phone,
  BadgeCheck,
  Clock,
  Globe2,
  Landmark,
  TrendingUp,
  Hourglass,
  ArrowDownToLine,
  Coins,
  Camera,
  Star,
} from "lucide-react";
import { X } from "lucide-react";
import { getKycRecord, type KycRecord } from "@/components/kyc-gate";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — ZiiDi Trader" },
      { name: "description", content: "Manage your ZiiDi Trader profile, KYC status, security, and wallet settings." },
      { property: "og:title", content: "Account — ZiiDi Trader" },
      { property: "og:description", content: "Manage your ZiiDi Trader profile, KYC status, security, and wallet settings." },
      { property: "og:url", content: "/account" },
    ],
    links: [{ rel: "canonical", href: "/account" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, loading } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [kyc, setKyc] = useState<KycRecord | null>(null);
  const [twoFA, setTwoFA] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [holdings, setHoldings] = useState(0);
  const [pendingTrades, setPendingTrades] = useState(0);
  const [investmentsLocked, setInvestmentsLocked] = useState(0);
  const [accountId, setAccountId] = useState<string>("");
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("account_id" as any).eq("id", user.id).maybeSingle()
      .then(({ data }) => setAccountId(((data as any)?.account_id as string) || ""));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getKycRecord(user.id).then(setKyc).catch(() => setKyc(null));
    try {
      const t = window.localStorage.getItem(`ziidi_2fa_${user.id}`);
      setTwoFA(t === "1");
    } catch {}
    (async () => {
      const [{ data: h }, { data: pl }, { data: inv }] = await Promise.all([
        supabase.from("holdings").select("quantity, avg_price").eq("user_id", user.id),
        supabase.from("listings").select("id").eq("buyer_id", user.id).eq("status", "pending"),
        supabase.from("investments").select("amount").eq("user_id", user.id).eq("status", "active"),
      ]);
      const hv = (h ?? []).reduce((s, x) => s + Number(x.quantity) * Number(x.avg_price), 0);
      setHoldings(hv);
      setPendingTrades((pl ?? []).length);
      const iv = (inv ?? []).reduce((s, x) => s + Number(x.amount), 0);
      setInvestmentsLocked(iv);
    })();
  }, [user]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user || !profile)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Please sign in to view your account.</p>
        <Link to="/auth" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Sign in
        </Link>
      </div>
    );

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    profile.username;
  const phone = (user.user_metadata?.phone as string | undefined) || user.phone || "—";
  const country = (user.user_metadata?.country as string | undefined) || "Kenya";
  const initial = displayName.charAt(0).toUpperCase();
  const mask = (v: string) =>
    showBalance ? (
      v
    ) : (
      <span className="inline-flex select-none items-center gap-0.5 blur-[1.5px] opacity-60">
        {Array.from({ length: 7 }).map((_, i) => (
          <Star key={i} className="h-3 w-3 fill-current" />
        ))}
      </span>
    );

  const changePassword = async () => {
    if (newPwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (newPwd !== confirmPwd) return toast.error("Passwords do not match");
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPwd(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setNewPwd("");
    setConfirmPwd("");
    setPwdOpen(false);
    try {
      const { notify } = await import("@/lib/notify");
      await notify(user.id, "security", "Password changed", "Your account password was updated successfully.");
    } catch {}
  };

  const toggle2FA = () => {
    const next = !twoFA;
    setTwoFA(next);
    try {
      window.localStorage.setItem(`ziidi_2fa_${user.id}`, next ? "1" : "0");
    } catch {}
    toast.success(next ? "Two-factor authentication enabled" : "Two-factor authentication disabled");
  };

  const availableBalance = Number(profile.balance) || 0;
  const totalWallet = availableBalance + holdings + investmentsLocked;

  const fmt = (n: number) =>
    `KSH ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main className="mx-auto max-w-3xl space-y-6 py-4 md:py-8">
      {/* Profile header */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" />
        <div className="relative flex items-start gap-4 p-5">
          <div className="relative">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-2xl font-bold ring-4 ring-card shadow-lg">
              {initial}
            </div>
            <button
              className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-background border border-border text-muted-foreground hover:text-primary"
              aria-label="Change photo"
              type="button"
            >
              <Camera className="h-3 w-3" />
            </button>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold">{displayName}</h1>
              {kyc ? (
                <KycTag status={kyc.status} />
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Member
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                <img
                  src={kenyaFlagAsset}
                  alt="Kenya flag"
                  className="h-3.5 w-5 rounded-sm object-cover"
                />
                {country}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                <Phone className="h-3 w-3" /> {phone}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Wallet hero */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary-foreground/80">
              <Wallet className="h-4 w-4" /> Total wallet value
            </div>
            <button
              onClick={() => setShowBalance((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-primary-foreground hover:bg-white/25 transition"
              aria-label={showBalance ? "Hide balances" : "Show balances"}
            >
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <div className="text-4xl font-bold tracking-tight">{mask(fmt(totalWallet))}</div>
          <div className="mt-1 text-xs text-primary-foreground/80">Across cash, stocks and investments</div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat label="Cash" value={mask(fmt(availableBalance))} />
            <MiniStat label="Stocks" value={mask(fmt(holdings))} />
            <MiniStat label="Invest." value={mask(fmt(investmentsLocked))} />
          </div>
        </div>
      </section>

      {/* Wallet breakdown */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Wallet breakdown</h2>
        <div className="space-y-2">
          <BalanceRow icon={Coins} tint="emerald" label="Ledger Balance" hint="Available to withdraw" value={mask(fmt(availableBalance))} />
          <BalanceRow icon={Hourglass} tint="amber" label="Pending Trades" hint="Awaiting seller release" value={mask(String(pendingTrades))} />
          <BalanceRow icon={ArrowDownToLine} tint="sky" label="Pending Withdrawals" hint="Being processed" value={mask("KSH 0")} />
          <BalanceRow icon={TrendingUp} tint="violet" label="Locked in Stocks" hint="Until you sell in Portfolio" value={mask(fmt(holdings))} />
          <BalanceRow icon={Landmark} tint="rose" label="Locked in Investments" hint="Until plan matures" value={mask(fmt(investmentsLocked))} />
        </div>
      </section>

      {/* Personal information */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Personal information</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field icon={UserIcon} tint="emerald" label="Name" value={displayName} />
          <Field icon={UserIcon} tint="sky" label="Account ID" value={accountId || "—"} />
          <Field icon={Mail} tint="sky" label="Email" value={user.email ?? "—"} />
          <Field icon={Phone} tint="violet" label="Phone number" value={phone} />
          <Field icon={Globe2} tint="amber" label="Country" value={country} />
        </div>
      </section>

      {/* Security */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Security</h2>

        {/* Change password */}
        <div className="rounded-lg border border-border">
          <button
            onClick={() => setPwdOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-3 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" /> Change password
            </span>
            <span className="text-xs text-muted-foreground">{pwdOpen ? "Hide" : "Update"}</span>
          </button>
          {pwdOpen && (
            <div className="space-y-3 border-t border-border p-4">
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={changePassword}
                disabled={savingPwd}
                className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {savingPwd ? "Updating…" : "Update password"}
              </button>
            </div>
          )}
        </div>

        {/* 2FA */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <div className="flex items-center gap-3 text-sm font-medium">
              <Smartphone className="h-4 w-4 text-primary" /> Two-factor authentication
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Optional
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Require a one-time code on every sign-in for extra protection.
            </p>
          </div>
          <button
            onClick={toggle2FA}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${twoFA ? "bg-primary" : "bg-muted"}`}
            aria-pressed={twoFA}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                twoFA ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {/* KYC info card - only if applied */}
      {kyc && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> KYC Verification
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
            <div>
              <div className="font-medium">
                {kyc.status === "verified" ? "Identity verified" : "Verification in review"}
              </div>
              <div className="text-xs text-muted-foreground">
                {kyc.fullName ? `${kyc.fullName} · ` : ""}
                {kyc.idType?.replace("_", " ") ?? "ID"}
              </div>
            </div>
            <KycTag status={kyc.status} />
          </div>
        </section>
      )}
    </main>
  );
}

function KycTag({ status }: { status: "verified" | "pending" | "rejected" }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
        <BadgeCheck className="h-3 w-3" /> KYC Verified
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-500">
        <X className="h-3 w-3" /> KYC Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
      <Clock className="h-3 w-3" /> KYC Pending
    </span>
  );
}

const TINTS: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-primary-foreground/75">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function BalanceRow({
  icon: Icon,
  tint = "emerald",
  label,
  hint,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint?: string;
  label: string;
  hint?: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm hover:bg-accent/40 transition">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${TINTS[tint] ?? TINTS.emerald}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium">{label}</div>
          {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <span className="ml-3 shrink-0 font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Field({
  icon: Icon,
  tint = "emerald",
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${TINTS[tint] ?? TINTS.emerald}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}