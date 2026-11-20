import { test, expect } from '@playwright/test';
import {
  extractVinCandidates,
  hasValidVinCheckDigit,
  normalizeVinOcrText,
  sanitizeVinInput,
  suggestVinCorrections,
} from '../src/services/vinOcr';

const VALID_VIN = '1HGCM82633A004352';
const INVALID_CHECK_DIGIT_VIN = '2HGFC2F59LH500001';
const OI_CONFUSED_INVALID_READ = 'IHGCMB2633AOO4352';
const OI_NORMALIZED_INVALID_VIN = '1HGCMB2633A004352';

test.describe('VIN OCR character normalization', () => {
  test('normalizes O to 0 and I to 1 before extracting candidates', () => {
    const raw = 'IHGCM82633AOO4352';

    expect(normalizeVinOcrText(raw)).toBe(VALID_VIN);

    const candidates = extractVinCandidates(`VIN: ${raw}`);
    expect(candidates[0]).toEqual({ vin: VALID_VIN, validCheckDigit: true });
    expect(hasValidVinCheckDigit(candidates[0].vin)).toBe(true);
  });

  test('normalizes O and I reads before suggesting a check-digit correction', () => {
    expect(normalizeVinOcrText(OI_CONFUSED_INVALID_READ)).toBe(OI_NORMALIZED_INVALID_VIN);

    const [candidate] = extractVinCandidates(OI_CONFUSED_INVALID_READ);
    expect(candidate).toEqual({
      vin: OI_NORMALIZED_INVALID_VIN,
      validCheckDigit: false,
    });

    const suggestions = suggestVinCorrections(OI_CONFUSED_INVALID_READ);
    expect(suggestions.map(suggestion => suggestion.vin)).toContain(VALID_VIN);
    expect(suggestions.every(suggestion => suggestion.validCheckDigit)).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  test('normalizes lowercase text and Q to 0 while preserving valid U characters', () => {
    expect(normalizeVinOcrText('q i o')).toBe('0 1 0');
    expect(normalizeVinOcrText('u')).toBe('U');
    expect(sanitizeVinInput(' ihgcm82633aoo4352! ')).toBe(VALID_VIN);
    expect(sanitizeVinInput('1hgcm82633u004352')).toBe('1HGCM82633U004352');
  });

  test('falls back to line scanning when the VIN contains spaces', () => {
    const candidates = extractVinCandidates('VIN: 1HG CM826 33A004352');
    expect(candidates.some(candidate => candidate.vin === VALID_VIN)).toBe(true);
  });

  test('does not extract VIN-shaped windows from ordinary words', () => {
    expect(extractVinCandidates('Honda Civic owner photo')).toEqual([]);
  });

  test('returns no corrections when the VIN check digit is already valid', () => {
    expect(suggestVinCorrections(VALID_VIN)).toEqual([]);
  });

  test('keeps VINs from separate OCR lines as separate candidates', () => {
    const candidates = extractVinCandidates(
      `Door jamb: ${INVALID_CHECK_DIGIT_VIN}\nWindshield: ${VALID_VIN}`,
    );

    expect(candidates[0].vin).toBe(VALID_VIN);
    expect(candidates.some(candidate => candidate.vin === INVALID_CHECK_DIGIT_VIN)).toBe(true);
    expect(candidates.every(candidate => candidate.vin.length === 17)).toBe(true);
  });
});
