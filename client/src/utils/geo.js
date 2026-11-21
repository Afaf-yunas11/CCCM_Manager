// client/src/utils/geo.js  (same maths as the server copy)
export function polygonAreaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  const R = 6371008.8;
  const lat0 = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const xy = points.map((p) => ({
    x: p.lng * (Math.PI / 180) * R * Math.cos(lat0),
    y: p.lat * (Math.PI / 180) * R,
  }));
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.round(Math.abs(sum) / 2);
}

export function polygonCentroid(points) {
  const n = points.length;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / n, lng: points.reduce((s, p) => s + p.lng, 0) / n };
}
