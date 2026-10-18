// Engine 3 — Astrology rules.
// Converts astronomical ecliptic longitudes into zodiac placements, chart
// angles, houses and aspects. Every function here is pure and testable.

import { DEG, norm360, angDiff, signedDiff } from './astro.js';

export const SIGNS = [
  { id: 'aries', name: 'Aries', glyph: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'mars', modernRuler: 'mars' },
  { id: 'taurus', name: 'Taurus', glyph: '♉', element: 'Earth', modality: 'Fixed', ruler: 'venus', modernRuler: 'venus' },
  { id: 'gemini', name: 'Gemini', glyph: '♊', element: 'Air', modality: 'Mutable', ruler: 'mercury', modernRuler: 'mercury' },
  { id: 'cancer', name: 'Cancer', glyph: '♋', element: 'Water', modality: 'Cardinal', ruler: 'moon', modernRuler: 'moon' },
  { id: 'leo', name: 'Leo', glyph: '♌', element: 'Fire', modality: 'Fixed', ruler: 'sun', modernRuler: 'sun' },
  { id: 'virgo', name: 'Virgo', glyph: '♍', element: 'Earth', modality: 'Mutable', ruler: 'mercury', modernRuler: 'mercury' },
  { id: 'libra', name: 'Libra', glyph: '♎', element: 'Air', modality: 'Cardinal', ruler: 'venus', modernRuler: 'venus' },
  { id: 'scorpio', name: 'Scorpio', glyph: '♏', element: 'Water', modality: 'Fixed', ruler: 'mars', modernRuler: 'pluto' },
  { id: 'sagittarius', name: 'Sagittarius', glyph: '♐', element: 'Fire', modality: 'Mutable', ruler: 'jupiter', modernRuler: 'jupiter' },
  { id: 'capricorn', name: 'Capricorn', glyph: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'saturn', modernRuler: 'saturn' },
  { id: 'aquarius', name: 'Aquarius', glyph: '♒', element: 'Air', modality: 'Fixed', ruler: 'saturn', modernRuler: 'uranus' },
  { id: 'pisces', name: 'Pisces', glyph: '♓', element: 'Water', modality: 'Mutable', ruler: 'jupiter', modernRuler: 'neptune' },
];

// Essential dignities (Ptolemaic). Signs by index.
export const DIGNITIES = {
  sun: { domicile: [4], exaltation: 0, detriment: [10], fall: 6 },
  moon: { domicile: [3], exaltation: 1, detriment: [9], fall: 7 },
  mercury: { domicile: [2, 5], exaltation: 5, detriment: [8, 11], fall: 11 },
  venus: { domicile: [1, 6], exaltation: 11, detriment: [7, 0], fall: 5 },
  mars: { domicile: [0, 7], exaltation: 9, detriment: [6, 1], fall: 3 },
  jupiter: { domicile: [8, 11], exaltation: 3, detriment: [2, 5], fall: 9 },
  saturn: { domicile: [9, 10], exaltation: 6, detriment: [3, 4], fall: 0 },
  uranus: { domicile: [10], exaltation: null, detriment: [4], fall: null },
  neptune: { domicile: [11], exaltation: null, detriment: [5], fall: null },
  pluto: { domicile: [7], exaltation: null, detriment: [1], fall: null },
};

export const ASPECTS = [
  { id: 'conjunction', name: 'Conjunction', glyph: '☌', angle: 0, orb: 8, color: '#f2c14e', dash: null, nature: 'blending' },
  { id: 'sextile', name: 'Sextile', glyph: '⚹', angle: 60, orb: 5, color: '#5aa9ff', dash: [2, 3], nature: 'harmonious' },
  { id: 'square', name: 'Square', glyph: '□', angle: 90, orb: 7, color: '#ff5d5d', dash: [8, 4], nature: 'challenging' },
  { id: 'trine', name: 'Trine', glyph: '△', angle: 120, orb: 7, color: '#4cd18a', dash: null, nature: 'harmonious' },
  { id: 'opposition', name: 'Opposition', glyph: '☍', angle: 180, orb: 8, color: '#b58cff', dash: [12, 3, 2, 3], nature: 'challenging' },
];

