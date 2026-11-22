/**
 * The 15 unique Audi VINs from the fleet sheet used for the My Garage pass.
 *
 * `sheetModel` is the label the sheet used. `expectedModel` is what the VIN
 * model code resolves to: GY/FJ/FZ come from Audi's NHTSA 2027 VIN breakdown;
 * HC is Audi's European A2 e-tron series. Two sheet rows labelled HC as
 * "E3 CUV", which is not a documented Audi model, so the app does not claim it.
 */
export interface AudiFleetVin {
  vin: string;
  year: string;
  code: 'GY' | 'FJ' | 'FZ' | 'HC';
  expectedModel: string;
  sheetModel: string;
}

export const AUDI_FLEET_VINS: AudiFleetVin[] = [
  { vin: 'WAUZZZHC2VA001164', year: '2027', code: 'HC', expectedModel: 'A2 e-tron', sheetModel: 'A2 e-tron' },
  { vin: 'WAUZZZHC4VA001005', year: '2027', code: 'HC', expectedModel: 'A2 e-tron', sheetModel: 'E3 CUV' },
  { vin: 'WAUZZZFJ2S1000156', year: '2025', code: 'FJ', expectedModel: 'Q3', sheetModel: 'Q3' },
  { vin: 'WAUZZZFJ2S1000190', year: '2025', code: 'FJ', expectedModel: 'Q3', sheetModel: 'Q3' },
  { vin: 'WAUZZZFJ5S1000362', year: '2025', code: 'FJ', expectedModel: 'Q3', sheetModel: 'Q3' },
  { vin: 'WAUZZZGY4WA900001', year: '2028', code: 'GY', expectedModel: 'A3/S3/RS 3', sheetModel: 'RS3' },
  { vin: 'WAUZZZGY5VA000149', year: '2027', code: 'GY', expectedModel: 'A3/S3/RS 3', sheetModel: 'S3' },
  { vin: 'WAUZZZGYXA000129', year: '', code: 'GY', expectedModel: '', sheetModel: 'A3' },
  { vin: 'WAUZZZGY8VA000212', year: '2027', code: 'GY', expectedModel: 'A3/S3/RS 3', sheetModel: 'A3/S3' },
  { vin: 'WAUZZZFZ6VP000054', year: '2027', code: 'FZ', expectedModel: 'Q4 e-tron', sheetModel: 'Q4 Sportback e-tron' },
  { vin: 'WAUZZZFZ6VP000023', year: '2027', code: 'FZ', expectedModel: 'Q4 e-tron', sheetModel: 'Q4 Sportback e-tron' },
  { vin: 'WAUZZZFZ3VP000013', year: '2027', code: 'FZ', expectedModel: 'Q4 e-tron', sheetModel: 'Q4 e-tron' },
  { vin: 'WAUZZZFZ5VP000062', year: '2027', code: 'FZ', expectedModel: 'Q4 e-tron', sheetModel: 'Q4 e-tron' },
  { vin: 'WAUZZZHCZWA000019', year: '2028', code: 'HC', expectedModel: 'A2 e-tron', sheetModel: 'E3 CUV' },
  { vin: 'WAUZZZFJ4V1000163', year: '2027', code: 'FJ', expectedModel: 'Q3', sheetModel: 'Q3' },
];
