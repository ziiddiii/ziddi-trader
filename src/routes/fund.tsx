import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Smartphone, Copy, Check, Loader2, ArrowRight, ArrowLeft, ShieldCheck,
  Clock, XCircle, Wallet, Bitcoin,
} from "lucide-react";
import mpesaLogo from "@/assets/mpesa-logo.png";
import { mpesaStkStatus, startStkDeposit, confirmStkDeposit } from "@/lib/mpesa.functions";
import { cryptoStatus, startCryptoDeposit } from "@/lib/nowpayments.functions";

export const Route = createFileRoute("/fund")({
  head: () => ({
    meta: [
      { title: "Deposit Funds — ZiiDi Trader" },
      { name: "description", content: "Fund your Safaricom ZiiDi Trader account instantly with M-PESA Paybill and start buying shares." },
      { property: "og:title", content: "Deposit Funds — ZiiDi Trader" },
      { property: "og:description", content: "Top up your ZiiDi account with M-PESA Paybill in a few steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/fund" }],
  }),
  component: FundPage,
});

type Settings = {
  min_deposit: number;
  max_deposit: number;
  paybill_number: string;
  account_number: string;
  business_name: string;
  instructions: string | null;
  till_number: string;
  till_business_name: string;
  active_method: string;
  stk_enabled: boolean;
  mobile_enabled: boolean;
  crypto_enabled: boolean;
  crypto_kes_per_usd: number;
};

