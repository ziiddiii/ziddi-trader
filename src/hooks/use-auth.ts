import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Profile = { id: string; username: string; balance: number; suspended?: boolean };

const PROFILE_CACHE_KEY = "ziidi:profile-cache:v1";

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PROFILE_CACHE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, Profile>;
    const p = parsed[userId];
    if (!p) return null;
    return { ...p, balance: Number(p.balance) };
  } catch {
    return null;
  }
}

function writeCachedProfile(p: Profile) {
  try {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Profile>) : {};
    parsed[p.id] = { id: p.id, username: p.username, balance: Number(p.balance), suspended: !!p.suspended };
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

function profileFromUser(user: User): Profile {
  const metadataName =
    (user.user_metadata?.username as string | undefined)?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim();
  const emailName = user.email?.split("@")[0]?.trim();

  return {
    id: user.id,
    username: metadataName || emailName || "Trader",
    balance: 0,
    suspended: false,
  };
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    // Hydrate instantly from cache (if any) so the wallet balance shows immediately.
    const cached = readCachedProfile(user.id);
    setProfile(cached ?? profileFromUser(user));
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, balance, suspended")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data) {
        const fresh = { ...data, balance: Number(data.balance), suspended: !!data.suspended };
        setProfile(fresh);
        writeCachedProfile(fresh);
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!roleRow);
    };
    load();
    const channel = supabase
      .channel(`profile:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const r = payload.new as Profile;
          const fresh = { id: r.id, username: r.username, balance: Number(r.balance), suspended: !!r.suspended };
          setProfile(fresh);
          writeCachedProfile(fresh);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { session, user, profile, isAdmin, loading };
}