export const ZODIACS = {
  tropical: { id: 'tropical', name: 'Tropical', short: 'Tropical' },
  lahiri: { id: 'lahiri', name: 'Sidereal — Lahiri (Chitrapaksha)', short: 'Sidereal (Lahiri)', j2000: 23.85709 },
  fagan: { id: 'fagan', name: 'Sidereal — Fagan/Bradley', short: 'Sidereal (Fagan/Bradley)', j2000: 24.74028 },
};

export const HOUSE_SYSTEMS = {
  'whole-sign': { id: 'whole-sign', name: 'Whole Sign' },
  placidus: { id: 'placidus', name: 'Placidus' },
  equal: { id: 'equal', name: 'Equal (from Ascendant)' },
  porphyry: { id: 'porphyry', name: 'Porphyry' },
};

/**
 * Ayanamsa: the angle between the tropical zero point (vernal equinox of
 * date) and the sidereal zero point. Value at J2000 plus IAU 2006 general
 * precession in longitude (Capitaine et al. 2003).
 */
export function ayanamsa(zodiac, jdTT) {
  const z = ZODIACS[zodiac];
  if (!z || !z.j2000) return 0;
  const T = (jdTT - 2451545.0) / 36525;
  const p = (5028.796195 * T + 1.1054348 * T * T) / 3600;
  return z.j2000 + p;
}

export function signOf(lon) {
  const l = norm360(lon);
  const idx = Math.floor(l / 30) % 12;
  const within = l - idx * 30;
  const d = Math.floor(within);
  const mFloat = (within - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return { index: idx, sign: SIGNS[idx], degree: within, d, m, s };
}

export function fmtDeg(x) {
  const d = Math.floor(x);
  let m = Math.round((x - d) * 60);
  if (m === 60) return `${d + 1}°00′`;
  return `${d}°${String(m).padStart(2, '0')}′`;
}

export function fmtLon(lon) {
  const s = signOf(lon);
  return `${fmtDeg(s.degree)} ${s.sign.name}`;
}

// --- Angles -----------------------------------------------------------------

/**
 * Midheaven and Ascendant from RAMC (local apparent sidereal time in degrees),
 * true obliquity and geographic latitude. Standard spherical-astronomy
 * formulas; the ASC is the ecliptic point rising on the eastern horizon.
 */
export function chartAngles(ramc, obliquity, latitude) {
  const r = ramc * DEG;
  const e = obliquity * DEG;
  const phi = latitude * DEG;
  const mc = norm360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) / DEG);
  let asc = norm360(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(phi) * Math.sin(e))) / DEG);
  // The Ascendant always lies in the half of the zodiac following the MC.
  if (norm360(asc - mc) > 180) asc = norm360(asc + 180);
  return { asc, mc, dsc: norm360(asc + 180), ic: norm360(mc + 180) };
}

function ecliptic_from_ra(ra, e) {
  return norm360(Math.atan2(Math.sin(ra * DEG), Math.cos(ra * DEG) * Math.cos(e * DEG)) / DEG);
}

/**
 * Placidus cusps by iteration. A cusp lies on the ecliptic point whose
 * diurnal (or nocturnal) semi-arc has been trisected: e.g. cusp 11 is
 * the point that has completed 1/3 of its semi-arc from rising to culminating.
 * Returns null when the latitude makes semi-arcs undefined (polar regions).
 */
