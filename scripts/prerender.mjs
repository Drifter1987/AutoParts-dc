import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const root = process.cwd();
const dist = join(root, "dist");
const base = (process.env.PRERENDER_BASE || "/").replace(/\/?$/, "/");
const port = 4173;

const brands = JSON.parse(
  await readFile(join(root, "src/data/brands.json"), "utf8"),
).brands;

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

    await page.waitForTimeout(100);
    const file = join(dist, route.output);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await page.content());
    console.log(`${route.output}: ${await page.title()}`);
  }
} finally {
  await browser.close();
  await server.close();
}
