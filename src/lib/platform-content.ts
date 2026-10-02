export type PlatformCategory = "journey" | "awareness" | "promos" | "general";
export type PlatformMediaType = "none" | "youtube" | "video" | "image";
export type PlatformContent = {
  id: string;
  category: PlatformCategory;
  title: string;
  summary: string;
  body: string;
  media_type: PlatformMediaType;
  media_url: string;
  published: boolean;
  sort_order: number;
  created_at: string;
};

export const CONTENT_CATEGORIES: { id: PlatformCategory; label: string }[] = [
  { id: "journey", label: "Our Journey" },
  { id: "awareness", label: "Awareness" },
  { id: "promos", label: "Promo Gallery" },
  { id: "general", label: "General" },
];

export function youtubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    let id: string | null = null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      id = parsed.pathname === "/watch" ? parsed.searchParams.get("v") : parsed.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1] ?? null;
    } else if (host === "youtu.be" || host === "www.youtu.be") {
      id = parsed.pathname.slice(1);
    }
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const rawTime = parsed.searchParams.get("t") ?? parsed.searchParams.get("start") ?? "0";
    const time = /^\d+$/.test(rawTime) ? Number(rawTime) : 0;
    return `https://www.youtube-nocookie.com/embed/${id}?start=${time}&rel=0`;
  } catch { return null; }
}

export function safeMediaUrl(url: string): string | null {
  if (url.startsWith("/__l5e/assets-v1/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch { return null; }
}