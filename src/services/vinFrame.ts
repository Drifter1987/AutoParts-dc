const MAX_OCR_WIDTH = 1600;
const MAX_OCR_SCALE = 2;
const CROP_WIDTH_RATIO = 0.9;
const CROP_HEIGHT_RATIO = 0.36;
const CONTRAST = 1.25;

const QUALITY_WIDTH = 48;
const QUALITY_HEIGHT = 27;
const DARK_BRIGHTNESS = 62;
const BRIGHT_BRIGHTNESS = 205;
const BLUR_SHARPNESS = 6;

export type VinFrameQualityLevel = 'good' | 'low-light' | 'too-bright' | 'blurry';

export interface VinFrameQuality {
  level: VinFrameQualityLevel;
  message: string;
  brightness: number;
  sharpness: number;
  signature: Uint8ClampedArray;
}

const QUALITY_MESSAGES: Record<VinFrameQualityLevel, string> = {
  good: 'Ready — hold the VIN inside the frame.',
  'low-light': 'Too dark — add light, then hold the VIN inside the frame.',
  'too-bright': 'Too much glare — angle away from direct light.',
  blurry: 'Hold steady and let the camera focus.',
};

function renderOcrCanvas(
  source: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  cropWidth: number,
  cropHeight: number,
): HTMLCanvasElement {
  const scale = Math.min(MAX_OCR_SCALE, MAX_OCR_WIDTH / cropWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable');
  context.drawImage(
    source,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const luminance = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    const value = Math.min(255, Math.max(0, (luminance - 128) * CONTRAST + 128));
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

interface VinCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function ratioCrop(width: number, height: number): VinCrop {
  const cropWidth = Math.max(1, Math.round(width * CROP_WIDTH_RATIO));
  const cropHeight = Math.max(1, Math.round(height * CROP_HEIGHT_RATIO));
  return {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

/**
 * Map the on-screen guide back into source pixels. `object-fit: cover` crops
 * the preview on narrow screens, so the guide and the captured crop would
 * otherwise disagree even though both use the same percentage region.
 */
function guideCrop(video: HTMLVideoElement, guide: HTMLElement): VinCrop | null {
  const videoRect = video.getBoundingClientRect();
  const guideRect = guide.getBoundingClientRect();
  if (!videoRect.width || !videoRect.height) return null;

  // The video uses object-fit: cover, so both axes share one scale.
  const scale = Math.max(
    videoRect.width / video.videoWidth,
    videoRect.height / video.videoHeight,
  );
  const contentWidth = video.videoWidth * scale;
  const contentHeight = video.videoHeight * scale;
  const contentLeft = videoRect.left + (videoRect.width - contentWidth) / 2;
  const contentTop = videoRect.top + (videoRect.height - contentHeight) / 2;
  const x = (guideRect.left - contentLeft) / scale;
  const y = (guideRect.top - contentTop) / scale;
  const width = guideRect.width / scale;
  const height = guideRect.height / scale;
  if (!width || !height) return null;

  const left = Math.max(0, Math.min(video.videoWidth - 1, x));
  const top = Math.max(0, Math.min(video.videoHeight - 1, y));
  const right = Math.min(video.videoWidth, Math.max(left + 1, x + width));
  const bottom = Math.min(video.videoHeight, Math.max(top + 1, y + height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Crop the guided VIN area and normalize it for OCR. */
export function createVinOcrCanvas(
  video: HTMLVideoElement,
  guide?: HTMLElement | null,
): HTMLCanvasElement {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error('Camera frame is not ready');

  const crop = (guide && guideCrop(video, guide)) || ratioCrop(width, height);
  return renderOcrCanvas(video, crop.x, crop.y, crop.width, crop.height);
}

/** Normalize a whole uploaded photo; the VIN can be anywhere in the frame. */
export function createVinOcrCanvasFromImage(image: HTMLImageElement): HTMLCanvasElement {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error('Photo is not ready');
  return renderOcrCanvas(image, 0, 0, width, height);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Photo could not be loaded'));
    image.src = url;
  });
}

export async function createVinOcrCanvasFromFile(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return createVinOcrCanvasFromImage(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Lightweight, low-resolution sample of the guided area. It powers the live
 * quality hint and the steady-frame check used by auto-read.
 */
export function measureVinFrameQuality(
  video: HTMLVideoElement,
  guide?: HTMLElement | null,
): VinFrameQuality | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const crop = (guide && guideCrop(video, guide)) || ratioCrop(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = QUALITY_WIDTH;
  canvas.height = QUALITY_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    QUALITY_WIDTH,
    QUALITY_HEIGHT,
  );
  const { data } = context.getImageData(0, 0, QUALITY_WIDTH, QUALITY_HEIGHT);
  const luminance = new Uint8ClampedArray(QUALITY_WIDTH * QUALITY_HEIGHT);
  let brightnessTotal = 0;

  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
    const value = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    luminance[pixel] = value;
    brightnessTotal += value;
  }
  const brightness = brightnessTotal / luminance.length;

  let gradientTotal = 0;
  for (let y = 0; y < QUALITY_HEIGHT; y += 1) {
    for (let x = 0; x < QUALITY_WIDTH; x += 1) {
      const index = y * QUALITY_WIDTH + x;
      if (x > 0) gradientTotal += Math.abs(luminance[index] - luminance[index - 1]);
      if (y > 0) gradientTotal += Math.abs(luminance[index] - luminance[index - QUALITY_WIDTH]);
    }
  }
  const sharpness = gradientTotal / (luminance.length * 2);

  let level: VinFrameQualityLevel = 'good';
  if (brightness < DARK_BRIGHTNESS) level = 'low-light';
  else if (brightness > BRIGHT_BRIGHTNESS) level = 'too-bright';
  else if (sharpness < BLUR_SHARPNESS) level = 'blurry';

  return {
    level,
    message: QUALITY_MESSAGES[level],
    brightness,
    sharpness,
    signature: luminance,
  };
}

/** Mean absolute luminance change between two samples (0-255). */
export function frameSignatureDelta(
  previous: Uint8ClampedArray,
  next: Uint8ClampedArray,
): number {
  if (!previous.length || previous.length !== next.length) return 255;
  let total = 0;
  for (let i = 0; i < previous.length; i += 1) {
    total += Math.abs(previous[i] - next[i]);
  }
  return total / previous.length;
}
