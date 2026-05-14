import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const resolveSiteUrl = () => {
  const rawUrl =
    process.env.SITE_URL ||
    process.env.VITE_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "https://example.com";

  return rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
};

const siteUrl = resolveSiteUrl().replace(/\/+$/, "");
const publicDir = path.resolve(process.cwd(), "public");

const routes = [
  { path: "/login", priority: "0.9" },
  { path: "/signup", priority: "0.8" },
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    ({ path: routePath, priority }) => `  <url>
    <loc>${siteUrl}${routePath}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /user/
Disallow: /system-admin/

Sitemap: ${siteUrl}/sitemap.xml
`;

await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
await writeFile(path.join(publicDir, "robots.txt"), robots, "utf8");
