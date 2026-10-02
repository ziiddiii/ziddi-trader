import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Briefcase,
  Film,
  Home as HomeIcon,
  Landmark,
  LineChart,
  Lock as LockIcon,
  LogOut,
  Moon,
  Settings,
  Send,
  Smartphone,
  Sun,
  TrendingUp,
  User as UserIcon,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notification-bell";
import { InstallAppButton } from "@/components/install-app-button";

const NAV = [
  { to: "/dashboard", label: "Home", icon: HomeIcon, color: "text-blue-500" },
  { to: "/fund", label: "Deposit", icon: Smartphone, color: "text-green-600" },
  { to: "/deposit", label: "Buy Shares", icon: LineChart, color: "text-emerald-500" },
  { to: "/bonds", label: "Buy Bonds", icon: Landmark, color: "text-amber-500" },
  { to: "/investments", label: "Investment", icon: Wallet, color: "text-violet-500" },
  { to: "/lock", label: "ZiiDi Lock", icon: LockIcon, color: "text-orange-500" },
  { to: "/transfer", label: "Send Funds", icon: Send, color: "text-teal-500" },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase, color: "text-blue-500" },
  { to: "/account", label: "Account", icon: UserIcon, color: "text-rose-500" },
  { to: "/community", label: "Community", icon: Users, color: "text-indigo-500" },
  { to: "/stories", label: "Stories & Media", icon: Film, color: "text-primary" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial: "light" | "dark" = stored ?? (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try { localStorage.setItem("theme", next); } catch {}
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  if (user && profile?.suspended) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-7 text-center shadow-xl">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <LockIcon className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">Account suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your ZiiDi Trader account has been suspended by the administrator. Trading, deposits,
            withdrawals and portfolio access are disabled until it is reinstated.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Please contact ZiiDi Trader support for assistance.
          </p>
          <button
            onClick={signOut}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><TrendingUp className="h-4 w-4" /></span>
          <span className="text-base">ZiiDi Trader</span>
        </Link>
        {user && profile && (
          <div className="relative flex items-center gap-2">
            <span className="hidden text-muted-foreground xs:inline">@{profile.username}</span>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {profile.username.charAt(0).toUpperCase()}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <nav className="flex flex-col py-1.5">
                    {NAV.slice(5).map((item) => {
                      const active = pathname === item.to || pathname.startsWith(item.to + "/");
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.label}
                          to={item.to}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}
                        >
                          <Icon className={`h-4 w-4 ${active ? "" : item.color}`} />{item.label}
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="border-t border-border py-1.5">
                    <button
                      onClick={() => { setMenuOpen(false); signOut(); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] pb-16 md:pb-0">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-card px-3 py-6 md:flex lg:w-56">
          <Link to="/" className="mb-8 flex items-center gap-2 px-2 font-semibold"><span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground"><TrendingUp className="h-5 w-5" /></span><span className="text-lg">ZiiDi Trader</span></Link>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => { const active = pathname === item.to || pathname.startsWith(item.to + "/"); const Icon = item.icon; return <Link key={item.label} to={item.to} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}><Icon className={`h-4 w-4 ${active ? "" : item.color}`} />{item.label}</Link>; })}
          </nav>
          <div className="mt-auto"><button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent"><LogOut className="h-4 w-4" /> Log out</button></div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6 lg:px-8">
          <div className="mb-4 hidden items-center justify-end gap-2 md:flex">
            <Link to="/account" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent" aria-label="Account settings"><Settings className="h-4 w-4" /></Link>
            <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle theme" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            <NotificationBell />
            <InstallAppButton className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent lg:inline-flex" />
            <button onClick={signOut} title="Log out" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent"><LogOut className="h-4 w-4" /></button>
          </div>
          {children}
        </main>

        <aside className="hidden w-72 shrink-0 flex-col gap-6 border-l border-border bg-card px-5 py-6 lg:flex">
          {user && profile ? <>
            <div className="flex items-center justify-end gap-3"><div className="min-w-0 text-right"><div className="truncate font-semibold">{(user.user_metadata?.full_name as string | undefined)?.trim() || profile.username}</div><div className="truncate text-xs text-muted-foreground">{user.email}</div></div><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted font-semibold text-foreground">{profile.username.charAt(0).toUpperCase()}</div></div>
            <div className="rounded-lg bg-muted/60 p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Briefcase className="h-4 w-4 text-cyan-500" /> Portfolio value</div><div className="mt-2 text-2xl font-bold">KSH {profile.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className="mt-1 text-xs text-muted-foreground">Available: KSH {profile.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
            <div className="grid gap-2"><Link to="/deposit" className="rounded-md bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground hover:opacity-90">Buy Shares</Link><Link to="/withdraw" className="rounded-md border border-border py-2.5 text-center text-sm font-medium hover:bg-accent">Withdraw</Link></div>
          </> : <Link to="/auth" className="rounded-md bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">Sign in</Link>}
        </aside>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-card px-2 py-2 md:hidden">
        {NAV.slice(0, 5).map((item) => { const active = pathname === item.to || pathname.startsWith(item.to + "/"); const Icon = item.icon; return <Link key={item.label} to={item.to} className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}><Icon className={`h-5 w-5 ${active ? "" : item.color}`} />{item.label}</Link>; })}
        <button onClick={signOut} className="flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[10px] text-muted-foreground"><LogOut className="h-5 w-5" />Out</button>
      </nav>
    </div>
  );
}