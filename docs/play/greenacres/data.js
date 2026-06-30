// data.js — Static game data for GreenAcres farming simulator
// All tunable numbers live here for easy balancing.

const CROPS = [
  { id: 'wheat', name: 'Wheat', category: 'Grain', emoji: '🌾', seedCost: 10, growthWeeks: 4, waterNeed: 1, soilDrain: 2, basePrice: 25, bestSeason: ['Spring', 'Summer'] },
  { id: 'corn', name: 'Corn', category: 'Grain', emoji: '🌽', seedCost: 15, growthWeeks: 6, waterNeed: 3, soilDrain: 3, basePrice: 45, bestSeason: ['Summer'] },
  { id: 'rice', name: 'Rice', category: 'Grain', emoji: '🌾', seedCost: 20, growthWeeks: 7, waterNeed: 3, soilDrain: 2, basePrice: 55, bestSeason: ['Summer'] },
  { id: 'carrot', name: 'Carrot', category: 'Vegetable', emoji: '🥕', seedCost: 8, growthWeeks: 3, waterNeed: 2, soilDrain: 1, basePrice: 20, bestSeason: ['Spring', 'Autumn'] },
  { id: 'potato', name: 'Potato', category: 'Vegetable', emoji: '🥔', seedCost: 10, growthWeeks: 4, waterNeed: 2, soilDrain: 2, basePrice: 30, bestSeason: ['Spring', 'Autumn'] },
  { id: 'tomato', name: 'Tomato', category: 'Vegetable', emoji: '🍅', seedCost: 12, growthWeeks: 5, waterNeed: 2, soilDrain: 2, basePrice: 50, bestSeason: ['Summer'] },
  { id: 'lettuce', name: 'Lettuce', category: 'Vegetable', emoji: '🥬', seedCost: 6, growthWeeks: 2, waterNeed: 2, soilDrain: 1, basePrice: 18, bestSeason: ['Spring', 'Autumn'] },
  { id: 'beans', name: 'Beans', category: 'Legume', emoji: '🫘', seedCost: 9, growthWeeks: 4, waterNeed: 1, soilDrain: -2, basePrice: 28, bestSeason: ['Spring', 'Summer'] },
  { id: 'soybean', name: 'Soybean', category: 'Legume', emoji: '🫛', seedCost: 11, growthWeeks: 5, waterNeed: 1, soilDrain: -2, basePrice: 35, bestSeason: ['Summer'] },
  { id: 'strawberry', name: 'Strawberry', category: 'Fruit', emoji: '🍓', seedCost: 18, growthWeeks: 6, waterNeed: 2, soilDrain: 2, basePrice: 70, bestSeason: ['Spring', 'Summer'] },
  { id: 'pumpkin', name: 'Pumpkin', category: 'Fruit', emoji: '🎃', seedCost: 16, growthWeeks: 7, waterNeed: 2, soilDrain: 3, basePrice: 60, bestSeason: ['Autumn'] },
  { id: 'sunflower', name: 'Sunflower', category: 'Other', emoji: '🌻', seedCost: 7, growthWeeks: 5, waterNeed: 1, soilDrain: 1, basePrice: 30, bestSeason: ['Summer'] },
];

const TECH = [
  { id: 'drip_irrigation', name: 'Drip Irrigation', emoji: '💧', cost: 300, description: 'Halves water used per irrigation; improves sustainability.' },
  { id: 'rainwater_harvesting', name: 'Rainwater Harvesting', emoji: '🪣', cost: 250, description: 'Rain weeks add water to your reserve.' },
  { id: 'compost_system', name: 'Compost System', emoji: '♻️', cost: 350, description: 'Organic compost becomes free and restores +soil each use.' },
  { id: 'solar_power', name: 'Solar Power', emoji: '☀️', cost: 400, description: 'Cuts farm emissions; raises sustainability; powers Greenhouse.' },
  { id: 'greenhouse', name: 'Greenhouse', emoji: '🏡', cost: 600, description: 'Grow any crop in any season (incl. winter) on greenhouse tiles.' },
  { id: 'precision_sensors', name: 'Precision Sensors', emoji: '📡', cost: 300, description: 'Shows optimal water/soil per tile; better weather forecast; reduces waste.' },
  { id: 'cover_cropping', name: 'Cover Cropping / No-Till', emoji: '🌱', cost: 250, description: 'Fallow tiles recover soil much faster; reduces erosion.' },
  { id: 'beneficial_insects', name: 'Beneficial Insects (IPM)', emoji: '🐞', cost: 200, description: 'Natural pest resistance; removes need for (and penalty of) pesticides.' },
  { id: 'crop_rotation_planner', name: 'Crop Rotation Planner', emoji: '🔄', cost: 200, description: 'Highlights good rotation choices; bonus sustainability for rotating well.' },
  { id: 'wind_turbine', name: 'Wind Turbine', emoji: '🌬️', cost: 450, description: 'Further emissions cut + small passive income from surplus energy.' },
];

const WEATHER_EVENTS = [
  { id: 'sunny', name: 'Sunny / Ideal', emoji: '☀️', description: 'Normal growth.' },
  { id: 'rain', name: 'Rain', emoji: '🌧️', description: 'Refills tile moisture for free; Rainwater Harvesting banks extra.' },
  { id: 'drought', name: 'Drought', emoji: '🌵', description: 'Moisture loss doubled; unirrigated crops suffer.' },
  { id: 'heatwave', name: 'Heatwave', emoji: '🔥', description: 'Cool-season crops (lettuce, carrot) take damage.' },
  { id: 'frost', name: 'Frost', emoji: '❄️', description: 'Warm-season crops (tomato, strawberry, pumpkin) damaged or killed if unprotected.' },
  { id: 'storm', name: 'Storm', emoji: '⛈️', description: 'Damages 1–3 random tiles\' crops.' },
];

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const WEEKS_PER_SEASON = 12;
const COLS = 6;
const ROWS = 5;
const TOTAL_TILES = COLS * ROWS;

const STARTING_MONEY = 240;
const STARTING_SOIL_HEALTH = 70;
const STARTING_MOISTURE = 50;
const STARTING_WATER_RESERVE = 100;
const TILL_COST = 5;
const IRRIGATION_WATER_COST = 5;
const IRRIGATION_WATER_AMOUNT = 30;
