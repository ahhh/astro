// Engine 2 — Astronomical calculations.
// Wraps Astronomy Engine (MIT, Don Cross), which implements VSOP87 for the
// planets, a truncated ELP/Brown lunar theory, IAU 2000B nutation and
// IAU 2006 precession. All positions are apparent (light-time + aberration)
// and geocentric unless marked topocentric.

import * as A from '../vendor/astronomy.js';

export const BODIES = [
  { id: 'sun', name: 'Sun', glyph: '☉', body: A.Body.Sun },
  { id: 'moon', name: 'Moon', glyph: '☽', body: A.Body.Moon },
  { id: 'mercury', name: 'Mercury', glyph: '☿', body: A.Body.Mercury },
  { id: 'venus', name: 'Venus', glyph: '♀', body: A.Body.Venus },
  { id: 'mars', name: 'Mars', glyph: '♂', body: A.Body.Mars },
  { id: 'jupiter', name: 'Jupiter', glyph: '♃', body: A.Body.Jupiter },
  { id: 'saturn', name: 'Saturn', glyph: '♄', body: A.Body.Saturn },
  { id: 'uranus', name: 'Uranus', glyph: '♅', body: A.Body.Uranus },
  { id: 'neptune', name: 'Neptune', glyph: '♆', body: A.Body.Neptune },
  { id: 'pluto', name: 'Pluto', glyph: '♇', body: A.Body.Pluto },
];

export const DEG = Math.PI / 180;
export const norm360 = (x) => ((x % 360) + 360) % 360;
export const angDiff = (a, b) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };
export const signedDiff = (a, b) => { let d = norm360(a - b); if (d > 180) d -= 360; return d; };

function eclipticLonLat(body, time) {
  const v = A.GeoVector(body, time, true);
  const e = A.Ecliptic(v);
  return { lon: e.elon, lat: e.elat, dist: v.Length(), vec: v };
}

// Mean lunar node (Meeus, Astronomical Algorithms, eq. 47.7), ecliptic of date.
function meanNode(time) {
  const T = time.tt / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T ** 3) / 467441 - (T ** 4) / 60616000);
}

/**
 * Compute the full astronomical state for a birth context.
 * Returns time metadata, per-body positions in three frames, and the
 * rotation matrices needed to put stars into the same frames.
 */
export function computeSky(ctx) {
  const time = A.MakeTime(ctx.utc);
  const observer = new A.Observer(ctx.lat, ctx.lon, 0);
  const tilt = A.e_tilt(time);
  const gast = A.SiderealTime(time); // hours, Greenwich apparent sidereal time
  const lst = norm360(gast * 15 + ctx.lon); // degrees = RAMC
  const deltaT = (time.tt - time.ut) * 86400;

  const before = time.AddDays(-0.5);
  const after = time.AddDays(0.5);

  const bodies = BODIES.map((b) => {
    const now = eclipticLonLat(b.body, time);
    const lonA = eclipticLonLat(b.body, before).lon;
    const lonB = eclipticLonLat(b.body, after).lon;
    const speed = signedDiff(lonB, lonA); // degrees per day
    const eqdTopo = A.Equator(b.body, time, observer, true, true);
    const eqjGeo = A.EquatorFromVector(now.vec);
    const hor = A.Horizon(time, observer, eqdTopo.ra, eqdTopo.dec, 'normal');
    const elong = b.id === 'sun' ? 0 : A.AngleFromSun(b.body, time);
    let mag = null;
    if (b.id !== 'sun') {
      try { mag = A.Illumination(b.body, time).mag; } catch { mag = null; }
    } else mag = -26.74;
    return {
      ...b,
      lon: now.lon,
      lat: now.lat,
      distAU: now.dist,
      speed,
      retrograde: b.id !== 'sun' && b.id !== 'moon' && speed < 0,
      stationary: b.id !== 'sun' && b.id !== 'moon' && Math.abs(speed) < 0.01,
      raJ2000: eqjGeo.ra * 15,
      decJ2000: eqjGeo.dec,
      raTopo: eqdTopo.ra * 15,
      decTopo: eqdTopo.dec,
      alt: hor.altitude,
      az: hor.azimuth,
      elongation: elong,
      mag,
      vecEQJ: { x: now.vec.x / now.dist, y: now.vec.y / now.dist, z: now.vec.z / now.dist },
    };
  });

  const node = meanNode(time);
  const points = [
    { id: 'node', name: 'North Node', glyph: '☊', lon: node, lat: 0, speed: -0.0529, kind: 'point', retrograde: true },
    { id: 'snode', name: 'South Node', glyph: '☋', lon: norm360(node + 180), lat: 0, speed: -0.0529, kind: 'point', retrograde: true },
  ];

  return {
    time,
    observer,
    jdUT: time.ut + 2451545.0,
    jdTT: time.tt + 2451545.0,
    deltaT,
    obliquity: tilt.tobl,
    meanObliquity: tilt.mobl,
    nutationLon: tilt.dpsi, // arcseconds
    gast,
    lst,
    bodies,
    points,
    rotEQJ_ECT: A.Rotation_EQJ_ECT(time),
    rotEQJ_HOR: A.Rotation_EQJ_HOR(time, observer),
    rotECT_EQJ: A.Rotation_ECT_EQJ(time),
  };
}

export function rotate(rot, x, y, z) {
  const r = rot.rot;
  return [
    r[0][0] * x + r[1][0] * y + r[2][0] * z,
    r[0][1] * x + r[1][1] * y + r[2][1] * z,
    r[0][2] * x + r[1][2] * y + r[2][2] * z,
  ];
}

export function lonLatToVec(lon, lat) {
  const cl = Math.cos(lat * DEG);
  return [cl * Math.cos(lon * DEG), cl * Math.sin(lon * DEG), Math.sin(lat * DEG)];
}

export function vecToLonLat(x, y, z) {
  const r = Math.hypot(x, y, z);
  return { lon: norm360(Math.atan2(y, x) / DEG), lat: Math.asin(z / r) / DEG };
}

/** Horizontal coordinates for an ecliptic-of-date point (used for chart angles). */
export function eclipticToHorizontal(sky, lon, lat = 0) {
  const [x, y, z] = lonLatToVec(lon, lat);
  const eqj = rotate(sky.rotECT_EQJ, x, y, z);
  const [hx, hy, hz] = rotate(sky.rotEQJ_HOR, ...eqj);
  return { alt: Math.asin(hz / Math.hypot(hx, hy, hz)) / DEG, az: norm360(-Math.atan2(hy, hx) / DEG) };
}

/** Great-circle separation of two unit vectors, degrees. */
export function separation(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  return Math.atan2(cross, dot) / DEG;
}

export { A };
