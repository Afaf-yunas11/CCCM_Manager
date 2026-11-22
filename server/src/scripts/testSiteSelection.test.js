const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assessSite } = require('../config/guidelines');
const { polygonAreaM2 } = require('../utils/geo');

function rectangle(center, widthM, heightM) {
  const halfLat = heightM / (2 * 111320);
  const halfLng = widthM / (2 * 111320 * Math.cos((center.lat * Math.PI) / 180));
  return [
    { lat: center.lat - halfLat, lng: center.lng - halfLng },
    { lat: center.lat - halfLat, lng: center.lng + halfLng },
    { lat: center.lat + halfLat, lng: center.lng + halfLng },
    { lat: center.lat + halfLat, lng: center.lng - halfLng },
  ];
}

const confirmedConditions = {
  slopePercent: 2,
  allSeasonRoad: true,
  waterSourceNearby: true,
  floodRiskManager: 'low',
  landslideRisk: false,
  malariaProne: false,
  titleClear: true,
};

const scenarios = [
  {
    name: 'Peshawar sample: spacious, confirmed site',
    center: { lat: 34.015, lng: 71.58 },
    widthM: 600,
    heightM: 600,
    population: 5000,
    expected: 'suitable',
  },
  {
    name: 'Swat sample: minimum area, below comfort target',
    center: { lat: 35.22, lng: 72.425 },
    widthM: 450,
    heightM: 450,
    population: 5000,
    expected: 'needs_review',
  },
  {
    name: 'Quetta sample: boundary too small for population',
    center: { lat: 30.18, lng: 66.99 },
    widthM: 300,
    heightM: 300,
    population: 4000,
    expected: 'not_suitable',
  },
  {
    name: 'Chitral sample: road access not confirmed',
    center: { lat: 35.85, lng: 71.78 },
    widthM: 500,
    heightM: 500,
    population: 5000,
    conditions: { allSeasonRoad: undefined },
    expected: 'needs_review',
  },
];

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const polygon = rectangle(scenario.center, scenario.widthM, scenario.heightM);
    const availableAreaM2 = polygonAreaM2(polygon);
    const result = assessSite({
      ...confirmedConditions,
      ...scenario.conditions,
      population: scenario.population,
      availableAreaM2,
    });

    assert.ok(Math.abs(availableAreaM2 - scenario.widthM * scenario.heightM) < scenario.widthM * scenario.heightM * 0.02);
    assert.equal(result.result, scenario.expected);
    if (scenario.expected === 'suitable') assert.equal(result.warns.length, 0);
    if (scenario.conditions && scenario.conditions.allSeasonRoad === undefined) {
      assert.ok(result.warns.some((warning) => warning.includes('road access not confirmed')));
    }

    console.log(
      `${scenario.name}: ${availableAreaM2.toLocaleString()} m², ${scenario.population.toLocaleString()} people, ${result.result}`
    );
  });
}
