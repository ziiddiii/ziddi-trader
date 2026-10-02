import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Film } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_CATEGORIES, safeMediaUrl, youtubeEmbed, type PlatformCategory, type PlatformContent, type PlatformMediaType } from "@/lib/platform-content";

type Draft = Pick<PlatformContent, "category" | "title" | "summary" | "body" | "media_type" | "media_url" | "published" | "sort_order"> & { id?: string };
const emptyDraft: Draft = { category: "journey", title: "", summary: "", body: "", media_type: "none", media_url: "", published: false, sort_order: 0 };

export function AdminContentSection() {
  const [items, setItems] = useState<PlatformContent[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const { data, error } = await supabase.from("platform_content").select("*").order("sort_order").order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []) as PlatformContent[]);
  };
  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return toast.error("Enter a title");
    const url = draft.media_url.trim();
    if (draft.media_type === "youtube" && !youtubeEmbed(url)) return toast.error("Enter a valid YouTube video link");
    if ((draft.media_type === "video" || draft.media_type === "image") && !safeMediaUrl(url)) return toast.error("Enter an HTTPS or hosted media URL");
    setBusy(true);
    const payload = { category: draft.category, title: draft.title.trim(), summary: draft.summary.trim(), body: draft.body.trim(), media_type: draft.media_type, media_url: draft.media_type === "none" ? "" : url, published: draft.published, sort_order: draft.sort_order };
    const { error } = draft.id ? await supabase.from("platform_content").update(payload).eq("id", draft.id) : await supabase.from("platform_content").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "Content updated" : "Content added");
    setDraft(emptyDraft);
    await load();
  };
  const remove = async (id: string) => {
    if (!window.confirm("Remove this content?")) return;
    const { error } = await supabase.from("platform_content").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Content removed");
    await load();
  };
  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  return <div className="text-foreground">
    <div className="mb-5 flex items-center gap-3"><Film className="h-6 w-6 text-primary" /><div><h1 className="text-xl font-semibold">Platform Content</h1><p className="text-xs text-muted-foreground">Manage journey, awareness, promo gallery and general stories.</p></div></div>
    <form onSubmit={save} className="mb-6 grid gap-4 rounded-md border border-border bg-card p-4 md:grid-cols-2">
      <h2 className="font-semibold md:col-span-2">{draft.id ? "Edit content" : "Add content"}</h2>
      <label className="grid gap-1 text-xs font-medium">Section<select className={field} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as PlatformCategory })}>{CONTENT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium">Media type<select className={field} value={draft.media_type} onChange={e => setDraft({ ...draft, media_type: e.target.value as PlatformMediaType })}><option value="none">Text only</option><option value="youtube">YouTube video</option><option value="video">Hosted video URL</option><option value="image">Image URL</option></select></label>
      <label className="grid gap-1 text-xs font-medium md:col-span-2">Title<Input required maxLength={180} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Story title" /></label>
      <label className="grid gap-1 text-xs font-medium md:col-span-2">Short description<Input value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} /></label>
      <label className="grid gap-1 text-xs font-medium md:col-span-2">Story text<Textarea rows={4} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} /></label>
      {draft.media_type !== "none" && <label className="grid gap-1 text-xs font-medium md:col-span-2">{draft.media_type === "youtube" ? "YouTube link" : "Media URL"}<Input type="url" required value={draft.media_url} onChange={e => setDraft({ ...draft, media_url: e.target.value })} placeholder="https://…" /></label>}
      <label className="grid gap-1 text-xs font-medium">Display order<Input type="number" value={draft.sort_order} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} /> Published</label>
      <div className="flex gap-2 md:col-span-2"><Button disabled={busy} type="submit">{draft.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{busy ? "Saving…" : draft.id ? "Save changes" : "Add content"}</Button>{draft.id && <Button type="button" variant="outline" onClick={() => setDraft(emptyDraft)}>Cancel</Button>}</div>
    </form>
    <div className="divide-y divide-border rounded-md border border-border bg-card">
      {loading && <p className="p-5 text-sm text-muted-foreground">Loading…</p>}
      {!loading && !items.length && <p className="p-5 text-sm text-muted-foreground">No content yet.</p>}
      {items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><div className="text-xs text-primary">{CONTENT_CATEGORIES.find(c => c.id === item.category)?.label} · {item.media_type} · {item.published ? "Published" : "Draft"}</div><div className="font-medium">{item.title}</div></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setDraft({ id: item.id, category: item.category, title: item.title, summary: item.summary, body: item.body, media_type: item.media_type, media_url: item.media_url, published: item.published, sort_order: item.sort_order }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button><Button size="icon" variant="outline" aria-label={`Delete ${item.title}`} onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}
    </div>
  </div>;
}