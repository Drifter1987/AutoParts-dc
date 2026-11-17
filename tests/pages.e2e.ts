import { test, expect } from "@playwright/test";
import { stubGoogleFonts } from "./google-fonts-stubs";
import { stubNhtsa } from "./nhtsa-stubs";

const PAGES_URL = "https://len-golani.github.io/AutoParts-fb/";
const BASE_PATH = "/AutoParts-fb/";
const KNOWN_GOOD_VIN = "1HGCM82633A004352";

test.describe("deployed GitHub Pages", () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
    await stubNhtsa(page);
  });

  test("decodes a VIN and keeps catalog navigation under the Pages base path", async ({
    page,
  }) => {
    await page.goto("vin");
    await page.locator("main").getByRole("textbox").fill(KNOWN_GOOD_VIN);
    await page.getByRole("button", { name: "Decode VIN" }).click();

    await expect(
      page.getByRole("heading", { name: /2003 HONDA Accord/i }),
    ).toBeVisible();

    const browseParts = page.getByRole("link", { name: /Browse HONDA Parts/i });
    await expect(browseParts).toHaveAttribute(
      "href",
      `${BASE_PATH}catalog/honda`,
    );
    await browseParts.click();
    await expect(page).toHaveURL(new RegExp(`${BASE_PATH}catalog/honda$`));
    await expect(
      page.getByRole("heading", { name: "Honda", exact: true }),
    ).toBeVisible();

    const catalogNav = page
      .locator("header")
      .getByRole("link", { name: "Catalog", exact: true });
    await expect(catalogNav).toHaveAttribute("href", `${BASE_PATH}catalog`);
    await catalogNav.click();
    await expect(page).toHaveURL(new RegExp(`${BASE_PATH}catalog$`));
    await expect(
      page.getByRole("heading", { name: "Browse by Brand" }),
    ).toBeVisible();

    const brandCards = page.locator('[class*="brandCard"]');
    await expect(brandCards.first()).toBeVisible();
    const hrefs = await brandCards.evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("href")),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(new RegExp(`^${BASE_PATH}catalog/[^/]+$`));
    }

    await brandCards.first().click();
    await expect(page).toHaveURL(new RegExp(`${BASE_PATH}catalog/[^/]+$`));
  });
});

test.describe("prerendered metadata", () => {
  test("serves route metadata without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const routes = [
      {
        path: "",
        title: "AutoParts — VIN Decoder & Vehicle Catalog",
        description:
          "Decode a VIN free and explore vehicle specifications and parts catalogs for automotive brands.",
      },
      {
        path: "vin",
        title: "VIN Decoder — AutoParts",
        description:
          "Decode a 17-character VIN with the free NHTSA vPIC database to see make, model, year, engine, trim, and plant details.",
      },
      {
        path: "catalog",
        title: "Vehicle Catalog — AutoParts",
        description:
          "Browse automotive brands and models by region to find your vehicle, then decode its VIN for exact specifications.",
      },
      {
        path: "catalog/honda",
        title: "Honda Models & Parts — AutoParts",
        description:
          "Browse Honda models and model years. Decode a Honda VIN to identify the exact trim, engine, and options.",
      },
      {
        path: "not-a-real-page",
        title: "Page Not Found — AutoParts",
        description:
          "The page you requested could not be found. Return to AutoParts to decode a VIN or browse the vehicle catalog.",
      },
    ];

    try {
      for (const route of routes) {
        const response = await page.goto(`${PAGES_URL}${route.path}`, {
          waitUntil: "domcontentloaded",
        });
        expect(await page.title()).toBe(route.title);

        const meta = page.locator('meta[name="description"]');
        await expect(meta).toHaveCount(1);
        expect(await meta.getAttribute("content")).toBe(route.description);
        expect(response?.status()).toBe(
          route.path === "not-a-real-page" ? 404 : 200,
        );
      }
    } finally {
      await context.close();
    }
  });
});
