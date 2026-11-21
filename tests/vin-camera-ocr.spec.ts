import { test, expect, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

const VALID_VIN = '1HGCM82633A004352';
const INVALID_CHECK_DIGIT_VIN = '2HGFC2F59LH500001';

const QUALITY_CASES: Array<{ mode: CameraFrameMode; label: string; message: string }> = [
  {
    mode: 'dark',
    label: 'too-dark',
    message: 'Too dark — add light, then hold the VIN inside the frame.',
  },
  {
    mode: 'bright',
    label: 'too-bright',
    message: 'Too much glare — angle away from direct light.',
  },
  {
    mode: 'blurry',
    label: 'blurry',
    message: 'Hold steady and let the camera focus.',
  },
];

type CameraFrameMode = 'good' | 'dark' | 'bright' | 'blurry';

interface OcrTestState {
  hold: boolean;
  started: number;
  settled: boolean;
  release: (() => void) | null;
}

type CameraTestWindow = Window & {
  __mockOcrText?: string;
  __cameraErrorName?: string;
  __lastOcrFrame?: { width: number; height: number; pixel: number[] | null };
  __lastFacingMode?: string;
  __failFacingMode?: string;
  __failTorch?: boolean;
  __torchApplied?: unknown;
  __ocr?: OcrTestState;
  __setCameraFrame?: (mode: CameraFrameMode) => void;
  __lastCameraStream?: MediaStream;
  __lastCameraTrack?: MediaStreamTrack;
  __revokeCameraPermission?: () => void;
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
                const state = window.__ocr;
                state.started += 1;
                try {
                  const context = image.getContext('2d');
                  const pixel = context?.getImageData(8, 8, 1, 1).data;
                  window.__lastOcrFrame = {
                    width: image.width,
                    height: image.height,
                    pixel: pixel ? [pixel[0], pixel[1], pixel[2], pixel[3]] : null,
                  };
                  const text = window.__mockOcrText || '';
                  if (state.hold) {
                    await new Promise(resolve => {
                      state.release = resolve;
                    });
                  }
                  return { data: { text } };
                } finally {
                  state.settled = true;
                }
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
    const testWindow = window as CameraTestWindow;
    testWindow.__mockOcrText = '';
    testWindow.__cameraErrorName = '';
    testWindow.__lastFacingMode = '';
    testWindow.__failFacingMode = '';
    testWindow.__failTorch = false;
    testWindow.__torchApplied = null;
    testWindow.__ocr = {
      hold: false,
      started: 0,
      settled: false,
      release: null,
    };
    testWindow.__setCameraFrame = undefined;
    testWindow.__lastCameraStream = undefined;
    testWindow.__lastCameraTrack = undefined;
    testWindow.__revokeCameraPermission = undefined;

    const permissionListeners = new Set<(event: Event) => void>();
    const permissionStatus = {
      state: 'granted',
      addEventListener: (_type: string, listener: (event: Event) => void) => {
        permissionListeners.add(listener);
      },
      removeEventListener: (_type: string, listener: (event: Event) => void) => {
        permissionListeners.delete(listener);
      },
    };
    const permissions = navigator.permissions;
    if (permissions) {
      const originalQuery = permissions.query.bind(permissions);
      Object.defineProperty(permissions, 'query', {
        configurable: true,
        value: (descriptor: PermissionDescriptor) =>
          descriptor.name === 'camera'
            ? Promise.resolve(permissionStatus)
            : originalQuery(descriptor),
      });
    }
    testWindow.__revokeCameraPermission = () => {
      permissionStatus.state = 'denied';
      permissionListeners.forEach(listener => listener(new Event('change')));
    };

    // Tests exercise the OCR and fallback paths deterministically. Individual
    // tests install a fake BarcodeDetector when they need the barcode path.
    Object.defineProperty(window, 'BarcodeDetector', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      if (testWindow.__cameraErrorName) {
        throw new DOMException('Camera test error', testWindow.__cameraErrorName);
      }

      const video = constraints?.video;
      let facing = 'environment';
      if (video && typeof video === 'object') {
        const desired = (video as MediaTrackConstraints).facingMode;
        facing = typeof desired === 'string' ? desired : desired?.ideal ?? 'environment';
      }
      if (testWindow.__failFacingMode && facing === testWindow.__failFacingMode) {
        throw new DOMException('Camera test error', 'OverconstrainedError');
      }
      testWindow.__lastFacingMode = String(facing);

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');

      const drawFrame = (mode: CameraFrameMode) => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (mode === 'dark') {
          context.fillStyle = '#050505';
          context.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }
        if (mode === 'bright') {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }
        context.fillStyle = '#9a9a9a';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (mode === 'good') {
          context.fillStyle = '#111111';
          context.font = 'bold 64px "Courier New", monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText('1HGCM82633A004352', canvas.width / 2, canvas.height / 2);
        }
      };
      drawFrame('good');

      const stream = canvas.captureStream(2);
      const track = stream.getVideoTracks()[0];
      testWindow.__lastCameraStream = stream;
      testWindow.__lastCameraTrack = track;
      testWindow.__setCameraFrame = mode => drawFrame(mode);
      if (track) {
        Object.defineProperty(track, 'getCapabilities', {
          configurable: true,
          value: () => ({ torch: true }),
        });
        Object.defineProperty(track, 'applyConstraints', {
          configurable: true,
          value: async (next: unknown) => {
            if (testWindow.__failTorch) {
              throw new DOMException('Torch test error', 'NotSupportedError');
            }
            testWindow.__torchApplied = next;
          },
        });
      }
      return stream;
    };
  });
}

