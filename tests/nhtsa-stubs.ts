import type { Page } from '@playwright/test';

interface DecodeFixture {
  Make: string;
  Model: string;
  ModelYear: string;
  Trim: string;
  EngineModel: string;
  FuelTypePrimary: string;
  TransmissionStyle: string;
  DriveType: string;
  BodyClass: string;
  Doors: string;
  PlantCountry: string;
  PlantCity: string;
  VehicleType: string;
  Series: string;
  DisplacementL: string;
  EngineCylinders: string;
  ErrorCode: string;
  ErrorText: string;
}

const EMPTY_DECODE: DecodeFixture = {
  Make: '',
  Model: '',
  ModelYear: '',
  Trim: '',
  EngineModel: '',
  FuelTypePrimary: '',
  TransmissionStyle: '',
  DriveType: '',
  BodyClass: '',
  Doors: '',
  PlantCountry: '',
  PlantCity: '',
  VehicleType: '',
  Series: '',
  DisplacementL: '',
  EngineCylinders: '',
  ErrorCode: '',
  ErrorText: '',
};

const DECODE_FIXTURES: Record<string, Partial<DecodeFixture>> = {
  '1HGCM82633A004352': {
    Make: 'HONDA',
    Model: 'Accord',
    ModelYear: '2003',
    Trim: 'EX',
    EngineModel: '3.0L V6',
    FuelTypePrimary: 'Gasoline',
    TransmissionStyle: 'Automatic',
    DriveType: 'FWD',
    BodyClass: 'Sedan',
    Doors: '4',
    PlantCountry: 'UNITED STATES (USA)',
    PlantCity: 'MARYSVILLE',
    VehicleType: 'PASSENGER CAR',
    Series: 'Accord',
    DisplacementL: '3.0',
    EngineCylinders: '6',
    ErrorCode: '0',
    ErrorText: '0 - VIN decoded clean. Check Digit (9th position) is correct.',
  },
  '2HGFC2F59LH500001': {
    Make: 'HONDA',
    Model: 'Civic',
    ModelYear: '2020',
    Trim: 'EX',
    EngineModel: '1.5L Turbo',
    FuelTypePrimary: 'Gasoline',
    TransmissionStyle: 'CVT',
    DriveType: 'FWD',
    BodyClass: 'Sedan',
    Doors: '4',
    PlantCountry: 'CANADA',
    PlantCity: 'ALLISTON',
    VehicleType: 'PASSENGER CAR',
    Series: 'Civic',
    DisplacementL: '1.5',
    EngineCylinders: '4',
    ErrorCode: '0',
    ErrorText: '0 - VIN decoded clean. Check Digit (9th position) is correct.',
  },
  '4T1BF3EK8AU561547': {
    Make: 'TOYOTA',
    Model: 'Camry',
    ModelYear: '2010',
    Trim: 'LE',
    EngineModel: '2.5L In-Line 4',
    FuelTypePrimary: 'Gasoline',
    TransmissionStyle: 'Automatic',
    DriveType: 'FWD',
    BodyClass: 'Sedan',
    Doors: '4',
    PlantCountry: 'UNITED STATES (USA)',
    PlantCity: 'GEORGETOWN',
    VehicleType: 'PASSENGER CAR',
    Series: 'Camry',
    DisplacementL: '2.5',
    EngineCylinders: '4',
    ErrorCode: '1',
    ErrorText: '1 - Check Digit (9th position) does not calculate properly.',
  },
  '00000000000000000': {
    ErrorCode: '6',
    ErrorText: '6 - Incomplete VIN.',
  },
};

const MAKES = [
  { MakeId: 474, MakeName: 'HONDA' },
  { MakeId: 448, MakeName: 'TOYOTA' },
  { MakeId: 482, MakeName: 'VOLKSWAGEN' },
  { MakeId: 485, MakeName: 'VOLVO' },
  { MakeId: 486, MakeName: 'SAAB' },
];

interface ModelFixture {
  Model_ID: number;
  Model_Name: string;
  Make_ID: number;
  Make_Name: string;
}

