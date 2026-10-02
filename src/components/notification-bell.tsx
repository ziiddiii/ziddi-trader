import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type N = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shownRef = useRef<Set<string>>(new Set());

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,kind,read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as N[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => {
          const n = p.new as N;
          setItems((prev) => [n, ...prev].slice(0, 20));
          if (!shownRef.current.has(n.id)) {
            shownRef.current.add(n.id);
            // Flash toast for immediate visibility
            import("sonner").then(({ toast }) => {
              if (n.kind === "reminder") toast.warning(n.title, { description: n.body, duration: 8000 });
              else if (n.kind === "cancelled") toast.error(n.title, { description: n.body, duration: 8000 });
              else if (n.kind === "sale") toast.success(n.title, { description: n.body, duration: 6000 });
              else toast(n.title, { description: n.body });
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="text-sm font-semibold">Notifications</div>
            <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground">
              Refresh
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="border-b border-border/60 px-4 py-3 last:border-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold text-foreground">{n.title}</div>
                    <div className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{n.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}