// ═══════════════════════════════════════════════════════════
//  OSM Building Classifier & Price Engine
//  Определяет цену, иконку и мин. уровень по тегам OSM
// ═══════════════════════════════════════════════════════════

// Базовые цены по типу здания (за 100%)
const BUILDING_PRICES = {
  // Жилые
  apartments:       { cost: 5000,    income: 5,    icon: '🏢', minLvl: 1 },
  residential:      { cost: 2000,    income: 2,    icon: '🏠', minLvl: 1 },
  house:            { cost: 1500,    income: 1.5,  icon: '🏡', minLvl: 1 },
  detached:         { cost: 3000,    income: 3,    icon: '🏡', minLvl: 1 },
  dormitory:        { cost: 2500,    income: 2.5,  icon: '🏘️', minLvl: 1 },

  // Коммерческие
  commercial:       { cost: 10000,   income: 10,   icon: '🏪', minLvl: 2 },
  retail:           { cost: 8000,    income: 8,    icon: '🛍️', minLvl: 2 },
  shop:             { cost: 6000,    income: 6,    icon: '🏪', minLvl: 2 },
  supermarket:      { cost: 15000,   income: 15,   icon: '🛒', minLvl: 3 },
  mall:             { cost: 80000,   income: 80,   icon: '🛍️', minLvl: 5 },

  // Офисные
  office:           { cost: 20000,   income: 20,   icon: '🏦', minLvl: 3 },
  industrial:       { cost: 25000,   income: 25,   icon: '🏭', minLvl: 4 },
  warehouse:        { cost: 12000,   income: 12,   icon: '🏗️', minLvl: 3 },

  // Общественные
  hotel:            { cost: 50000,   income: 50,   icon: '🏨', minLvl: 5 },
  hospital:         { cost: 100000,  income: 100,  icon: '🏥', minLvl: 6 },
  school:           { cost: 30000,   income: 30,   icon: '🏫', minLvl: 4 },
  university:       { cost: 80000,   income: 80,   icon: '🎓', minLvl: 5 },
  church:           { cost: 40000,   income: 40,   icon: '⛪', minLvl: 4 },
  cathedral:        { cost: 500000,  income: 500,  icon: '⛪', minLvl: 8 },
  mosque:           { cost: 60000,   income: 60,   icon: '🕌', minLvl: 5 },
  temple:           { cost: 70000,   income: 70,   icon: '🛕', minLvl: 5 },

  // Развлечения
  stadium:          { cost: 200000,  income: 200,  icon: '🏟️', minLvl: 7 },
  theatre:          { cost: 100000,  income: 100,  icon: '🎭', minLvl: 6 },
  cinema:           { cost: 60000,   income: 60,   icon: '🎬', minLvl: 5 },
  casino:           { cost: 500000,  income: 500,  icon: '🎰', minLvl: 8 },

  // Транспорт
  train_station:    { cost: 150000,  income: 150,  icon: '🚉', minLvl: 6 },
  airport:          { cost: 2000000, income: 2000, icon: '✈️', minLvl: 12 },

  // POI (amenity теги)
  restaurant:       { cost: 3000,    income: 3,    icon: '🍽️', minLvl: 1 },
  cafe:             { cost: 2000,    income: 2,    icon: '☕', minLvl: 1 },
  bar:              { cost: 4000,    income: 4,    icon: '🍺', minLvl: 2 },
  bank:             { cost: 30000,   income: 30,   icon: '🏦', minLvl: 4 },
  pharmacy:         { cost: 8000,    income: 8,    icon: '💊', minLvl: 2 },
  fuel:             { cost: 20000,   income: 20,   icon: '⛽', minLvl: 3 },
  parking:          { cost: 15000,   income: 15,   icon: '🅿️', minLvl: 3 },

  // Достопримечательности (tourism)
  attraction:       { cost: 500000,  income: 500,  icon: '🗺️', minLvl: 8 },
  museum:           { cost: 200000,  income: 200,  icon: '🏛️', minLvl: 7 },
  monument:         { cost: 300000,  income: 300,  icon: '🗿', minLvl: 7 },
  artwork:          { cost: 50000,   income: 50,   icon: '🎨', minLvl: 5 },
  viewpoint:        { cost: 100000,  income: 100,  icon: '👁️', minLvl: 6 },
  zoo:              { cost: 400000,  income: 400,  icon: '🦁', minLvl: 7 },
  theme_park:       { cost: 800000,  income: 800,  icon: '🎡', minLvl: 9 },

  // По умолчанию
  yes:              { cost: 1000,    income: 1,    icon: '🏠', minLvl: 1 },
  default:          { cost: 1000,    income: 1,    icon: '🏠', minLvl: 1 },
};

// Страновой коэффициент (примерный ВВП на душу населения)
const COUNTRY_MULTIPLIERS = {
  'United States': 3.0, 'USA': 3.0,
  'United Kingdom': 2.5, 'UK': 2.5,
  'Germany': 2.3,
  'France': 2.2,
  'Japan': 2.0,
  'Australia': 2.2,
  'Canada': 2.1,
  'Switzerland': 3.5,
  'Norway': 3.0,
  'Singapore': 3.0,
  'UAE': 2.5,
  'China': 1.5,
  'Russia': 0.8,
  'Brazil': 0.7,
  'India': 0.5,
  'Turkey': 0.6,
  'Mexico': 0.6,
  'Indonesia': 0.5,
};

function getCountryMultiplier(countryName) {
  if (!countryName) return 1.0;
  for (const [key, mult] of Object.entries(COUNTRY_MULTIPLIERS)) {
    if (countryName.toLowerCase().includes(key.toLowerCase())) return mult;
  }
  return 1.0;
}

function classifyBuilding(tags) {
  // Приоритет: tourism > amenity > building > shop > office
  const checks = [
    tags.tourism,
    tags.amenity,
    tags.building,
    tags.shop,
    tags.office,
    tags.leisure,
    tags.historic,
  ];

  for (const tag of checks) {
    if (tag && BUILDING_PRICES[tag]) return { type: tag, ...BUILDING_PRICES[tag] };
  }

  // Особые случаи
  if (tags.historic)   return { type: 'attraction', ...BUILDING_PRICES.attraction };
  if (tags.tourism)    return { type: 'attraction', ...BUILDING_PRICES.attraction };
  if (tags.leisure === 'park') return { type: 'attraction', ...BUILDING_PRICES.viewpoint };

  return { type: 'default', ...BUILDING_PRICES.default };
}

function calcOSMPrice(tags, countryName) {
  const base        = classifyBuilding(tags);
  const countryMult = getCountryMultiplier(countryName);

  // Небольшая случайность ±20% чтобы соседние здания отличались
  const rand = 0.8 + Math.random() * 0.4;

  return {
    buildingType: base.type,
    icon:         base.icon,
    minLevel:     base.minLvl,
    cost:         Math.round(base.cost * countryMult * rand),
    incomeBase:   parseFloat((base.income * countryMult * rand).toFixed(4)),
  };
}

function getBuildingName(tags, osmId) {
  return (
    tags['name:ru'] ||
    tags.name ||
    tags['name:en'] ||
    tags.brand ||
    tags.operator ||
    `Здание #${osmId}`
  );
}

function getIcon(tags) {
  return classifyBuilding(tags).icon;
}

module.exports = { calcOSMPrice, getBuildingName, getIcon, classifyBuilding };
