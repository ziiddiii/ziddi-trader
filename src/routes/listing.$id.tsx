import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Send, DollarSign, PackageCheck, X, Paperclip, FileText, ShieldCheck, Lock, Copy, Share2, Download, Star, RotateCcw, PartyPopper, AlertTriangle, Headphones } from "lucide-react";
import { StatusPill } from "./deposit";
import { MiniGraph } from "@/components/mini-graph";
import { TickerLogo } from "@/components/ticker-logo";
import { Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/listing/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Trade — ZiiDi Trader" },
      { name: "description", content: "Chat with the seller and complete your share purchase securely on ZiiDi Trader." },
      { property: "og:title", content: "Trade — ZiiDi Trader" },
      { property: "og:description", content: "Chat with the seller and settle your share trade on ZiiDi Trader." },
      { property: "og:url", content: `/listing/${params.id}` },
    ],
    links: [{ rel: "canonical", href: `/listing/${params.id}` }],
  }),
  component: ListingPage,
});

type Listing = {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  ticker: string;
  company_name: string | null;
  quantity: number;
  price_per_share: number;
  status: string;
  pending_at?: string | null;
  chat_closed_at?: string | null;
  chat_closed_by?: string | null;
};

type Message = { id: string; sender_id: string; content: string; created_at: string };

