import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Shield, Plus, Save, Trash2, ChevronLeft, ToggleLeft, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/admin-plans")({
  head: () => ({
    meta: [
      { title: "Admin — Investment Plans" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPlansPage,
});

type Plan = {
  id: string;
  name: string;
  description: string;
  interest_rate: number;
  duration_hours: number;
  min_amount: number;
  max_amount: number;
  active: boolean;
  sort_order: number;
};

type Draft = Omit<Plan, "id"> & { id?: string };

const empty: Draft = {
  name: "",
  description: "",
  interest_rate: 100,
  duration_hours: 24,
  min_amount: 1000,
  max_amount: 100000,
  active: true,
  sort_order: 10,
};

function AdminPlansPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, loading, navigate]);

  const load = async () => {
    const { data, error } = await supabase.from("investment_plans").select("*").order("sort_order");
    if (error) { toast.error(error.message); return; }
    setPlans((data ?? []) as Plan[]);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const edit = (p: Plan) => setDraft({ ...p });
  const reset = () => setDraft(empty);

  const save = async () => {
    if (!draft.name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    const payload = {
      name: draft.name,
      description: draft.description,
      interest_rate: Number(draft.interest_rate),
      duration_hours: Number(draft.duration_hours),
      min_amount: Number(draft.min_amount),
      max_amount: Number(draft.max_amount),
      active: !!draft.active,
      sort_order: Number(draft.sort_order),
    };
    const q = draft.id
      ? supabase.from("investment_plans").update(payload).eq("id", draft.id)
      : supabase.from("investment_plans").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(draft.id ? "Plan updated" : "Plan created");
    reset();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    const { error } = await supabase.from("investment_plans").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const toggle = async (p: Plan) => {
    const { error } = await supabase.from("investment_plans").update({ active: !p.active }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading || isAdmin === null) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!isAdmin) return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Admins only</h1>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card hover:bg-accent"><ChevronLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-xl font-semibold">Investment Plans</h1>
          <p className="text-xs text-muted-foreground">Create and manage investment packages users can pick from.</p>
        </div>
      </div>

      <section className="mb-6 rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{draft.id ? "Edit plan" : "Create new plan"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Plan name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Btcfx Starter Plan" />
          </Field>
          <Field label="Sort order">
            <input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Interest rate (%)">
            <input type="number" step="0.01" value={draft.interest_rate} onChange={(e) => setDraft({ ...draft, interest_rate: Number(e.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Duration (hours)">
            <input type="number" value={draft.duration_hours} onChange={(e) => setDraft({ ...draft, duration_hours: Number(e.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Minimum entry (KSH)">
            <input type="number" step="0.01" value={draft.min_amount} onChange={(e) => setDraft({ ...draft, min_amount: Number(e.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Maximum entry (KSH)">
            <input type="number" step="0.01" value={draft.max_amount} onChange={(e) => setDraft({ ...draft, max_amount: Number(e.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Short description shown on the plan card." />
          </Field>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active (visible to users)
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {busy ? "Saving…" : draft.id ? "Save changes" : "Create plan"}
          </button>
          {draft.id && (
            <button onClick={reset} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <div className="col-span-3">Name</div>
          <div className="col-span-1">Rate</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-2">Min</div>
          <div className="col-span-2">Max</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {plans.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No plans yet.</div>}
        {plans.map((p) => (
          <div key={p.id} className="grid grid-cols-2 gap-3 border-b px-4 py-3 text-sm md:grid-cols-12 md:items-center">
            <div className="md:col-span-3">
              <div className="font-semibold">{p.name}</div>
              <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>
            </div>
            <div className="md:col-span-1 font-mono">{p.interest_rate}%</div>
            <div className="md:col-span-2">{p.duration_hours}h</div>
            <div className="md:col-span-2 font-mono text-xs">KSH {Number(p.min_amount).toLocaleString()}</div>
            <div className="md:col-span-2 font-mono text-xs">KSH {Number(p.max_amount).toLocaleString()}</div>
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              <button onClick={() => toggle(p)} className="rounded-md border p-1.5 hover:bg-accent" title={p.active ? "Set inactive" : "Set active"}>
                {p.active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
              </button>
              <button onClick={() => edit(p)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">Edit</button>
              <button onClick={() => remove(p.id)} className="rounded-md border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}