/* Cold-load performance audit for the live GitHub Pages deployment.
 * Usage: node scripts/perf-audit.mjs [runs]   (default 3 runs per profile)
 * Saves raw medians to test-results/perf-audit-results.json.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://drifter1987.github.io/AutoParts-dc/";
const RUNS = Number(process.argv[2] || 3);
const OUT = "test-results/perf-audit-results.json";

const routes = [
  { id: "home", path: "" },
  { id: "vin", path: "vin/" },
  { id: "catalog", path: "catalog/" },
  { id: "brand", path: "catalog/honda/" },
  { id: "model-year", path: "catalog/honda/civic/2020/" },
  { id: "assembly", path: "catalog/honda/civic/2020/engine/" },
  { id: "part", path: "catalog/honda/civic/2020/engine/engine-oil-filter/" },
  { id: "search", path: "search/" },
  { id: "garage", path: "garage/" },
  { id: "recall-center", path: "recall-center/" },
  { id: "fleet", path: "fleet/" },
  { id: "tools", path: "tools/" },
];

const profiles = {
  desktop: {
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    cpu: 1,
    net: null,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    cpu: 4,
    net: { latency: 150, downKbps: 1600, upKbps: 750 },
  },
};

const initScript = () => {
  window.__perf = { lcp: 0, lcpEl: "", cls: 0, longTasks: 0, tbt: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.lcp = entry.startTime;
        const el = entry.element;
        window.__perf.lcpEl = el
          ? `${el.tagName?.toLowerCase() || "?"}${el.className ? "." + String(el.className).split(" ")[0] : ""}`
          : entry.url || "";
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__perf.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.longTasks += 1;
        window.__perf.tbt += Math.max(0, entry.duration - 50);
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {}
};

const collect = () => {
  const nav = performance.getEntriesByType("navigation")[0] || {};
  const paint = Object.fromEntries(
    performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]),
  );
  return {
    status: nav.responseStatus,
    protocol: nav.nextHopProtocol,
    ttfb: Math.round(nav.responseStart || 0),
    fcp: Math.round(paint["first-contentful-paint"] || 0),
    lcp: Math.round(window.__perf.lcp || 0),
    lcpEl: window.__perf.lcpEl,
    cls: Number(window.__perf.cls.toFixed(4)),
    longTasks: window.__perf.longTasks,
    tbt: Math.round(window.__perf.tbt),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    load: Math.round(nav.loadEventEnd || 0),
    htmlTransfer: nav.transferSize || 0,
    htmlDecoded: nav.decodedBodySize || 0,
    resources: performance.getEntriesByType("resource").length,
    modulePreloads: [...document.querySelectorAll('link[rel="modulepreload"]')].length,
    stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].length,
  };
};

const median = (values) => {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const kb = (b) => Math.round((b / 1024) * 10) / 10;

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  headless: true,
});
const results = {};

try {
  for (const [profileName, profile] of Object.entries(profiles)) {
    results[profileName] = {};
    for (const route of routes) {
      const runs = [];
      for (let i = 0; i < RUNS; i += 1) {
        const context = await browser.newContext({
          viewport: profile.viewport,
          deviceScaleFactor: profile.deviceScaleFactor,
          isMobile: profile.isMobile,
          hasTouch: profile.hasTouch,
          serviceWorkers: "block",
          locale: "en-US",
        });
        await context.addInitScript(initScript);
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

        const reqs = new Map();
        cdp.on("Network.responseReceived", (event) => {
          reqs.set(event.requestId, {
            url: event.response.url,
            status: event.response.status,
            mime: event.response.mimeType || "",
            bytes: 0,
          });
        });
        cdp.on("Network.loadingFinished", (event) => {
          const item = reqs.get(event.requestId);
          if (item) item.bytes = event.encodedDataLength || 0;
        });

        if (profile.net) {
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: profile.net.latency,
            downloadThroughput: (profile.net.downKbps * 1024) / 8,
            uploadThroughput: (profile.net.upKbps * 1024) / 8,
            connectionType: "cellular3g",
          });
        }
        if (profile.cpu > 1) {
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
        }

        let contentMs = 0;
        let error = "";
        const failures = [];
        page.on("requestfailed", (req) => {
          if (failures.length < 8) failures.push(`${req.failure()?.errorText || "failed"} ${req.url().slice(0, 110)}`);
        });
        page.on("response", (res) => {
          if (res.status() >= 400 && failures.length < 8) {
            failures.push(`${res.status()} ${res.url().slice(0, 110)}`);
          }
        });

        try {
          await page.goto(`${BASE}${route.path}`, {
            waitUntil: "domcontentloaded",
            timeout: 90000,
          });
          await page.locator("main h1, h1").first().waitFor({ state: "visible", timeout: 45000 });
          contentMs = Math.round(await page.evaluate(() => performance.now()));
          await page.waitForLoadState("load", { timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(1500);
          const metrics = await page.evaluate(collect);

          const all = [...reqs.values()];
          const byKind = {};
          for (const r of all) {
            let kind = "other";
            if (r.mime.includes("javascript") || r.mime.includes("ecmascript")) kind = "js";
            else if (r.mime.includes("css")) kind = "css";
            else if (r.mime.includes("font")) kind = "font";
            else if (r.mime.startsWith("image/")) kind = "image";
            else if (r.mime.includes("json")) kind = "json";
            else if (r.mime.includes("html")) kind = "document";
            byKind[kind] = byKind[kind] || { count: 0, bytes: 0 };
            byKind[kind].count += 1;
            byKind[kind].bytes += r.bytes;
          }
          const totalBytes = all.reduce((s, r) => s + r.bytes, 0);
          const heaviest = all
            .filter((r) => r.bytes > 0)
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 8)
            .map((r) => ({
              url: r.url.replace(new URL(BASE).origin, ""),
              kb: kb(r.bytes),
              kind: r.mime,
            }));

          runs.push({
            ...metrics,
            contentMs,
            totalBytes,
            byKind,
            heaviest,
            requestCount: all.length,
            crossOrigin: all.filter((r) => {
              try {
                return new URL(r.url).origin !== new URL(BASE).origin;
              } catch {
                return false;
              }
            }).length,
            failures,
          });
        } catch (err) {
          error = String(err && err.message ? err.message : err).slice(0, 200);
          runs.push({ error, contentMs, failures });
        } finally {
          await context.close();
        }
      }

      const good = runs.filter((r) => !r.error);
      if (!good.length) {
        results[profileName][route.id] = { error: runs[0]?.error || "failed", runs };
        console.log(`${profileName} ${route.id}: FAILED ${runs[0]?.error}`);
        continue;
      }
      const kindMedian = (kind, field) =>
        median(good.map((r) => r.byKind?.[kind]?.[field] || 0));
      const agg = {
        runs: good.length,
        status: good[0].status,
        protocol: good[0].protocol,
        contentMs: Math.round(median(good.map((r) => r.contentMs))),
        ttfb: Math.round(median(good.map((r) => r.ttfb))),
        fcp: Math.round(median(good.map((r) => r.fcp))),
        lcp: Math.round(median(good.map((r) => r.lcp))),
        lcpEl: good[0].lcpEl,
        cls: median(good.map((r) => r.cls)),
        tbt: Math.round(median(good.map((r) => r.tbt))),
        domContentLoaded: Math.round(median(good.map((r) => r.domContentLoaded))),
        load: Math.round(median(good.map((r) => r.load))),
        requests: Math.round(median(good.map((r) => r.requestCount))),
        crossOrigin: Math.round(median(good.map((r) => r.crossOrigin))),
        htmlKb: kb(median(good.map((r) => r.htmlDecoded))),
        totalKb: kb(median(good.map((r) => r.totalBytes))),
        jsKb: kb(kindMedian("js", "bytes")),
        jsCount: Math.round(kindMedian("js", "count")),
        cssKb: kb(kindMedian("css", "bytes")),
        fontKb: kb(kindMedian("font", "bytes")),
        fontCount: Math.round(kindMedian("font", "count")),
        jsonKb: kb(kindMedian("json", "bytes")),
        imageKb: kb(kindMedian("image", "bytes")),
        modulePreloads: Math.round(median(good.map((r) => r.modulePreloads))),
        heaviest: good[0].heaviest,
        failures: good[0].failures,
        perRun: good.map((r) => ({
          contentMs: r.contentMs,
          fcp: r.fcp,
          lcp: r.lcp,
          load: r.load,
          tbt: r.tbt,
          totalKb: kb(r.totalBytes),
        })),
      };
      results[profileName][route.id] = agg;
      console.log(
        `${profileName.padEnd(7)} ${route.id.padEnd(13)} h1=${String(agg.contentMs).padStart(5)} fcp=${String(agg.fcp).padStart(5)} lcp=${String(agg.lcp).padStart(5)} load=${String(agg.load).padStart(5)} req=${String(agg.requests).padStart(3)} total=${String(agg.totalKb).padStart(7)}kB js=${String(agg.jsKb).padStart(6)}kB(${agg.jsCount}) font=${String(agg.fontKb).padStart(5)}kB cls=${agg.cls} tbt=${String(agg.tbt).padStart(4)}`,
      );
    }
  }
} finally {
  await browser.close();
}

await mkdir("test-results", { recursive: true });
await writeFile(OUT, JSON.stringify(results, null, 2));
console.log(`\nSaved ${OUT}`);