const MODELS: Record<string, ModelFixture[]> = {
  '474': [
    { Model_ID: 1861, Model_Name: 'Civic', Make_ID: 474, Make_Name: 'HONDA' },
    { Model_ID: 1862, Model_Name: 'Accord', Make_ID: 474, Make_Name: 'HONDA' },
    { Model_ID: 1863, Model_Name: 'CR-V', Make_ID: 474, Make_Name: 'HONDA' },
  ],
  '474:2020': [
    { Model_ID: 1861, Model_Name: 'Civic', Make_ID: 474, Make_Name: 'HONDA' },
    { Model_ID: 1862, Model_Name: 'Accord', Make_ID: 474, Make_Name: 'HONDA' },
  ],
  '485': [
    { Model_ID: 9001, Model_Name: 'XC90', Make_ID: 485, Make_Name: 'VOLVO' },
  ],
  '486': [
    { Model_ID: 9002, Model_Name: '900', Make_ID: 486, Make_Name: 'SAAB' },
  ],
};

function vinFromPath(pathname: string, endpoint: string): string {
  return pathname.split(`/${endpoint}/`)[1]?.split('/')[0]?.toUpperCase() ?? '';
}

/** Intercept every NHTSA vPIC call the VIN page makes, including manual makes. */
export async function stubNhtsa(page: Page): Promise<void> {
  await page.route(/^https:\/\/api\.nhtsa\.gov\/complaints\//, async route => {
    await route.fulfill({
      json: {
        Count: 1,
        results: [
          {
            odiNumber: 11345678,
            dateComplaintFiled: '2021-04-12',
            components: 'FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP',
            summary: 'Vehicle stalled while driving; fuel pump was replaced.',
            crash: false,
            fire: false,
            numberOfInjuries: 0,
            numberOfDeaths: 0,
          },
        ],
      },
    });
  });

  await page.route(/^https:\/\/api\.nhtsa\.gov\/recalls\//, async route => {
    await route.fulfill({
      json: {
        Count: 1,
        Message: 'Results returned successfully',
        results: [
          {
            Manufacturer: 'Honda (American Honda Motor Co.)',
            NHTSACampaignNumber: '21V215000',
            parkIt: false,
            parkOutSide: false,
            overTheAirUpdate: false,
            ReportReceivedDate: '25/03/2021',
            Component: 'FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP',
            Summary: 'The low-pressure fuel pump inside the fuel tank may fail.',
            Consequence: 'Fuel pump failure can cause an engine stall while driving.',
            Remedy: 'Honda will replace the fuel pump assembly free of charge.',
          },
        ],
      },
    });
  });

  await page.route(/^https:\/\/vpic\.nhtsa\.dot\.gov\/api\/vehicles\//, async route => {
    const { pathname } = new URL(route.request().url());

    if (pathname.includes('/DecodeVinValues/')) {
      const vin = vinFromPath(pathname, 'DecodeVinValues');
      const result = { ...EMPTY_DECODE, ...DECODE_FIXTURES[vin] };
      await route.fulfill({
        json: {
          Count: 1,
          Message: 'Results returned successfully',
          Results: [result],
        },
      });
      return;
    }

    if (pathname.includes('/DecodeVin/')) {
      const vin = vinFromPath(pathname, 'DecodeVin');
      const fixture = DECODE_FIXTURES[vin];
      const results = fixture
        ? [
            { Variable: 'Make', Value: fixture.Make ?? '', VariableId: 26 },
            { Variable: 'Model', Value: fixture.Model ?? '', VariableId: 28 },
            { Variable: 'Model Year', Value: fixture.ModelYear ?? '', VariableId: 29 },
            { Variable: 'Body Class', Value: fixture.BodyClass ?? '', VariableId: 5 },
          ].filter(item => item.Value)
        : [];
      await route.fulfill({ json: { Results: results } });
      return;
    }

    const yearModels = pathname.match(/\/GetModelsForMakeIdYear\/makeId\/(\d+)\/modelyear\/(\d+)/);
    if (yearModels) {
      const results = MODELS[`${yearModels[1]}:${yearModels[2]}`] ?? [];
      await route.fulfill({
        json: { Count: results.length, Message: 'Results returned successfully', Results: results },
      });
      return;
    }

    const makeModels = pathname.match(/\/GetModelsForMakeId\/(\d+)/);
    if (makeModels) {
      const results = MODELS[makeModels[1]] ?? [];
      await route.fulfill({
        json: { Count: results.length, Message: 'Results returned successfully', Results: results },
      });
      return;
    }

    if (pathname.includes('/GetMakesForVehicleType/car')) {
      await route.fulfill({
        json: {
          Count: MAKES.length,
          Message: 'Results returned successfully',
          Results: MAKES,
        },
      });
      return;
    }

    await route.fulfill({ json: { Results: [] } });
  });
}
