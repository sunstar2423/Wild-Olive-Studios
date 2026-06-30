export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;
export const DT = 1 / 60;

export const SHOULDER_WIDTH = 70;
export const BIKE_WIDTH = 44;
export const BIKE_HEIGHT = 72;
export const PLAYER_LATERAL_SPEED = 420;
export const LIVES = 3;
export const INVULN_TIME = 1.5;

export const BASE_SCROLL_SPEED = 280;
export const SPEED_MIN_MULT = 0.6;
export const SPEED_MAX_MULT = 1.6;
export const OFFROAD_SPEED_MULT = 0.5;

export const AIR_DURATION = 0.85;
export const AIR_MAX_HEIGHT = 60;
export const HOP_DURATION = 0.45;
export const HOP_HEIGHT = 22;
export const HOP_COOLDOWN = 0.6;

export const SEGMENT_LENGTH = 220;
export const BIKE_WIDTH_F = BIKE_WIDTH;
export const GAP_MIN = BIKE_WIDTH * 2.6;
export const MIN_REACTION = 0.7;

export const COIN_POINTS = 10;
export const TRICK_POINTS = 50;
export const CLEAN_LANDING = 100;
export const NEAR_MISS_RADIUS = 34;
export const NEAR_MISS_BASE = 15;
export const COMBO_WINDOW = 2.4;
export const COMBO_MAX = 8;
export const DELIVERY = 75;
export const PERFECT_DELIVERY = 150;
export const DISTANCE_PER_POINT = 10;

/* boost pickup */
export const BOOST_POINTS = 25;
export const BOOST_DURATION = 1.8;
export const BOOST_MULT = 1.45;

export const PLAYER_Y = 540;

