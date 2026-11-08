// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const INDEX_HTML = path.join(ROOT, "index.html");
const VERCEL_JSON = path.join(ROOT, "vercel.json");

describe("1. Google Search Console & Webmaster Verification", () => {
  it("index.html contains google-site-verification meta tag", () => {
    const html = fs.readFileSync(INDEX_HTML, "utf-8");
    expect(html).toMatch(/<meta\s+name=["']google-site-verification["']\s+content=["'][^"']+["']/i);
  });

  it("robots.txt allows Googlebot and declares the sitemap", () => {
    const robots = fs.readFileSync(path.join(PUBLIC_DIR, "robots.txt"), "utf-8");
    expect(robots).toMatch(/User-agent:\s*Googlebot/i);
    expect(robots).toMatch(/Sitemap:\s*https:\/\/academia\.app\/sitemap\.xml/i);
  });

  it("index.html contains canonical URL", () => {
    const html = fs.readFileSync(INDEX_HTML, "utf-8");
    expect(html).toContain('<link rel="canonical" href="https://academia.app/"');
  });
});

describe("2. sitemap.xml Compliance", () => {
  const sitemap = fs.readFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), "utf-8");

  it("is valid XML with sitemaps schema", () => {
    expect(sitemap.trim().startsWith("<?xml")).toBe(true);
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(sitemap).toContain("</urlset>");
  });

  it("never contains hash fragment (#) in URLs (disallowed by GSC and Bing)", () => {
    const locMatches = sitemap.match(/<loc>(.*?)<\/loc>/g) || [];
    expect(locMatches.length).toBeGreaterThan(5);
    for (const match of locMatches) {
      expect(match).not.toContain("#");
      expect(match).toMatch(/<loc>https:\/\/academia\.app\/?.*<\/loc>/);
    }
  });

  it("includes valid lastmod, changefreq, and priority", () => {
    const priorities = sitemap.match(/<priority>(.*?)<\/priority>/g) || [];
    for (const p of priorities) {
      const val = parseFloat(p.replace(/<\/?priority>/g, ""));
      expect(val).toBeGreaterThanOrEqual(0.0);
      expect(val).toBeLessThanOrEqual(1.0);
    }
    expect(sitemap).toContain("<changefreq>");
    expect(sitemap).toContain("<lastmod>");
  });
});

describe("3. LLMS.txt AI Context Discovery", () => {
  it("public/llms.txt follows the llmstxt.org standard format", () => {
    const llms = fs.readFileSync(path.join(PUBLIC_DIR, "llms.txt"), "utf-8");
    // H1 title
    expect(llms).toMatch(/^#\s+Academia/m);
    // Blockquote summary
    expect(llms).toMatch(/^>\s+/m);
    // Links to documentation and modules
    expect(llms).toContain("## Core Modules & Features");
    expect(llms).toMatch(/\[.*?\]\(https:\/\/academia\.app\/.*?\):/);
    // Optional section pointing to full spec
    expect(llms).toContain("## Optional");
    expect(llms).toContain("llms-full.txt");
  });

  it("public/llms-full.txt exists with exhaustive technical specifications", () => {
    const llmsFull = fs.readFileSync(path.join(PUBLIC_DIR, "llms-full.txt"), "utf-8");
    expect(llmsFull).toContain("SM-2");
    expect(llmsFull).toContain("AES-256-GCM");
    expect(llmsFull).toContain(".academia-lock");
    expect(llmsFull).toContain("acad-vm");
  });

  it("robots.txt declares AI crawler user-agents", () => {
    const robots = fs.readFileSync(path.join(PUBLIC_DIR, "robots.txt"), "utf-8");
    expect(robots).toContain("GPTBot");
    expect(robots).toContain("ClaudeBot");
    expect(robots).toContain("PerplexityBot");
  });
});

describe("4. Open Graph & Twitter Card Tags", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf-8");

  it("contains all required Open Graph meta properties", () => {
    expect(html).toMatch(/<meta\s+property=["']og:site_name["']\s+content=["']Academia["']/i);
    expect(html).toMatch(/<meta\s+property=["']og:title["']\s+content=["'][^"']+["']/i);
    expect(html).toMatch(/<meta\s+property=["']og:description["']\s+content=["'][^"']+["']/i);
    expect(html).toMatch(/<meta\s+property=["']og:type["']\s+content=["']website["']/i);
    expect(html).toMatch(/<meta\s+property=["']og:url["']\s+content=["']https:\/\/academia\.app\/["']/i);
    expect(html).toMatch(/<meta\s+property=["']og:image["']\s+content=["']https:\/\/academia\.app\/Images\/promos\/promo-library\.jpg["']/i);
    expect(html).toMatch(/<meta\s+property=["']og:image:width["']\s+content=["']1200["']/i);
    expect(html).toMatch(/<meta\s+property=["']og:image:height["']\s+content=["']630["']/i);
  });

  it("contains all required Twitter / X card tags", () => {
    expect(html).toMatch(/<meta\s+name=["']twitter:card["']\s+content=["']summary_large_image["']/i);
    expect(html).toMatch(/<meta\s+name=["']twitter:title["']\s+content=["'][^"']+["']/i);
    expect(html).toMatch(/<meta\s+name=["']twitter:description["']\s+content=["'][^"']+["']/i);
    expect(html).toMatch(/<meta\s+name=["']twitter:image["']\s+content=["'][^"']+["']/i);
  });

  it("referenced OG image exists on disk in public folder", () => {
    const imagePath = path.join(PUBLIC_DIR, "Images", "promos", "promo-library.jpg");
    expect(fs.existsSync(imagePath)).toBe(true);
    const stats = fs.statSync(imagePath);
    expect(stats.size).toBeGreaterThan(10000);
  });
});

describe("5. Bing Webmaster Tools", () => {
  it("index.html contains msvalidate.01 meta tag", () => {
    const html = fs.readFileSync(INDEX_HTML, "utf-8");
    expect(html).toMatch(/<meta\s+name=["']msvalidate\.01["']\s+content=["'][^"']+["']/i);
  });

  it("public/BingSiteAuth.xml exists with valid XML schema", () => {
    const bingAuth = fs.readFileSync(path.join(PUBLIC_DIR, "BingSiteAuth.xml"), "utf-8");
    expect(bingAuth.trim().startsWith("<?xml")).toBe(true);
    expect(bingAuth).toContain("<users>");
    expect(bingAuth).toContain("<user>");
  });

  it("robots.txt allows Bingbot", () => {
    const robots = fs.readFileSync(path.join(PUBLIC_DIR, "robots.txt"), "utf-8");
    expect(robots).toMatch(/User-agent:\s*Bingbot/i);
  });
});

describe("Vercel Routing & Discovery Headers", () => {
  it("vercel.json configures correct headers for sitemap, robots, llms.txt, and BingSiteAuth", () => {
    const vercel = JSON.parse(fs.readFileSync(VERCEL_JSON, "utf-8"));
    const sources = vercel.headers.map((h: { source: string }) => h.source);
    expect(sources).toContain("/sitemap.xml");
    expect(sources).toContain("/robots.txt");
    expect(sources).toContain("/(llms\\.txt|llms-full\\.txt)");
    expect(sources).toContain("/BingSiteAuth.xml");
  });
});

