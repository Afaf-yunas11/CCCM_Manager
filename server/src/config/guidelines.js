// server/src/config/guidelines.js
// Source: NDMA "Guidelines for Minimum Standards of Relief in Camp" (2017).
// `p` = printed page number in the PDF. Anything marked PLACEHOLDER is NOT from NDMA.

const G = {
  source: 'NDMA Guidelines for Minimum Standards of Relief in Camp (2017)',

  // ---------- Camp layout & space (p.6) ----------
  space: {
    landPerPersonM2: { min: 30, max: 45, p: 6 },       // 3-4.5 ha per 1000 people
    coveredShelterPerPersonM2: 3.5,                    // p.6
    roadsAndWalkwaysShare: { min: 0.20, max: 0.25 },   // of whole camp, p.6
    roadWidthM: 10,                                    // p.6
    distanceFromMainRoadM: 100,                        // preferred, p.6
    distanceBetweenCampsM: 50,                         // preferred, p.6
    firebreak: { widthM: { min: 30, max: 50 }, everyM: 300 }, // p.6
    tentSpacingM: 2,                                   // p.6
  },

  // ---------- Site selection, open-space camps (p.4) ----------
  site: {
    slopePercent: { min: 1, max: 5 },                  // natural drainage, p.4
    mustAvoid: ['landslide', 'flood', 'high wind', 'soil erosion/mudslide', 'earthquake-prone edge of hill'],
    mustHave: [
      'all-season road access with space for internal roads and parking',
      'absorptive, stable soil',
      'near a water source, groundwater table known',
      'clear land/building ownership title',
      'space for future expansion',
      'space for storing food and non-food items',
      'free from malaria / water-borne / vector-borne disease risk',
      'safe distance from conflict areas and damaged homes',
    ],
    buildingBasedNote: 'Prefer pre-identified, elevated community halls/stadiums; avoid schools and public buildings unless no other option (p.3).',
  },

  // ---------- Water (p.8-9) ----------
  water: {
    litresPerPersonPerDay: { min: 15, max: 20 },       // p.9 (5-7 drinking + 5-7 hygiene + 5-6 cooking)
    tankMinLitres: 200,
    tankDistanceFromTentsM: { min: 100, max: 500 },
    personsPerTap: { min: 200, max: 250 },             // 7.5 L/min
    personsPerHandPump: { min: 200, max: 300 },        // 17 L/min
    personsPerOpenWell: 400,
    personsPerHandBasin: 10,
    waterPointFromToiletsFt: 20,                       // p.9
    sampleTestingFrequency: 'weekly (PHE district lab)',
  },

  // ---------- Sanitation (p.10) ----------
  sanitation: {
    personsPerToilet: 20,                              // living areas
    toiletDistanceFromShelterM: { min: 30, max: 50 },
    latrineFromWaterSourceM: 30,                       // NOTE: p.10 says 30 m, p.9 says 20 ft. Verify.
    wastePitPersons: 500,                              // one 2m x 5m x 2m pit per 500
    soapGramsPerFamilyPerWeek: 100,
    pitAboveWaterTableM: 1.5,                          // PDF text reads "1-5 meters"; check original (likely 1.5)
  },

  // ---------- Food, health, security ----------
  food: { kcalAdult: 2100, kcalChild: 1700 },          // p.7
  health: {
    ambulanceIfPopulationOver: 1000,                   // p.12
    bhcStaffMin: { doctor: 1, midwife: 1, pharmacist: 1, healthWorker: 1 }, // p.11
    screeningWithinHours: 24,
  },
  security: { watchTowers: 4, p: 15 },

  // ---------- Camp lifecycle ----------
  expansionAllowedIf: [ // p.16
    'significant new arrivals',
    'camp overcrowded or congested',
    'part of camp unsafe/unsuitable (flood, landslide, lack of water)',
  ],

  // ---------- NOT in NDMA: you must define or source these ----------
  placeholders: {
    riverDistanceHighRiskM: 500,   // PLACEHOLDER
    riverDistanceMediumRiskM: 1000, // PLACEHOLDER
    avgFamilySize: 6,              // PLACEHOLDER, for tents/soap/containers
  },
};

