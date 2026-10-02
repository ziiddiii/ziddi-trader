import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ChevronLeft, Gift, Receipt, ShieldCheck, TrendingUp, Info, Download, CheckCircle2, AlertTriangle, ShoppingCart } from "lucide-react";
import jsPDF from "jspdf";

export const Route = createFileRoute("/investments/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Invest — ZiiDi Trader" },
      { name: "description", content: "Confirm your investment plan and expected returns on ZiiDi Trader." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Invest — ZiiDi Trader" },
      { property: "og:description", content: "Confirm your investment plan and expected returns on ZiiDi Trader." },
      { property: "og:url", content: `/investments/${params.id}` },
    ],
  }),
  component: InvestPage,
});

type Plan = {
  id: string;
  name: string;
  description: string;
  interest_rate: number;
  duration_hours: number;
  min_amount: number;
  max_amount: number;
};

type SavedInvestment = {
  id: string;
  plan_name: string;
  amount: number;
  interest_rate: number;
  duration_hours: number;
  expected_return: number;
  invested_at: string;
  matures_at: string;
};

function fmt(n: number) {
  return `KSH ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvestPage() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "confirm" | "success">("amount");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedInvestment | null>(null);
  const [insufficient, setInsufficient] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("investment_plans").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast.error("Plan not found"); navigate({ to: "/investments" }); return; }
      setPlan(data as Plan);
      setAmount(Number(data.min_amount).toFixed(2));
    })();
  }, [id, navigate]);

  if (!plan) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const numAmount = Number(amount) || 0;
  const income = numAmount * (plan.interest_rate / 100);
  const expected = numAmount + income;
  const inRange = numAmount >= plan.min_amount && numAmount <= plan.max_amount;

  const goConfirm = () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    const bal = Number(profile?.balance ?? 0);
    if (bal < plan.min_amount) { setInsufficient(true); return; }
    if (!inRange) { toast.error(`Amount must be between ${fmt(plan.min_amount)} and ${fmt(plan.max_amount)}`); return; }
    if (bal < numAmount) { setInsufficient(true); return; }
    setStep("confirm");
  };

  const investNow = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    const bal = Number(profile?.balance ?? 0);
    if (bal < numAmount || bal < plan.min_amount) {
      setInsufficient(true);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("invest_in_plan" as never, { _plan_id: plan.id, _amount: numAmount } as never);
    setBusy(false);
    if (error && /INSUFFICIENT_BALANCE/.test(error.message)) { setInsufficient(true); return; }
    if (error || !data) { toast.error(error?.message ?? "Could not place investment"); return; }
    const matures = new Date((data as SavedInvestment & { matures_at: string }).matures_at);
    window.dispatchEvent(new Event("balance-updated"));
    setSaved(data as SavedInvestment);
    setStep("success");
    try {
      const { notify } = await import("@/lib/notify");
      await notify(user.id, "investment", `Investment placed — ${plan.name}`,
        `You invested KES ${numAmount.toLocaleString()} in the ${plan.name} plan. Matures on ${matures.toLocaleString()} with expected return of KES ${expected.toLocaleString()}.`);
    } catch {}
  };

  const downloadPdf = () => {
    if (!saved || !plan) return;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const W = pdf.internal.pageSize.getWidth();
    // Header
    pdf.setFillColor(21, 128, 61);
    pdf.rect(0, 0, W, 90, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("ZiiDi Trader — Investment Receipt", 40, 45);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Reference: ${saved.id.slice(0, 8).toUpperCase()}`, 40, 68);
    pdf.text(new Date(saved.invested_at).toLocaleString(), W - 40, 68, { align: "right" });

    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Investment Summary", 40, 130);

    const rows: [string, string][] = [
      ["Package", saved.plan_name],
      ["Amount Invested", fmt(saved.amount)],
      ["Interest Rate", `${saved.interest_rate}%`],
      ["Duration", `${saved.duration_hours} hours`],
      ["Income", fmt(saved.expected_return - saved.amount)],
      ["Expected Return", fmt(saved.expected_return)],
      ["Matures On", new Date(saved.matures_at).toLocaleString()],
      ["Status", "Active"],
    ];
    let y = 160;
    rows.forEach(([k, v], i) => {
      if (i % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(40, y - 14, W - 80, 24, "F"); }
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(90, 90, 90);
      pdf.setFontSize(10);
      pdf.text(k, 52, y + 2);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(20, 20, 20);
      pdf.text(v, W - 52, y + 2, { align: "right" });
      y += 26;
    });

    pdf.setDrawColor(220, 220, 220);
    pdf.line(40, y + 10, W - 40, y + 10);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(90, 90, 90);
    pdf.setFontSize(10);
    pdf.text("Your funds are safe and secured. Thank you for trading with Safaricom Ziidi MMF.", 40, y + 32);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text("This is a system-generated receipt. Keep it for your records.", 40, 800);

    pdf.save(`ziidi_investment_${saved.id.slice(0, 8)}.pdf`);
  };

  if (step === "success" && saved) {
    return (
      <main className="mx-auto max-w-2xl py-6 md:py-10">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm md:p-10">
          <img
            src="https://media.tenor.com/bm8Q6yAlsPsAAAAi/verified.gif"
            alt="Success"
            className="mx-auto h-28 w-28"
          />
          <h1 className="mt-3 text-2xl font-bold text-primary">Investment placed successfully!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your capital is now working for you. Track it under Your Investments.</p>

          <div className="mt-6 rounded-xl border border-border bg-background p-5 text-left">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <Receipt className="h-4 w-4" /> Investment Summary
            </div>
            <div className="grid gap-2 text-sm">
              <Row k="Reference" v={saved.id.slice(0, 8).toUpperCase()} />
              <Row k="Package" v={saved.plan_name} />
              <Row k="Amount" v={fmt(saved.amount)} bold />
              <Row k="Interest rate" v={`${saved.interest_rate}%`} />
              <Row k="Duration" v={`${saved.duration_hours} hours`} />
              <Row k="Income" v={fmt(saved.expected_return - saved.amount)} />
              <Row k="Expected return" v={fmt(saved.expected_return)} bold accent />
              <Row k="Matures on" v={new Date(saved.matures_at).toLocaleString()} />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={downloadPdf}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Download PDF receipt
            </button>
            <Link
              to="/investments"
              className="inline-flex flex-1 items-center justify-center rounded-md border border-border py-2.5 text-sm font-medium hover:bg-accent"
            >
              Back to plans
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> Your funds are safe and secured.
          </div>
        </div>
      </main>
    );
  }

  if (step === "confirm") {
    return (
      <main className="mx-auto max-w-lg py-6 md:py-10">
        {insufficient && (
          <InsufficientFundsModal
            balance={Number(profile?.balance ?? 0)}
            needed={numAmount}
            onClose={() => setInsufficient(false)}
            onYes={() => { setInsufficient(false); navigate({ to: "/deposit" }); }}
          />
        )}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold">Invest to {plan.name.split(" ")[0]}</h1>
          </div>

          <div className="text-center">
            <div className="text-sm text-muted-foreground">Amount</div>
            <div className="mt-1 text-4xl font-bold text-primary">{fmt(numAmount)}</div>
            <div className="mx-auto mt-2 inline-block rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-muted-foreground">
              Min. {fmt(plan.min_amount)}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary"><Gift className="h-4 w-4" /> Package</div>
              <div className="font-semibold">{plan.name}</div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary"><Receipt className="h-4 w-4" /> Transaction Fee</div>
              <div className="font-semibold">KSH 0.00</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setStep("amount")}
              className="rounded-md border border-border py-2.5 text-sm font-medium hover:bg-accent"
            >
              Edit Amount
            </button>
            <button
              onClick={investNow}
              disabled={busy}
              className="rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Processing…" : "Invest Now"}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Your funds are safe and secured.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/investments"
          className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-card shadow-sm hover:bg-accent"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Invest in {plan.name}</h1>
      </div>

      <label className="text-sm font-semibold">
        Amount <span className="text-destructive">*</span>
      </label>
      <div className="mt-2 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm focus-within:border-primary">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent text-2xl font-medium outline-none"
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Min {Number(plan.min_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} – Max {Number(plan.max_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} KSH
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Duration:</span>
          <span className="font-bold">
            {plan.duration_hours >= 24 && plan.duration_hours % 24 === 0
              ? `${plan.duration_hours / 24} day${plan.duration_hours / 24 > 1 ? "s" : ""}`
              : `${plan.duration_hours} hours`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Income:</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-primary">
            {fmt(income)}
            <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground" title={`${plan.interest_rate}% return`}>
              <Info className="h-3 w-3" />
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Expected Return:</span>
          <span className="font-bold">{fmt(expected)}</span>
        </div>
      </div>

      {plan.description && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{plan.description}</p>
      )}

      <button
        onClick={goConfirm}
        disabled={!inRange}
        className="mt-6 w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        Continue
      </button>
    </main>
  );
}

function Row({ k, v, bold, accent }: { k: string; v: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${accent ? "text-primary" : ""}`}>{v}</span>
    </div>
  );
}

function InsufficientFundsModal({
  balance,
  needed,
  onClose,
  onYes,
}: {
  balance: number;
  needed: number;
  onClose: () => void;
  onYes: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">Insufficient funds</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your available balance is{" "}
              <span className="font-semibold text-foreground">
                KSH {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              , which is below the KSH {needed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} required for this investment.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-primary">
            <ShieldCheck className="h-4 w-4" /> Safaricom Ziidi Escrow
          </div>
          <p className="mt-1 text-muted-foreground">
            Would you like <span className="font-medium text-foreground">Safaricom</span> to help you search for
            <span className="font-medium text-foreground"> Ziidi verified merchants</span> to buy shares from via secure escrow?
            You can then resell for a profit and fund this investment.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border py-2.5 text-sm font-medium hover:bg-accent"
          >
            No, cancel
          </button>
          <button
            onClick={onYes}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4" /> Yes, find merchants
          </button>
        </div>
      </div>
    </div>
  );
}