async function setOcrText(page: Page, text: string): Promise<void> {
  await page.evaluate(value => {
    (window as CameraTestWindow).__mockOcrText = value;
  }, text);
}

async function setCameraErrorName(page: Page, name: string): Promise<void> {
  await page.evaluate(value => {
    (window as CameraTestWindow).__cameraErrorName = value;
  }, name);
}

async function setFailFacingMode(page: Page, mode: string): Promise<void> {
  await page.evaluate(value => {
    (window as CameraTestWindow).__failFacingMode = value;
  }, mode);
}

async function installBarcodeDetector(
  page: Page,
  formats: string[] = ['code_39'],
): Promise<void> {
  await page.evaluate(supportedFormats => {
    class MockBarcodeDetector {
      static async getSupportedFormats() {
        return supportedFormats;
      }

      async detect() {
        return [{ rawValue: '1HGCM82633A004352' }];
      }
    }

    Object.defineProperty(window, 'BarcodeDetector', {
      value: MockBarcodeDetector,
      configurable: true,
      writable: true,
    });
  }, formats);
}

async function openCamera(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Scan VIN with camera' }).click();
  await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const video = document.querySelector('video');
        return video?.videoWidth ?? 0;
      }),
    )
    .toBeGreaterThan(0);
}

function reviewGroup(page: Page) {
  return page.getByRole('group', { name: /Review the VIN read from the camera/i });
}

function reviewInput(page: Page) {
  return page.getByRole('textbox', { name: 'VIN read from the camera' });
}

function vinInput(page: Page) {
  return page.getByRole('textbox', { name: 'Vehicle Identification Number (VIN)' });
}

