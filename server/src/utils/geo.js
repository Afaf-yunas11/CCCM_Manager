// server/src/utils/geo.js
// Area of a drawn polygon in m². Accurate enough for camp-sized sites.
// The polygon must not cross itself.
function polygonAreaM2(points) {
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
module.exports = { polygonAreaM2 };
