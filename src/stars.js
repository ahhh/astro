// Engine 4 — Fixed stars and constellations.
// Real HYG catalogue positions (J2000, epoch 2000.0) are carried to the birth
// date by applying proper motion, then rotated by precession + nutation into
// the true ecliptic of date — the same frame as the planets — and into the
// observer's horizon frame for the Birth Sky.

import { DEG, norm360, angDiff, rotate, lonLatToVec, separation } from './astro.js';

let catalog = null;

export async function loadCatalog() {
  if (catalog) return catalog;
  const [stars, fixed, cons] = await Promise.all([
    fetch('data/stars.json').then((r) => r.json()),
    fetch('data/fixed-stars.json').then((r) => r.json()),
    fetch('data/constellations.json').then((r) => r.json()),
  ]);
  catalog = { stars, fixed: fixed.stars, fixedMeta: fixed.meta, constellations: cons.constellations, constellationMeta: cons.meta };
  catalog.byHyg = new Map(stars.hyg.map((h, i) => [h, i]));
  catalog.consById = new Map(cons.constellations.map((c) => [c.id, c]));
  return catalog;
}

/** Apply linear proper motion from epoch 2000.0, returning a J2000-frame unit vector. */
export function propagate(raDeg, decDeg, pmra, pmdec, years) {
  const dec = decDeg + (pmdec * years) / 3.6e6;
  const cosd = Math.cos(decDeg * DEG);
  const ra = raDeg + (cosd > 1e-6 ? (pmra * years) / 3.6e6 / cosd : 0);
  const cd = Math.cos(dec * DEG);
  return [cd * Math.cos(ra * DEG), cd * Math.sin(ra * DEG), Math.sin(dec * DEG)];
}

function toLonLat([x, y, z]) {
  return { lon: norm360(Math.atan2(y, x) / DEG), lat: Math.asin(Math.max(-1, Math.min(1, z))) / DEG };
}

function toHorizon(rot, v) {
  const [hx, hy, hz] = rotate(rot, ...v);
  return { alt: Math.asin(Math.max(-1, Math.min(1, hz))) / DEG, az: norm360(-Math.atan2(hy, hx) / DEG) };
}

/**
 * Positions for the whole naked-eye catalogue at the birth instant.
 * Returns typed arrays: J2000 vectors, ecliptic-of-date vectors and horizon vectors.
 */
export function starField(sky) {
  const s = catalog.stars;
  const n = s.ra.length;
  const years = (sky.jdTT - 2451545.0) / 365.25;
  const eqj = new Float32Array(n * 3);
  const ect = new Float32Array(n * 3);
  const hor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = propagate(s.ra[i], s.dec[i], s.pmra[i], s.pmdec[i], years);
    eqj.set(v, i * 3);
    ect.set(rotate(sky.rotEQJ_ECT, ...v), i * 3);
    hor.set(rotate(sky.rotEQJ_HOR, ...v), i * 3);
  }
  return { n, eqj, ect, hor, mag: s.mag, ci: s.ci, years };
}

/** Traditional fixed stars at the birth epoch, in all frames. */
export function fixedStarPositions(sky, ayan) {
  const years = (sky.jdTT - 2451545.0) / 365.25;
  return catalog.fixed.map((f) => {
    const v = propagate(f.ra, f.dec, f.pmra, f.pmdec, years);
    const ectVec = rotate(sky.rotEQJ_ECT, ...v);
    const ecl = toLonLat(ectVec);
    const h = toHorizon(sky.rotEQJ_HOR, v);
    const raNow = norm360(Math.atan2(v[1], v[0]) / DEG);
    const decNow = Math.asin(v[2]) / DEG;
    return {
      ...f,
      kind: 'star',
      vecEQJ: v,
      tropicalLon: ecl.lon,
      lon: norm360(ecl.lon - ayan),
      lat: ecl.lat,
      raEpoch: raNow,
      decEpoch: decNow,
      alt: h.alt,
      az: h.az,
      years,
    };
  });
}

export function fixedStarOrb(star, settings) {
  const base = settings.starOrb;
  if (!settings.starOrbByMag) return base;
  if (star.mag < 1) return base * 2;
  if (star.mag < 2) return base * 1.5;
  return base;
}

/**
 * Planet / angle to fixed-star contacts.
 * Rule "longitude" (traditional): |Δλ| along the ecliptic ≤ orb, ignoring latitude.
 * Rule "sky": true great-circle separation on the sky ≤ orb.
 * Both measurements are always reported so they can be compared.
 */
export function fixedStarContacts(chart, sky, stars, settings) {
  const contacts = [];
  const bodyVec = new Map(sky.bodies.map((b) => [b.id, [b.vecEQJ.x, b.vecEQJ.y, b.vecEQJ.z]]));
  const targets = chart.placements.filter((p) => p.kind === 'body' || (p.kind === 'angle'));
  for (const p of targets) {
    let pv = bodyVec.get(p.id);
    if (!pv) {
      // Chart angles are points on the ecliptic (latitude 0).
      const [x, y, z] = lonLatToVec(p.tropicalLon, 0);
      pv = rotate(sky.rotECT_EQJ, x, y, z);
    }
    for (const s of stars) {
      const dLon = angDiff(p.lon, s.lon);
      const sky_ = separation(pv, s.vecEQJ);
      const orb = fixedStarOrb(s, settings);
      const measure = settings.starRule === 'sky' ? sky_ : dLon;
      if (measure <= orb) {
        contacts.push({
          id: `star:${p.id}:${s.id}`,
          a: p.id, b: s.id,
          lonDiff: dLon,
          skySeparation: sky_,
          starLat: s.lat,
          bodyLat: p.lat || 0,
          orb,
          rule: settings.starRule,
          deviation: measure,
          strength: 1 - measure / orb,
        });
      }
    }
  }
  contacts.sort((x, y) => x.deviation - y.deviation);
  return contacts;
}

export function getCatalog() { return catalog; }

/** B−V colour index to an approximate RGB (Ballesteros 2012 temperature + blackbody fit). */
export function bvToRgb(bv) {
  if (bv === null || bv === undefined || Number.isNaN(bv)) bv = 0.6;
  bv = Math.max(-0.4, Math.min(2.0, bv));
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const k = t / 100;
  let r, g, b;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; b = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04; }
  else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); b = 255; }
  const c = (x) => Math.max(0, Math.min(255, x)) / 255;
  return [c(r), c(g), c(b)];
}