export function placidusCusps(ramc, obliquity, latitude, angles) {
  const phi = latitude * DEG;
  const e = obliquity * DEG;
  const solve = (fraction, nocturnal) => {
    let lon = norm360(ramc + (nocturnal ? 180 - 90 * fraction : 90 * fraction));
    for (let i = 0; i < 60; i++) {
      const dec = Math.asin(Math.sin(e) * Math.sin(lon * DEG));
      const x = Math.tan(phi) * Math.tan(dec);
      if (Math.abs(x) >= 1) return null;
      const ad = Math.asin(x) / DEG; // ascensional difference
      const ra = nocturnal ? ramc + 180 - fraction * (90 - ad) : ramc + fraction * (90 + ad);
      const next = ecliptic_from_ra(norm360(ra), obliquity);
      if (angDiff(next, lon) < 1e-9) { lon = next; break; }
      lon = next;
    }
    return lon;
  };
  const c11 = solve(1 / 3, false);
  const c12 = solve(2 / 3, false);
  const c2 = solve(2 / 3, true);
  const c3 = solve(1 / 3, true);
  if ([c11, c12, c2, c3].some((c) => c === null)) return null;
  const cusps = new Array(12);
  cusps[0] = angles.asc; cusps[1] = c2; cusps[2] = c3; cusps[3] = angles.ic;
  cusps[9] = angles.mc; cusps[10] = c11; cusps[11] = c12;
  cusps[4] = norm360(c11 + 180); cusps[5] = norm360(c12 + 180);
  cusps[6] = angles.dsc; cusps[7] = norm360(c2 + 180); cusps[8] = norm360(c3 + 180);
  return cusps;
}

export function houseCusps(system, angles, ramc, obliquity, latitude) {
  const { asc, mc } = angles;
  if (system === 'whole-sign') {
    const start = Math.floor(asc / 30) * 30;
    return { system, cusps: Array.from({ length: 12 }, (_, i) => norm360(start + 30 * i)), note: null };
  }
  if (system === 'equal') {
    return { system, cusps: Array.from({ length: 12 }, (_, i) => norm360(asc + 30 * i)), note: null };
  }
  if (system === 'placidus') {
    const cusps = placidusCusps(ramc, obliquity, latitude, angles);
    if (cusps) return { system, cusps, note: null };
    const fallback = houseCusps('porphyry', angles, ramc, obliquity, latitude);
    return { ...fallback, system: 'porphyry', requested: 'placidus', note: `Placidus is undefined at latitude ${latitude.toFixed(2)}°: some ecliptic degrees never rise or set, so their semi-arcs cannot be trisected. Porphyry houses are shown instead.` };
  }
  // Porphyry: trisect each quadrant in ecliptic longitude.
  const q1 = norm360(angles.ic - asc);
  const q2 = norm360(angles.dsc - angles.ic);
  const cusps = new Array(12);
  cusps[0] = asc;
  cusps[1] = norm360(asc + q1 / 3); cusps[2] = norm360(asc + 2 * q1 / 3);
  cusps[3] = angles.ic;
  cusps[4] = norm360(angles.ic + q2 / 3); cusps[5] = norm360(angles.ic + 2 * q2 / 3);
  for (let i = 6; i < 12; i++) cusps[i] = norm360(cusps[i - 6] + 180);
  void mc;
  return { system: 'porphyry', cusps, note: null };
}

export function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i];
    const b = cusps[(i + 1) % 12];
    const span = norm360(b - a);
    if (norm360(lon - a) < span) return i + 1;
  }
  return 1;
}

// --- Aspects ------------------------------------------------------------------