export const ZONES = [
  {
    id: 'forest',
    names: ['Whispering Pines', 'Silent Woods', 'Cedar Grove', 'Fern Valley', 'Pine Ridge'],
    lengthMeters: 1200,
    roadWidth: 480,
    palette: {
      road: '#5c4a3a',
      roadLine: '#7a6b5a',
      edge: '#6a5a4a',
      shoulder: '#3a5a3a',
      bg: '#1a2a1a',
      accent: '#8b7355',
    },
    scrollMult: 1.0,
    obstacleDensity: 0.45,
    rampChance: 0.08,
    coinChance: 0.5,
    boostChance: 0.04,
    obstacleTable: [
      { kind: 'log', clearance: 'mid', weight: 3, w: 120, h: 34 },
      { kind: 'rock', clearance: 'solid', weight: 2, w: 56, h: 56 },
      { kind: 'puddle', clearance: 'low', weight: 3, w: 90, h: 40 },
    ],
    sceneryDensity: 0.6,
    sceneryTable: [
      { kind: 'pine', weight: 4 }, { kind: 'bush', weight: 3 }, { kind: 'stump', weight: 1 },
    ],
    delivery: false,
  },
  {
    id: 'suburb',
    names: ['Maple Street', 'Oak Avenue', 'Willow Lane', 'Birch Crescent', 'Cedar Court'],
    lengthMeters: 1000,
    roadWidth: 540,
    palette: {
      road: '#4a4a4a',
      roadLine: '#cccc88',
      edge: '#6a6a5a',
      shoulder: '#4a6a3a',
      bg: '#3a4a3a',
      accent: '#8a7a5a',
    },
    scrollMult: 1.05,
    obstacleDensity: 0.5,
    rampChance: 0.08,
    coinChance: 0.5,
    boostChance: 0.04,
    obstacleTable: [
      { kind: 'car', clearance: 'solid', weight: 2, w: 80, h: 50 },
      { kind: 'bin', clearance: 'mid', weight: 2, w: 50, h: 60 },
      { kind: 'cone', clearance: 'low', weight: 3, w: 30, h: 50 },
      { kind: 'dog', clearance: 'moving', weight: 1, w: 40, h: 30, speed: 160 },
    ],
    sceneryDensity: 0.5,
    sceneryTable: [
      { kind: 'house', weight: 3 }, { kind: 'tree', weight: 3 }, { kind: 'fence', weight: 2 }, { kind: 'lamp', weight: 1 },
    ],
    delivery: false,
  },
  {
    id: 'downtown',
    names: ['Downtown', 'Midtown', 'Uptown', 'Financial District', 'The Core'],
    lengthMeters: 1000,
    roadWidth: 620,
    palette: {
      road: '#3a3a3a',
      roadLine: '#8888aa',
      edge: '#5a5a5a',
      shoulder: '#4a4a5a',
      bg: '#2a2a3a',
      accent: '#6a5a7a',
    },
    scrollMult: 1.1,
    obstacleDensity: 0.55,
    rampChance: 0.06,
    coinChance: 0.5,
    boostChance: 0.04,
    obstacleTable: [
      { kind: 'taxi', clearance: 'solid', weight: 2, w: 80, h: 50 },
      { kind: 'cart', clearance: 'mid', weight: 1, w: 60, h: 50 },
      { kind: 'cone', clearance: 'low', weight: 3, w: 30, h: 50 },
      { kind: 'pedestrian', clearance: 'moving', weight: 2, w: 30, h: 30, speed: 100 },
    ],
    sceneryDensity: 0.4,
    sceneryTable: [
      { kind: 'building', weight: 4 }, { kind: 'lamp', weight: 2 }, { kind: 'sign', weight: 1 }, { kind: 'planter', weight: 1 },
    ],
    delivery: false,
  },
  {
    id: 'construction',
    names: ['The Build Zone', 'The Overhaul', 'The Expansion', 'The Dig', 'The Project'],
    lengthMeters: 800,
    roadWidth: 520,
    palette: {
      road: '#5a4a3a',
      roadLine: '#cc8844',
      edge: '#6a5a4a',
      shoulder: '#4a3a2a',
      bg: '#3a2a1a',
      accent: '#8a6a3a',
    },
    scrollMult: 1.0,
    obstacleDensity: 0.6,
    rampChance: 0.12,
    coinChance: 0.4,
    boostChance: 0.05,
    obstacleTable: [
      { kind: 'barrier', clearance: 'mid', weight: 3, w: 100, h: 40 },
      { kind: 'mixer', clearance: 'solid', weight: 1, w: 70, h: 70 },
      { kind: 'gravel', clearance: 'low', weight: 2, w: 80, h: 40 },
    ],
    sceneryDensity: 0.3,
    sceneryTable: [
      { kind: 'barrel', weight: 3 }, { kind: 'pipe', weight: 2 }, { kind: 'gravel_pile', weight: 2 },
    ],
    delivery: false,
  },
  {
    id: 'park',
    names: ['Greenfield Park', 'Central Gardens', "King's Meadow", 'Riverside Common', 'Rose Gardens'],
    lengthMeters: 1000,
    roadWidth: 460,
    palette: {
      road: '#6a6a4a',
      roadLine: '#aabb88',
      edge: '#7a8a5a',
      shoulder: '#4a7a3a',
      bg: '#2a4a2a',
      accent: '#7a9a5a',
    },
    scrollMult: 1.0,
    obstacleDensity: 0.4,
    rampChance: 0.14,
    coinChance: 0.6,
    boostChance: 0.04,
    obstacleTable: [
      { kind: 'bench', clearance: 'mid', weight: 2, w: 80, h: 30 },
      { kind: 'fountain', clearance: 'solid', weight: 1, w: 60, h: 60 },
      { kind: 'ball', clearance: 'low', weight: 2, w: 30, h: 30 },
      { kind: 'jogger', clearance: 'moving', weight: 2, w: 30, h: 40, speed: 130 },
    ],
    sceneryDensity: 0.7,
    sceneryTable: [
      { kind: 'tree', weight: 4 }, { kind: 'bush', weight: 3 }, { kind: 'lamp', weight: 1 }, { kind: 'pond', weight: 1 },
    ],
    delivery: false,
  },
  {
    id: 'harbour',
    names: ["Mariner's Wharf", 'Portside', 'The Docks', 'Harbour View', 'Anchor Bay'],
    lengthMeters: 1000,
    roadWidth: 480,
    palette: {
      road: '#4a5a5a',
      roadLine: '#8899aa',
      edge: '#5a6a6a',
      shoulder: '#3a4a4a',
      bg: '#1a2a3a',
      accent: '#7a8a7a',
    },
    scrollMult: 1.0,
    obstacleDensity: 0.5,
    rampChance: 0.06,
    coinChance: 0.5,
    boostChance: 0.04,
    obstacleTable: [
      { kind: 'barrier', clearance: 'mid', weight: 3, w: 90, h: 40 },
      { kind: 'bin', clearance: 'solid', weight: 2, w: 50, h: 50 },
      { kind: 'puddle', clearance: 'low', weight: 2, w: 70, h: 35 },
      { kind: 'dog', clearance: 'moving', weight: 1, w: 30, h: 25, speed: 120 },
    ],
    sceneryDensity: 0.4,
    sceneryTable: [
      { kind: 'building', weight: 3 }, { kind: 'lamp', weight: 2 }, { kind: 'barrel', weight: 2 }, { kind: 'pipe', weight: 1 },
    ],
    delivery: false,
  },
  {
    id: 'university',
    names: ['University Circle', 'Campus Way', "Scholar's Walk", 'The Quad', 'College Green'],
    lengthMeters: 1000,
    roadWidth: 540,
    palette: {
      road: '#5a4a3a',
      roadLine: '#aabb99',
      edge: '#6a5a4a',
      shoulder: '#3a4a2a',
      bg: '#2a2a1a',
      accent: '#8a6a4a',
    },
    scrollMult: 1.0,
    obstacleDensity: 0.45,
    rampChance: 0.08,
    coinChance: 0.55,
    boostChance: 0.04,
    obstacleTable: [
      { kind: 'bench', clearance: 'mid', weight: 2, w: 80, h: 30 },
      { kind: 'cone', clearance: 'low', weight: 3, w: 30, h: 50 },
      { kind: 'ball', clearance: 'low', weight: 1, w: 30, h: 30 },
      { kind: 'pedestrian', clearance: 'moving', weight: 2, w: 30, h: 30, speed: 100 },
    ],
    sceneryDensity: 0.5,
    sceneryTable: [
      { kind: 'building', weight: 3 }, { kind: 'tree', weight: 3 }, { kind: 'lamp', weight: 1 }, { kind: 'bush', weight: 1 },
    ],
    delivery: false,
  },
  {
    id: 'arts',
    names: ['Arts District', 'Gallery Row', 'Theatre Lane', 'Studio Quarter', 'Murderer\'s Row'],
    lengthMeters: 1000,
    roadWidth: 560,
    palette: {
      road: '#4a3a4a',
      roadLine: '#cc88aa',
      edge: '#5a4a5a',
      shoulder: '#3a2a3a',
      bg: '#2a1a2a',
      accent: '#7a5a6a',
    },
    scrollMult: 1.0,
    obstacleDensity: 0.45,
    rampChance: 0.08,
    coinChance: 0.5,
    boostChance: 0.04,
    obstacleTable: [
      { kind: 'fountain', clearance: 'solid', weight: 1, w: 60, h: 60 },
      { kind: 'cart', clearance: 'mid', weight: 2, w: 60, h: 50 },
      { kind: 'cone', clearance: 'low', weight: 2, w: 30, h: 50 },
      { kind: 'pedestrian', clearance: 'moving', weight: 3, w: 30, h: 30, speed: 90 },
    ],
    sceneryDensity: 0.5,
    sceneryTable: [
      { kind: 'building', weight: 3 }, { kind: 'lamp', weight: 2 }, { kind: 'sign', weight: 2 }, { kind: 'planter', weight: 1 },
    ],
    delivery: false,
  },
];
