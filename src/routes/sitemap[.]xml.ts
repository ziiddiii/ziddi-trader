import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://www.ziiditraders.online";

const PATHS = [
  "/",
  "/auth",
  "/forgot-password",
  "/community",
  "/dashboard",
  "/deposit",
  "/portfolio",
  "/bonds",
  "/investments",
  "/lock",
  "/auto-invest",
  "/account",
  "/withdraw",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = PATHS.map(
          (p) =>
            `  <url>\n    <loc>${BASE_URL}${p}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${p === "/" ? "1.0" : "0.7"}</priority>\n  </url>`,
        ).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});