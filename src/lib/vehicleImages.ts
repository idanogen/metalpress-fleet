/**
 * Maps Hebrew vehicle model strings to { make, model } for image lookup.
 * Uses imagin.studio CDN for car renders.
 */

interface CarInfo {
  make: string;
  model: string;
}

// Keyword-based mapping: Hebrew brand keyword → English make
const BRAND_MAP: [string, string][] = [
  ['סקודה', 'Skoda'],
  ['טויוטה', 'Toyota'],
  ['קיה', 'Kia'],
  ['צ\'רי', 'Chery'],
  ['פיג\'ו', 'Peugeot'],
  ['פייגו', 'Peugeot'],
  ['פיגו', 'Peugeot'],
  ['רנו', 'Renault'],
  ['דאציה', 'Dacia'],
  ['מזדה', 'Mazda'],
  ['מ.ג', 'MG'],
  ['סיטרואן', 'Citroen'],
  ['סיאט', 'Seat'],
  ['סוזוקי', 'Suzuki'],
  ['ניסאן', 'Nissan'],
  ['מיצובישי', 'Mitsubishi'],
  ['מיצובושי', 'Mitsubishi'],
  ['יונדאי', 'Hyundai'],
  ['ב מ וו', 'BMW'],
  ['טסלה', 'Tesla'],
  ['דודג\'', 'RAM'],
  ['איסוזו', 'Isuzu'],
  ['איווקו', 'Iveco'],
  ['מרצדס', 'Mercedes'],
  ['אופל', 'Opel'],
  ['בי ווי די', 'BYD'],
  ['ג\'יפ', 'Jeep'],
  ['גילי', 'Geely'],
  ['אקספנג', 'Xpeng'],
  ['רובר', 'Land Rover'],
];

// Model keyword → English model family
const MODEL_MAP: Record<string, Record<string, string>> = {
  Skoda: {
    'OCTAVIA': 'Octavia',
    'FABIA': 'Fabia',
    'KAROQ': 'Karoq',
    'KODIAQ': 'Kodiaq',
    'אוקטביה': 'Octavia',
    'סופרב': 'Superb',
    'פאביה': 'Fabia',
  },
  Toyota: {
    'COROLLA': 'Corolla',
    'RAV4': 'RAV4',
    'YARIS': 'Yaris Cross',
  },
  Kia: {
    'SPORTAGE': 'Sportage',
    'ספורטאז': 'Sportage',
    'ספורטז': 'Sportage',
    'PICANTO': 'Picanto',
    'SELTOS': 'Seltos',
  },
  Chery: {
    'TIGGO 8 PRO': 'Tiggo 8 Pro',
    'TIGGO 7 PRO': 'Tiggo 7 Pro',
    'TIGGO 8': 'Tiggo 8',
    'טיגו 8': 'Tiggo 8',
    'ARRIZO': 'Arrizo 8',
    'FX': 'FX',
  },
  Peugeot: {
    '3008': '3008',
    '5008': '5008',
    'אקטיב': '5008',
  },
  Renault: {
    'ARKANA': 'Arkana',
    'ארקנה': 'Arkana',
    'CAPTUR': 'Captur',
    'דסטר': 'Duster',
    'KANGOO': 'Kangoo',
  },
  Dacia: {
    'DOKKER': 'Dokker',
    'DUSTER': 'Duster',
  },
  Mazda: {
    'CX-30': 'CX-30',
    'CX-5': 'CX-5',
    'MAZDA 2': 'Mazda2',
  },
  MG: {
    'MG4': 'MG4',
    'MG5': 'MG5',
  },
  Citroen: {
    'C4': 'C4',
    'ברלינגו': 'Berlingo',
    'BERLINGO': 'Berlingo',
  },
  Seat: {
    'ATECA': 'Ateca',
    'אטקה': 'Ateca',
  },
  Mitsubishi: {
    'OUTLANDER': 'Outlander',
    'L200': 'L200',
  },
  BMW: {
    'Z4': 'Z4',
    'X3': 'X3',
  },
  Tesla: {
    'MODEL S': 'Model S',
    'MODEL 3': 'Model 3',
  },
  Isuzu: {
    'NPR': 'NPR',
    'D-MAX': 'D-Max',
  },
  Mercedes: {
    'SPRINTER': 'Sprinter',
    'GLA': 'GLA',
  },
  Hyundai: {
    'i20': 'i20',
    'I20': 'i20',
  },
};