type Deposit = {
  id: string;
  amount: number;
  phone: string;
  tx_ref: string | null;
  mpesa_receipt?: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

const GREEN = "#00A651";

/** Coins/networks users can deposit with (NOWPayments pay_currency codes). */
const CRYPTO_COINS: { code: string; label: string }[] = [
  { code: "usdttrc20", label: "USDT · TRC20" },
  { code: "usdtbsc", label: "USDT · BEP20" },
  { code: "usdterc20", label: "USDT · ERC20" },
  { code: "btc", label: "BTC" },
  { code: "eth", label: "ETH" },
  { code: "trx", label: "TRX" },
];

const DEFAULTS: Settings = {
  min_deposit: 25000,
  max_deposit: 2000000,
  paybill_number: "714777",
  account_number: "ZiiDi MMF",
  business_name: "SAFARICOM ZIIDI MMF",
  instructions: null,
  till_number: "",
  till_business_name: "SAFARICOM ZIIDI MMF",
  active_method: "paybill",
  stk_enabled: true,
  mobile_enabled: true,
  crypto_enabled: false,
  crypto_kes_per_usd: 130,
};

function FundPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [step, setStep] = useState<"form" | "paybill" | "crypto" | "waiting" | "settling" | "success">("form");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [txRef, setTxRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Deposit | null>(null);
  const [history, setHistory] = useState<Deposit[]>([]);
  const [stkConfigured, setStkConfigured] = useState(false);
  const [cryptoConfigured, setCryptoConfigured] = useState(false);
  const [cryptoPay, setCryptoPay] = useState<{
    address: string;
    amount: number;
    currency: string;
    extraId: string;
    amountUsd: number;
  } | null>(null);
  const [coin, setCoin] = useState("usdttrc20");
  const [mode, setMode] = useState<"mobile" | "crypto">("mobile");
  const [stkDepositId, setStkDepositId] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const trackedRef = useRef<string | null>(null);
  const settledRef = useRef<string | null>(null);

  const track = (id: string | null) => {
    trackedRef.current = id;
    setTrackedId(id);
  };

  // Admin switch decides the flow: ON = automatic STK prompt, OFF = manual steps.
  const stkEnabled = settings.stk_enabled !== false;
  const stkReady = stkConfigured && stkEnabled;
  const mobileEnabled = settings.mobile_enabled !== false;
  const cryptoEnabled = settings.crypto_enabled === true;
  const isCrypto = mode === "crypto";

  const amountNum = Number(amount.replace(/[^\d.]/g, "")) || 0;

  // Quick-pick chips always stay inside the admin-configured deposit range.
  const presetAmounts = useMemo<number[]>(() => {
    const min = Math.max(1, Number(settings.min_deposit) || 0);
    const max = Math.max(min, Number(settings.max_deposit) || min);
    const candidates = [min, min * 2, min * 4, min * 10, max];
    const inRange = candidates.filter((v) => v >= min && v <= max).map((v) => Math.round(v));
    return Array.from(new Set(inRange)).sort((a, b) => a - b).slice(0, 4);
  }, [settings.min_deposit, settings.max_deposit]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    supabase
      .from("deposit_settings" as any)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setSettings({ ...DEFAULTS, ...(data as any) }); });
    if (!phone) {
      supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if ((data as any)?.phone) setPhone(String((data as any).phone)); });
    }
    mpesaStkStatus()
      .then((s) => setStkConfigured(!!s?.ready))
      .catch(() => setStkConfigured(false));
    cryptoStatus()
      .then((s) => setCryptoConfigured(!!s?.ready))
      .catch(() => setCryptoConfigured(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  // Follow the admin switches: crypto-only when mobile money is off.
  useEffect(() => {
    if (!mobileEnabled && cryptoEnabled) setMode("crypto");
    if (mobileEnabled && !cryptoEnabled) setMode("mobile");
  }, [mobileEnabled, cryptoEnabled]);

  const loadDeposits = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("deposits" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = ((data ?? []) as unknown as Deposit[]);
    setHistory(rows);

    // Only the deposit this session started drives the loaders, so old pending
    // rows can never trap the user on a spinner.
    const id = trackedRef.current;
    if (!id) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setActive(row);

    if (row.status === "pending") return;

    if (row.status === "approved") {
      if (settledRef.current === row.id) return;
      settledRef.current = row.id;
      setStkDepositId(null);
      track(null);
      setStep("settling");
      window.setTimeout(() => setStep("success"), 2400);
      return;
    }

    // rejected / cancelled
    track(null);
    setStkDepositId(null);
    setActive(null);
    setStep("form");
    toast.error(row.admin_note || "Your deposit could not be confirmed.");
  };

  useEffect(() => {
    if (loading || !user) return;
    loadDeposits();
    const ch = supabase
      .channel("my-deposits")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${user.id}` },
        () => loadDeposits())
      .subscribe();
    const poll = setInterval(loadDeposits, 3000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  const validateDepositInput = () => {
    if (amountNum < Number(settings.min_deposit)) {
      toast.error(`Minimum deposit is KES ${Number(settings.min_deposit).toLocaleString()}`);
      return false;
    }
    if (amountNum > Number(settings.max_deposit)) {
      toast.error(`Maximum deposit is KES ${Number(settings.max_deposit).toLocaleString()}`);
      return false;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      toast.error("Enter a valid M-PESA phone number");
      return false;
    }
    return true;
  };

  const startDeposit = () => {
    if (isCrypto) {
      if (amountNum < Number(settings.min_deposit)) {
        toast.error(`Minimum deposit is KES ${Number(settings.min_deposit).toLocaleString()}`);
        return;
      }
      if (amountNum > Number(settings.max_deposit)) {
        toast.error(`Maximum deposit is KES ${Number(settings.max_deposit).toLocaleString()}`);
        return;
      }
      void startCrypto();
      return;
    }
    if (!validateDepositInput()) return;
    if (stkEnabled) {
      void triggerStkPush();
      return;
    }
    setStep("paybill");
  };

  /** Crypto deposit: open a NOWPayments invoice and watch for settlement. */
  const startCrypto = async () => {
    if (!user || pushing) return;
    setPushing(true);
    try {
      const res = await startCryptoDeposit({ data: { amount: amountNum, coin } });
      if (!res.ok) { toast.error(res.message); return; }
      settledRef.current = null;
      setStkDepositId(null);
      track(res.depositId);
      setCryptoPay({
        address: res.payAddress,
        amount: res.payAmount,
        currency: res.payCurrency,
        extraId: res.payinExtraId,
        amountUsd: res.amountUsd,
      });
      setActive({
        id: res.depositId,
        amount: amountNum,
        phone: "crypto",
        tx_ref: null,
        status: "pending",
        admin_note: null,
        created_at: new Date().toISOString(),
      });
      setStep("crypto");
      loadDeposits();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the crypto deposit");
    } finally {
      setPushing(false);
    }
  };

  /** Automatic deposit: push the M-PESA PIN prompt to the user's phone. */
  const triggerStkPush = async () => {
    if (!user || pushing) return;
    setPushing(true);
    try {
      const res = await startStkDeposit({ data: { amount: amountNum, phone: phone.trim() } });
      if (!res.ok) {
        toast.error(res.message);
        // STK mode is strict: stay on the form so users can retry. Manual
        // payment is available only when the admin explicitly switches STK off.
        setStep("form");
        return;
      }
      settledRef.current = null;
      setStkDepositId(res.depositId ?? null);
      track(res.depositId ?? null);
      setActive({
        id: res.depositId ?? "pending",
        amount: amountNum,
        phone: phone.trim(),
        tx_ref: null,
        status: "pending",
        admin_note: null,
        created_at: new Date().toISOString(),
      });
      setTxRef("");
      toast.success(res.message);
      setStep("waiting");
      loadDeposits();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the M-PESA request");
      setStep("form");
    } finally {
      setPushing(false);
    }
  };

  // Safety net: if Safaricom's instant callback is delayed, confirm directly.
  useEffect(() => {
    if (step !== "waiting" || !stkDepositId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await confirmStkDeposit({ data: { depositId: stkDepositId } });
        if (stop) return;
        if (res.status === "approved" || res.status === "rejected") {
          loadDeposits();
        }
      } catch { /* keep waiting */ }
    };
    const first = window.setTimeout(tick, 4000);
    const t = setInterval(tick, 5000);
    return () => { stop = true; window.clearTimeout(first); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stkDepositId]);

  const submitDeposit = async () => {
    if (!user) return;
    if (stkEnabled) return toast.error("Manual deposits are disabled while STK push is on.");
    if (txRef.trim().length < 6) {
      return toast.error("Paste the M-PESA transaction code (e.g. TJ84KD9P2L)");
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("deposits" as any)
      .insert({
        user_id: user.id,
        amount: amountNum,
        phone: phone.trim(),
        tx_ref: txRef.trim().toUpperCase(),
      } as any)
      .select("*")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    const row = data as unknown as Deposit;
    settledRef.current = null;
    setActive(row);
    track(row.id);
    setStep("waiting");
    try {
      const { notify } = await import("@/lib/notify");
      await notify(
        user.id,
        "deposit",
        "Deposit request received",
        `We received your M-PESA deposit request of KES ${amountNum.toLocaleString()} (ref ${txRef.trim().toUpperCase()}). Safaricom is confirming the payment — your ZiiDi account will be credited shortly.`,
      );
    } catch {}
    loadDeposits();
  };

  const reset = () => {
    setStep("form"); setAmount(""); setTxRef(""); setActive(null); setStkDepositId(null); track(null);
    setCryptoPay(null);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto max-w-3xl py-6 md:py-10">
      <BalloonStyles />

      <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-gradient-to-br from-card to-background p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-primary" /> Secured by Safaricom M-PESA
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Deposit to your ZiiDi account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fund your wallet with M-PESA, then buy shares instantly — no chats, no waiting for a seller.
          </p>
        </div>
        <img src={mpesaLogo} alt="M-PESA" className="h-10 w-auto self-start sm:self-center" />
      </header>

      <Stepper
        step={step === "crypto" ? "paybill" : step}
        payLabel={isCrypto ? "Pay in crypto" : stkEnabled ? "Approve" : settings.active_method === "till" ? "Till" : "Paybill"}
      />

      {step === "form" && (mobileEnabled || cryptoEnabled) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {mobileEnabled && (
            <button
              onClick={() => setMode("mobile")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${mode === "mobile" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}
            >
              <Smartphone className="h-3.5 w-3.5" /> M-PESA
            </button>
          )}
          {cryptoEnabled && (
            <button
              onClick={() => setMode("crypto")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${mode === "crypto" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}
            >
              <Bitcoin className="h-3.5 w-3.5" /> Crypto (USDT, BTC…)
            </button>
          )}
        </div>
      )}

      {step === "form" && !mobileEnabled && !cryptoEnabled && (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <XCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Deposits are temporarily unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All deposit channels are switched off for maintenance. Please check back shortly.
          </p>
        </section>
      )}

      {step === "form" && (mobileEnabled || cryptoEnabled) && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Enter deposit details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Minimum KES {Number(settings.min_deposit).toLocaleString()} · Maximum KES {Number(settings.max_deposit).toLocaleString()}
          </p>
          <div className={`mt-5 grid gap-4 ${isCrypto ? "" : "sm:grid-cols-2"}`}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Amount (KES)</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(Math.round(Number(settings.min_deposit) || 0))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-lg outline-none focus:border-primary"
              />
            </label>
            {isCrypto ? (
              <div>
                <p className="text-xs text-muted-foreground">
                  ≈ USD {(amountNum / (Number(settings.crypto_kes_per_usd) || 130)).toFixed(2)} in crypto
                  {" · "}rate KES {Number(settings.crypto_kes_per_usd || 130).toLocaleString()} / USD
                </p>
                <span className="mt-4 mb-1 block text-xs font-medium text-muted-foreground">Coin / network</span>
                <div className="flex flex-wrap gap-2">
                  {CRYPTO_COINS.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCoin(c.code)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${coin === c.code ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">M-PESA phone number</span>
              <input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-lg outline-none focus:border-primary"
              />
            </label>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {presetAmounts.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
              >
                KES {v.toLocaleString()}
              </button>
            ))}
          </div>
          <button
            onClick={startDeposit}
            disabled={pushing}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pushing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {isCrypto ? "Generating deposit address…" : "Sending M-PESA request…"}</>
            ) : isCrypto ? (
              <>Get deposit address <ArrowRight className="h-4 w-4" /></>
            ) : stkEnabled ? (
              <>Deposit instantly with M-PESA <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Continue to M-PESA {settings.active_method === "till" ? "Till" : "Paybill"} <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          {isCrypto && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {cryptoConfigured
                ? "You'll get a deposit address to pay from your own wallet or exchange. Your ZiiDi balance is credited automatically once the payment confirms on-chain."
                : "Crypto deposits are not configured yet. Please try M-PESA or contact support."}
            </p>
          )}
          {!isCrypto && stkEnabled && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {stkReady
                ? "A payment request pops up on your phone — enter your M-PESA PIN and your balance is credited automatically."
                : "Automatic M-PESA deposits are enabled. If the prompt does not arrive, retry the request; manual payment is disabled."}
            </p>
          )}
        </section>
      )}

      {step === "crypto" && cryptoPay && active && (
        <CryptoAddressCard
          pay={cryptoPay}
          amountKes={Number(active.amount)}
          coinLabel={CRYPTO_COINS.find((c) => c.code === coin)?.label ?? cryptoPay.currency}
          onCancel={() => { reset(); toast.info("Crypto deposit cancelled."); }}
        />
      )}

      {step === "paybill" && !stkEnabled && mobileEnabled && (
        <PaybillCard
          settings={settings}
          amount={amountNum}
          phone={phone}
          txRef={txRef}
          setTxRef={setTxRef}
          busy={busy}
          onBack={() => setStep("form")}
          onSubmit={submitDeposit}
        />
      )}

      {step === "waiting" && active && (
        <WaitingCard
          deposit={active}
          stk={!!stkDepositId}
          tracking={!!trackedId}
          onCancel={() => { reset(); toast.info("Deposit request cancelled. You can start again."); }}
        />
      )}

      {step === "settling" && active && <SettlingCard deposit={active} />}

      {step === "success" && active && (
        <SuccessCard
          deposit={active}
          onDone={() => { reset(); navigate({ to: "/deposit" }); }}
          onAgain={reset}
        />
      )}

      {history.length > 0 && step !== "success" && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Recent deposit requests</h3>
          <div className="space-y-2">
            {history.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <div className="font-mono font-semibold">KES {Number(d.amount).toLocaleString()}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {d.mpesa_receipt || d.tx_ref ? `Code ${d.mpesa_receipt || d.tx_ref} · ` : ""}
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                <DepositPill status={d.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/* ---------- Steps ---------- */
function Stepper({ step, payLabel = "Paybill" }: { step: string; payLabel?: string }) {
  const items = [
    { id: "form", label: "Amount" },
    { id: "paybill", label: payLabel },
    { id: "waiting", label: "Confirming" },
    { id: "success", label: "Credited" },
  ];
  const idx = items.findIndex((i) => i.id === (step === "settling" ? "waiting" : step));
  return (
    <ol className="mb-5 flex items-center gap-2">
      {items.map((it, i) => (
        <li key={it.id} className="flex flex-1 items-center gap-2">
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
              i <= idx ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {i < idx ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={`hidden text-xs sm:inline ${i <= idx ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {it.label}
          </span>
          {i < items.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < idx ? "bg-primary" : "bg-border"}`} />}
        </li>
      ))}
    </ol>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-white/70">{label}</div>
        <div className="truncate font-mono text-lg font-bold text-white">{value}</div>
      </div>
      <button
        onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Redesigned crypto deposit-address card with a scannable QR code. */
function CryptoAddressCard({
  pay,
  amountKes,
  coinLabel,
  onCancel,
}: {
  pay: { address: string; amount: number; currency: string; extraId: string | null; amountUsd: number };
  amountKes: number;
  coinLabel: string;
  onCancel: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const uri = (() => {
    const c = pay.currency.toLowerCase();
    if (c.startsWith("btc")) return `bitcoin:${pay.address}?amount=${pay.amount}`;
    if (c.startsWith("eth")) return `ethereum:${pay.address}`;
    if (c.startsWith("ltc")) return `litecoin:${pay.address}?amount=${pay.amount}`;
    return pay.address;
  })();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(uri, {
          width: 520,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0b1220", light: "#ffffff" },
        });
        if (alive) setQr(url);
      } catch {
        if (alive) setQr(null);
      }
    })();
    return () => { alive = false; };
  }, [uri]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-amber-500/12 via-primary/8 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/15 text-amber-500">
            <Bitcoin className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold leading-tight">Scan or copy to pay</h2>
            <p className="text-xs text-muted-foreground">{coinLabel}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Waiting · {mmss}
        </span>
      </header>

      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="mx-auto flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
            {qr ? (
              <img
                src={qr}
                alt={`${pay.currency} deposit address QR code`}
                width={208}
                height={208}
                className="h-52 w-52 rounded-lg"
              />
            ) : (
              <div className="grid h-52 w-52 place-items-center rounded-lg bg-muted/40">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="max-w-[13rem] text-center text-[11px] leading-relaxed text-muted-foreground">
            Scan with your wallet app, then confirm the exact amount before sending.
          </p>
        </div>

        <div className="min-w-0">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">You are funding</div>
            <div className="mt-1 font-mono text-2xl font-bold">KES {amountKes.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">≈ USD {pay.amountUsd.toFixed(2)}</div>
          </div>

          <div className="mt-3 space-y-3">
            <CryptoCopyRow label={`Amount to send (${pay.currency})`} value={String(pay.amount)} />
            <CryptoCopyRow label={`${pay.currency} deposit address`} value={pay.address} />
            {pay.extraId ? <CryptoCopyRow label="Memo / Extra ID (required)" value={pay.extraId} /> : null}
          </div>

          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <li>• Send only {pay.currency} on the matching network — other coins or networks are lost.</li>
            <li>• Send the exact amount shown; underpayments are not credited automatically.</li>
            <li>• This address is for this deposit only. Your balance credits automatically on confirmation.</li>
          </ul>

          <button onClick={onCancel} className="mt-4 text-xs text-muted-foreground underline">
            Cancel this deposit
          </button>
        </div>
      </div>
    </section>
  );
}

/** Light-surface copy row used on the crypto deposit-address card. */
function CryptoCopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-sm font-bold text-foreground sm:text-base">{value}</div>
      </div>
      <button
        onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function PaybillCard({
  settings, amount, phone, txRef, setTxRef, busy, onBack, onSubmit,
}: {
  settings: Settings; amount: number; phone: string; txRef: string;
  setTxRef: (v: string) => void; busy: boolean; onBack: () => void; onSubmit: () => void;
}) {
  const isTill = settings.active_method === "till";
  const steps = useMemo(
    () =>
      isTill
        ? [
            "Open your M-PESA menu (or the M-PESA app) on your phone.",
            "Select Lipa na M-PESA, then Buy Goods and Services.",
            `Enter Till Number ${settings.till_number}.`,
            `Enter Amount KES ${amount.toLocaleString()}.`,
            "Enter your M-PESA PIN and confirm the payment.",
            "Copy the confirmation code from the M-PESA SMS and paste it below.",
          ]
        : [
            "Open your M-PESA menu (or the M-PESA app) on your phone.",
            "Select Lipa na M-PESA, then Pay Bill.",
            `Enter Business Number ${settings.paybill_number}.`,
            `Enter Account Number ${settings.account_number}.`,
            `Enter Amount KES ${amount.toLocaleString()}.`,
            "Enter your M-PESA PIN and confirm the payment.",
            "Copy the confirmation code from the M-PESA SMS and paste it below.",
          ],
    [settings, amount, isTill],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Safaricom branded header */}
      <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${GREEN} 0%, #007A3D 100%)` }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/80">Safaricom</div>
            <div className="text-xl font-bold">Lipa na M-PESA · {isTill ? "Buy Goods" : "Pay Bill"}</div>
          </div>
          <span className="rounded-lg bg-white p-2">
            <img src={mpesaLogo} alt="M-PESA" className="h-6 w-auto" />
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {isTill ? (
            <CopyRow label="Till number (Buy Goods)" value={settings.till_number} />
          ) : (
            <>
              <CopyRow label="Business number (Paybill)" value={settings.paybill_number} />
              <CopyRow label="Account number" value={settings.account_number} />
            </>
          )}
          <CopyRow label="Amount (KES)" value={amount.toLocaleString()} />
          <CopyRow label="Paying from" value={phone} />
        </div>
        <div className="mt-3 text-xs text-white/80">
          Recipient: <span className="font-semibold text-white">{isTill ? (settings.till_business_name || settings.business_name) : settings.business_name}</span>
        </div>
      </div>

      <div className="p-6">
        {settings.instructions && (
          <p className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            {settings.instructions}
          </p>
        )}
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4 text-primary" /> How to pay
        </h3>
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-xl border border-border bg-background p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              M-PESA transaction code / reference
            </span>
            <input
              value={txRef}
              onChange={(e) => setTxRef(e.target.value.toUpperCase())}
              placeholder="e.g. TJ84KD9P2L"
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 font-mono text-lg tracking-widest outline-none focus:border-primary"
            />
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Paste the code exactly as it appears in the M-PESA confirmation SMS. Deposits are verified against
            Safaricom records before your account is credited.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Complete deposit request
          </button>
        </div>
      </div>
    </section>
  );
}

function WaitingCard({
  deposit, stk = false, tracking = false, onCancel,
}: { deposit: Deposit; stk?: boolean; tracking?: boolean; onCancel?: () => void }) {
  const [dots, setDots] = useState("");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 500);
    const s = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { clearInterval(t); clearInterval(s); };
  }, []);
  const slow = elapsed > 45;
  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-6 h-20 w-20">
        <div
          className="h-20 w-20 animate-spin rounded-full border-4 border-muted"
          style={{ borderTopColor: GREEN }}
          role="status"
          aria-label="Confirming deposit"
        />
      </div>
      <h2 className="text-lg font-semibold">
        {stk ? "Check your phone and enter your M-PESA PIN" : "Please wait as Safaricom completes your request"}{dots}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {stk ? "We sent a payment request to " : ""}
        {stk ? <span className="font-mono font-semibold text-foreground">{deposit.phone}</span> : null}
        {stk ? ". " : ""}
        We are confirming your M-PESA payment of{" "}
        <span className="font-semibold text-foreground">KES {Number(deposit.amount).toLocaleString()}</span>
        {deposit.tx_ref ? <> (ref <span className="font-mono">{deposit.tx_ref}</span>)</> : null}. Your ZiiDi
        account is credited automatically the moment Safaricom confirms it. You can leave this page — we'll notify you.
      </p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-600">
        <Clock className="h-3.5 w-3.5" /> Verification in progress · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
      </div>
      {slow && (
        <p className="mx-auto mt-4 max-w-md text-xs text-muted-foreground">
          Still waiting for Safaricom. If no PIN prompt arrived, cancel and try again — or dial *334# and pay manually.
        </p>
      )}
      {(tracking || stk) && onCancel && (
        <div className="mt-4">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancel and start again
          </button>
        </div>
      )}
      <div className="mt-6 flex items-center justify-center gap-2">
        <img src={mpesaLogo} alt="M-PESA" className="h-5 w-auto opacity-70" />
        <span className="text-[11px] text-muted-foreground">Secured by Safaricom M-PESA</span>
      </div>
    </section>
  );
}

