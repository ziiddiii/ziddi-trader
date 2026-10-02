import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Smartphone, Landmark, CreditCard, ChevronLeft, Check, AlertCircle, Copy, Share2, Download, CheckCircle2, Eye, EyeOff, Receipt, XCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { KycGate, isKycVerified } from "@/components/kyc-gate";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw — ZiiDi Trader" },
      { name: "description", content: "Withdraw your available balance to M-Pesa, bank, or card on ZiiDi Trader." },
      { property: "og:title", content: "Withdraw — ZiiDi Trader" },
      { property: "og:description", content: "Withdraw your available balance to M-Pesa, bank, or card on ZiiDi Trader." },
      { property: "og:url", content: "/withdraw" },
    ],
    links: [{ rel: "canonical", href: "/withdraw" }],
  }),
  component: WithdrawPage,
});

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  destination: string;
  status: string;
  created_at: string;
  tax_paid_at?: string | null;
  tax_tx_code?: string | null;
};

const METHODS = [
  { id: "mpesa", label: "M-Pesa", icon: Smartphone, placeholder: "07XX XXX XXX",
    tagline: "Instant mobile money withdrawal for Kenya users", badge: "Instant" },
  { id: "bank",  label: "Bank Transfer", icon: Landmark, placeholder: "Account number",
    tagline: "Direct bank wire transfer for larger withdrawals", badge: null },
  { id: "card",  label: "Debit / Credit Card", icon: CreditCard, placeholder: "Card number",
    tagline: "Withdraw straight to your Visa or Mastercard", badge: null },
] as const;

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function codeFromId(id: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) {
    const c = id.charCodeAt(i % id.length) + i * 7;
    s += chars[c % chars.length];
  }
  return s;
}

function maskDigits(input: string) {
  // Mask any digit run of length >= 10 to first 6 + *** + last 3
  return input.replace(/\d{10,}/g, (d) => `${d.slice(0, 6)}***${d.slice(-3)}`);
}

function formatBankDestination(destination: string) {
  // Bank destination is stored as: "Bank Name · A/C number · Holder · ..."
  const parts = destination.split(" · ");
  const bankName = parts[0] || "";
  const accountRaw = (parts[1] || "").replace(/^A\/C\s*/, "");
  const accountNumber = maskDigits(accountRaw);
  const accountHolder = parts[2] || "";
  return `${bankName} · ${accountNumber} · ${accountHolder}`;
}

function formatHistoryDestination(method: string, destination: string, holder: string) {
  if (method === "mpesa") {
    const masked = maskDigits(destination.replace(/\s+/g, ""));
    return `${holder} · ${masked}`;
  }
  if (method === "bank") {
    return formatBankDestination(destination);
  }
  return maskDigits(destination);
}