// Default model per brand when we can't determine specific model
const DEFAULT_MODEL: Record<string, string> = {
  Skoda: 'Octavia',
  Toyota: 'Corolla',
  Kia: 'Sportage',
  Chery: 'Tiggo 8',
  Peugeot: '3008',
  Renault: 'Captur',
  Dacia: 'Duster',
  Mazda: 'CX-5',
  MG: 'MG4',
  Citroen: 'C4',
  Seat: 'Ateca',
  Suzuki: 'Swift',
  Nissan: 'X-Trail',
  Mitsubishi: 'Outlander',
  Hyundai: 'i20',
  BMW: 'X3',
  Tesla: 'Model 3',
  RAM: '1500',
  Isuzu: 'D-Max',
  Iveco: 'Daily',
  Mercedes: 'Sprinter',
  Opel: 'Combo',
  BYD: 'Atto 3',
  Jeep: 'Grand Cherokee',
  Geely: 'Coolray',
  Xpeng: 'G6',
  'Land Rover': 'Discovery',
};

// Exact string overrides for tricky model names
const EXACT_OVERRIDES: Record<string, CarInfo> = {
  'BERLINGO': { make: 'Citroen', model: 'Berlingo' },
  'KANGOO': { make: 'Renault', model: 'Kangoo' },
  'GLA200': { make: 'Mercedes', model: 'GLA' },
  'byd': { make: 'BYD', model: 'Atto 3' },
  'TIGGO 7 PRO': { make: 'Chery', model: 'Tiggo 7 Pro' },
};

export function parseVehicleModel(hebrewModel: string): CarInfo {
  // Check exact overrides first
  const trimmed = hebrewModel.trim();
  if (EXACT_OVERRIDES[trimmed]) {
    return EXACT_OVERRIDES[trimmed];
  }

  // Find brand
  let make = '';
  for (const [keyword, brand] of BRAND_MAP) {
    if (trimmed.includes(keyword)) {
      make = brand;
      break;
    }
  }

  if (!make) {
    return { make: 'Generic', model: 'Car' };
  }

  // Find model within the brand's model map
  const brandModels = MODEL_MAP[make];
  if (brandModels) {
    const upperModel = trimmed.toUpperCase();
    for (const [keyword, modelName] of Object.entries(brandModels)) {
      if (upperModel.includes(keyword.toUpperCase())) {
        return { make, model: modelName };
      }
    }
  }

  // Fallback to default model for brand
  return { make, model: DEFAULT_MODEL[make] || 'Car' };
}

const IMAGE_CUSTOMER = 'hrjavascript-mastery';

export function getVehicleImageUrl(hebrewModel: string): string {
  const { make, model } = parseVehicleModel(hebrewModel);

  if (make === 'Generic') {
    return '';
  }

  return `https://cdn.imagin.studio/getimage?customer=${IMAGE_CUSTOMER}&make=${encodeURIComponent(make)}&modelFamily=${encodeURIComponent(model)}&zoomType=fullscreen&angle=23&width=200`;
}

