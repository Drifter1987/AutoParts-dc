import { test, expect } from "@playwright/test";
import { stubGoogleFonts } from "./google-fonts-stubs";
import { stubNhtsa } from "./nhtsa-stubs";

const PAGES_URL = "https://drifter1987.github.io/AutoParts-dc/";
const BASE_PATH = "/AutoParts-dc/";

// The live Pages build now carries the P1-04 copy. Set
// PAGES_EXPECT_PRE_P1_04=1 only when checking an older deployment.
const EXPECT_PRE_P1_04 = process.env.PAGES_EXPECT_PRE_P1_04 === "1";
const HOME_METADATA = EXPECT_PRE_P1_04
  ? {
      title: "AutoParts — VIN Decoder & Vehicle Catalog",
      description:
        "Decode a VIN free and explore vehicle specifications and parts catalogs for automotive brands.",
    }
  : {
      title: "AutoParts — VIN Decoder & Safety Report",
      description:
        "Decode a VIN with NHTSA, check model-year recalls and complaints, and browse the published 2020 Honda Civic parts slice.",
    };
const CIVIC_2020_VIN = "2HGFC2F59LH500001";

test.describe("deployed GitHub Pages", () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
    await stubNhtsa(page);
  });

  test("decodes a VIN and keeps catalog navigation under the Pages base path", async ({
    page,
  }) => {
    await page.goto("vin");
    await page.locator("main").getByRole("textbox").fill(CIVIC_2020_VIN);
    await page.getByRole("button", { name: "Decode VIN" }).click();

    await expect(
      page.getByRole("heading", { name: /2020 HONDA Civic EX/i }),
    ).toBeVisible();

    const browseParts = page.getByRole("link", { name: /Browse 2020 Honda Civic Parts/i });
    await expect(browseParts).toHaveAttribute(
      "href",
      new RegExp(`^${BASE_PATH}catalog/honda/civic/2020\\?vin=${CIVIC_2020_VIN}`),
    );
    await browseParts.click();
    await expect(page).toHaveURL(new RegExp(`${BASE_PATH}catalog/honda/civic/2020`));
    await expect(
      page.getByRole("heading", { name: "2020 Honda Civic Parts" }),
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
    if (EXPECT_PRE_P1_04) {
      test.info().annotations.push({
        type: "environment",
        description:
          "Checking an older deployed Pages build; Home metadata expects the pre-P1-04 copy.",
      });
    }

    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const routes = [
      {
        path: "",
        title: HOME_METADATA.title,
        description: HOME_METADATA.description,
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
          "Browse 63 active automotive brands and 1249 models with production years and EPA-sourced engine options, then decode a VIN. The live parts slice currently covers the 2020 Honda Civic.",
      },
      {
        path: "catalog/honda",
        title: "Honda Models & Parts — AutoParts",
        description:
          "Browse the Honda brand and model preview. Decode a Honda VIN to identify the exact trim, engine, and options; live parts data is called out on supported models.",
      },
      {
        path: "catalog/honda/civic/2020",
        title: "2020 Honda Civic Parts — AutoParts",
        description:
          "Browse representative 2020 Honda Civic assemblies and 36 OEM-reference parts. Check fitment, copy part numbers, and verify with a dealer.",
      },
      {
        path: "catalog/honda/civic/2020/brakes",
        title: "2020 Honda Civic Brakes Parts — AutoParts",
        description:
          "9 representative 2020 Honda Civic brakes parts with OEM/reference numbers, fitment notes, and supersession references.",
      },
      {
        path: "catalog/honda/civic/2020/brakes/front-brake-pads",
        title: "Front Brake Pad Set — 2020 Honda Civic — AutoParts",
        description:
          "Front Brake Pad Set (OEM 45022-TBA-A00) for 2020 Honda Civic. Fitment notes, supersessions, interchange references, and provenance. Verify fitment with a dealer.",
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
