/**
 * European Audi VIN model fallback.
 *
 * NHTSA vPIC returns the make and model year for many European Audi VINs but
 * leaves the model blank. Audi encodes the model line in VIN positions 7-8.
 * This table fills only that missing field; a model returned by NHTSA always
 * wins, and an unknown code is left blank rather than guessed.
 *
 * Sources:
 * - GY/FJ/FZ: NHTSA 2027 Audi VIN breakdown sheet, Volkswagen Group of America
 *   (21 Oct 2026), position 7-8 table.
 *   https://vpic.nhtsa.dot.gov/mid/home/displayfile/9016236d-7c38-4112-9964-60923753a16a
 * - HC: Audi's European HC series is the A2 e-tron (ADAC model catalogue).
 *   HC is not in NHTSA's US Audi sheet, so the note asks for verification.
 */

export interface EuropeanVinModel {
  make: string;
  model: string;
  /** The two model-code characters at VIN positions 7-8. */
  code: string;
  /** Shown to the user; explains the source and any uncertainty. */
  note: string;
}

const AUDI_MODEL_CODES: Record<string, { model: string; note: string }> = {
  GY: {
    model: 'A3/S3/RS 3',
    note: "Audi's 2027 VIN breakdown lists GY as the A3/S3/RS 3 line; the exact body is not encoded in these two characters.",
  },
  FJ: {
    model: 'Q3',
    note: "Audi's 2027 VIN breakdown lists FJ as the Q3 SUV.",
  },
  FZ: {
    model: 'Q4 e-tron',
    note: "Audi's 2027 VIN breakdown lists FZ as the Q4 e-tron SUV/Sportback.",
  },
  HC: {
    model: 'A2 e-tron',
    note: "Audi's European HC series is the A2 e-tron. HC is not in NHTSA's US Audi VIN sheet, so verify this model against the vehicle.",
  },
};

const AUDI_WMI = new Set(['WAU', 'WUA']);
const EUROPEAN_FILLER = 'ZZZ';

/**
 * Resolve an Audi model from a European-format VIN. Returns null for any VIN
 * that is not exactly 17 characters, is not an Audi WMI with the ZZZ filler,
 * or uses a model code this table does not know.
 */
export function inferEuropeanVinModel(vin: string): EuropeanVinModel | null {
  const clean = vin.trim().toUpperCase();
  if (clean.length !== 17) return null;
  if (!AUDI_WMI.has(clean.slice(0, 3))) return null;
  if (clean.slice(3, 6) !== EUROPEAN_FILLER) return null;

  const code = clean.slice(6, 8);
  const match = AUDI_MODEL_CODES[code];
  if (!match) return null;

  return {
    make: 'AUDI',
    model: match.model,
    code,
    note: match.note,
  };
}