export function aspectBetween(a, b, settings) {
  const sep = angDiff(a.lon, b.lon);
  let best = null;
  for (const asp of ASPECTS) {
    if (settings.enabledAspects && !settings.enabledAspects[asp.id]) continue;
    let orb = settings.orbs?.[asp.id] ?? asp.orb;
    if (settings.luminaryBonus && (['sun', 'moon'].includes(a.id) || ['sun', 'moon'].includes(b.id))) orb += settings.luminaryBonus;
    if (a.kind === 'angle' || b.kind === 'angle' || a.kind === 'point' || b.kind === 'point') orb = Math.min(orb, settings.angleOrb ?? 5);
    const dev = Math.abs(sep - asp.angle);
    if (dev <= orb && (!best || dev < best.deviation)) best = { aspect: asp, separation: sep, deviation: dev, orb };
  }
  if (!best) return null;
  // Applying when the separation is moving toward exactness.
  const dt = 0.1; // days
  const sepLater = angDiff(a.lon + (a.speed || 0) * dt, b.lon + (b.speed || 0) * dt);
  const devLater = Math.abs(sepLater - best.aspect.angle);
  best.applying = devLater < best.deviation;
  best.strength = 1 - best.deviation / best.orb;
  return best;
}

export function findAspects(objects, settings) {
  const out = [];
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      if (a.kind === 'angle' && b.kind === 'angle') continue;
      if (a.kind === 'point' && b.kind === 'point') continue;
      if ((a.id === 'node' && b.id === 'snode') || (a.id === 'snode' && b.id === 'node')) continue;
      const hit = aspectBetween(a, b, settings);
      if (hit) out.push({ id: `asp:${a.id}:${b.id}`, a: a.id, b: b.id, ...hit });
    }
  }
  out.sort((x, y) => x.deviation - y.deviation);
  return out;
}

// --- Dignities, patterns, balances ------------------------------------------

export function dignityOf(bodyId, signIndex) {
  const d = DIGNITIES[bodyId];
  if (!d) return null;
  if (d.domicile.includes(signIndex)) return 'domicile';
  if (d.exaltation === signIndex) return 'exaltation';
  if (d.detriment.includes(signIndex)) return 'detriment';
  if (d.fall === signIndex) return 'fall';
  return null;
}

export function findPatterns(placements, aspects) {
  const patterns = [];
  const planets = placements.filter((p) => p.kind === 'body');
  const has = (x, y, type) => aspects.some((a) => a.aspect.id === type && ((a.a === x && a.b === y) || (a.a === y && a.b === x)));

  const bySign = new Map();
  const byHouse = new Map();
  for (const p of planets) {
    bySign.set(p.signIndex, [...(bySign.get(p.signIndex) || []), p.id]);
    if (p.house) byHouse.set(p.house, [...(byHouse.get(p.house) || []), p.id]);
  }
  for (const [s, ids] of bySign) if (ids.length >= 3) patterns.push({ id: `pat:stellium-sign-${s}`, type: 'stellium', label: `Stellium in ${SIGNS[s].name}`, members: ids, rule: '3 or more planets in one sign' });
  for (const [h, ids] of byHouse) if (ids.length >= 3) patterns.push({ id: `pat:stellium-house-${h}`, type: 'stellium', label: `Stellium in house ${h}`, members: ids, rule: '3 or more planets in one house' });

  const ids = planets.map((p) => p.id);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) {
    const [x, y, z] = [ids[i], ids[j], ids[k]];
    if (has(x, y, 'trine') && has(y, z, 'trine') && has(x, z, 'trine')) patterns.push({ id: `pat:gt-${x}-${y}-${z}`, type: 'grand-trine', label: 'Grand Trine', members: [x, y, z], rule: 'three planets mutually trine (120° each)' });
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (!has(ids[i], ids[j], 'opposition')) continue;
    for (const apex of ids) {
      if (apex === ids[i] || apex === ids[j]) continue;
      if (has(apex, ids[i], 'square') && has(apex, ids[j], 'square')) patterns.push({ id: `pat:ts-${ids[i]}-${ids[j]}-${apex}`, type: 't-square', label: `T-Square (apex ${apex[0].toUpperCase() + apex.slice(1)})`, members: [ids[i], ids[j], apex], rule: 'an opposition with a third planet square to both ends' });
    }
  }
  return patterns;
}

