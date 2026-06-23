// ═══════════════════════════════════════════════════════════
//  OSM Building Classifier & Price Engine
// ═══════════════════════════════════════════════════════════

const BUILDING_PRICES = {
  // Жилые
  apartments:    { cost: 5000,     income: 5,     icon: '🏢', minLvl: 1, tier: 'residential' },
  residential:   { cost: 2000,     income: 2,     icon: '🏠', minLvl: 1, tier: 'residential' },
  house:         { cost: 1500,     income: 1.5,   icon: '🏡', minLvl: 1, tier: 'residential' },
  detached:      { cost: 3000,     income: 3,     icon: '🏡', minLvl: 1, tier: 'residential' },
  dormitory:     { cost: 2500,     income: 2.5,   icon: '🏘️', minLvl: 1, tier: 'residential' },
  // Коммерческие
  commercial:    { cost: 10000,    income: 10,    icon: '🏪', minLvl: 2, tier: 'commercial' },
  retail:        { cost: 8000,     income: 8,     icon: '🛍️', minLvl: 2, tier: 'commercial' },
  shop:          { cost: 6000,     income: 6,     icon: '🏪', minLvl: 2, tier: 'commercial' },
  supermarket:   { cost: 15000,    income: 15,    icon: '🛒', minLvl: 3, tier: 'commercial' },
  mall:          { cost: 80000,    income: 80,    icon: '🛍️', minLvl: 5, tier: 'landmark' },
  // Офисные
  office:        { cost: 20000,    income: 20,    icon: '🏦', minLvl: 3, tier: 'commercial' },
  industrial:    { cost: 25000,    income: 25,    icon: '🏭', minLvl: 4, tier: 'commercial' },
  warehouse:     { cost: 12000,    income: 12,    icon: '🏗️', minLvl: 3, tier: 'commercial' },
  // Общественные
  hotel:         { cost: 50000,    income: 50,    icon: '🏨', minLvl: 5, tier: 'landmark' },
  hospital:      { cost: 100000,   income: 100,   icon: '🏥', minLvl: 6, tier: 'landmark' },
  school:        { cost: 30000,    income: 30,    icon: '🏫', minLvl: 4, tier: 'commercial' },
  university:    { cost: 80000,    income: 80,    icon: '🎓', minLvl: 5, tier: 'landmark' },
  church:        { cost: 40000,    income: 40,    icon: '⛪', minLvl: 4, tier: 'landmark' },
  cathedral:     { cost: 500000,   income: 500,   icon: '⛪', minLvl: 8, tier: 'monument' },
  mosque:        { cost: 60000,    income: 60,    icon: '🕌', minLvl: 5, tier: 'landmark' },
  temple:        { cost: 70000,    income: 70,    icon: '🛕', minLvl: 5, tier: 'landmark' },
  // Развлечения
  stadium:       { cost: 200000,   income: 200,   icon: '🏟️', minLvl: 7, tier: 'landmark' },
  theatre:       { cost: 100000,   income: 100,   icon: '🎭', minLvl: 6, tier: 'landmark' },
  cinema:        { cost: 60000,    income: 60,    icon: '🎬', minLvl: 5, tier: 'landmark' },
  casino:        { cost: 500000,   income: 500,   icon: '🎰', minLvl: 8, tier: 'monument' },
  // Транспорт
  train_station: { cost: 150000,   income: 150,   icon: '🚉', minLvl: 6, tier: 'landmark' },
  airport:       { cost: 2000000,  income: 2000,  icon: '✈️', minLvl: 12, tier: 'monument' },
  // Amenity POI
  restaurant:    { cost: 3000,     income: 3,     icon: '🍽️', minLvl: 1, tier: 'commercial' },
  cafe:          { cost: 2000,     income: 2,     icon: '☕', minLvl: 1, tier: 'commercial' },
  bar:           { cost: 4000,     income: 4,     icon: '🍺', minLvl: 2, tier: 'commercial' },
  bank:          { cost: 30000,    income: 30,    icon: '🏦', minLvl: 4, tier: 'commercial' },
  pharmacy:      { cost: 8000,     income: 8,     icon: '💊', minLvl: 2, tier: 'commercial' },
  fuel:          { cost: 20000,    income: 20,    icon: '⛽', minLvl: 3, tier: 'commercial' },
  parking:       { cost: 15000,    income: 15,    icon: '🅿️', minLvl: 3, tier: 'commercial' },
  // Tourism / Historic — всегда landmark или monument
  attraction:    { cost: 500000,   income: 500,   icon: '🗺️', minLvl: 8,  tier: 'monument' },
  museum:        { cost: 200000,   income: 200,   icon: '🏛️', minLvl: 7,  tier: 'landmark' },
  monument:      { cost: 300000,   income: 300,   icon: '🗿', minLvl: 7,  tier: 'landmark' },
  castle:        { cost: 800000,   income: 800,   icon: '🏰', minLvl: 9,  tier: 'monument' },
  artwork:       { cost: 50000,    income: 50,    icon: '🎨', minLvl: 5,  tier: 'landmark' },
  viewpoint:     { cost: 100000,   income: 100,   icon: '👁️', minLvl: 6,  tier: 'landmark' },
  zoo:           { cost: 400000,   income: 400,   icon: '🦁', minLvl: 7,  tier: 'landmark' },
  theme_park:    { cost: 800000,   income: 800,   icon: '🎡', minLvl: 9,  tier: 'monument' },
  // Historic
  ruins:         { cost: 150000,   income: 150,   icon: '🏚️', minLvl: 6,  tier: 'landmark' },
  // Default
  yes:           { cost: 1000,     income: 1,     icon: '🏠', minLvl: 1,  tier: 'residential' },
  default:       { cost: 1000,     income: 1,     icon: '🏠', minLvl: 1,  tier: 'residential' },
};