async function makePhotoPng(page: Page, text = ''): Promise<Buffer> {
  const dataUrl = await page.evaluate(photoText => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 300;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (photoText) {
      context.fillStyle = '#111111';
      context.font = 'bold 72px "Courier New", monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(photoText, canvas.width / 2, canvas.height / 2);
    }
    return canvas.toDataURL('image/png');
  }, text);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test.describe('VIN camera OCR', () => {
  test.beforeEach(async ({ page }) => {
    await stubOcr(page);
    await mockCamera(page);
    await stubNhtsa(page);
    await stubGoogleFonts(page);
    await page.goto('/vin');
  });

  test('accepts an OCR result with a valid check digit', async ({ page }) => {
    await setOcrText(page, VALID_VIN);
    await openCamera(page);
    await expect(page.getByText('Align the VIN inside the frame')).toBeVisible();

    await page.getByRole('button', { name: 'Read VIN text' }).click();

    const review = reviewGroup(page);
    await expect(review).toBeVisible();
    await expect(reviewInput(page)).toHaveValue(VALID_VIN);
    await expect(
      review.getByText('Check digit is valid — still confirm it matches the door jamb.'),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toHaveCount(0);

    const frame = await page.evaluate(() => (window as CameraTestWindow).__lastOcrFrame);
    expect(frame?.width).toBe(1600);
    expect(frame?.height).toBeLessThan(500);
    expect(frame?.pixel?.[0]).toBe(frame?.pixel?.[1]);
    expect(frame?.pixel?.[1]).toBe(frame?.pixel?.[2]);

    await page.getByRole('button', { name: 'Use this VIN' }).click();
    await expect(vinInput(page)).toHaveValue(VALID_VIN);
    await expect(review).toHaveCount(0);
  });

  test('normalizes O and I confusions before extracting the VIN', async ({ page }) => {
    await setOcrText(page, 'IHGCM82633AOO4352');
    await openCamera(page);

    await page.getByRole('button', { name: 'Read VIN text' }).click();

    await expect(reviewGroup(page)).toBeVisible();
    await expect(reviewInput(page)).toHaveValue(VALID_VIN);
    await expect(reviewGroup(page).getByText(/Check digit is valid/)).toBeVisible();
  });

  test('suggests a correction for an O/I-confused OCR read', async ({ page }) => {
    await setOcrText(page, 'IHGCMB2633AOO4352');
    await openCamera(page);

    await page.getByRole('button', { name: 'Read VIN text' }).click();

    const review = reviewGroup(page);
    await expect(review).toBeVisible();
    await expect(reviewInput(page)).toHaveValue('1HGCMB2633A004352');
    await expect(review.getByText('Possible correction if a character was misread:')).toBeVisible();

    const suggestion = review.getByRole('button', { name: VALID_VIN });
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    await expect(reviewInput(page)).toHaveValue(VALID_VIN);
    await expect(review.getByText(/Check digit is valid/)).toBeVisible();
    await expect(review.getByText(/Check digit does not validate/)).toHaveCount(0);
  });

  test('shows an advisory for an OCR result with an invalid check digit', async ({ page }) => {
    await setOcrText(page, INVALID_CHECK_DIGIT_VIN);
    await openCamera(page);

    await page.getByRole('button', { name: 'Read VIN text' }).click();

    const review = reviewGroup(page);
    await expect(review).toBeVisible();
    await expect(reviewInput(page)).toHaveValue(INVALID_CHECK_DIGIT_VIN);
    await expect(
      review.getByText('Check digit does not validate. Compare every character before using it.'),
    ).toBeVisible();
    await expect(review.getByText(/Check digit is valid/)).toHaveCount(0);
  });

  test('suggests a check-digit correction for a plausible OCR confusion', async ({ page }) => {
    await setOcrText(page, '1HGCMB2633A004352');
    await openCamera(page);

    await page.getByRole('button', { name: 'Read VIN text' }).click();

    const review = reviewGroup(page);
    await expect(review).toBeVisible();
    await expect(review.getByText('Possible correction if a character was misread:')).toBeVisible();
    const suggestion = review.getByRole('button', { name: VALID_VIN });
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    await expect(reviewInput(page)).toHaveValue(VALID_VIN);
    await expect(review.getByText(/Check digit is valid/)).toBeVisible();
    await expect(review.getByText(/Check digit does not validate/)).toHaveCount(0);
  });

  test('lets the user edit the OCR VIN and validates the edit', async ({ page }) => {
    await setOcrText(page, INVALID_CHECK_DIGIT_VIN);
    await openCamera(page);

    await page.getByRole('button', { name: 'Read VIN text' }).click();
    await expect(reviewInput(page)).toHaveValue(INVALID_CHECK_DIGIT_VIN);

    await reviewInput(page).fill(VALID_VIN);

    await expect(reviewGroup(page).getByText(/Check digit is valid/)).toBeVisible();
    await page.getByRole('button', { name: 'Use this VIN' }).click();
    await expect(vinInput(page)).toHaveValue(VALID_VIN);
  });

  test('offers alternate VIN reads from the same image', async ({ page }) => {
    await setOcrText(page, `${INVALID_CHECK_DIGIT_VIN}\n${VALID_VIN}`);
    await openCamera(page);

    await page.getByRole('button', { name: 'Read VIN text' }).click();

    const review = reviewGroup(page);
    await expect(reviewInput(page)).toHaveValue(VALID_VIN);
    await expect(review.getByText('Other reads from this image:')).toBeVisible();
    await review.getByRole('button', { name: INVALID_CHECK_DIGIT_VIN }).click();

    await expect(reviewInput(page)).toHaveValue(INVALID_CHECK_DIGIT_VIN);
    await expect(review.getByText(/Check digit does not validate/)).toBeVisible();
  });

  test('shows the no-VIN error inside the open camera dialog', async ({ page }) => {
    await setOcrText(page, 'NOT A VIN');
    await openCamera(page);

    await page.getByRole('button', { name: 'Read VIN text' }).click();

    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toHaveText(
      'No VIN-like text was found. Align the VIN inside the frame, avoid glare, and try again.',
    );
    await expect(reviewGroup(page)).toHaveCount(0);
  });

  test('cancels in-flight OCR without a late review or error', async ({ page }) => {
    await setOcrText(page, VALID_VIN);
    await page.evaluate(() => {
      const state = (window as CameraTestWindow).__ocr;
      if (!state) throw new Error('OCR test state missing');
      state.hold = true;
    });

    await openCamera(page);
    await page.getByRole('button', { name: 'Read VIN text' }).click();

    await expect
      .poll(() => page.evaluate(() => Boolean((window as CameraTestWindow).__ocr?.release)))
      .toBe(true);

    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await page.evaluate(() => (window as CameraTestWindow).__ocr?.settled ?? false)).toBe(
      false,
    );

    // Release the held recognition only after the dialog has closed, then wait
    // for it to settle so a late state update cannot hide behind a sleep.
    await page.evaluate(() => {
      const state = (window as CameraTestWindow).__ocr;
      if (!state?.release) throw new Error('OCR hold was not installed');
      state.release();
    });
    await expect
      .poll(() => page.evaluate(() => (window as CameraTestWindow).__ocr?.settled ?? false))
      .toBe(true);
    await page.evaluate(
      () =>
        new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    await expect(dialog).toHaveCount(0);
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(/No VIN-like text was found/)).toHaveCount(0);
    await expect(page.getByText(/OCR could not read this image/)).toHaveCount(0);
  });

  test('closing for a retake aborts the active OCR without leaking into the new session', async ({
    page,
  }) => {
    await setOcrText(page, VALID_VIN);
    await page.evaluate(() => {
      const state = (window as CameraTestWindow).__ocr;
      if (!state) throw new Error('OCR test state missing');
      state.hold = true;
    });

    await openCamera(page);
    await page.getByRole('button', { name: 'Read VIN text' }).click();
    await expect
      .poll(() => page.evaluate(() => Boolean((window as CameraTestWindow).__ocr?.release)))
      .toBe(true);

    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
    await dialog.getByRole('button', { name: 'Cancel VIN camera scan' }).click();
    await expect(dialog).toHaveCount(0);

    // Retake by reopening the scanner while the first recognition is still held.
    await page.getByRole('button', { name: 'Scan VIN with camera' }).click();
    const retakeDialog = page.getByRole('dialog', { name: 'Read a VIN' });
    await expect(retakeDialog).toBeVisible();

    await page.evaluate(() => {
      const state = (window as CameraTestWindow).__ocr;
      if (!state?.release) throw new Error('OCR hold was not installed');
      state.release();
    });
    await expect
      .poll(() => page.evaluate(() => (window as CameraTestWindow).__ocr?.settled ?? false))
      .toBe(true);
    await page.evaluate(
      () =>
        new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    await expect(retakeDialog).toBeVisible();
    await expect(retakeDialog.getByRole('button', { name: 'Read VIN text' })).toBeEnabled();
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(/No VIN-like text was found/)).toHaveCount(0);
    await expect(page.getByText(/OCR could not read this image/)).toHaveCount(0);
  });

  test('explains a blocked camera permission and can retry', async ({ page }) => {
    await setCameraErrorName(page, 'NotAllowedError');

    await page.getByRole('button', { name: 'Scan VIN with camera' }).click();

    await expect(
      page.getByText(
        'Camera permission is blocked. Allow camera access in your browser settings, then try again, or enter the VIN manually.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scan VIN with camera' })).toBeEnabled();

    await setCameraErrorName(page, '');
    await openCamera(page);
    await expect(page.getByRole('button', { name: 'Read VIN text' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('explains when no camera is available', async ({ page }) => {
    await setCameraErrorName(page, 'NotFoundError');
    await page.getByRole('button', { name: 'Scan VIN with camera' }).click();

    await expect(
      page.getByText('No camera was found. Connect a camera or enter the VIN manually.'),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toHaveCount(0);
  });

  test('explains when the camera is in use or cannot start', async ({ page }) => {
    await setCameraErrorName(page, 'NotReadableError');
    await page.getByRole('button', { name: 'Scan VIN with camera' }).click();

    await expect(
      page.getByText(
        'The camera is in use or could not start. Close other apps using it, then try again, or enter the VIN manually.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toHaveCount(0);
  });

  test('traps focus in the camera dialog and closes on Escape', async ({ page }) => {
    await openCamera(page);

    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
    await expect(dialog).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel VIN camera scan' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scan VIN with camera' })).toBeFocused();
  });

  test('keeps keyboard focus in the VIN input through a decode', async ({ page }) => {
    const input = vinInput(page);
    await input.focus();
    await page.keyboard.type(INVALID_CHECK_DIGIT_VIN);
    await expect(input).toHaveValue(INVALID_CHECK_DIGIT_VIN);

    await page.keyboard.press('Enter');

    // The scan animation and the NHTSA request must not move focus out of the field.
    await expect(input).toHaveAttribute('aria-busy', 'true');
    await expect(input).toBeFocused();

    await expect(page.getByRole('heading', { name: /2020 HONDA Civic/i })).toBeVisible();
    await expect(input).toBeFocused();
    await expect(
      page.getByRole('status').filter({ hasText: /Decoded 2020 HONDA Civic/ }),
    ).toBeVisible();

    // Tab continues from the input to its submit button instead of restarting at the top.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Decode VIN' })).toBeFocused();
  });

  test('clears a stale OCR review when the URL VIN changes', async ({ page }) => {
    await setOcrText(page, VALID_VIN);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'vin.png',
      mimeType: 'image/png',
      buffer: await makePhotoPng(page, VALID_VIN),
    });
    await expect(reviewGroup(page)).toBeVisible();

    const headerSearch = page.getByPlaceholder('VIN, part #, or model...');
    await headerSearch.fill(INVALID_CHECK_DIGIT_VIN);
    await headerSearch.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/vin\\?vin=${INVALID_CHECK_DIGIT_VIN}$`));
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(vinInput(page)).toHaveValue(INVALID_CHECK_DIGIT_VIN);
  });

  test('wraps Shift+Tab inside the camera dialog from the container', async ({ page }) => {
    await openCamera(page);
    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
    await expect(dialog).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel VIN camera scan' })).toBeFocused();
  });

  test('pulls keyboard focus back into the camera dialog after focus is lost', async ({ page }) => {
    await openCamera(page);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel VIN camera scan' })).toBeFocused();

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  });

  test('switches between the rear and front cameras', async ({ page }) => {
    await openCamera(page);
    expect(await page.evaluate(() => (window as CameraTestWindow).__lastFacingMode)).toBe(
      'environment',
    );

    await page.getByRole('button', { name: 'Switch camera' }).click();

    await expect
      .poll(() => page.evaluate(() => (window as CameraTestWindow).__lastFacingMode))
      .toBe('user');
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toBeVisible();
  });

  test('keeps the current camera when switching fails', async ({ page }) => {
    await openCamera(page);
    await setFailFacingMode(page, 'user');

    await page.getByRole('button', { name: 'Switch camera' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      'That camera could not be started. Keep using the current view, switch back, or enter the VIN manually.',
    );
    await expect(page.getByRole('button', { name: 'Read VIN text' })).toBeVisible();
    expect(await page.evaluate(() => (window as CameraTestWindow).__lastFacingMode)).toBe(
      'environment',
    );
  });

  test('shows a recovery path when the camera track ends mid-preview', async ({ page }) => {
    await openCamera(page);
    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });

    await page.evaluate(() => {
      (window as CameraTestWindow).__lastCameraTrack?.dispatchEvent(new Event('ended'));
    });

    await expect(dialog.getByText('Camera feed stopped')).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText(
      'The camera stopped. Reconnect the camera, check that it is not in use by another app, or use a photo.',
    );
    await expect(dialog.getByRole('button', { name: 'Read VIN text' })).toBeDisabled();

    const reconnect = dialog.getByRole('button', { name: 'Reconnect camera' });
    await expect(reconnect).toBeVisible();
    await reconnect.click();

    await expect(dialog.getByText('Camera feed stopped')).toHaveCount(0);
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const video = document.querySelector('video');
          return video?.videoWidth ?? 0;
        }),
      )
      .toBeGreaterThan(0);
  });

  test('shows a recovery path when camera permission is revoked mid-preview', async ({ page }) => {
    await openCamera(page);
    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });

    await page.evaluate(() => {
      (window as CameraTestWindow).__revokeCameraPermission?.();
    });

    await expect(dialog.getByText('Camera feed stopped')).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText(
      'Camera access was revoked. Allow camera access in your browser settings, then reconnect or use a photo.',
    );
    await expect(dialog.getByRole('button', { name: 'Reconnect camera' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Read VIN text' })).toBeDisabled();
  });

  test('toggles the torch when the camera exposes it', async ({ page }) => {
    await openCamera(page);

    const torchButton = page.getByRole('button', { name: 'Turn on torch' });
    await expect(torchButton).toBeVisible();
    await torchButton.click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const applied = (window as CameraTestWindow).__torchApplied as
            | { advanced?: Array<{ torch?: boolean }> }
            | null;
          return applied?.advanced?.[0]?.torch ?? null;
        }),
      )
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Turn off torch' })).toBeVisible();
  });

  test('hides the torch and keeps the preview when activation fails', async ({ page }) => {
    await openCamera(page);
    const dialog = page.getByRole('dialog', { name: 'Read a VIN' });
    const video = dialog.locator('video');

    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate(element => element.videoWidth)).toBeGreaterThan(0);
    await expect(dialog.getByRole('button', { name: 'Turn on torch' })).toBeVisible();

    await page.evaluate(() => {
      (window as CameraTestWindow).__failTorch = true;
    });
    await dialog.getByRole('button', { name: 'Turn on torch' }).click();

    await expect(
      dialog.getByText('The torch is not available on this camera.'),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Turn on torch' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Turn off torch' })).toHaveCount(0);
    expect(await page.evaluate(() => (window as CameraTestWindow).__torchApplied)).toBeNull();

    await expect(dialog).toBeVisible();
    await expect(video).toBeVisible();
    expect(await video.evaluate(element => element.videoWidth)).toBeGreaterThan(0);
    expect(await video.evaluate(element => element.videoHeight)).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => {
        const stream = (window as CameraTestWindow).__lastCameraStream;
        const track = stream?.getVideoTracks()[0];
        return { active: stream?.active ?? false, readyState: track?.readyState ?? 'ended' };
      }),
    ).toEqual({ active: true, readyState: 'live' });
    await expect(dialog.getByRole('button', { name: 'Read VIN text' })).toBeEnabled();
  });

  test('shows live image-quality feedback in the camera dialog', async ({ page }) => {
    await openCamera(page);

    await expect(page.getByText('Ready — hold the VIN inside the frame.')).toBeVisible();
    await expect(
      page.getByText('Camera frames are processed on this device; no image is uploaded.'),
    ).toBeVisible();
  });

  for (const { mode, label, message } of QUALITY_CASES) {
    test(`shows ${label} quality feedback without auto-reading`, async ({ page }) => {
      await setOcrText(page, VALID_VIN);
      await page.evaluate(() => {
        const state = (window as CameraTestWindow).__ocr;
        if (!state) throw new Error('OCR test state missing');
        state.hold = true;
        state.started = 0;
      });

      await openCamera(page);
      await expect(page.getByText('Ready — hold the VIN inside the frame.')).toBeVisible();

      await page.evaluate(frameMode => {
        const setFrame = (window as CameraTestWindow).__setCameraFrame;
        if (!setFrame) throw new Error('Camera frame setter missing');
        setFrame(frameMode);
      }, mode);
      await expect(page.getByText(message)).toBeVisible();

      await page.getByRole('checkbox', { name: 'Auto-read when steady' }).check();
      await page.waitForTimeout(1800);

      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toBeVisible();
      await expect(reviewGroup(page)).toHaveCount(0);
      expect(await page.evaluate(() => (window as CameraTestWindow).__ocr?.started ?? 0)).toBe(0);
    });
  }

  test('auto-reads a steady frame when auto-read is enabled', async ({ page }) => {
    await setOcrText(page, VALID_VIN);
    await openCamera(page);

    await page.getByRole('checkbox', { name: 'Auto-read when steady' }).check();

    await expect(reviewGroup(page)).toBeVisible();
    await expect(reviewInput(page)).toHaveValue(VALID_VIN);
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toHaveCount(0);
  });

  test('explains when BarcodeDetector is unavailable', async ({ page }) => {
    await openCamera(page);

    await expect(page.getByText(/Barcode scanning isn/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Read VIN text' })).toBeVisible();
  });

  test('explains when Code 39 barcode detection is unsupported', async ({ page }) => {
    await installBarcodeDetector(page, ['qr_code']);
    await openCamera(page);

    await expect(page.getByText(/Barcode scanning isn/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Read VIN text' })).toBeVisible();
  });

  test('accepts a Code 39 barcode after two matching reads', async ({ page }) => {
    await installBarcodeDetector(page);
    await openCamera(page);

    await expect(vinInput(page)).toHaveValue(VALID_VIN);
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toHaveCount(0);
  });

  test('reads a VIN from an uploaded photo when the camera is unavailable', async ({ page }) => {
    await setOcrText(page, VALID_VIN);

    await page.locator('input[type="file"]').setInputFiles({
      name: 'vin.png',
      mimeType: 'image/png',
      buffer: await makePhotoPng(page, VALID_VIN),
    });

    await expect(reviewGroup(page)).toBeVisible();
    await expect(reviewInput(page)).toHaveValue(VALID_VIN);
    await expect(page.getByRole('dialog', { name: 'Read a VIN' })).toHaveCount(0);
  });

  test('reports a photo with no VIN-like text', async ({ page }) => {
    await setOcrText(page, 'Honda Civic owner photo');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'no-vin.png',
      mimeType: 'image/png',
      buffer: await makePhotoPng(page, 'Honda Civic'),
    });

    await expect(
      page.getByText(
        'No VIN-like text was found in that photo. Try a closer, sharper photo without glare, or enter the VIN manually.',
      ),
    ).toBeVisible();
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload a VIN photo' })).toBeEnabled();
  });

  test('reports a corrupt photo and restores the uploader', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'corrupt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not actually a PNG'),
    });

    await expect(
      page.getByText('That photo could not be read. Try another image with the VIN in focus.'),
    ).toBeVisible();
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload a VIN photo' })).toBeEnabled();
    await expect(page.getByText('Preparing photo…')).toHaveCount(0);
  });

  test('reports an unsupported file and restores the uploader', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'vin.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('1HGCM82633A004352'),
    });

    await expect(
      page.getByText(
        "That file type isn't supported. Use a JPEG, PNG, WebP, GIF, AVIF, or BMP image, or enter the VIN manually.",
      ),
    ).toBeVisible();
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload a VIN photo' })).toBeEnabled();
  });

  test('rejects an oversized photo before reading it', async ({ page }) => {
    await setOcrText(page, VALID_VIN);

    await page.locator('input[type="file"]').setInputFiles({
      name: 'oversized.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(12 * 1024 * 1024 + 1),
    });

    await expect(
      page.getByText(
        'That photo is too large. Choose an image under 12 MB, or enter the VIN manually.',
      ),
    ).toBeVisible();
    await expect(reviewGroup(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload a VIN photo' })).toBeEnabled();
    expect(await page.evaluate(() => (window as CameraTestWindow).__ocr?.started ?? 0)).toBe(0);
  });
});
