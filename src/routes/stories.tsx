import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Film, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_CATEGORIES, safeMediaUrl, youtubeEmbed, type PlatformCategory, type PlatformContent } from "@/lib/platform-content";
import awarenessPoster from "@/assets/ziidi-awareness-clean.jpg";

const awarenessWebm = "/__l5e/assets-v1/d6938fc7-51df-4394-b2f3-9f52c9dbd1a7/ziidi-awareness.webm";

export const Route = createFileRoute("/stories")({
  head: () => ({ meta: [
    { title: "Journey, Stories & Media — ZiiDi Trader" },
    { name: "description", content: "Explore the ZiiDi Trader journey, investing awareness videos, promotions and platform stories." },
    { property: "og:title", content: "Journey, Stories & Media — ZiiDi Trader" },
    { property: "og:description", content: "Watch our platform journey and explore ZiiDi Trader videos, promotions and awareness stories." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: StoriesPage,
});

function Media({ item }: { item: PlatformContent }) {
  const embed = item.media_type === "youtube" ? youtubeEmbed(item.media_url) : null;
  const safe = safeMediaUrl(item.media_url);
  if (embed) return <iframe className="aspect-video w-full bg-muted" src={embed} title={item.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />;
  if (item.media_type === "video" && safe) return <video controls preload="metadata" playsInline poster={item.media_url.includes("ziidi-awareness") ? awarenessPoster : undefined} className="max-h-[540px] w-full bg-muted object-contain"><source src={safe} type="video/mp4" />{item.media_url.includes("ziidi-awareness") && <source src={awarenessWebm} type="video/webm" />}Your browser does not support video.</video>;
  if (item.media_type === "image" && safe) return <img src={safe} alt={item.title} loading="lazy" className="max-h-[540px] w-full object-contain bg-muted" />;
  return null;
}

function StoriesPage() {
  const [items, setItems] = useState<PlatformContent[]>([]);
  const [category, setCategory] = useState<PlatformCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    supabase.from("platform_content").select("*").eq("published", true).order("sort_order").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      setItems((data ?? []) as PlatformContent[]);
      setError(error?.message ?? "");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const visible = category === "all" ? items : items.filter((item) => item.category === category);
  return <div className="mx-auto max-w-6xl pb-20">
    <div className="border-b border-border pb-8 pt-4 md:pt-8">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Film className="h-4 w-4" /> ZiiDi Trader / Media</div>
      <h1 className="max-w-3xl font-heading text-3xl font-bold leading-tight text-foreground md:text-5xl">Our journey, in stories.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">Videos, awareness and updates from ZiiDi Trader.</p>
    </div>
    <div className="sticky top-[57px] z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-4 md:static md:mx-0 md:px-0" aria-label="Content categories">
      {[{ id: "all", label: "All" }, ...CONTENT_CATEGORIES].map((tab) => <Button key={tab.id} type="button" variant={category === tab.id ? "default" : "ghost"} size="sm" onClick={() => setCategory(tab.id as PlatformCategory | "all")} className="shrink-0">{tab.label}</Button>)}
    </div>
    {loading ? <div className="py-16 text-sm text-muted-foreground">Loading stories…</div> : error ? <div role="alert" className="py-16 text-sm text-destructive">Could not load stories: {error}</div> : visible.length === 0 ? <div className="py-16 text-sm text-muted-foreground">Nothing published in this section yet.</div> :
      <div className="grid gap-x-8 gap-y-12 pt-8 md:grid-cols-2">
        {visible.map((item) => <article key={item.id} className="min-w-0 border-b border-border pb-8">
          <div className="mb-4 overflow-hidden rounded-md bg-muted">{item.media_type === "none" ? <div className="flex aspect-video items-center justify-center"><Play className="h-10 w-10 text-primary" /></div> : <Media item={item} />}</div>
          <div className="mb-2 text-xs font-semibold uppercase text-primary">{CONTENT_CATEGORIES.find((c) => c.id === item.category)?.label ?? item.category}</div>
          <h2 className="font-heading text-xl font-semibold leading-snug text-foreground">{item.title}</h2>
          {item.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>}
          {item.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground">{item.body}</p>}
        </article>)}
      </div>}
    <div className="mt-10 border-t border-border pt-6"><Button asChild variant="outline"><Link to="/deposit">Explore shares <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button></div>
  </div>;
}