async function downloadWithdrawalHistoryPdf(opts: {
  name: string;
  rows: Array<{ date: Date; method: string; methodLabel: string; destination: string; amount: number; status: string; code: string }>;
  holder: string;
  email?: string;
  phone?: string;
}) {
  try {
    const { default: jsPDF } = await import("jspdf");
    const QRCode = (await import("qrcode")).default;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const GREEN = "#2E8B2C";
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Date helpers
    const now = new Date();
    const ordinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const fmtLong = (d: Date) =>
      `${ordinal(d.getDate())} ${d.toLocaleString("en-GB", { month: "long" })} ${d.getFullYear()}`;
    const fmtShort = (d: Date) =>
      `${ordinal(d.getDate())} ${d.toLocaleString("en-GB", { month: "short" })} ${d.getFullYear()}`;
    const periodStart = new Date(now); periodStart.setMonth(periodStart.getMonth() - 1);
    const periodLabel = `${fmtShort(periodStart)} - ${fmtShort(now)}`;

    // "Page 1 of N" placeholder — updated at end
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor("#6b7280");
    pdf.text("Page 1 of 1", pageW - 32, 40, { align: "right" });

    // Big green title
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(GREEN);
    pdf.text("ZIIDI TRADER TRANSACTION STATEMENT", pageW / 2, 78, { align: "center" });

    // Customer info block (left)
    let y = 108;
    const labelX = 32;
    const valueX = 150;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const infoRows: Array<[string, string]> = [
      ["Customer Name:", opts.name],
      ["Mobile Number:", opts.phone || "-"],
      ["Email Address:", opts.email || "-"],
      ["Statement Period:", periodLabel],
      ["Request Date:", fmtShort(now)],
    ];
    for (const [label, val] of infoRows) {
      pdf.setTextColor(GREEN);
      pdf.text(label, labelX, y);
      pdf.setTextColor("#111111");
      pdf.text(val, valueX, y);
      y += 18;
    }

    // Stamp box (middle)
    const stampX = 270, stampY = 108, stampW = 135, stampH = 92;
    pdf.setDrawColor("#1e3a8a");
    pdf.setLineWidth(1);
    pdf.rect(stampX, stampY, stampW, stampH);
    pdf.setTextColor("#1e3a8a");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(`Approved - ${fmtLong(now)}`, stampX + stampW / 2, stampY + 14, { align: "center" });
    pdf.setFontSize(6.5);
    pdf.text("SAFARICOM ZIIDI CUSTOMER CARE", stampX + stampW / 2, stampY + 26, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("ZIIDI Statement Period:", stampX + stampW / 2, stampY + 40, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.text(periodLabel, stampX + stampW / 2, stampY + 51, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.setTextColor("#374151");
    pdf.text("www.safaricom.co.ke", stampX + stampW / 2, stampY + 66, { align: "center" });
    pdf.text("P.O. BOX 66827 - 00800, NAIROBI", stampX + stampW / 2, stampY + 75, { align: "center" });
    pdf.setTextColor(GREEN);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text("Simple • Transparent • Honest  FOR YOU", stampX + stampW / 2, stampY + 88, { align: "center" });

    // QR code (right)
    try {
      const qrPayload = `ZIIDI|${opts.name}|${periodLabel}|${now.toISOString()}`;
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 240 });
      pdf.addImage(qrDataUrl, "PNG", pageW - 128, 108, 96, 96);
    } catch { /* ignore QR failures */ }

    // Summary section
    y = 240;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(GREEN);
    pdf.text("SUMMARY", pageW / 2, y, { align: "center" });
    y += 12;
    // header row
    pdf.setFillColor(GREEN);
    pdf.rect(24, y, pageW - 48, 20, "F");
    pdf.setTextColor("#ffffff");
    pdf.setFontSize(10);
    pdf.text("TRANSACTION TYPE", 32, y + 14);
    pdf.text("PAID IN", pageW - 230, y + 14);
    pdf.text("PAID OUT", pageW - 90, y + 14);
    y += 20;

    const byMethod = new Map<string, number>();
    let totalOut = 0;
    for (const r of opts.rows) {
      byMethod.set(r.methodLabel, (byMethod.get(r.methodLabel) ?? 0) + r.amount);
      totalOut += r.amount;
    }
    const summaryRows: Array<[string, number, number]> = [];
    for (const [label, amt] of byMethod.entries()) {
      summaryRows.push([`WITHDRAWAL (${label.toUpperCase()})`, 0, amt]);
    }
    summaryRows.push(["TOTAL", 0, totalOut]);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor("#111111");
    pdf.setFontSize(10);
    summaryRows.forEach(([label, pin, pout], i) => {
      if (label === "TOTAL") pdf.setFont("helvetica", "bold");
      if (i % 2 === 1 && label !== "TOTAL") { pdf.setFillColor("#f8fafc"); pdf.rect(24, y, pageW - 48, 18, "F"); }
      pdf.text(label, 32, y + 13);
      pdf.text(pin.toFixed(2), pageW - 230, y + 13);
      pdf.text(pout.toLocaleString(undefined, { minimumFractionDigits: 2 }), pageW - 90, y + 13);
      y += 18;
      if (label === "TOTAL") pdf.setFont("helvetica", "normal");
    });

    // Detailed statement
    y += 16;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(GREEN);
    pdf.text("DETAILED STATEMENT", pageW / 2, y, { align: "center" });
    y += 10;

    // Table header
    pdf.setFillColor(GREEN);
    pdf.rect(24, y, pageW - 48, 22, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor("#ffffff");
    pdf.text("Receipt No.", 30, y + 15);
    pdf.text("Completion Time", 105, y + 15);
    pdf.text("Details", 195, y + 15);
    pdf.text("Status", 380, y + 15);
    pdf.text("Withdrawn", 435, y + 15);
    pdf.text("Balance", 510, y + 15);
    y += 22;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);

    let runningBal = 0;
    for (const r of opts.rows) runningBal += r.amount;
    let rowIndex = 0;
    for (const r of opts.rows) {
      const dest = formatHistoryDestination(r.method, r.destination, opts.holder);
      const dateStr = r.date.toISOString().slice(0, 10).replace(/-/g, "-") + " " +
        r.date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const details = `Withdraw ${r.methodLabel} to ${dest}`;
      const detailLines = pdf.splitTextToSize(details, 180);
      const codeLines = pdf.splitTextToSize(r.code, 70);
      const contentLines = Math.max(detailLines.length, codeLines.length, 1);
      const rowH = Math.max(20, contentLines * 11 + 8);

      if (y + rowH > pageH - 90) { pdf.addPage(); y = 48; }

      // Alternating row background
      if (rowIndex % 2 === 1) {
        pdf.setFillColor("#f8fafc");
        pdf.rect(24, y, pageW - 48, rowH, "F");
      }

      const textY = y + 13;
      pdf.setTextColor("#111111");
      pdf.text(codeLines, 30, textY);
      pdf.text(dateStr, 105, textY);
      pdf.text(detailLines, 195, textY);
      pdf.text(r.status || "Completed", 380, textY);
      pdf.text("-" + r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 435, textY);
      pdf.text(Math.max(0, runningBal - r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }), 510, textY);
      runningBal -= r.amount;
      pdf.setDrawColor("#e5e7eb");
      pdf.line(24, y + rowH, pageW - 24, y + rowH);
      y += rowH;
      rowIndex++;
    }

    // Verification block + footer
    if (y > pageH - 120) { pdf.addPage(); y = 48; }
    y += 14;
    pdf.setDrawColor("#d1d5db");
    pdf.setLineWidth(0.5);
    pdf.line(24, y, pageW - 24, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor("#6b7280");
    pdf.text(
      "Disclaimer: Any personal information shared with you should be handled in accordance with the Data Protection Act",
      32, y,
    );
    y += 10;
    pdf.text("and only used for the purpose for which it was provided.", 32, y);
    y += 18;

    pdf.setFillColor("#eef7ec");
    pdf.rect(24, y, pageW - 48, 44, "F");
    pdf.setTextColor("#111111");
    pdf.setFontSize(9);
    pdf.text("Statement Verification Code", 36, y + 14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(GREEN);
    const verify = (opts.rows[0]?.code || "ZIIDI0000").slice(-8).toUpperCase();
    pdf.text(verify, 36, y + 34);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor("#374151");
    pdf.text("To verify the validity of this statement, contact Safaricom Ziidi", pageW - 36, y + 18, { align: "right" });
    pdf.text("Customer Care via *334# and follow the prompts.", pageW - 36, y + 30, { align: "right" });
    y += 56;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor("#6b7280");
    pdf.text(
      "For self-help dial *234# | Web: www.safaricom.co.ke | Twitter: @SafaricomPLC | Facebook: Safaricom PLC | Terms and conditions apply",
      pageW / 2, pageH - 30, { align: "center" },
    );

    // Update page numbers
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor("#6b7280");
      pdf.text(`Page ${i} of ${pageCount}`, pageW - 32, 40, { align: "right" });
    }

    pdf.save("ziidi_trader_transaction_statement.pdf");
  } catch (err) {
    console.error(err);
    toast.error("Could not generate PDF");
  }
}

async function downloadWithdrawalReceipt(opts: {
  name: string;
  amount: number;
  code: string;
  date: Date;
  methodLabel: string;
  destination: string;
}) {
  const GREEN = "#3AAA35";
  const DGREEN = "#2E8B2C";
  const firstName = (opts.name || "Customer").split(" ")[0];
  const dateStr =
    opts.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    opts.date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
  const bars = Array.from({ length: 70 })
    .map((_, i) => {
      const c = opts.code.charCodeAt(i % opts.code.length) + i * 3;
      const w = (c % 3) + 1;
      const black = i % 2 === 0;
      return `<span style="display:inline-block;width:${w}px;height:60px;background:${black ? "#111" : "#fff"};vertical-align:top"></span>`;
    })
    .join("");

  const receiptHTML = `
    <div id="__wd_receipt_sheet" style="width:440px;background:#fff;padding:28px 26px 24px;font-family:Arial,Helvetica,sans-serif;color:#333;box-sizing:border-box">
      <svg width="72" height="36" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="118" height="58" rx="6" fill="#fff" stroke="#e5e5e5"/>
        <text x="8" y="28" font-family="Arial Black,Arial" font-size="20" font-weight="900" fill="${GREEN}">M-PESA</text>
        <rect x="52" y="32" width="14" height="22" rx="2" fill="#fff" stroke="${GREEN}" stroke-width="2"/>
        <rect x="55" y="36" width="8" height="4" fill="#e11"/>
      </svg>
      <div style="text-align:center;margin:18px 0 6px">
        <svg width="140" height="90" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
          <polygon points="10,60 190,10 120,110 100,75 175,25 60,80" fill="${GREEN}"/>
          <polygon points="100,75 120,110 115,80" fill="${DGREEN}"/>
        </svg>
      </div>
      <div style="color:${GREEN};font-size:28px;font-weight:800;text-align:center;margin:14px 0 6px">Hi ${firstName},</div>
      <div style="text-align:center;color:#4a4a4a;font-size:13px;margin-bottom:22px">Thank you for withdrawing with M-PESA</div>
      <div style="display:flex;gap:14px;align-items:stretch">
        <div style="background:${GREEN};color:#fff;border-radius:4px;padding:16px 14px;width:180px;display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:13px;font-weight:600;line-height:1.3;margin-bottom:8px">Total Amount Withdrawn:</div>
          <div style="font-size:22px;font-weight:800;letter-spacing:.5px">KES ${opts.amount.toFixed(0)}</div>
        </div>
        <div style="flex:1;font-size:12px;color:#333;line-height:1.9">
          <div style="display:flex"><span style="width:110px;color:#555">Date:</span><span style="font-weight:700;color:#222">${dateStr}</span></div>
          <div style="display:flex"><span style="width:110px;color:#555">Customer:</span><span style="font-weight:700;color:#222">${opts.name}</span></div>
          <div style="display:flex"><span style="width:110px;color:#555">Paid To:</span><span style="font-weight:700;color:#222">${opts.destination}</span></div>
          <div style="display:flex"><span style="width:110px;color:#555">Method:</span><span style="font-weight:700;color:#222">${opts.methodLabel}</span></div>
          <div style="display:flex"><span style="width:110px;color:#555">Transaction No:</span><span style="font-weight:700;color:#222">${opts.code}</span></div>
          <div style="display:flex"><span style="width:110px;color:#555">Payment Type:</span><span style="font-weight:700;color:#222">Customer Withdrawal</span></div>
        </div>
      </div>
      <div style="margin:26px 0 6px;text-align:center;white-space:nowrap;overflow:hidden;line-height:0">${bars}</div>
      <div style="text-align:center;color:${GREEN};font-weight:800;letter-spacing:3px;font-size:14px;margin:10px 0 16px">ETR</div>
      <div style="text-align:center;color:#4a4a4a;font-size:12px;line-height:1.8">
        <div style="margin-bottom:8px">Question? Comment? Feel free to get in touch!</div>
        <div>Safaricom House Waiyaki Way</div>
        <div>P.O Box 66827 – 00800, Nairobi</div>
        <div>+254 722 003 272</div>
      </div>
      <div style="text-align:center;margin-top:22px;color:${GREEN};font-size:11px;letter-spacing:1px">Simple • Transparent • Honest</div>
      <div style="text-align:center;color:${GREEN};font-weight:800;font-size:24px;letter-spacing:3px;margin-top:2px">FOR YOU</div>
      <div style="display:flex;justify-content:flex-end;align-items:center;margin-top:20px;gap:6px;color:${GREEN};font-weight:800;font-size:22px;font-style:italic">
        <svg width="26" height="26" viewBox="0 0 32 32"><path d="M4 20 Q16 4 28 20" fill="none" stroke="#e11" stroke-width="3"/><circle cx="16" cy="18" r="3" fill="${GREEN}"/></svg>
        <span>Safaricom</span>
      </div>
    </div>
  `;

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff;z-index:-1";
  host.innerHTML = receiptHTML;
  document.body.appendChild(host);
  const node = host.firstElementChild as HTMLElement;

  try {
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      onclone: (doc) => {
        const els = doc.querySelectorAll<HTMLElement>("*");
        els.forEach((el) => {
          const cs = doc.defaultView?.getComputedStyle(el);
          if (!cs) return;
          (["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "fill", "stroke"] as const).forEach((prop) => {
            const v = cs.getPropertyValue(prop === "backgroundColor" ? "background-color" : prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()));
            if (v && v.includes("oklch")) {
              (el.style as any)[prop] = prop === "color" ? "#333333" : prop.toLowerCase().includes("background") ? "#ffffff" : "#000000";
            }
          });
        });
      },
    });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const targetW = pageW - margin * 2;
    const targetH = (canvas.height / canvas.width) * targetW;
    const y = Math.max(margin, (pageH - targetH) / 2);
    pdf.addImage(img, "PNG", margin, y, targetW, targetH);
    pdf.save(`safaricom_ziidi_withdrawal_receipt.pdf`);
  } catch (err) {
    console.error(err);
    toast.error("Could not generate PDF");
  } finally {
    host.remove();
  }
}