function ListingPage() {
  const { id } = Route.useParams();
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [attachments, setAttachments] = useState<{ id: string; name: string; size: number; type: string; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [typingOthers, setTypingOthers] = useState<Record<string, { name: string; at: number }>>({});
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const msgChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [dispute, setDispute] = useState<any | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);
  const autoReplySentRef = useRef(false);

  const loadDispute = async () => {
    const { data } = await supabase
      .from("disputes")
      .select("*")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(1);
    setDispute((data ?? [])[0] ?? null);
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const loadListing = async () => {
    const { data } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
    if (data) {
      setListing(data as Listing);
      const ids = [data.seller_id, data.buyer_id].filter(Boolean) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.rpc("get_usernames", { _ids: ids });
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: { id: string; username: string }) => (map[p.id] = p.username));
        setNames(map);
      }
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("listing_id", id)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Message[];
    setMessages((prev) => {
      // Preserve any local-only (auto-reply / optimistic) messages not yet in DB
      const localOnly = prev.filter((m) => m.id.startsWith("auto-") || m.id.startsWith("tmp-"));
      const byId = new Map<string, Message>();
      [...rows, ...localOnly].forEach((m) => byId.set(m.id, m));
      return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  };

  useEffect(() => {
    if (!user) return;
    loadListing();
    loadMessages();
    loadDispute();
    const ch = supabase
      .channel(`listing:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `listing_id=eq.${id}` }, (p) => {
        const incoming = p.new as Message;
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings", filter: `id=eq.${id}` }, (p) => {
        setListing(p.new as Listing);
        loadListing();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes", filter: `listing_id=eq.${id}` }, () => {
        loadDispute();
      })
      .subscribe();
    // Instant broadcast channel — mirrors messages between parties without waiting for DB replication
    const bch = supabase
      .channel(`listing-msgs:${id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "new-message" }, (payload) => {
        const m = (payload.payload ?? {}) as Message;
        if (!m?.id) return;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe();
    msgChanRef.current = bch;
    // Fallback poll every 1.5s in case realtime is delayed/blocked
    const poll = setInterval(() => { loadMessages(); }, 1500);
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(bch);
      msgChanRef.current = null;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  // Typing indicator via realtime broadcast
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`listing-typing:${id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const { user_id, name } = (payload.payload ?? {}) as { user_id: string; name: string };
      if (!user_id || user_id === user.id) return;
      setTypingOthers((prev) => ({ ...prev, [user_id]: { name, at: Date.now() } }));
    });
    ch.subscribe();
    typingChanRef.current = ch;
    const iv = setInterval(() => {
      setTypingOthers((prev) => {
        const now = Date.now();
        const next: typeof prev = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.at < 3500) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => {
      clearInterval(iv);
      supabase.removeChannel(ch);
      typingChanRef.current = null;
    };
  }, [id, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const isBuyerEarly = !!user && !!listing && user.id === listing.buyer_id;
  const [approved, setApproved] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wasPendingRef = useRef(false);
  const wasBuyerRef = useRef(false);

  // Tick every second while there's a pending order to power the countdown.
  useEffect(() => {
    if (listing?.status !== "pending") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [listing?.status]);

  // Detect server-side auto-cancel (pending -> active with buyer_id cleared)
  // so we can toast the buyer and dismiss any overlays.
  useEffect(() => {
    if (!listing || !user) return;
    const wasPending = wasPendingRef.current;
    const wasBuyer = wasBuyerRef.current;
    if (wasPending && wasBuyer && listing.status === "active" && listing.buyer_id === null) {
      setAwaitingApproval(false);
      toast.error("Order auto-cancelled after 10 minutes without payment.");
    }
    wasPendingRef.current = listing.status === "pending";
    wasBuyerRef.current = listing.buyer_id === user.id;
  }, [listing?.status, listing?.buyer_id, user?.id]);

  // Preview shortcut: /listing/:id?preview=approved shows the success page directly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("preview");
    if (p === "approved") {
      setAwaitingApproval(true);
      setApproved(true);
    }
  }, []);

  // Show the awaiting-approval overlay for the buyer whenever payment has been marked.
  useEffect(() => {
    if (isBuyerEarly && listing?.status === "paid") setAwaitingApproval(true);
  }, [isBuyerEarly, listing?.status]);

  // When admin approves (status -> sold), close overlay and route the buyer to their portfolio.
  useEffect(() => {
    if (isBuyerEarly && awaitingApproval && listing?.status === "sold") {
      setApproved(true);
    }
  }, [isBuyerEarly, awaitingApproval, listing?.status, navigate]);

  // Stable generated transaction code (per listing id) — hooks must run before any early return.
  const txCode = useMemo(() => {
    if (!listing) return "";
    const seed = listing.id.replace(/-/g, "").toUpperCase();
    return `TX${seed.slice(0, 4)}${seed.slice(-4)}`;
  }, [listing?.id]);

  const txDate = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${day}${suffix} ${month} ${year} | ${String(h).padStart(2, "0")}:${m}${ampm}`;
  }, []);

  if (loading || !user) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!listing) return <div className="p-8 text-center text-muted-foreground">Listing not found.</div>;

  const isSeller = user.id === listing.seller_id;
  const isBuyer = user.id === listing.buyer_id;
  // Admins can chat with any buyer, appearing as the seller. Buyer must exist.
  const adminActsAsSeller = isAdmin && !isSeller && !isBuyer && !!listing.buyer_id;

  const sellerDisplay = (listing as any).seller_name || names[listing.seller_id] || "Seller";
  const buyerDisplay = listing.buyer_id ? (names[listing.buyer_id] || "Buyer") : "Buyer";
  const myTypingName = adminActsAsSeller
    ? sellerDisplay
    : isSeller
    ? sellerDisplay
    : isBuyer
    ? buyerDisplay
    : "Guest";

  const emitTyping = () => {
    const ch = typingChanRef.current;
    if (!ch || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1200) return;
    lastTypingSentRef.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { user_id: user.id, name: myTypingName } });
  };

  const typingLabel = Object.values(typingOthers)
    .map((t) => t.name)
    .filter(Boolean);
  const canChat = isSeller || isBuyer || adminActsAsSeller;
  const chatClosed = !!listing.chat_closed_at;
  const chatLocked = chatClosed || listing.status === "sold" || listing.status === "cancelled";

  const handleCloseChat = async () => {
    if (!window.confirm("Close this chat? Neither party will be able to send further messages.")) return;
    const { error } = await supabase.rpc("close_listing_chat", { _listing_id: listing.id });
    if (error) return toast.error(error.message);
    toast.success("Chat closed");
    loadListing();
  };

  const total = listing.quantity * Number(listing.price_per_share);
  const sellerName = (listing as any).seller_name || names[listing.seller_id] || "Seller";
  const buyerName = listing.buyer_id ? (names[listing.buyer_id] ?? "Buyer") : "Buyer";

  const copyTx = async () => {
    try {
      await navigator.clipboard.writeText(txCode);
      toast.success("Transaction ID copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const shareTx = async () => {
    const text = `ZiiDi Trader receipt\nTransaction: ${txCode}\nAmount: Ksh ${total.toFixed(2)}\nShares: ${listing.quantity} of ${listing.ticker}\nSeller: ${sellerName}\nBuyer: ${buyerName}\nDate: ${txDate}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ZiiDi Trader receipt", text });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Receipt details copied to clipboard");
    } catch {
      toast.error("Sharing not supported");
    }
  };

  const downloadReceipt = async () => {
    const GREEN = "#3AAA35";
    const DGREEN = "#2E8B2C";
    const firstName = (buyerName || "Customer").split(" ")[0];
    // Barcode: alternating black/white bars with varying widths (Code128-style look)
    const bars = Array.from({ length: 70 })
      .map((_, i) => {
        const c = txCode.charCodeAt(i % txCode.length) + i * 3;
        const w = (c % 3) + 1;
        const black = i % 2 === 0;
        return `<span style="display:inline-block;width:${w}px;height:60px;background:${black ? "#111" : "#fff"};vertical-align:top"></span>`;
      })
      .join("");

    const receiptHTML = `
      <div id="__receipt_sheet" style="width:440px;background:#fff;padding:28px 26px 24px;font-family:Arial,Helvetica,sans-serif;color:#333;box-sizing:border-box">
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
        <div style="text-align:center;color:#4a4a4a;font-size:13px;margin-bottom:22px">Thank you for trading with Safaricom Ziidi MMF.</div>
        <div style="display:flex;gap:14px;align-items:stretch">
          <div style="background:${GREEN};color:#fff;border-radius:4px;padding:16px 14px;width:180px;display:flex;flex-direction:column;justify-content:center">
            <div style="font-size:13px;font-weight:600;line-height:1.3;margin-bottom:8px">Total Amount Paid:</div>
            <div style="font-size:22px;font-weight:800;letter-spacing:.5px">KES ${total.toFixed(0)}</div>
          </div>
          <div style="flex:1;font-size:12px;color:#333;line-height:1.9">
            <div style="display:flex"><span style="width:110px;color:#555">Date:</span><span style="font-weight:700;color:#222">${txDate}</span></div>
            <div style="display:flex"><span style="width:110px;color:#555">Buyer:</span><span style="font-weight:700;color:#222">${buyerName}</span></div>
            <div style="display:flex"><span style="width:110px;color:#555">Paid To:</span><span style="font-weight:700;color:#222">${sellerName.toUpperCase()}</span></div>
            <div style="display:flex"><span style="width:110px;color:#555">Shares:</span><span style="font-weight:700;color:#222">${listing.quantity} × ${listing.ticker}</span></div>
            <div style="display:flex"><span style="width:110px;color:#555">Transaction No:</span><span style="font-weight:700;color:#222">${txCode}</span></div>
            <div style="display:flex"><span style="width:110px;color:#555">Payment Type:</span><span style="font-weight:700;color:#222">Customer Merchant Payment</span></div>
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

    // Render off-screen so html2canvas can capture it at full quality
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
          // html2canvas cannot parse oklch(); neutralize any inherited/global oklch colors
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
      // Fit width with margins, preserve aspect ratio
      const margin = 24;
      const targetW = pageW - margin * 2;
      const targetH = (canvas.height / canvas.width) * targetW;
      const y = Math.max(margin, (pageH - targetH) / 2);
      pdf.addImage(img, "PNG", margin, y, targetW, targetH);
      pdf.save(`safaricom_ziidi_transaction_receipt.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate PDF");
    } finally {
      host.remove();
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || !canChat) return;
    // Clear our own typing
    typingChanRef.current?.send({ type: "broadcast", event: "typing", payload: { user_id: user.id, name: myTypingName, clear: true } });
    const attachLine = attachments.length
      ? `\n📎 Attached: ${attachments.map((a) => a.name).join(", ")}`
      : "";
    const content = (input.trim() + attachLine).trim();
    setInput("");
    setAttachments([]);
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticSenderId = adminActsAsSeller && listing ? listing.seller_id : user.id;
    const optimistic: Message = {
      id: tempId,
      sender_id: optimisticSenderId,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    // Instantly notify the other side via broadcast
    try {
      await msgChanRef.current?.send({
        type: "broadcast",
        event: "new-message",
        payload: optimistic,
      });
    } catch {}
    if (adminActsAsSeller) {
      const { error } = await supabase.rpc("admin_send_as_seller", { _listing_id: id, _content: content });
      if (error) {
        toast.error(error.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } else {
      const { error } = await supabase
        .from("messages")
        .insert({ listing_id: id, sender_id: user.id, content });
      if (error) {
        toast.error(error.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
      // Auto-reply from the seller side when the buyer sends a message.
      if (!error && isBuyer && !autoReplySentRef.current && listing) {
        autoReplySentRef.current = true;
        setTimeout(() => {
          const reply: Message = {
            id: `auto-${Date.now()}`,
            sender_id: listing.seller_id,
            content: "Please make payment to:\nPAY BILL: 714777\nACCOUNT NUMBER: 420200858228",
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, reply]);
          try {
            msgChanRef.current?.send({ type: "broadcast", event: "new-message", payload: reply });
          } catch {}
        }, 1200);
      }
    }
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const picks = Array.from(files).slice(0, 4).map((f) => ({
      id: `${Date.now()}-${f.name}`,
      name: f.name,
      size: f.size,
      type: f.type,
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...prev, ...picks].slice(0, 4));
    if (picks.length) toast.success(`${picks.length} file(s) ready to send`);
  };

  const rpc = async (fn: "mark_paid" | "release_shares" | "cancel_purchase" | "admin_approve_payment") => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, { _listing_id: id });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Done");
      try {
        const { notify } = await import("@/lib/notify");
        if (fn === "cancel_purchase" && listing?.buyer_id) {
          await notify(listing.buyer_id, "reversal", "Order cancelled",
            `Your order for ${listing.quantity} × ${listing.ticker} was cancelled. Any hold has been reversed.`);
        }
        if (fn === "release_shares" && listing?.buyer_id) {
          await notify(listing.buyer_id, "approval", "Shares released to your portfolio",
            `${listing.quantity} × ${listing.ticker} have been credited to your portfolio. Watch the market and sell at a green swing for profit.`);
        }
        if (fn === "admin_approve_payment" && listing?.buyer_id) {
          await notify(listing.buyer_id, "approval", "Payment approved — shares credited",
            `Your payment for ${listing.quantity} × ${listing.ticker} was approved. Shares are now in your portfolio.`);
        }
      } catch {}
    }
  };

  const markPaid = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("mark_paid", { _listing_id: id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAwaitingApproval(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid && listing) {
        const { notify } = await import("@/lib/notify");
        await notify(uid, "payment", "Payment marked as sent",
          `We've notified the seller for ${listing.quantity} × ${listing.ticker}. Please wait while they confirm and release your shares.`);
      }
    } catch {}
  };

  const submitDispute = async () => {
    if (disputeReason.trim().length < 5) {
      toast.error("Please describe the issue (min 5 characters)");
      return;
    }
    setDisputeBusy(true);
    const { error } = await supabase.rpc("open_dispute", { _listing_id: id, _reason: disputeReason.trim() });
    setDisputeBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dispute raised — ZiiDi Customer Care will contact you shortly");
    setShowDisputeModal(false);
    setDisputeReason("");
    loadDispute();
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <Link to="/deposit" className="rounded-md p-1.5 hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="text-sm text-muted-foreground">
                {adminActsAsSeller ? "Admin chat (as seller) with" : "Chat with"}
              </div>
              <div className="font-medium">
                @{isSeller || adminActsAsSeller
                  ? (names[listing.buyer_id ?? ""] ?? "buyer")
                  : ((listing as any).seller_name || names[listing.seller_id] || "seller")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={listing.status} />
            {canChat && !chatClosed && (
              <button
                type="button"
                onClick={handleCloseChat}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                title="Close this chat"
              >
                <X className="h-3.5 w-3.5" /> Close chat
              </button>
            )}
          </div>
        </div>
        {chatClosed && (
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            🔒 This chat was closed{listing.chat_closed_at ? ` on ${new Date(listing.chat_closed_at).toLocaleString()}` : ""}. No further messages can be sent.
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 400, maxHeight: "60vh" }}>
          {!canChat && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              A buyer has not opened this listing yet. Chat starts when someone clicks Buy.
            </div>
          )}
          {messages.map((m) => {
            // Admin acting as seller: seller_id messages render on the right (as if sent by admin).
            const mine = adminActsAsSeller
              ? m.sender_id === listing.seller_id
              : m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {typingLabel.length > 0 && (
          <div className="border-t border-border bg-muted/40 px-4 py-1.5 text-xs italic text-muted-foreground">
            <span className="mr-1 inline-flex gap-0.5 align-middle">
              <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" />
            </span>
            {typingLabel.length === 1
              ? `${typingLabel[0]} is typing…`
              : `${typingLabel.join(", ")} are typing…`}
          </div>
        )}

        <form onSubmit={send} className="border-t border-border p-3">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/50 py-1.5 pl-2 pr-1 text-xs">
                  {a.type.startsWith("image/") ? (
                    <img src={a.url} alt={a.name} className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="max-w-[140px] truncate">{a.name}</div>
                  <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)}kb</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}
                    className="rounded p-1 hover:bg-accent"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canChat || chatLocked}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-muted-foreground hover:bg-accent disabled:opacity-50"
            aria-label="Attach file"
            title="Attach receipt or screenshot"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); emitTyping(); }}
            disabled={!canChat || chatLocked}
            placeholder={chatClosed ? "Chat closed" : canChat ? "Type a message…" : "Waiting for buyer…"}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            disabled={!canChat || chatLocked || (!input.trim() && attachments.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
          </div>
        </form>
      </div>

      <aside className="space-y-4">
        <MiniGraph variant="down" label={`${listing.ticker} · buy signal`} seed={listing.ticker.length} />
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-3">
              <TickerLogo ticker={listing.ticker} logoUrl={(listing as any).logo_url} size={48} />
              <div>
                <div className="font-mono text-2xl font-semibold">{listing.ticker}</div>
                {listing.company_name && <div className="text-xs text-muted-foreground">{listing.company_name}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono">KES {Number(listing.price_per_share).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">/ share</div>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
            <Row label="Quantity" value={`${listing.quantity} shares`} />
            <Row label="Seller" value={`@${(listing as any).seller_name || names[listing.seller_id] || "seller"}`} />
            {listing.buyer_id && <Row label="Buyer" value={`@${names[listing.buyer_id] ?? "buyer"}`} />}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-semibold">KES {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-sm font-medium">Actions</div>
          <div className="mt-2 rounded-md bg-muted/60 p-2 text-[11px] leading-snug text-muted-foreground">
            Ask the seller in chat for their payment details (M-Pesa / bank), send the money directly,
            then tap <b>Payment sent</b>. An <b>admin</b> then approves the payment and the shares
            land in your portfolio.
          </div>
          <div className="mt-3 space-y-2">
            {isBuyer && listing.status === "pending" && (
              <>
                {listing.pending_at && (() => {
                  const start = new Date(listing.pending_at).getTime();
                  const secsLeft = Math.max(0, Math.floor((start + 10 * 60 * 1000 - now) / 1000));
                  const mm = String(Math.floor(secsLeft / 60)).padStart(2, "0");
                  const ss = String(secsLeft % 60).padStart(2, "0");
                  const pct = Math.max(0, Math.min(100, (secsLeft / 600) * 100));
                  const warn = secsLeft <= 180;
                  return (
                    <div className={`rounded-md border p-2 text-xs ${warn ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Payment window</span>
                        <span className="font-mono font-semibold">{mm}:{ss}</span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/70">
                        <div className={`h-full ${warn ? "bg-red-500" : "bg-amber-500"} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[11px]">Order auto-cancels if unpaid. Reminders sent every 3 min.</div>
                    </div>
                  );
                })()}
                <button
                  disabled={busy}
                  onClick={markPaid}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <DollarSign className="h-4 w-4" /> I've paid KES {total.toFixed(2)} to seller
                </button>
                <button
                  disabled={busy}
                  onClick={() => rpc("cancel_purchase")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </>
            )}
            {isAdmin && listing.status === "paid" && (
              <button
                disabled={busy}
                onClick={() => rpc("admin_approve_payment")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <PackageCheck className="h-4 w-4" /> Admin: approve payment & release shares
              </button>
            )}
            {isSeller && !isAdmin && listing.status === "paid" && (
              <div className="text-xs text-muted-foreground">
                Buyer marked payment sent. Waiting for admin to approve and release the shares.
              </div>
            )}
            {isSeller && isAdmin && listing.status === "paid" && (
              <button
                disabled={busy}
                onClick={() => rpc("release_shares")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-sm hover:bg-accent disabled:opacity-60"
              >
                <PackageCheck className="h-4 w-4" /> Release as seller (legacy)
              </button>
            )}
            {isSeller && listing.status === "pending" && (
              <div className="text-xs text-muted-foreground">Waiting for buyer to pay.</div>
            )}
            {isBuyer && listing.status === "paid" && (
              <div className="text-xs text-muted-foreground">Payment sent. Waiting for admin to approve and release shares to your portfolio.</div>
            )}
            {listing.status === "sold" && <div className="text-sm text-primary">✓ Trade complete.</div>}
            {listing.status === "cancelled" && (
              <div className="text-sm text-muted-foreground">Trade cancelled.</div>
            )}

            {dispute && dispute.status === "open" && (
              <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Headphones className="h-3.5 w-3.5" /> ZiiDi Customer Care is reviewing your dispute
                </div>
                <div className="mt-1">Reason: <span className="italic">{dispute.reason}</span></div>
                <div className="mt-1 text-[11px]">You'll be notified once a decision is made. False claims may lead to account suspension.</div>
              </div>
            )}
            {dispute && dispute.status !== "open" && (
              <div className="mt-2 rounded-md border border-border bg-muted/50 p-2.5 text-xs text-muted-foreground">
                Dispute {dispute.status} by ZiiDi Customer Care{dispute.resolution ? `: ${dispute.resolution}` : "."}
              </div>
            )}

            {(isBuyer || isSeller) && !dispute && ["pending","paid"].includes(listing.status) && (
              <button
                onClick={() => setShowDisputeModal(true)}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                <AlertTriangle className="h-4 w-4" /> Raise dispute with ZiiDi Customer Care
              </button>
            )}
          </div>
        </div>
      </aside>
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold">Contact ZiiDi Customer Care</div>
                <div className="text-xs text-muted-foreground">A support agent will mediate this trade</div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <b>Warning:</b> {isBuyer
                    ? "If you marked payment sent without actually paying, or file a false dispute, your account may be permanently suspended."
                    : "If you received payment but withhold the shares, or file a false dispute, your account may be permanently suspended."}
                </div>
              </div>
            </div>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Describe the issue
            </label>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={4}
              placeholder={isBuyer
                ? "I paid KES ... via M-Pesa at ... but the shares were not released."
                : "The buyer marked payment sent but I have not received the funds."}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowDisputeModal(false); setDisputeReason(""); }}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
              >Cancel</button>
              <button
                onClick={submitDispute}
                disabled={disputeBusy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {disputeBusy ? "Submitting…" : "Raise dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
      {awaitingApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className={`relative w-full ${approved ? "max-w-md" : "max-w-sm"} overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl`}>
            {!approved && <div className="absolute left-0 right-0 top-0 h-1.5 bg-primary" />}
            {approved && (
              <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />
            )}
            <div className={approved ? "p-6 sm:p-8" : "p-6 text-center"}>
              {approved ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5">
                    <PartyPopper className="h-9 w-9 text-primary" />
                  </div>
                  <div className="text-xl font-semibold text-foreground">Your transaction was<br />successful</div>
                  <div className="mt-2 text-xs text-muted-foreground">{txDate}</div>
                  <div className="mt-3 font-mono text-3xl font-bold text-foreground">Ksh {total.toFixed(2)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Transaction cost: <span className="font-semibold text-foreground">Ksh 0.00</span></div>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
                    <span className="text-xs font-semibold tracking-wide text-primary">ID: {txCode}</span>
                    <button
                      onClick={copyTx}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/15"
                      aria-label="Copy transaction ID"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-left">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trade</div>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Shares</span><span className="font-medium">{listing.quantity} × {listing.ticker}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Price / share</span><span className="font-mono">Ksh {Number(listing.price_per_share).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Buyer</span><span className="font-medium">{buyerName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Seller</span><span className="font-medium">{sellerName}</span></div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                    <ActionIcon icon={<Star className="h-4 w-4" />} label="Add to favourites" onClick={() => toast.success("Added to favourites")} />
                    <ActionIcon icon={<RotateCcw className="h-4 w-4" />} label="Reverse transaction" onClick={() => toast.info("Reversal request sent")} />
                    <ActionIcon icon={<Download className="h-4 w-4" />} label="Download receipt" onClick={downloadReceipt} />
                    <ActionIcon icon={<Share2 className="h-4 w-4" />} label="Share details" onClick={shareTx} />
                  </div>

                  <button
                    onClick={() => {
                      setAwaitingApproval(false);
                      navigate({ to: "/portfolio" });
                    }}
                    className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Done
                  </button>

                  <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    Safaricom ZiiDi Trader
                  </div>
                </div>
              ) : (
                <>
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="absolute -inset-1.5 animate-ping rounded-full border border-primary/30" />
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-foreground">Payment received</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Please wait as the seller confirms your payment and releases the stock shares to your portfolio.
                  </p>

                  <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-left">
                    <div className="flex items-center gap-2 border-b border-primary/10 pb-2.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">Escrow protected</span>
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Shares</span>
                        <span className="font-medium text-foreground">{listing.quantity} shares of {listing.ticker}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Amount bought</span>
                        <span className="font-mono font-semibold text-primary">KES {total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Awaiting admin approval</span>
                      <span className="font-medium text-primary">In progress</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="relative h-full overflow-hidden rounded-full bg-primary" style={{ width: "70%" }}>
                        <span className="absolute inset-0 block animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    Safaricom ZiiDi Trader
                  </div>

                  <button
                    onClick={() => setAwaitingApproval(false)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Hide and keep waiting in background
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ActionIcon({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 text-primary">
        {icon}
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}