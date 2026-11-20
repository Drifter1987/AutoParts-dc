const VIN_LENGTH = 17;
const VIN_ALPHABET = /[A-HJ-NPR-Z0-9]/;

export interface VinCandidate {
  vin: string;
  validCheckDigit: boolean;
}

/**
 * VINs never contain I, O, or Q. OCR engines routinely substitute the
 * lookalike characters below, so normalize them before looking for windows.
 */
const OCR_CHARACTER_FIXES: Record<string, string> = {
  I: '1',
  O: '0',
  Q: '0',
};

export function normalizeVinOcrText(text: string): string {
  return text.toUpperCase().replace(/[IOQ]/g, char => OCR_CHARACTER_FIXES[char]);
}

/** Normalize and strip anything that cannot appear in a VIN. */
export function sanitizeVinInput(value: string): string {
  return normalizeVinOcrText(value)
    .replace(/[^A-HJ-NPR-Z0-9]/g, '')
    .slice(0, VIN_LENGTH);
}

/** Standard VIN check-digit algorithm (letters I, O, and Q are not valid). */
export function hasValidVinCheckDigit(vin: string): boolean {
  const clean = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) return false;

  const transliteration: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i += 1) {
    const char = clean[i];
    const value = /\d/.test(char) ? Number(char) : transliteration[char];
    if (value === undefined) return false;
    sum += value * weights[i];
  }
  const remainder = sum % 11;
  return clean[8] === (remainder === 10 ? 'X' : String(remainder));
}

function collectVinCandidates(
  compact: string,
  found: Map<string, VinCandidate>,
  boundaries?: { starts: Set<number>; ends: Set<number> },
): void {
  for (let i = 0; i <= compact.length - VIN_LENGTH; i += 1) {
    if (boundaries && (!boundaries.starts.has(i) || !boundaries.ends.has(i + VIN_LENGTH))) {
      continue;
    }
    const candidate = compact.slice(i, i + VIN_LENGTH);
    if (![...candidate].every(char => VIN_ALPHABET.test(char))) continue;
    if (found.has(candidate)) continue;
    found.set(candidate, {
      vin: candidate,
      validCheckDigit: hasValidVinCheckDigit(candidate),
    });
  }
}

/** Compact text while remembering word edges so ordinary prose cannot
 * accidentally contribute a VIN-shaped window. */
function compactWithBoundaries(text: string): {
  compact: string;
  starts: Set<number>;
  ends: Set<number>;
} {
  const tokens = text.split(/[^A-Z0-9]+/).filter(Boolean);
  const starts = new Set<number>();
  const ends = new Set<number>();
  let offset = 0;
  for (const token of tokens) {
    starts.add(offset);
    offset += token.length;
    ends.add(offset);
  }
  return { compact: tokens.join(''), starts, ends };
}

export function extractVinCandidates(text: string): VinCandidate[] {
  const normalized = normalizeVinOcrText(text);
  const found = new Map<string, VinCandidate>();

  // Prefer contiguous tokens so labels such as "VIN:" or "Door jamb" do not
  // merge into the candidate. These fallbacks cover spaced or wrapped VINs.
  for (const token of normalized.split(/[^A-Z0-9]+/)) {
    if (token.length >= VIN_LENGTH) collectVinCandidates(token, found);
  }
  if (found.size === 0) {
    for (const line of normalized.split(/[\r\n]+/)) {
      const compact = compactWithBoundaries(line);
      if (compact.compact.length >= VIN_LENGTH) {
        collectVinCandidates(compact.compact, found, compact);
      }
    }
  }
  if (found.size === 0) {
    const compact = compactWithBoundaries(normalized);
    if (compact.compact.length >= VIN_LENGTH) {
      collectVinCandidates(compact.compact, found, compact);
    }
  }

  return [...found.values()].sort(
    (a, b) => Number(b.validCheckDigit) - Number(a.validCheckDigit),
  );
}

const MAX_SUGGESTIONS = 3;

// Common photographed-VIN confusions. Each pair is bidirectional, so a read
// can be corrected from either direction.
const OCR_CONFUSIONS: Record<string, string[]> = {};
for (const [left, right] of [
  ['0', 'D'],
  ['7', 'T'],
  ['1', '7'],
  ['1', 'T'],
  ['1', 'L'],
  ['2', 'Z'],
  ['4', 'A'],
  ['5', 'S'],
  ['6', 'G'],
  ['8', 'B'],
] as const) {
  (OCR_CONFUSIONS[left] ??= []).push(right);
  (OCR_CONFUSIONS[right] ??= []).push(left);
}

export function suggestVinCorrections(vin: string): VinCandidate[] {
  const clean = sanitizeVinInput(vin);
  if (clean.length !== VIN_LENGTH || hasValidVinCheckDigit(clean)) return [];

  const corrections = new Map<string, VinCandidate>();
  for (let index = 0; index < clean.length; index += 1) {
    for (const replacement of OCR_CONFUSIONS[clean[index]] ?? []) {
      const candidate = `${clean.slice(0, index)}${replacement}${clean.slice(index + 1)}`;
      if (candidate !== clean && hasValidVinCheckDigit(candidate)) {
        corrections.set(candidate, { vin: candidate, validCheckDigit: true });
      }
    }
  }
  return [...corrections.values()].slice(0, MAX_SUGGESTIONS);
}

export interface OcrProgress {
  status: string;
  progress: number;
}

function createAbortError(): DOMException {
  return new DOMException('The OCR read was canceled.', 'AbortError');
}

/**
 * Tesseract is loaded only when the user asks for OCR, keeping the normal VIN
 * decoder network surface small. The language/worker data is downloaded by the
 * OCR engine on first use.
 */
export async function recognizeVinFromImage(
  image: HTMLCanvasElement,
  onProgress?: (status: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<VinCandidate[]> {
  if (signal?.aborted) throw createAbortError();

  const { createWorker } = await import('tesseract.js');
  if (signal?.aborted) throw createAbortError();

  let aborted = false;
  let rejectAbort: ((error: DOMException) => void) | null = null;
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const workerPromise = createWorker('eng', 1, {
    logger: message => {
      if (aborted) return;
      onProgress?.({
        status: message.status || 'Reading image',
        progress: typeof message.progress === 'number' ? message.progress : 0,
      });
    },
  });
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  const handleAbort = () => {
    aborted = true;
    rejectAbort?.(createAbortError());
    void worker?.terminate().catch(() => {});
  };
  signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    worker = await Promise.race([workerPromise, abortPromise]);
    if (aborted) throw createAbortError();
    const result = await Promise.race([worker.recognize(image), abortPromise]);
    if (aborted) throw createAbortError();
    return extractVinCandidates(result.data.text);
  } finally {
    signal?.removeEventListener('abort', handleAbort);
    if (worker) {
      await worker.terminate().catch(() => {});
    } else if (aborted) {
      // The worker may finish initializing after the read was canceled.
      void workerPromise.then(lateWorker => lateWorker.terminate()).catch(() => {});
    }
  }
}
