// Deterministic generator for the seed trail dataset. Run: node scripts/gen-trails.mjs
import { writeFileSync } from 'node:fs';

// mulberry32: short, and unlike a naive LCG it does not visibly cycle over the
// few hundred draws this generator makes.
let state = 20260820;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const REGIONS = [
  { name: 'Charlevoix', lat: 47.55, lon: -70.35 },
  { name: 'Mont-Tremblant', lat: 46.21, lon: -74.58 },
  { name: 'Gaspesie', lat: 48.92, lon: -66.15 },
  { name: 'Saguenay Fjord', lat: 48.35, lon: -70.87 },
  { name: 'Eastern Townships', lat: 45.4, lon: -72.15 },
  { name: 'Laurentians', lat: 46.05, lon: -74.28 },
  { name: 'Adirondacks', lat: 44.11, lon: -73.92 },
  { name: 'White Mountains', lat: 44.27, lon: -71.3 },
  { name: 'Green Mountains', lat: 43.94, lon: -72.85 },
  { name: 'Bas-Saint-Laurent', lat: 47.82, lon: -69.55 },
];
const HEADS = ['Sentier', 'Pic', 'Mont', 'Lac', 'Cap', 'Ridge', 'Summit', 'Falls', 'Notch', 'Col', 'Crete', 'Belvedere', 'Gorge', 'Pointe', 'Butte'];
const MIDS = ['', '', 'des Erables', 'du Loup', 'de la Tour', 'Sainte-Anne', 'Grand', 'Petit', 'Vieux', 'Haut'];
const TAILS = ['des Caps', 'du Nord', 'Bleu', 'de la Chute', 'Panorama', 'Loop', 'Traverse', 'Overlook', 'Crossing', 'Basin', 'Ouest', 'Escarpment', 'Cascade', 'Lookout', 'Sud'];
const DIFFICULTIES = ['easy', 'moderate', 'hard', 'expert'];
const TAGS = ['waterfall', 'summit', 'lake', 'forest', 'ridge', 'dog-friendly', 'family', 'backcountry', 'loop', 'scramble'];

const trails = [];
const usedNames = new Set();

/** Draws until it finds a name no other trail is using. */
function uniqueName() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const mid = pick(MIDS);
    const candidate = [pick(HEADS), mid, pick(TAILS)].filter(Boolean).join(' ');
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
  throw new Error('name space exhausted');
}

for (let i = 0; i < 200; i++) {
  const region = pick(REGIONS);
  const name = uniqueName();
  const distanceKm = Math.round((1.5 + rand() * 22) * 10) / 10;
  const baseElev = Math.round(120 + rand() * 700);
  const gain = Math.round(60 + rand() * 1100);
  const pointCount = Math.max(24, Math.round(distanceKm * 9));

  // Route: a wandering polyline anchored to the region.
  const route = [];
  let lat = region.lat + (rand() - 0.5) * 0.25;
  let lon = region.lon + (rand() - 0.5) * 0.25;
  let bearing = rand() * Math.PI * 2;
  for (let p = 0; p < pointCount; p++) {
    bearing += (rand() - 0.5) * 0.7;
    const step = (distanceKm / pointCount) / 111;
    lat += Math.cos(bearing) * step;
    lon += (Math.sin(bearing) * step) / Math.cos((lat * Math.PI) / 180);
    // Elevation follows a smooth up-then-down profile with noise.
    const t = p / (pointCount - 1);
    const shape = Math.sin(t * Math.PI);
    const elevation = Math.round(baseElev + gain * shape + (rand() - 0.5) * 28);
    route.push({
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lon * 1e6) / 1e6,
      elevation,
      distanceKm: Math.round((distanceKm * t) * 1000) / 1000,
    });
  }

  const tagCount = 1 + Math.floor(rand() * 3);
  const tags = [];
  while (tags.length < tagCount) {
    const t = pick(TAGS);
    if (!tags.includes(t)) tags.push(t);
  }

  trails.push({
    id: `trail-${String(i + 1).padStart(3, '0')}`,
    name: `${name}`,
    region: region.name,
    distanceKm,
    elevationGainM: gain,
    difficulty: pick(DIFFICULTIES),
    rating: Math.round((3 + rand() * 2) * 10) / 10,
    reviewCount: Math.round(rand() * 900),
    estimatedMinutes: Math.round(distanceKm * 14 + gain * 0.09),
    description: `A ${distanceKm} km route in ${region.name} climbing ${gain} m. ${tags.join(', ')}.`,
    tags,
    photoSeed: (i * 37) % 1000,
    route,
  });
}

writeFileSync(new URL('../src/data/trails.json', import.meta.url), JSON.stringify(trails));
console.log(`wrote ${trails.length} trails, ${trails.reduce((n, t) => n + t.route.length, 0)} route points`);