// Brand accent colors — visible tints for image backgrounds
const BRAND_COLORS: Record<string, { bg: string; border: string }> = {
  Skoda:       { bg: 'rgba(52, 199, 89, 0.15)',   border: 'rgba(52, 199, 89, 0.35)' },   // green
  Toyota:      { bg: 'rgba(255, 59, 48, 0.12)',   border: 'rgba(255, 59, 48, 0.3)' },    // red
  Kia:         { bg: 'rgba(0, 122, 255, 0.12)',   border: 'rgba(0, 122, 255, 0.3)' },    // blue
  Chery:       { bg: 'rgba(175, 82, 222, 0.12)',  border: 'rgba(175, 82, 222, 0.3)' },   // purple
  Peugeot:     { bg: 'rgba(0, 80, 180, 0.14)',    border: 'rgba(0, 80, 180, 0.35)' },    // deep blue
  Renault:     { bg: 'rgba(255, 190, 0, 0.15)',   border: 'rgba(255, 190, 0, 0.35)' },   // yellow
  Dacia:       { bg: 'rgba(0, 140, 110, 0.12)',   border: 'rgba(0, 140, 110, 0.3)' },    // teal
  Mazda:       { bg: 'rgba(200, 16, 46, 0.12)',   border: 'rgba(200, 16, 46, 0.3)' },    // crimson
  MG:          { bg: 'rgba(255, 59, 48, 0.12)',   border: 'rgba(255, 59, 48, 0.3)' },    // red
  Citroen:     { bg: 'rgba(255, 149, 0, 0.14)',   border: 'rgba(255, 149, 0, 0.35)' },   // orange
  Seat:        { bg: 'rgba(180, 83, 9, 0.12)',    border: 'rgba(180, 83, 9, 0.3)' },     // copper
  Suzuki:      { bg: 'rgba(0, 122, 255, 0.12)',   border: 'rgba(0, 122, 255, 0.3)' },    // blue
  Nissan:      { bg: 'rgba(200, 16, 46, 0.12)',   border: 'rgba(200, 16, 46, 0.3)' },    // red
  Mitsubishi:  { bg: 'rgba(255, 45, 85, 0.12)',   border: 'rgba(255, 45, 85, 0.3)' },    // pink-red
  Hyundai:     { bg: 'rgba(0, 44, 95, 0.14)',     border: 'rgba(0, 44, 95, 0.3)' },      // navy
  BMW:         { bg: 'rgba(0, 122, 255, 0.14)',   border: 'rgba(0, 122, 255, 0.35)' },   // blue
  Tesla:       { bg: 'rgba(200, 16, 46, 0.12)',   border: 'rgba(200, 16, 46, 0.3)' },    // red
  RAM:         { bg: 'rgba(30, 30, 30, 0.12)',    border: 'rgba(30, 30, 30, 0.25)' },    // dark
  Isuzu:       { bg: 'rgba(200, 16, 46, 0.12)',   border: 'rgba(200, 16, 46, 0.3)' },    // red
  Iveco:       { bg: 'rgba(0, 44, 95, 0.14)',     border: 'rgba(0, 44, 95, 0.3)' },      // navy
  Mercedes:    { bg: 'rgba(30, 30, 30, 0.1)',     border: 'rgba(30, 30, 30, 0.25)' },    // silver/dark
  Opel:        { bg: 'rgba(255, 190, 0, 0.15)',   border: 'rgba(255, 190, 0, 0.35)' },   // yellow
  BYD:         { bg: 'rgba(0, 122, 255, 0.12)',   border: 'rgba(0, 122, 255, 0.3)' },    // blue
  Jeep:        { bg: 'rgba(52, 78, 37, 0.14)',    border: 'rgba(52, 78, 37, 0.3)' },     // army green
  Geely:       { bg: 'rgba(0, 44, 95, 0.14)',     border: 'rgba(0, 44, 95, 0.3)' },      // navy
  Xpeng:       { bg: 'rgba(255, 149, 0, 0.14)',   border: 'rgba(255, 149, 0, 0.35)' },   // orange
  'Land Rover':{ bg: 'rgba(52, 78, 37, 0.15)',    border: 'rgba(52, 78, 37, 0.35)' },    // british green
};

const DEFAULT_BRAND_COLOR = { bg: 'rgba(0, 0, 0, 0.03)', border: 'rgba(0, 0, 0, 0.08)' };

export function getBrandColor(hebrewModel: string): { bg: string; border: string } {
  const { make } = getVehicleInfo(hebrewModel);
  return BRAND_COLORS[make] || DEFAULT_BRAND_COLOR;
}

// Cache for parsed models to avoid re-parsing
const modelCache = new Map<string, CarInfo>();

export function getVehicleInfo(hebrewModel: string): CarInfo {
  if (!modelCache.has(hebrewModel)) {
    modelCache.set(hebrewModel, parseVehicleModel(hebrewModel));
  }
  return modelCache.get(hebrewModel)!;
}
