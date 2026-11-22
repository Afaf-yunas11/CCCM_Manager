// server/src/services/siteApis.js
// Free map/hazard APIs (no key needed). ALL values are INDICATIVE only.
//  1. Overpass API (OpenStreetMap)  -> nearest river/canal/stream, nearest hospital
//  2. Open-Meteo Elevation API      -> elevation + rough slope estimate
//  3. Open-Meteo Flood API (GloFAS) -> forecast river discharge (m3/s)
const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const TIMEOUT_MS = 15000;
const RIVER_SEARCH_RADIUS_M = 3000;
const HOSPITAL_SEARCH_RADIUS_M = 30000;

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function overpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
  return res.json();
}

// Returns metres to nearest river/canal/stream, or null if none within 3 km.
async function getRiverDistanceM(lat, lng) {
  const q = `[out:json][timeout:12];way["waterway"~"^(river|stream|canal)$"](around:${RIVER_SEARCH_RADIUS_M},${lat},${lng});out geom;`;
  const data = await overpass(q);
  let min = null;
  for (const el of data.elements || []) {
    for (const pt of el.geometry || []) {
      const d = haversineM(lat, lng, pt.lat, pt.lon);
      if (min === null || d < min) min = d;
    }
  }
  return min === null ? null : Math.round(min);
}

// Returns km to nearest hospital (1 decimal), or null if none within 30 km.
async function getNearestHospitalKm(lat, lng) {
  const q = `[out:json][timeout:12];nwr["amenity"="hospital"](around:${HOSPITAL_SEARCH_RADIUS_M},${lat},${lng});out center;`;
  const data = await overpass(q);
  let min = null;
  for (const el of data.elements || []) {
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (pLat == null || pLng == null) continue;
    const d = haversineM(lat, lng, pLat, pLng);
    if (min === null || d < min) min = d;
  }
  return min === null ? null : Math.round(min / 100) / 10;
}

// Elevation of the pin + crude slope: biggest height change over ~100 m (N/S/E/W).
// Open-Meteo's DEM is ~90 m resolution, so the slope is rough.
async function getElevation(lat, lng) {
  const dLat = 100 / 111320;
  const dLng = 100 / (111320 * Math.cos((lat * Math.PI) / 180));
  const pts = [[lat, lng], [lat + dLat, lng], [lat - dLat, lng], [lat, lng + dLng], [lat, lng - dLng]];
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[0].toFixed(6)).join(',')}&longitude=${pts.map((p) => p[1].toFixed(6)).join(',')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Elevation API returned ${res.status}`);
  const { elevation } = await res.json();
  if (!Array.isArray(elevation) || elevation.length < 5) throw new Error('Elevation API returned no data');
  const centre = elevation[0];
  const maxDiff = Math.max(...elevation.slice(1).map((e) => Math.abs(e - centre)));
  return { elevationM: Math.round(centre), slopePercentEstimate: Math.round(maxDiff * 10) / 10 };
}

// Highest forecast river discharge (m3/s) over the next 7 days at the nearest river grid cell.
async function getFloodDischarge(lat, lng) {
  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&forecast_days=7`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Flood API returned ${res.status}`);
  const data = await res.json();
  const vals = (data.daily?.river_discharge || []).filter((v) => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round(Math.max(...vals) * 10) / 10;
}

const WATER_SEARCH_RADIUS_M = 1000;
const ROAD_SEARCH_RADIUS_M = 500;
const MAIN_ROADS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];

// Wells, springs, water towers and drinking-water points within 1 km (OpenStreetMap).
async function getWaterPoints(lat, lng) {
  const a = `(around:${WATER_SEARCH_RADIUS_M},${lat},${lng})`;
  const q = `[out:json][timeout:12];(nwr["amenity"="drinking_water"]${a};nwr["man_made"~"^(water_well|water_tower|water_works|water_tap|borehole)$"]${a};nwr["natural"="spring"]${a};);out center;`;
  const data = await overpass(q);
  let min = null;
  let count = 0;
  for (const el of data.elements || []) {
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (pLat == null || pLng == null) continue;
    count++;
    const d = haversineM(lat, lng, pLat, pLng);
    if (min === null || d < min) min = d;
  }
  return { count, nearestM: min === null ? null : Math.round(min) };
}

// Nearest road of any kind, and nearest MAIN road, within 500 m (OpenStreetMap).
async function getRoads(lat, lng) {
  const q = `[out:json][timeout:12];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"](around:${ROAD_SEARCH_RADIUS_M},${lat},${lng});out geom;`;
  const data = await overpass(q);
  let any = null;
  let main = null;
  for (const el of data.elements || []) {
    const isMain = MAIN_ROADS.includes(el.tags?.highway);
    for (const pt of el.geometry || []) {
      const d = haversineM(lat, lng, pt.lat, pt.lon);
      if (any === null || d < any) any = d;
      if (isMain && (main === null || d < main)) main = d;
    }
  }
  return { anyM: any === null ? null : Math.round(any), mainM: main === null ? null : Math.round(main) };
}

// Overpass allows few parallel requests per IP, so its queries run one after another.
async function runSequential(tasks) {
  const out = [];
  for (const t of tasks) {
    try { out.push({ status: 'fulfilled', value: await t() }); }
    catch (e) { out.push({ status: 'rejected', reason: e }); }
  }
  return out;
}

// A failing API never breaks the assessment: it only adds a note.
async function fetchSiteData(lat, lng) {
  const [osmRes, elevRes, floodRes] = await Promise.allSettled([
    runSequential([
      () => getRiverDistanceM(lat, lng),
      () => getNearestHospitalKm(lat, lng),
      () => getWaterPoints(lat, lng),
      () => getRoads(lat, lng),
    ]),
    getElevation(lat, lng),
    getFloodDischarge(lat, lng),
  ]);
  const [river, hospital, water, roads] = osmRes.value;
  const notes = [];
  const apiData = { fetchedAt: new Date(), notes };
  const take = (r, label, onOk) => {
    if (r.status === 'fulfilled') onOk(r.value);
    else notes.push(`${label} unavailable: ${r.reason?.message || 'error'}`);
  };
  take(river, 'River distance', (v) => {
    if (v === null) notes.push(`No river, stream or canal found within ${RIVER_SEARCH_RADIUS_M} m in OpenStreetMap`);
    else apiData.riverDistanceM = v;
  });
  take(hospital, 'Hospital search', (v) => {
    if (v === null) notes.push(`No hospital found within ${HOSPITAL_SEARCH_RADIUS_M / 1000} km in OpenStreetMap`);
    else apiData.nearestHospitalKm = v;
  });
  take(water, 'Water point search', (v) => {
    apiData.waterPointsCount = v.count;
    if (v.nearestM === null) notes.push(`No well, spring or water point found within ${WATER_SEARCH_RADIUS_M} m in OpenStreetMap (may be missing from the map)`);
    else apiData.nearestWaterPointM = v.nearestM;
  });
  take(roads, 'Road search', (v) => {
    if (v.anyM !== null) apiData.roadDistanceM = v.anyM;
    if (v.mainM !== null) apiData.mainRoadDistanceM = v.mainM;
    else notes.push(`No main road found within ${ROAD_SEARCH_RADIUS_M} m in OpenStreetMap (may be missing from the map)`);
  });
  take(elevRes, 'Elevation', (v) => Object.assign(apiData, v));
  take(floodRes, 'Flood forecast', (v) => {
    if (v === null) notes.push('No river discharge forecast for this point');
    else apiData.floodDischarge = v;
  });
  return apiData;
}

module.exports = { fetchSiteData, haversineM };