// ---------- Calculator: requirements for N people ----------
function calculateRequirements(population, familySize = G.placeholders.avgFamilySize) {
  const n = population;
  const families = Math.ceil(n / familySize);
  return {
    population: n,
    families,
    landM2: { min: n * G.space.landPerPersonM2.min, max: n * G.space.landPerPersonM2.max },
    coveredShelterM2: n * G.space.coveredShelterPerPersonM2,
    tents: families, // one tent per family, p.6
    waterLitresPerDay: { min: n * G.water.litresPerPersonPerDay.min, max: n * G.water.litresPerPersonPerDay.max },
    taps: { min: Math.ceil(n / G.water.personsPerTap.max), max: Math.ceil(n / G.water.personsPerTap.min) },
    handPumps: { min: Math.ceil(n / G.water.personsPerHandPump.max), max: Math.ceil(n / G.water.personsPerHandPump.min) },
    handBasins: Math.ceil(n / G.water.personsPerHandBasin),
    toilets: Math.ceil(n / G.sanitation.personsPerToilet),
    wastePits: Math.ceil(n / G.sanitation.wastePitPersons),
    soapKgPerWeek: (families * G.sanitation.soapGramsPerFamilyPerWeek) / 1000,
    foodKcalPerDay: { adult: G.food.kcalAdult, child: G.food.kcalChild },
    ambulanceRequired: n > G.health.ambulanceIfPopulationOver,
    watchTowers: G.security.watchTowers,
  };
}

// ---------- Rule engine: suitable / needs_review / not_suitable ----------
// input: { population, availableAreaM2, slopePercent, allSeasonRoad, waterSourceNearby,
//          floodRiskManager: 'low'|'medium'|'high', landslideRisk: bool, malariaProne: bool,
//          riverDistanceM (optional, from API), titleClear: bool }
function assessSite(input) {
  const req = calculateRequirements(input.population);
  const fails = [], warns = [];

  if (input.availableAreaM2 < req.landM2.min) fails.push(`Area ${input.availableAreaM2} m2 is below the 30 m2/person minimum (${req.landM2.min} m2) [p.6]`);
  else if (input.availableAreaM2 < req.landM2.max) warns.push(`Area meets the minimum but not the 45 m2/person comfort level (${req.landM2.max} m2) [p.6]`);

  if (input.slopePercent < G.site.slopePercent.min || input.slopePercent > G.site.slopePercent.max)
    warns.push(`Slope ${input.slopePercent}% is outside the 1-5% range for natural drainage [p.4]`);
  if (!input.allSeasonRoad) fails.push('No all-season road access [p.4]');
  if (!input.waterSourceNearby) warns.push('No water source nearby [p.4]');
  if (input.landslideRisk) fails.push('Landslide/erosion risk [p.4]');
  if (input.malariaProne) warns.push('Area prone to malaria / water-borne disease [p.4]');
  if (input.titleClear === false) warns.push('Land ownership title not clear [p.4]');

  if (input.floodRiskManager === 'high') fails.push('Manager reports high flood risk [p.4]');
  else if (input.floodRiskManager === 'medium') warns.push('Manager reports medium flood risk [p.4]');

  if (typeof input.riverDistanceM === 'number') { // indicative, from API, NOT NDMA
    if (input.riverDistanceM < G.placeholders.riverDistanceHighRiskM) warns.push(`Indicative: river ${input.riverDistanceM} m away (project threshold, not NDMA)`);
  }

  const result = fails.length ? 'not_suitable' : warns.length ? 'needs_review' : 'suitable';
  return { result, fails, warns, requirements: req };
}

// ---------- LLM report prompt ----------
function buildReportPrompt(siteInput, assessment, apiData) {
  return {
    system: `You write short site assessment reports for relief camp managers in Pakistan.
Use ONLY the JSON provided. Do not invent numbers, distances, or facts.
If a value is missing, write "not provided".
Do not decide suitability yourself: report the "result" field exactly as given.
Cite the NDMA page number from the findings where available.
Mark values from "apiData" as "indicative". Keep it under 250 words.
Sections: Summary, Risks, Resource needs, Recommended actions.`,
    user: JSON.stringify({ guidelineSource: G.source, siteInput, assessment, apiData }),
  };
}

module.exports = { G, calculateRequirements, assessSite, buildReportPrompt };