const COUNTRY_MULTIPLIERS = {
  'united states': 3.0, 'usa': 3.0,
  'united kingdom': 2.5,
  'germany': 2.3,
  'france': 2.2,
  'japan': 2.0,
  'australia': 2.2,
  'canada': 2.1,
  'switzerland': 3.5,
  'norway': 3.0,
  'singapore': 3.0,
  'united arab emirates': 2.5, 'uae': 2.5,
  'china': 1.5,
  'russia': 0.8,
  'brazil': 0.7,
  'india': 0.5,
  'turkey': 0.6,
  'mexico': 0.6,
  'indonesia': 0.5,
};

function getCountryMultiplier(countryName) {
  if (!countryName) return 1.0;
  const lower = countryName.toLowerCase();
  for (const [key, mult] of Object.entries(COUNTRY_MULTIPLIERS)) {
    if (lower.includes(key)) return mult;
  }
  return 1.0;
}

function classifyBuilding(tags) {
  const checks = [
    tags.historic,
    tags.tourism,
    tags.amenity,
    tags.building,
    tags.shop,
    tags.office,
    tags.leisure,
  ];
  for (const tag of checks) {
    if (tag && BUILDING_PRICES[tag]) return { type: tag, ...BUILDING_PRICES[tag] };
  }
  if (tags.historic || tags.tourism) return { type: 'attraction', ...BUILDING_PRICES.attraction };
  if (tags.leisure === 'park')       return { type: 'viewpoint',  ...BUILDING_PRICES.viewpoint };
  return { type: 'default', ...BUILDING_PRICES.default };
}

function calcOSMPrice(tags, countryName) {
  const base        = classifyBuilding(tags);
  const countryMult = getCountryMultiplier(countryName);
  const rand        = 0.8 + Math.random() * 0.4;
  return {
    buildingType: base.type,
    tier:         base.tier,
    icon:         base.icon,
    minLevel:     base.minLvl,
    cost:         Math.round(base.cost * countryMult * rand),
    incomeBase:   parseFloat((base.income * countryMult * rand).toFixed(4)),
  };
}

// ── Smart name logic ────────────────────────────────────────
// Tier priority:
//   monument  → use OSM name as-is (Kremlin, Eiffel Tower…)
//   landmark  → use OSM name if present, else "Type on Street"
//   commercial→ use brand/name if present, else "Type, Street N"
//   residential→ always "Street N" (ul. Lenina 43)

function getBuildingName(tags, osmId, addressInfo) {
  const tier = classifyBuilding(tags).tier;

  // Explicit name always wins for non-residential
  const explicitName = tags['name:ru'] || tags.name || tags['name:en'];

  if (tier === 'monument' || tier === 'landmark') {
    if (explicitName) return explicitName;
    // Fallback: type label + street
    const typeLabel = getTierLabel(tags);
    const street    = formatAddress(tags, addressInfo);
    return street ? `${typeLabel} на ${street}` : typeLabel;
  }

  if (tier === 'commercial') {
    if (explicitName) return explicitName;
    if (tags.brand)   return tags.brand;
    const typeLabel = getTierLabel(tags);
    const street    = formatAddress(tags, addressInfo);
    return street ? `${typeLabel}, ${street}` : typeLabel;
  }

  // residential — always address-based
  const street = formatAddress(tags, addressInfo);
  if (street) return street;
  if (explicitName) return explicitName;
  return `Жилой дом`;
}

function formatAddress(tags, addressInfo) {
  // OSM address tags
  const street = tags['addr:street'] || addressInfo?.road || addressInfo?.street || '';
  const house  = tags['addr:housenumber'] || '';

  if (street && house) return `${street}, ${house}`;
  if (street)          return street;
  if (house)           return `д. ${house}`;
  return '';
}

function getTierLabel(tags) {
  const amenity  = tags.amenity;
  const building = tags.building;
  const tourism  = tags.tourism;
  const historic = tags.historic;
  const shop     = tags.shop;

  const labels = {
    // amenity
    restaurant: 'Ресторан', cafe: 'Кафе', bar: 'Бар', bank: 'Банк',
    hospital: 'Больница', school: 'Школа', university: 'Университет',
    pharmacy: 'Аптека', fuel: 'АЗС', parking: 'Парковка',
    theatre: 'Театр', cinema: 'Кинотеатр', casino: 'Казино',
    // building
    apartments: 'Жилой дом', hotel: 'Отель', office: 'Офис',
    commercial: 'Торговое здание', industrial: 'Промышленное здание',
    warehouse: 'Склад', church: 'Церковь', cathedral: 'Собор',
    mosque: 'Мечеть', temple: 'Храм', stadium: 'Стадион',
    train_station: 'Вокзал', airport: 'Аэропорт',
    // tourism
    museum: 'Музей', monument: 'Памятник', castle: 'Замок',
    attraction: 'Достопримечательность', viewpoint: 'Смотровая площадка',
    zoo: 'Зоопарк', theme_park: 'Парк развлечений',
    // historic
    ruins: 'Руины', fort: 'Крепость',
  };

  for (const tag of [amenity, building, tourism, historic, shop]) {
    if (tag && labels[tag]) return labels[tag];
  }
  return 'Здание';
}

function getIcon(tags) {
  return classifyBuilding(tags).icon;
}

function getTier(tags) {
  return classifyBuilding(tags).tier;
}

module.exports = { calcOSMPrice, getBuildingName, formatAddress, getIcon, getTier, classifyBuilding };