function WithdrawPage() {
  const { user, profile, loading } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("mpesa");
  const [destination, setDestination] = useState("");
  const [bank, setBank] = useState({
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    swift: "",
    branch: "",
  });
  const [showAcct, setShowAcct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [step, setStep] = useState<"method" | "details" | "tax" | "success" | "processing">("method");
  const [codeOpen, setCodeOpen] = useState(false);
  const [txCode, setTxCode] = useState("");
  const [approvedW, setApprovedW] = useState<Withdrawal | null>(null);
  const [rejectedW, setRejectedW] = useState<Withdrawal | null>(null);
  const [holdingsCount, setHoldingsCount] = useState<number | null>(null);
  const [kycOk, setKycOk] = useState(false);
  const [showKyc, setShowKyc] = useState(false);
  const [taxSettings, setTaxSettings] = useState<{
    tax_percent: number; till_number: string; till_business_name: string;
    paybill_number: string; paybill_account: string; instructions: string;
    active_method: "till" | "paybill";
    min_withdrawal: number; max_withdrawal: number; tax_enabled: boolean;
  } | null>(null);
  const [pendingTax, setPendingTax] = useState<null | {
    amount: number; tax: number; method: string; destination: string;
    invoiceNo: string; issuedAt: Date;
  }>(null);
  const [receipt, setReceipt] = useState<null | {
    id?: string;
    code: string;
    date: Date;
    amount: number;
    method: string;
    destination: string;
    newBalance: number;
    remainingDaily: number;
  }>(null);

  // Track which settled (approved/rejected) withdrawals the user has already been shown.
  const seenKey = user ? `ziidi_wd_seen_${user.id}` : "";
  const readSeen = (): string[] | null => {
    try { const v = localStorage.getItem(seenKey); return v ? JSON.parse(v) : null; } catch { return null; }
  };
  const watchWithdrawal = (_id: string) => { /* all of the user's withdrawals are watched */ };
  useEffect(() => {
    if (!user) return;
    let stop = false;
    const tick = async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["completed", "approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (stop || !data) return;
      const rows = data as Withdrawal[];
      const seen = readSeen();
      if (seen === null) {
        // First visit: don't pop screens for old withdrawals.
        localStorage.setItem(seenKey, JSON.stringify(rows.map((w) => w.id)));
        return;
      }
      const fresh = rows.find((w) => !seen.includes(w.id));
      if (!fresh) return;
      localStorage.setItem(seenKey, JSON.stringify([...seen, fresh.id].slice(-200)));
      if (fresh.status === "rejected") { setApprovedW(null); setRejectedW(fresh); }
      else { setRejectedW(null); setApprovedW(fresh); }
      load();
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setHistory((data ?? []) as Withdrawal[]);
    const { count } = await supabase
      .from("holdings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setHoldingsCount(count ?? 0);
    setKycOk(await isKycVerified(user.id));
    const { data: tx } = await supabase
      .from("withdrawal_tax_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tx) setTaxSettings({
      tax_percent: Number(tx.tax_percent ?? 15),
      till_number: tx.till_number ?? "",
      till_business_name: tx.till_business_name ?? "",
      paybill_number: tx.paybill_number ?? "",
      paybill_account: tx.paybill_account ?? "",
      instructions: tx.instructions ?? "",
      active_method: ((tx as { active_method?: string }).active_method === "paybill" ? "paybill" : "till"),
      tax_enabled: (tx as { tax_enabled?: boolean }).tax_enabled !== false,
      min_withdrawal: Math.max(100000, Number((tx as { min_withdrawal?: number }).min_withdrawal ?? 0)),
      max_withdrawal: Number((tx as { max_withdrawal?: number }).max_withdrawal ?? 1000000),
    });
  };

  useEffect(() => {
    if (!loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  const taxPaidKey = (id: string) => `ziidi_tax_paid_${id}`;
  const isTaxPaid = (id: string) => {
    if (typeof window === "undefined") return false;
    try { return !!localStorage.getItem(taxPaidKey(id)); } catch { return false; }
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const minW = Math.max(100000, taxSettings?.min_withdrawal ?? 100000);
    if (amt < minW) return toast.error(`Minimum withdrawal is KES ${minW.toLocaleString()}`);
    if (taxSettings && amt > taxSettings.max_withdrawal) return toast.error(`Maximum withdrawal is KES ${taxSettings.max_withdrawal.toLocaleString()}`);
    let dest = destination.trim();
    if (method === "bank") {
      if (!bank.bankName.trim()) return toast.error("Enter bank name");
      if (!bank.accountNumber.trim()) return toast.error("Enter account number");
      if (!bank.accountHolder.trim()) return toast.error("Enter account holder name");
      dest =
        `${bank.bankName.trim()} · A/C ${bank.accountNumber.trim()} · ${bank.accountHolder.trim()}` +
        (bank.swift.trim() ? ` · SWIFT ${bank.swift.trim()}` : "") +
        (bank.branch.trim() ? ` · ${bank.branch.trim()}` : "");
    } else if (!dest) {
      return toast.error("Enter a destination");
    }
    setBusy(true);
    const { data: wid, error } = await supabase.rpc("withdraw_funds", {
      _amount: amt,
      _method: method,
      _destination: dest,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const dailyCap = method === "mpesa" ? 500_000 : 10_000_000;
    const wRow = wid as { id?: string } | null;
    const code = wRow?.id ? codeFromId(wRow.id) : genCode();
    setReceipt({
      id: wRow?.id,
      code,
      date: new Date(),
      amount: amt,
      method,
      destination: dest,
      newBalance: Math.max(0, balance - amt),
      remainingDaily: Math.max(0, dailyCap - amt),
    });
    // Read the admin's MMF tax switch live so a recent toggle is respected.
    const { data: liveTax } = await supabase
      .from("withdrawal_tax_settings")
      .select("tax_enabled,tax_percent")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const liveTaxOn = liveTax ? (liveTax as { tax_enabled?: boolean }).tax_enabled !== false : taxSettings?.tax_enabled !== false;
    if (taxSettings) setTaxSettings({ ...taxSettings, tax_enabled: liveTaxOn, tax_percent: Number(liveTax?.tax_percent ?? taxSettings.tax_percent) });
    if (!liveTaxOn) {
      setStep("processing");
    } else if (wRow?.id) {
      const pct = Number(liveTax?.tax_percent ?? taxSettings?.tax_percent ?? 15);
      setPendingTax({ amount: amt, tax: Math.round(amt * pct) / 100, method, destination: dest, invoiceNo: "TAX-" + codeFromId(wRow.id), issuedAt: new Date() });
      (window as unknown as { __ziidi_tax_wid?: string }).__ziidi_tax_wid = wRow.id;
      setStep("tax");
    } else {
      setStep("success");
    }
    setAmount("");
    setDestination("");
    setBank({ bankName: "", accountNumber: "", accountHolder: "", swift: "", branch: "" });
    load();
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const { notify } = await import("@/lib/notify");
        const taxOn = liveTaxOn;
        await notify(uid, "withdrawal", taxOn ? "Withdrawal submitted — MMF tax due" : "Withdrawal submitted — processing",
          taxOn ? `Your withdrawal of KES ${amt.toLocaleString()} via ${method.toUpperCase()} is queued. Pay the MMF withholding tax to release funds. Ref ${code}.` : `Your withdrawal of KES ${amt.toLocaleString()} via ${method.toUpperCase()} is being processed. Ref ${code}.`,
          { reference: code, details: [
            { label: "Amount", value: `KES ${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { label: "Method", value: method.toUpperCase() },
            { label: "Destination", value: dest },
            { label: "MMF withholding tax (15%)", value: `KES ${(Math.round(amt * 15) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { label: "New balance", value: `KES ${Math.max(0, balance - amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { label: "Status", value: taxOn ? "Awaiting tax payment" : "Processing" },
            { label: "Date", value: new Date().toLocaleString() },
          ] });
      }
    } catch {}
  };

  const openTaxFor = (w: Withdrawal) => {
    const pct = taxSettings?.tax_percent ?? 15;
    const amt = Number(w.amount);
    setPendingTax({
      amount: amt,
      tax: Math.round(amt * pct) / 100,
      method: w.method,
      destination: w.destination,
      invoiceNo: "TAX-" + codeFromId(w.id),
      issuedAt: new Date(w.created_at),
    });
    (pendingTax as unknown); // no-op
    (window as unknown as { __ziidi_tax_wid?: string }).__ziidi_tax_wid = w.id;
    setStep("tax");
  };

  const markTaxPaid = async (txc: string) => {
    const wid = (window as unknown as { __ziidi_tax_wid?: string }).__ziidi_tax_wid;
    if (!wid) return;
    setBusy(true);
    const { error } = await supabase.rpc("submit_withdrawal_tax_code" as never, { _id: wid, _code: txc } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transaction code submitted. Your withdrawal is pending verification.");
    setCodeOpen(false);
    setPendingTax(null);
    watchWithdrawal(wid);
    setStep("processing");
    load();
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user)
    return <div className="p-8 text-center text-muted-foreground">Sign in to withdraw.</div>;

  const chosen = METHODS.find((m) => m.id === method)!;
  const balance = Number(profile?.balance ?? 0);
  const insufficient = balance <= 0;

  if (approvedW) {
    const ml = METHODS.find((m) => m.id === approvedW.method)?.label ?? approvedW.method;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-14 w-14 text-primary" />
          </div>
        </div>
        <h2 className="mt-6 text-xl font-bold">Withdrawal approved</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          KES {Number(approvedW.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} — funds are on the way to your {ml}
          {approvedW.destination ? ` (${approvedW.destination})` : ""}.
        </p>
        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/dashboard" hash="transactions" onClick={() => setApprovedW(null)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Receipt className="h-4 w-4" /> View transaction history
          </Link>
          <button onClick={() => { setApprovedW(null); setStep("method"); }} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">Done</button>
        </div>
      </div>
    );
  }

  if (rejectedW) {
    const ml = METHODS.find((m) => m.id === rejectedW.method)?.label ?? rejectedW.method;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-14 w-14 text-destructive" />
          </div>
        </div>
        <h2 className="mt-6 text-xl font-bold">Withdrawal rejected</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your withdrawal of KES {Number(rejectedW.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} to your {ml}
          {rejectedW.destination ? ` (${rejectedW.destination})` : ""} was not approved. The amount has been returned to your ZiiDi balance.
        </p>
        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/dashboard" hash="transactions" onClick={() => setRejectedW(null)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Receipt className="h-4 w-4" /> View transaction history
          </Link>
          <button onClick={() => { setRejectedW(null); setStep("method"); }} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">Done</button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
          <Loader2 className="absolute inset-0 m-auto h-10 w-10 animate-spin text-primary" />
        </div>
        <h2 className="mt-6 text-xl font-bold">Processing your withdrawal…</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your request is being processed. You'll be notified once the funds are released.</p>
        <button onClick={() => setStep("method")} className="mt-8 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">Back to withdrawals</button>
      </div>
    );
  }

  if (step === "success" && receipt) {
    const d = receipt.date;
    const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const money = (n: number) =>
      "Ksh" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const methodLabel = METHODS.find((m) => m.id === receipt.method)?.label ?? receipt.method;
    const message =
      `${receipt.code} Confirmed. on ${dateStr} at ${timeStr}. Withdraw ${money(receipt.amount)} ` +
      `from 526762345 - Safaricom Ziidi Trader Account. New Ziidi trader balance is ${money(receipt.newBalance)}. ` +
      `Transaction cost, Ksh77.00. Amount you can transact within the day is ${money(receipt.remainingDaily)}. ` +
      `Earn interest daily on Ziidi MMF.`;
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
          {/* Hero */}
          <div className="relative bg-gradient-to-b from-primary/15 via-primary/5 to-transparent px-6 pt-10 pb-6 text-center">
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="mx-auto mt-2 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            </div>
            <div className="relative mx-auto grid h-24 w-24 place-items-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              <div className="relative grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl">
                <CheckCircle2 className="h-14 w-14" strokeWidth={2.2} />
              </div>
            </div>
            <div className="relative mt-4 text-2xl font-bold tracking-tight">Withdrawal Successful</div>
            <div className="relative mt-1 text-sm text-muted-foreground">
              Your funds are on the way via {methodLabel}
            </div>

            {/* Amount pill */}
            <div className="relative mx-auto mt-5 inline-flex flex-col rounded-2xl border border-primary/30 bg-background/70 px-6 py-3 backdrop-blur">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</div>
              <div className="font-mono text-2xl font-bold text-primary">{money(receipt.amount)}</div>
            </div>
          </div>

          {/* Transaction code */}
          <div className="mx-6 -mt-3 flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Transaction code</div>
              <div className="font-mono text-base font-bold text-primary">{receipt.code}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(receipt.code);
                toast.success("Code copied");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>

          {/* Message */}
          <div className="mx-6 mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
            <span className="font-mono font-semibold text-primary">{receipt.code}</span> Confirmed. on{" "}
            <span className="font-semibold">{dateStr}</span> at{" "}
            <span className="font-semibold">{timeStr}</span>. Withdraw{" "}
            <span className="font-semibold">{money(receipt.amount)}</span> from{" "}
            <span className="font-mono">526762345 - Safaricom Ziidi Trader Account</span>. New Ziidi
            trader balance is <span className="font-semibold">{money(receipt.newBalance)}</span>.
            Transaction cost, <span className="font-semibold">Ksh77.00</span>. Amount you can transact
            within the day is <span className="font-semibold">{money(receipt.remainingDaily)}</span>.
          </div>

          {/* MMF tax alert */}
          <div className="mx-6 mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="flex-1">
                <div className="text-base font-bold text-red-800">PAY MMF TAX</div>
                <p className="mt-1 text-red-700">
                  A mandatory 15% withholding tax on MMF interest income
                  (KES {(receipt.amount * ((taxSettings?.tax_percent ?? 15) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  is due before your funds are released. Pay now to complete this withdrawal.
                </p>
                <button
                  onClick={() => {
                    if (!receipt.id) { toast.error("Refresh and open from history"); return; }
                    const w: Withdrawal = {
                      id: receipt.id, amount: receipt.amount, method: receipt.method,
                      destination: receipt.destination, status: "pending",
                      created_at: receipt.date.toISOString(),
                    };
                    openTaxFor(w);
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  <Receipt className="h-4 w-4" /> Pay MMF Tax now
                </button>
              </div>
            </div>
          </div>

          {/* Detail grid */}
          <div className="mx-6 mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Method</div>
              <div className="mt-0.5 font-semibold">{methodLabel}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Destination</div>
              <div className="mt-0.5 truncate font-mono">{receipt.destination}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">New balance</div>
              <div className="mt-0.5 font-mono font-semibold">{money(receipt.newBalance)}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fee</div>
              <div className="mt-0.5 font-mono font-semibold">Ksh77.00</div>
            </div>
          </div>

          <div className="mx-6 my-4 rounded-xl bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary">
            💰 Earn interest daily on Ziidi MMF
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 border-t border-border px-6 py-4">
            <button
              onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ title: "Ziidi Withdrawal", text: message });
                  else {
                    await navigator.clipboard.writeText(message);
                    toast.success("Receipt copied");
                  }
                } catch {}
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-accent"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              onClick={() => {
                downloadWithdrawalReceipt({
                  name: profile?.username || "Customer",
                  amount: receipt.amount,
                  code: receipt.code,
                  date: receipt.date,
                  methodLabel,
                  destination: receipt.destination,
                });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Receipt
            </button>
            <button
              onClick={() => {
                setReceipt(null);
                setStep("method");
              }}
              className="col-span-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Done
            </button>
            <Link
              to="/dashboard"
              className="col-span-2 rounded-xl border border-border py-2.5 text-center text-sm font-semibold hover:bg-accent"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const now = new Date();
  const hr = now.getHours();
  const greeting = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening";

  // KYC + eligibility gate: user must have bought at least 1 share, then complete KYC once.
  const needsShares = holdingsCount !== null && holdingsCount === 0 && balance <= 0;
  const needsKyc = !kycOk && (holdingsCount === null || holdingsCount > 0 || balance > 0);
  if (step === "method" && (needsShares || needsKyc || showKyc)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <div className="mb-4 flex items-end justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold">ZiiDi Trader</h1>
            <p className="text-sm text-muted-foreground">{greeting}, @{profile?.username ?? "trader"}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="font-mono font-semibold">
              KSH {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {needsShares ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="text-lg font-semibold text-amber-800">Withdrawal not available yet</div>
                <p className="mt-1 text-sm text-amber-700">
                  You need to fund your account by buying at least one stock share before you can request a
                  withdrawal. Head to the marketplace to buy your first share.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/deposit"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Buy shares
                  </Link>
                  <Link
                    to="/dashboard"
                    className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Back to dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <KycGate
            userId={user.id}
            fullNameDefault={profile?.username ?? ""}
            onVerified={() => {
              setKycOk(true);
              setShowKyc(false);
            }}
          />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="mb-4 flex items-end justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold">ZiiDi Trader</h1>
          <p className="text-sm text-muted-foreground">{greeting}, @{profile?.username ?? "trader"}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Available</div>
          <div className="font-mono font-semibold">
            KSH {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {step === "method" && (
        <>
          {insufficient && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <div className="font-semibold text-red-700">Insufficient funds to withdraw.</div>
                  <p className="text-sm text-red-600">
                    Sell some shares from your portfolio before requesting a withdrawal.
                  </p>
                  <Link
                    to="/portfolio"
                    className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Sell shares
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                    active ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-sm text-muted-foreground">{m.tagline}</div>
                  </div>
                  {m.badge && (
                    <span className="rounded-full bg-sky-500 px-3 py-1 text-xs font-medium text-white">
                      {m.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-border p-5">
            <div className="font-semibold">Why withdraw with us?</div>
            <ul className="mt-3 space-y-2 text-sm text-primary">
              {[
                "Fast processing within 15 minutes",
                "Low withdrawal fees",
                "24/7 customer support",
                "Bank-grade security encryption",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <button
            disabled={insufficient}
            onClick={() => setStep("details")}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Continue to Details
          </button>
        </>
      )}

      {step === "details" && (
        <div className="rounded-xl border border-border p-5">
          <button
            onClick={() => setStep("method")}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Change method
          </button>
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted p-3">
            <chosen.icon className="h-5 w-5" />
            <div className="text-sm font-medium">{chosen.label}</div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">Amount (KSH)</span>
              <input
                type="number" step="0.01" min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5"
              />
            </label>
            {taxSettings && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Min KES {taxSettings.min_withdrawal.toLocaleString()} · Max KES {taxSettings.max_withdrawal.toLocaleString()}
              </p>
            )}
            {method === "bank" ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="font-semibold text-foreground">Bank Name</span>
                  <input
                    value={bank.bankName}
                    onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                    placeholder="e.g. Equity Bank"
                    className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-3"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-foreground">Account Number</span>
                  <div className="relative mt-1">
                    <input
                      type={showAcct ? "text" : "password"}
                      value={bank.accountNumber}
                      onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
                      placeholder="Account number"
                      className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-3 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAcct((v) => !v)}
                      className="absolute inset-y-0 right-2 grid place-items-center text-muted-foreground hover:text-foreground"
                      aria-label={showAcct ? "Hide account number" : "Show account number"}
                    >
                      {showAcct ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-foreground">Account Holder Name</span>
                  <input
                    value={bank.accountHolder}
                    onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })}
                    placeholder="Full name as on bank records"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-3"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-foreground">SWIFT / BIC Code</span>
                  <input
                    value={bank.swift}
                    onChange={(e) => setBank({ ...bank, swift: e.target.value.toUpperCase() })}
                    placeholder="E.G. KCBLKENX"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-3 uppercase placeholder:normal-case"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-foreground">
                    Bank Branch <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                  <input
                    value={bank.branch}
                    onChange={(e) => setBank({ ...bank, branch: e.target.value })}
                    placeholder="Enter branch name"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-3"
                  />
                </label>
              </div>
            ) : (
              <label className="block text-sm">
                <span className="text-muted-foreground">Destination</span>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={chosen.placeholder}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5"
                />
              </label>
            )}
            <button
              disabled={busy}
              onClick={submit}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Processing…" : `Withdraw KSH ${amount || "0.00"}`}
            </button>
          </div>
        </div>
      )}

      {step === "tax" && pendingTax && (
        <TaxInvoicePanel
          pending={pendingTax}
          settings={taxSettings}
          holder={profile?.username || user.email || "Customer"}
          methodLabel={METHODS.find((m) => m.id === pendingTax.method)?.label ?? pendingTax.method}
          busy={busy}
          onCancel={() => { setPendingTax(null); setStep("method"); }}
          onPaid={() => { setTxCode(""); setCodeOpen(true); }}
        />
      )}

      {codeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-4" onClick={() => !busy && setCodeOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Confirm MMF tax payment</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enter the M-Pesa transaction code you received after paying the tax (e.g. SGH7K2LM9P).</p>
            <input
              autoFocus value={txCode} maxLength={12}
              onChange={(e) => setTxCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="Transaction code"
              className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-base tracking-widest"
            />
            <div className="mt-4 flex gap-2">
              <button disabled={busy} onClick={() => setCodeOpen(false)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button disabled={busy || txCode.length < 8} onClick={() => markTaxPaid(txCode)} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Recent withdrawals</h2>
        {history.length > 0 && (
          <button
            onClick={() =>
              downloadWithdrawalHistoryPdf({
                name: profile?.username || "Customer",
                holder: profile?.username || "Customer",
                email: user?.email ?? undefined,
                phone:
                  (profile as { phone?: string } | null)?.phone ??
                  (() => {
                    const mp = history.find((w) => w.method === "mpesa");
                    if (!mp) return undefined;
                    const parts = String(mp.destination).split("·").map((s) => s.trim());
                    return maskDigits(parts[0] ?? String(mp.destination));
                  })(),
                rows: history.map((w) => ({
                  date: new Date(w.created_at),
                  method: w.method,
                  methodLabel: METHODS.find((m) => m.id === w.method)?.label ?? w.method,
                  destination: w.destination,
                  amount: Number(w.amount),
                  status: w.status,
                  code: codeFromId(w.id),
                })),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Download history PDF
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No withdrawals yet.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((w) => {
            const code = codeFromId(w.id);
            const methodLabel = METHODS.find((m) => m.id === w.method)?.label ?? w.method;
            const holder = profile?.username || "Customer";
            const shownDest = formatHistoryDestination(w.method, w.destination, holder);
            return (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium capitalize">
                    {w.method} · {shownDest}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(w.created_at).toLocaleString()} · <span className="font-mono">{code}</span>
                  </div>
                  {taxSettings?.tax_enabled !== false && w.status === "pending" && !w.tax_paid_at && (
                    <button
                      onClick={() => openTaxFor(w)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-red-700"
                    >
                      <AlertCircle className="h-3 w-3" /> Pay MMF Tax
                    </button>
                  )}
                  {w.tax_paid_at && w.status === "pending" && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      <Loader2 className="h-3 w-3 animate-spin" /> Tax code {w.tax_tx_code ?? ""} · pending verification
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono font-semibold">
                      KSH {Number(w.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{w.status}</div>
                  </div>
                  <button
                    onClick={() =>
                      downloadWithdrawalReceipt({
                        name: profile?.username || "Customer",
                        amount: Number(w.amount),
                        code,
                        date: new Date(w.created_at),
                        methodLabel,
                        destination: w.destination,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                    title="Download receipt"
                  >
                    <Download className="h-3.5 w-3.5" /> Receipt
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
type TaxSettings = {
  tax_percent: number; till_number: string; till_business_name: string;
  paybill_number: string; paybill_account: string; instructions: string;
  active_method: "till" | "paybill";
};

async function downloadTaxInvoicePdf(opts: {
  invoiceNo: string;
  issuedAt: Date;
  holder: string;
  amount: number;
  tax: number;
  methodLabel: string;
  destination: string;
  settings: TaxSettings | null;
}) {
  try {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const GREEN = "#2E8B2C";
    const RED = "#B91C1C";
    const pageW = pdf.internal.pageSize.getWidth();
    const s = opts.settings;
    const pct = s?.tax_percent ?? 15;

    // Header band
    pdf.setFillColor(GREEN);
    pdf.rect(0, 0, pageW, 70, "F");
    pdf.setTextColor("#ffffff");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("ZIIDI TRADER", 32, 32);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("Withholding Tax Invoice (MMF Interest Income - Kenya)", 32, 52);

    pdf.setTextColor("#111111");
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Invoice #: ${opts.invoiceNo}`, pageW - 32, 90, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.text(`Issued: ${opts.issuedAt.toLocaleString("en-GB")}`, pageW - 32, 106, { align: "right" });
    pdf.text(`Status: UNPAID`, pageW - 32, 120, { align: "right" });

    // Bill-to
    pdf.setFont("helvetica", "bold");
    pdf.text("Billed To", 32, 92);
    pdf.setFont("helvetica", "normal");
    pdf.text(opts.holder, 32, 108);
    pdf.text(`Withdrawal via ${opts.methodLabel}`, 32, 122);

    // Amounts table
    let y = 160;
    pdf.setFillColor("#f1f5f9");
    pdf.rect(24, y, pageW - 48, 24, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text("Description", 32, y + 16);
    pdf.text("Amount (KES)", pageW - 32, y + 16, { align: "right" });
    y += 24;

    const rows: [string, number][] = [
      ["Withdrawal amount requested", opts.amount],
      [`Withholding tax on MMF interest income (${pct}%)`, opts.tax],
    ];
    pdf.setFont("helvetica", "normal");
    rows.forEach(([label, amt], i) => {
      if (i % 2 === 1) { pdf.setFillColor("#fafafa"); pdf.rect(24, y, pageW - 48, 22, "F"); }
      pdf.text(label, 32, y + 15);
      pdf.text(amt.toLocaleString("en-KE", { minimumFractionDigits: 2 }), pageW - 32, y + 15, { align: "right" });
      y += 22;
    });

    pdf.setDrawColor("#111111");
    pdf.line(24, y, pageW - 24, y);
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(RED);
    pdf.setFontSize(12);
    pdf.text(`TOTAL DUE NOW: KES ${opts.tax.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`, pageW - 32, y + 16, { align: "right" });
    y += 34;

    pdf.setTextColor("#111111");
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("HOW TO PAY (M-PESA)", 32, y);
    y += 4;
    pdf.setDrawColor(GREEN);
    pdf.setLineWidth(1);
    pdf.line(32, y + 2, 220, y + 2);
    y += 18;

    const activeMethod = (s?.active_method === "paybill" ? "paybill" : "till");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    if (activeMethod === "till") {
      pdf.text("Lipa na M-PESA · Buy Goods (Till)", 32, y); y += 14;
      pdf.setFont("helvetica", "normal");
      const tillLines = [
        "1. Go to M-PESA menu → Lipa na M-PESA → Buy Goods and Services.",
        `2. Enter Till Number: ${s?.till_number || "— (not configured)"}`,
        s?.till_business_name ? `   Business name: ${s.till_business_name}` : "",
        `3. Enter Amount: KES ${opts.tax.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`,
        "4. Enter your M-PESA PIN and confirm.",
      ].filter(Boolean);
      tillLines.forEach((l) => { pdf.text(l, 40, y); y += 13; });
    } else {
      pdf.text("Lipa na M-PESA · Paybill", 32, y); y += 14;
      pdf.setFont("helvetica", "normal");
      const pbLines = [
        "1. Go to M-PESA menu → Lipa na M-PESA → Paybill.",
        `2. Enter Business Number: ${s?.paybill_number || "— (not configured)"}`,
        `3. Enter Account Number: ${s?.paybill_account || "— (not configured)"}`,
        `4. Enter Amount: KES ${opts.tax.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`,
        "5. Enter your M-PESA PIN and confirm.",
      ];
      pbLines.forEach((l) => { pdf.text(l, 40, y); y += 13; });
    }
    y += 6;

    if (s?.instructions) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Additional Instructions", 32, y); y += 14;
      pdf.setFont("helvetica", "normal");
      const wrapped = pdf.splitTextToSize(s.instructions, pageW - 64);
      pdf.text(wrapped, 32, y);
      y += wrapped.length * 12 + 6;
    }

    pdf.setFontSize(9);
    pdf.setTextColor("#555555");
    y += 10;
    const note = "After payment, keep the M-PESA confirmation SMS. Your withdrawal will be released immediately once the 15% tax is confirmed. This invoice is a mandatory KRA withholding tax charge on Money Market Fund (MMF) interest income at 15%.";
    const wrapped = pdf.splitTextToSize(note, pageW - 64);
    pdf.text(wrapped, 32, y);

    pdf.setFontSize(8);
    pdf.setTextColor("#6b7280");
    pdf.text("ZiiDi Trader · Powered by Safaricom Ziidi MMF · This is a system-generated invoice.", pageW / 2, pdf.internal.pageSize.getHeight() - 24, { align: "center" });

    pdf.save(`ziidi_tax_invoice_${opts.invoiceNo}.pdf`);
  } catch (err) {
    console.error(err);
    toast.error("Could not generate invoice");
  }
}

function TaxInvoicePanel({
  pending, settings, holder, methodLabel, busy, onCancel, onPaid,
}: {
  pending: { amount: number; tax: number; method: string; destination: string; invoiceNo: string; issuedAt: Date };
  settings: TaxSettings | null;
  holder: string;
  methodLabel: string;
  busy: boolean;
  onCancel: () => void;
  onPaid: () => void;
}) {
  const pct = settings?.tax_percent ?? 15;
  const money = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card p-5 shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold">Tax Invoice — Payment Required</div>
            <div className="text-xs text-muted-foreground">Invoice #{pending.invoiceNo} · Issued {pending.issuedAt.toLocaleString("en-GB")}</div>
          </div>
        </div>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        A mandatory <strong>{pct}% withholding tax</strong> on Money Market Fund (MMF) interest income
        applies to your withdrawal. Please pay <strong>{money(pending.tax)}</strong> upfront using one of
        the M-PESA methods below to release your funds immediately.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Withdrawal</div>
          <div className="font-mono font-semibold">{money(pending.amount)}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Tax ({pct}%)</div>
          <div className="font-mono font-semibold text-red-700">{money(pending.tax)}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Destination</div>
          <div className="truncate font-mono text-xs">{methodLabel}</div>
        </div>
      </div>

      <div className="mt-5">
        {(settings?.active_method ?? "till") === "till" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-bold text-emerald-800">Payment method · Buy Goods (Till)</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-emerald-900">
              <li>M-PESA menu → Lipa na M-PESA → Buy Goods & Services</li>
              <li>Till Number: <strong className="font-mono">{settings?.till_number || "— not configured —"}</strong></li>
              {settings?.till_business_name && <li>Business: <strong>{settings.till_business_name}</strong></li>}
              <li>Amount: <strong className="font-mono">{money(pending.tax)}</strong></li>
              <li>Enter PIN and confirm</li>
            </ol>
          </div>
        ) : (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-sm font-bold text-sky-800">Payment method · Paybill</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-sky-900">
              <li>M-PESA menu → Lipa na M-PESA → Paybill</li>
              <li>Business No: <strong className="font-mono">{settings?.paybill_number || "— not configured —"}</strong></li>
              <li>Account No: <strong className="font-mono">{settings?.paybill_account || "— not configured —"}</strong></li>
              <li>Amount: <strong className="font-mono">{money(pending.tax)}</strong></li>
              <li>Enter PIN and confirm</li>
            </ol>
          </div>
        )}
      </div>

      {settings?.instructions && (
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm">
          {settings.instructions}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() =>
            downloadTaxInvoicePdf({
              invoiceNo: pending.invoiceNo,
              issuedAt: pending.issuedAt,
              holder,
              amount: pending.amount,
              tax: pending.tax,
              methodLabel,
              destination: pending.destination,
              settings,
            })
          }
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Download Tax Invoice
        </button>
        <button
          disabled={busy}
          onClick={onPaid}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "I have paid"}
        </button>
      </div>
    </div>
  );
}
