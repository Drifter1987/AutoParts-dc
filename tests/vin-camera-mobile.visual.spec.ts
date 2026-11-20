import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const VALID_VIN = '1HGCM82633A004352';
const OCR_TEXT = '1HGCMB2633A004352';
const OUT_DIR = 'test-results/vin-camera-mobile';

type VisualWindow = Window & {
  __mockOcrText?: string;
  __lastOcrFrame?: { width: number; height: number };
};

async function stubOcr(page: Page): Promise<void> {
  await page.route(/tesseract__js\.js/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        export default {
          async createWorker() {
            return {
              async recognize(image) {
                window.__lastOcrFrame = { width: image.width, height: image.height };
                return { data: { text: window.__mockOcrText || '' } };
              },
              async terminate() {},
            };
          }
        };
      `,
    }),
  );
}

async function mockCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as VisualWindow).__mockOcrText = '';
    Object.defineProperty(window, 'BarcodeDetector', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.fillStyle = '#9a9a9a';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111111';
      context.font = 'bold 64px "Courier New", monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('1HGCMB2633A004352', canvas.width / 2, canvas.height / 2);
      return canvas.captureStream(2);
    };
  });
}

test('mobile camera dialog guide and OCR suggestions', async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  await stubOcr(page);
  await mockCamera(page);
  await stubNhtsa(page);
  await stubGoogleFonts(page);
  await page.goto('/vin');

  await page.evaluate(value => {
    (window as VisualWindow).__mockOcrText = value;
  }, OCR_TEXT);

  await page.getByRole('button', { name: 'Scan VIN with camera' }).click();
  const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const video = document.querySelector('video');
        return video?.videoWidth ?? 0;
      }),
    )
    .toBeGreaterThan(0);
  await expect(page.getByText('Ready — hold the VIN inside the frame.')).toBeVisible();

  const metrics = await page.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) throw new Error('video missing');
    const label = Array.from(document.querySelectorAll('span')).find(
      element => element.textContent === 'Align the VIN inside the frame',
    );
    const guide = label?.parentElement;
    if (!guide) throw new Error('guide missing');

    const videoRect = video.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();
    const modal = document.querySelector('[role="dialog"]')?.firstElementChild as HTMLElement | null;
    const modalRect = modal?.getBoundingClientRect();

    return {
      viewport: { width: innerWidth, height: innerHeight },
      objectFit: getComputedStyle(video).objectFit,
      video: {
        left: videoRect.left,
        top: videoRect.top,
        width: videoRect.width,
        height: videoRect.height,
        sourceWidth: video.videoWidth,
        sourceHeight: video.videoHeight,
      },
      guide: {
        left: guideRect.left,
        top: guideRect.top,
        width: guideRect.width,
        height: guideRect.height,
      },
      modal: modalRect
        ? {
            top: modalRect.top,
            bottom: modalRect.bottom,
            height: modalRect.height,
            fitsViewport: modalRect.top >= 0 && modalRect.bottom <= innerHeight,
          }
        : null,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  console.log('CAMERA_METRICS', JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: `${OUT_DIR}/camera-dialog.png` });

  await page.getByRole('button', { name: 'Read VIN text' }).click();
  const coverScale = Math.max(
    metrics.video.width / metrics.video.sourceWidth,
    metrics.video.height / metrics.video.sourceHeight,
  );
  const sourceCropWidth = metrics.guide.width / coverScale;
  const sourceCropHeight = metrics.guide.height / coverScale;
  const ocrScale = Math.min(2, 1600 / sourceCropWidth);
  const expectedFrame = {
    width: Math.round(sourceCropWidth * ocrScale),
    height: Math.round(sourceCropHeight * ocrScale),
  };
  const review = page.getByRole('group', { name: /Review the VIN read from the camera/i });
  await expect(review).toBeVisible();
  const frame = await page.evaluate(() => (window as VisualWindow).__lastOcrFrame);
  console.log('EXPECTED_OCR_FRAME', expectedFrame, 'ACTUAL', frame);
  const suggestion = review.getByRole('button', { name: VALID_VIN });
  await expect(suggestion).toBeVisible();
  await review.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);

  const reviewMetrics = await page.evaluate(vin => {
    const group = Array.from(document.querySelectorAll('[role="group"]')).find(element =>
      element.getAttribute('aria-label')?.includes('Review the VIN read from the camera'),
    );
    if (!group) throw new Error('review missing');
    const button = Array.from(group.querySelectorAll('button')).find(
      element => element.textContent?.trim() === vin,
    );
    if (!button) throw new Error('suggestion missing');
    const rect = group.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const input = group.querySelector('input');
    const inputRect = input?.getBoundingClientRect();

    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      review: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      input: inputRect
        ? { left: inputRect.left, top: inputRect.top, width: inputRect.width, height: inputRect.height }
        : null,
      suggestion: {
        left: buttonRect.left,
        top: buttonRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      },
      suggestionInViewport:
        buttonRect.left >= 0 &&
        buttonRect.top >= 0 &&
        buttonRect.right <= innerWidth &&
        buttonRect.bottom <= innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      allSuggestionLabels: Array.from(group.querySelectorAll('button')).map(element =>
        element.textContent?.trim(),
      ),
    };
  }, VALID_VIN);
  console.log('REVIEW_METRICS', JSON.stringify(reviewMetrics, null, 2));

  await page.screenshot({ path: `${OUT_DIR}/ocr-review.png` });

  await suggestion.click();
  await expect(review.getByRole('textbox', { name: 'VIN read from the camera' })).toHaveValue(
    VALID_VIN,
  );
  await page.screenshot({ path: `${OUT_DIR}/ocr-review-corrected.png` });

  expect(metrics.scrollWidth).toBeLessThanOrEqual(390);
  expect(metrics.modal?.fitsViewport).toBe(true);
  expect(Math.abs((frame?.width ?? 0) - expectedFrame.width)).toBeLessThanOrEqual(2);
  expect(Math.abs((frame?.height ?? 0) - expectedFrame.height)).toBeLessThanOrEqual(2);
  expect(reviewMetrics.suggestionInViewport).toBe(true);
  expect(reviewMetrics.suggestion.height).toBeGreaterThanOrEqual(44);
  expect(reviewMetrics.suggestion.width).toBeGreaterThanOrEqual(44);
  expect(reviewMetrics.horizontalOverflow).toBe(false);
});

test('keeps the camera actions reachable on a short screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await stubOcr(page);
  await mockCamera(page);
  await stubNhtsa(page);
  await stubGoogleFonts(page);
  await page.goto('/vin');

  await page.getByRole('button', { name: 'Scan VIN with camera' }).click();
  const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const video = document.querySelector('video');
        return video?.videoWidth ?? 0;
      }),
    )
    .toBeGreaterThan(0);

  for (const name of ['Switch camera', 'Use a photo', 'Read VIN text', 'Cancel']) {
    const button = dialog.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeInViewport();
    await expect(button).toBeEnabled();
  }

  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