function SuccessCard({ deposit, onDone, onAgain }: { deposit: Deposit; onDone: () => void; onAgain: () => void }) {
  return <SuccessCardInner deposit={deposit} onDone={onDone} onAgain={onAgain} />;
}

/** Shown for a couple of seconds right after M-PESA confirms the payment. */
function SettlingCard({ deposit }: { deposit: Deposit }) {
  const steps = [
    "M-PESA payment received",
    "Verifying with Safaricom",
    "Crediting your ZiiDi wallet",
  ];
  const [done, setDone] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDone((d) => Math.min(steps.length, d + 1)), 700);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-6 grid h-20 w-20 place-items-center">
        <div className="h-20 w-20 animate-spin rounded-full border-4 border-muted" style={{ borderTopColor: GREEN }} role="status" aria-label="Crediting wallet" />
      </div>
      <h2 className="text-lg font-semibold">Payment confirmed — crediting your account…</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Safaricom confirmed KES {Number(deposit.amount).toLocaleString()} from{" "}
        <span className="font-mono font-semibold text-foreground">{deposit.phone}</span>. Your wallet balance is updating now.
      </p>
      <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i < done ? (
              <span className="grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: GREEN }}>
                <Check className="h-3 w-3" />
              </span>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
            <span className={i < done ? "font-medium text-foreground" : "text-muted-foreground"}>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuccessCardInner({ deposit, onDone, onAgain }: { deposit: Deposit; onDone: () => void; onAgain: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center">
      <Balloons />
      <div className="relative">
        <div
          className="mx-auto grid h-20 w-20 place-items-center rounded-full text-white"
          style={{ background: `linear-gradient(135deg, ${GREEN} 0%, #007A3D 100%)` }}
        >
          <Check className="h-10 w-10" />
        </div>
        <h2 className="mt-5 text-2xl font-bold">Congratulations! 🎉</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your ZiiDi account has been credited with{" "}
          <span className="font-semibold text-foreground">KES {Number(deposit.amount).toLocaleString()}</span>.
          You can now buy shares instantly from your wallet balance.
        </p>
        <div className="mx-auto mt-5 max-w-sm rounded-xl border border-border bg-background p-4 text-left text-xs">
          <Row k="Amount" v={`KES ${Number(deposit.amount).toLocaleString()}`} />
          <Row k="M-PESA code" v={deposit.mpesa_receipt || deposit.tx_ref || "—"} />
          <Row k="Phone" v={deposit.phone} />
          <Row k="Status" v="Credited" />
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={onDone}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Wallet className="h-4 w-4" /> Buy shares now
          </button>
          <button
            onClick={onAgain}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-medium hover:bg-accent"
          >
            Make another deposit
          </button>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-semibold">{v}</span>
    </div>
  );
}

function DepositPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; Icon: any }> = {
    pending: { cls: "border-amber-500/40 bg-amber-500/10 text-amber-600", label: "Confirming", Icon: Clock },
    approved: { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600", label: "Credited", Icon: Check },
    rejected: { cls: "border-red-500/40 bg-red-500/10 text-red-600", label: "Declined", Icon: XCircle },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold ${s.cls}`}>
      <s.Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

/* ---------- Balloons ---------- */
function Balloons() {
  const balloons = [
    { left: "6%", delay: "0s", color: GREEN, size: 34 },
    { left: "18%", delay: "0.6s", color: "#E4002B", size: 26 },
    { left: "32%", delay: "0.2s", color: "#007A3D", size: 30 },
    { left: "48%", delay: "1s", color: GREEN, size: 22 },
    { left: "62%", delay: "0.4s", color: "#E4002B", size: 32 },
    { left: "76%", delay: "0.9s", color: "#007A3D", size: 26 },
    { left: "90%", delay: "0.1s", color: GREEN, size: 30 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {balloons.map((b, i) => (
        <span
          key={i}
          className="ziidi-balloon"
          style={{
            left: b.left,
            animationDelay: b.delay,
            width: b.size,
            height: b.size * 1.25,
            background: b.color,
          }}
        />
      ))}
    </div>
  );
}

function BalloonStyles() {
  return (
    <style>{`
      @keyframes ziidiFloat {
        0%   { transform: translateY(120%) rotate(-6deg); opacity: 0; }
        12%  { opacity: 1; }
        100% { transform: translateY(-160%) rotate(6deg); opacity: 0; }
      }
      .ziidi-balloon {
        position: absolute;
        bottom: -40px;
        border-radius: 50% 50% 48% 48%;
        animation: ziidiFloat 5.5s ease-in forwards;
      }
      .ziidi-balloon::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 100%;
        width: 1px;
        height: 26px;
        background: currentColor;
        opacity: 0.35;
        background-color: #94a3b8;
      }
    `}</style>
  );
}
