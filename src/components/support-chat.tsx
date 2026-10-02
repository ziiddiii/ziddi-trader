import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Headphones, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Msg = {
  id: string;
  user_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
  read_by_user?: boolean;
};

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function SupportChat() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [adminTyping, setAdminTyping] = useState(false);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const adminTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  const openRef = useRef(open);
  openRef.current = open;

  // Typing channel (shared with admin)
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`support-typing:${user.id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const p = (payload.payload ?? {}) as { role?: string };
      if (p.role !== "admin") return;
      setAdminTyping(true);
      if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
      adminTypingTimerRef.current = setTimeout(() => setAdminTyping(false), 3000);
    });
    ch.on("broadcast", { event: "msg" }, (payload) => {
      const m = payload.payload as Msg;
      if (!m?.id) return;
      setAdminTyping(false);
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (!openRef.current) setUnread((u) => u + 1);
    });
    ch.subscribe();
    typingChanRef.current = ch;
    const poll = setInterval(async () => {
      const { data } = await supabase.from("support_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
      if (data) setMsgs((prev) => (data.length !== prev.length ? (data as Msg[]) : prev));
    }, 2500);
    return () => {
      clearInterval(poll);
      if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
      supabase.removeChannel(ch);
      typingChanRef.current = null;
    };
  }, [user?.id]);

  const emitTyping = () => {
    const ch = typingChanRef.current;
    if (!ch) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1200) return;
    lastTypingSentRef.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { role: "user" } });
  };

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("ziidi:open-support", handler);
    return () => window.removeEventListener("ziidi:open-support", handler);
  }, []);

  // Load history + realtime
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!cancelled && data) {
        setMsgs(data as Msg[]);
        const un = (data as Msg[]).filter((m) => m.sender_role === "admin" && !m.read_by_user).length;
        setUnread(un);
      }
    })();

    const channel = supabase
      .channel(`support:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_role === "admin" && !openRef.current) setUnread((u) => u + 1);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Mark admin messages as read when panel is open
  useEffect(() => {
    if (!open || !user) return;
    setUnread(0);
    const unreadIds = msgs.filter((m) => m.sender_role === "admin" && !m.read_by_user).map((m) => m.id);
    if (unreadIds.length) {
      supabase
        .from("support_messages")
        .update({ read_by_user: true })
        .in("id", unreadIds)
        .then(() => {});
    }
  }, [open, msgs, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setInput("");
    const { data: row, error } = await supabase.from("support_messages").insert({
      user_id: user.id,
      sender_role: "user",
      sender_id: user.id,
      body: text,
    }).select("*").single();
    setSending(false);
    if (error) {
      setInput(text);
      return;
    }
    if (row) {
      const m = row as Msg;
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      typingChanRef.current?.send({ type: "broadcast", event: "msg", payload: m });
    }
  };

  if (!mounted || !user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open ZiiDi Customer Care"
          className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-2xl shadow-emerald-900/30 transition hover:bg-emerald-700 md:bottom-6 md:right-6"
        >
          <span className="relative grid h-6 w-6 place-items-center">
            <MessageCircle className="h-6 w-6" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
                {unread}
              </span>
            )}
          </span>
          <span className="hidden text-sm font-semibold sm:inline">Live Support</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 md:inset-auto md:bottom-6 md:right-6">
          <div className="mx-auto flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl md:h-[560px] md:rounded-2xl">
            <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-500 px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="relative grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur">
                    <Headphones className="h-5 w-5" />
                    <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-300 ring-2 ring-emerald-600" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-base font-black uppercase tracking-wide">SAFARICOM ZIIDI CUSTOMER CARE</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-50/90">
                      <Circle className="h-2 w-2 fill-emerald-300 text-emerald-300" />
                      Live agent support · Reply usually within minutes
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4">
              {msgs.length === 0 && (
                <div className="mx-auto max-w-[90%] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-xs text-emerald-900">
                  Hi 👋 Send us a message and a ZiiDi Customer Care agent will reply here shortly.
                </div>
              )}
              {msgs.map((m) => (
                <MsgBubble key={m.id} m={m} />
              ))}
              {adminTyping && (
                <div className="flex items-end gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                    <Headphones className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-xs italic text-slate-500 shadow-sm">
                    ZiiDi Customer Care is typing
                    <span className="ml-1 inline-flex gap-0.5">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
            >
              <input
                value={input}
                onChange={(e) => { setInput(e.target.value); emitTyping(); }}
                placeholder="Type your message…"
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="bg-white pb-2 text-center text-[10px] text-slate-400">
              Powered by Safaricom · ZiiDi Trader
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MsgBubble({ m }: { m: Msg }) {
  const mine = m.sender_role === "user";
  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
      {!mine && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
          <Headphones className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          mine ? "rounded-br-sm bg-emerald-600 text-white" : "rounded-bl-sm bg-white text-slate-800"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{m.body}</div>
        <div className={`mt-1 text-[10px] ${mine ? "text-emerald-50/80" : "text-slate-400"}`}>
          {timeLabel(m.created_at)}
        </div>
      </div>
    </div>
  );
}