import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const root = process.cwd();
const dist = join(root, "dist");
const base = (process.env.PRERENDER_BASE || "/").replace(/\/?$/, "/");
const siteUrl = (process.env.PRERENDER_SITE_URL || "https://len-golani.github.io/AutoParts-fb/").replace(
  /\/?$/,
  "/",
);
const port = 4173;

const brands = JSON.parse(
  await readFile(join(root, "src/data/brands.json"), "utf8"),
).brands;
const catalogDir = join(root, "src/data/parts");
const catalogFiles = (await readdir(catalogDir))
  .filter((file) => file.endsWith(".json"))
  .sort();
const catalogs = await Promise.all(
  catalogFiles.map(async (file) => {
    const parsed = JSON.parse(await readFile(join(catalogDir, file), "utf8"));
    const base = `catalog/${parsed.catalog.brandSlug}/${parsed.catalog.modelSlug}/${parsed.catalog.year}`;
    return { ...parsed, base };
  }),
);
const lastUpdated = catalogs
  .map((catalog) => catalog.catalog.lastUpdated)
  .sort()
  .at(-1);

const vehicleRoutes = catalogs.flatMap((catalog) => [
  {
    path: catalog.base,
    output: `${catalog.base}/index.html`,
    waitFor: '[class*="assemblyCard"]',
  },
  ...catalog.assemblies.map((assembly) => ({
    path: `${catalog.base}/${assembly.slug}`,
    output: `${catalog.base}/${assembly.slug}/index.html`,
    waitFor: '[class*="diagramSvg"]',
  })),
  ...catalog.assemblies.flatMap((assembly) =>
    assembly.parts.map((part) => ({
      path: `${catalog.base}/${assembly.slug}/${part.slug}`,
      output: `${catalog.base}/${assembly.slug}/${part.slug}/index.html`,
      waitFor: "h1",
    })),
  ),
]);
const catalogRoutes = vehicleRoutes.map((route) => route.path);

const routes = [
  { path: "", output: "index.html", waitFor: '[class*="modelCard"]' },
  { path: "vin", output: "vin/index.html", waitFor: "h1" },
  {
    path: "catalog",
    output: "catalog/index.html",
    waitFor: '[class*="brandCard"]',
  },
  ...brands.map((brand) => ({
    path: `catalog/${brand.slug}`,
    output: `catalog/${brand.slug}/index.html`,
    waitFor: '[class*="modelCard"]',
  })),
  ...vehicleRoutes,
  { path: "search", output: "search/index.html", waitFor: "h1" },
  { path: "garage", output: "garage/index.html", waitFor: "h1" },
  { path: "tools", output: "tools/index.html", waitFor: "h1" },
  { path: "roadmap", output: "roadmap/index.html", waitFor: "h1" },
  { path: "recall-center", output: "recall-center/index.html", waitFor: "h1" },
  { path: "fleet", output: "fleet/index.html", waitFor: "h1" },
  { path: "not-a-real-page", output: "404.html", waitFor: "h1" },
];

const server = await preview({
  base,
  preview: { host: "127.0.0.1", port, strictPort: true },
  logLevel: "error",
});

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  headless: true,
});

try {
  const context = await browser.newContext();
  await context.route(
    /^https:\/\/vpic\.nhtsa\.dot\.gov\/api\/vehicles\//,
    (route) => route.fulfill({ json: { Results: [] } }),
  );
  await context.route(
    /^https:\/\/api\.nhtsa\.gov\/recalls\//,
    (route) => route.fulfill({ json: { Count: 0, results: [] } }),
  );
  await context.route(/^https:\/\/api\.nhtsa\.gov\/complaints\//, (route) =>
    route.fulfill({ json: { Count: 0, results: [] } }),
  );
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );

  const page = await context.newPage();
  let homeTitle = "";

  for (const route of routes) {
    await page.goto(`http://127.0.0.1:${port}${base}${route.path}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(route.waitFor).first().waitFor({ state: "visible" });

    if (homeTitle) {
      await page.waitForFunction(
        (title) => document.title !== title,
        homeTitle,
      );
    } else {
      homeTitle = await page.title();
    }

    await page.waitForTimeout(150);
    const file = join(dist, route.output);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await page.content());
    console.log(`${route.output}: ${await page.title()}`);
  }

  const sitemapPaths = [
    "",
    "vin",
    "catalog",
    ...brands.map((brand) => `catalog/${brand.slug}`),
    "search",
    "tools",
    "roadmap",
    ...catalogRoutes,
  ];

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapPaths.map(
      (path) =>
        `  <url><loc>${siteUrl}${path}</loc><lastmod>${lastUpdated}</lastmod></url>`,
    ),
    "</urlset>",
    "",
  ].join("\n");

  await writeFile(join(dist, "sitemap.xml"), sitemap);
  console.log(`sitemap.xml: ${sitemapPaths.length} URLs`);
} finally {
  await browser.close();
  await server.close();
}