export function balances(placements) {
  const el = { Fire: [], Earth: [], Air: [], Water: [] };
  const mo = { Cardinal: [], Fixed: [], Mutable: [] };
  for (const p of placements) {
    if (p.kind !== 'body') continue;
    el[SIGNS[p.signIndex].element].push(p.id);
    mo[SIGNS[p.signIndex].modality].push(p.id);
  }
  return { elements: el, modalities: mo };
}

/**
 * Build the Natal Chart contract from the astronomical state.
 */
export function buildChart(ctx, sky, settings) {
  const ayan = ayanamsa(settings.zodiac, sky.jdTT);
  const toZ = (lon) => norm360(lon - ayan);

  let angles = null;
  let houses = null;
  const cautions = [];
  if (ctx.timeKnown) {
    const trop = chartAngles(sky.lst, sky.obliquity, ctx.lat);
    angles = { asc: toZ(trop.asc), mc: toZ(trop.mc), dsc: toZ(trop.dsc), ic: toZ(trop.ic), tropical: trop };
    const h = houseCusps(settings.houseSystem, trop, sky.lst, sky.obliquity, ctx.lat);
    let cusps = h.cusps.map(toZ);
    if (h.system === 'whole-sign' && ayan) {
      const start = Math.floor(angles.asc / 30) * 30;
      cusps = cusps.map((_, i) => norm360(start + 30 * i));
    }
    houses = { ...h, cusps };
    if (h.note) cautions.push(h.note);
    if (Math.abs(ctx.lat) > 60) cautions.push('High latitude: quadrant house sizes become extremely unequal and the Ascendant moves very fast.');
  }

  const placements = [];
  for (const b of sky.bodies) {
    const lon = toZ(b.lon);
    const s = signOf(lon);
    placements.push({
      id: b.id, name: b.name, glyph: b.glyph, kind: 'body',
      lon, tropicalLon: b.lon, lat: b.lat, speed: b.speed, retrograde: b.retrograde, stationary: b.stationary,
      signIndex: s.index, degree: s.degree,
      house: houses ? houseOf(lon, houses.cusps) : null,
      dignity: dignityOf(b.id, s.index),
      astro: b,
    });
  }
  for (const p of sky.points) {
    const lon = toZ(p.lon);
    const s = signOf(lon);
    placements.push({ ...p, kind: 'point', lon, tropicalLon: p.lon, signIndex: s.index, degree: s.degree, house: houses ? houseOf(lon, houses.cusps) : null });
  }
  if (angles) {
    for (const [id, name, glyph] of [['asc', 'Ascendant', 'AC'], ['mc', 'Midheaven', 'MC'], ['dsc', 'Descendant', 'DC'], ['ic', 'Imum Coeli', 'IC']]) {
      const lon = angles[id];
      const s = signOf(lon);
      placements.push({ id, name, glyph, kind: 'angle', lon, tropicalLon: angles.tropical[id], lat: 0, speed: 360.98, signIndex: s.index, degree: s.degree, house: null });
    }
  }

  const aspectObjects = placements.filter((p) => p.kind === 'body' || (settings.includeNodes && p.id === 'node') || (p.kind === 'angle' && (p.id === 'asc' || p.id === 'mc')));
  const aspects = findAspects(aspectObjects, settings);
  const patterns = findPatterns(placements, aspects);

  let chartRuler = null;
  if (angles) {
    const ascSign = SIGNS[signOf(angles.asc).index];
    chartRuler = settings.modernRulers ? ascSign.modernRuler : ascSign.ruler;
  }

  // Sect: a day chart has the Sun above the horizon at the birth place.
  const sunAlt = sky.bodies.find((b) => b.id === 'sun').alt;
  const sect = ctx.timeKnown ? (sunAlt > 0 ? 'day' : 'night') : null;

  return {
    zodiac: settings.zodiac,
    ayanamsa: ayan,
    houseSystem: houses ? houses.system : null,
    houses,
    angles,
    placements,
    aspects,
    patterns,
    balances: balances(placements),
    chartRuler,
    sect,
    cautions,
  };
}
