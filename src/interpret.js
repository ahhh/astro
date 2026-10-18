// Engine 7 — Interpretation content and explanations.
// Two kinds of text live here and are always kept visually separate:
//   FACT   — what was measured or computed, and how.
//   LORE   — what Western astrological tradition says it symbolises.
// Lore is symbolic and non-predictive; it never claims causation.

import { SIGNS, ASPECTS, fmtDeg, fmtLon, signOf, ZODIACS, HOUSE_SYSTEMS } from './astrology.js';

export const PLANET_TEXT = {
  sun: { lore: 'Core identity, vitality and conscious purpose — the "I am" of the chart.', keywords: 'identity · will · vitality', fact: 'Its ecliptic longitude defines the zodiac year: the Sun crosses 0° Aries at the March equinox.' },
  moon: { lore: 'Emotional needs, instinct, memory and what makes you feel safe.', keywords: 'feeling · habit · nurture', fact: 'Moves about 13° per day, so an unknown birth time can shift it by up to ~7°.' },
  mercury: { lore: 'Thinking, speaking, learning and how you process information.', keywords: 'mind · speech · exchange', fact: 'Never more than ~28° from the Sun as seen from Earth; appears retrograde ~3 times a year.' },
  venus: { lore: 'Attraction, values, pleasure, aesthetics and how you relate.', keywords: 'love · value · harmony', fact: 'Never more than ~47° from the Sun; brightest planet in the sky.' },
  mars: { lore: 'Drive, desire, courage, conflict and how you go after things.', keywords: 'action · desire · courage', fact: 'Appears retrograde for ~2 months every ~26 months, near opposition to the Sun.' },
  jupiter: { lore: 'Growth, faith, generosity, opportunity and the search for meaning.', keywords: 'expansion · wisdom · luck', fact: 'Takes ~12 years to circle the zodiac — roughly one sign per year.' },
  saturn: { lore: 'Structure, discipline, limits, time and hard-won mastery.', keywords: 'form · duty · maturity', fact: 'Takes ~29.5 years to circle the zodiac (the "Saturn return").' },
  uranus: { lore: 'Innovation, awakening, rebellion and sudden change.', keywords: 'freedom · disruption · insight', fact: 'Discovered 1781 by William Herschel; ~84-year orbit, ~7 years per sign.' },
  neptune: { lore: 'Dreams, imagination, compassion, dissolution and illusion.', keywords: 'vision · empathy · fog', fact: 'Discovered 1846 from predictions based on Uranus\' orbit; ~165-year orbit.' },
  pluto: { lore: 'Power, depth, transformation, endings and rebirth.', keywords: 'depth · power · renewal', fact: 'Discovered 1930, reclassified as a dwarf planet in 2006; its eccentric 248-year orbit makes sign stays uneven (12–32 years).' },
  node: { lore: 'The North Node marks a direction of growth in modern astrology; in older tradition, the "dragon\'s head" where eclipses happen.', keywords: 'direction · growth', fact: 'Calculated, not a body: where the Moon\'s orbit crosses the ecliptic going north. The mean node regresses ~19.3° per year.' },
  snode: { lore: 'The South Node marks the familiar and habitual in modern astrology; the "dragon\'s tail".', keywords: 'habit · release', fact: 'Always exactly opposite the North Node.' },
};

export const SIGN_TEXT = {
  aries: 'Initiative, courage, directness — the spark of beginnings.',
  taurus: 'Stability, sensuality, patience — building and keeping.',
  gemini: 'Curiosity, wit, versatility — connecting ideas and people.',
  cancer: 'Nurture, protection, feeling — home and belonging.',
  leo: 'Expression, warmth, pride — the creative heart.',
  virgo: 'Discernment, craft, service — refining and improving.',
  libra: 'Balance, partnership, fairness — weighing and relating.',
  scorpio: 'Intensity, depth, transformation — what lies beneath.',
  sagittarius: 'Exploration, meaning, candour — the far horizon.',
  capricorn: 'Ambition, structure, responsibility — the long climb.',
  aquarius: 'Independence, ideals, community — the future-minded.',
  pisces: 'Empathy, imagination, surrender — boundaries dissolve.',
};

export const HOUSE_TEXT = [
  'Self, body, appearance and how you meet the world.',
  'Money, possessions, resources and self-worth.',
  'Siblings, neighbours, short journeys, everyday communication.',
  'Home, family, roots, ancestry and private life.',
  'Creativity, romance, children, play and pleasure.',
  'Work routines, health, service and daily habits.',
  'Partnerships, marriage, open adversaries — the significant other.',
  'Shared resources, debt, intimacy, death and inheritance.',
  'Travel, higher learning, philosophy, religion and law.',
  'Career, reputation, public role and authority.',
  'Friends, groups, hopes and benefactors.',
  'The hidden, solitude, retreat, institutions and self-undoing.',
];

export const ANGLE_TEXT = {
  asc: { name: 'Ascendant', lore: 'The rising sign: your outward style and how you begin things. Ruler of house 1.', fact: 'The ecliptic degree rising on the eastern horizon at birth. It sweeps through all 12 signs every ~24 hours (~1° every 4 minutes).' },
  mc: { name: 'Midheaven (Medium Coeli)', lore: 'Public life, vocation and aspiration.', fact: 'The ecliptic degree culminating on the local meridian (due south in the northern hemisphere). Not the same as the zenith.' },
  dsc: { name: 'Descendant', lore: 'What you seek in others; partnership.', fact: 'The ecliptic degree setting on the western horizon — exactly opposite the Ascendant.' },
  ic: { name: 'Imum Coeli', lore: 'Roots, home and private foundations.', fact: 'The ecliptic degree on the meridian below the horizon — opposite the Midheaven.' },
};

export const ASPECT_TEXT = {
  conjunction: 'The two energies fuse and act together, for better or worse — the most powerful contact.',
  sextile: 'A cooperative opportunity that rewards effort; easy flow when activated.',
  square: 'Friction and tension that demand action; a source of drive and growth.',
  trine: 'Natural ease and talent; harmonious flow that can become complacent.',
  opposition: 'Polarity and awareness through others; a pull between two ends seeking balance.',
};

export const DIGNITY_TEXT = {
  domicile: 'Domicile — the planet is in a sign it rules; traditionally strong and comfortable.',
  exaltation: 'Exaltation — the planet is honoured here; traditionally elevated.',
  detriment: 'Detriment — opposite its own sign; traditionally working against the grain.',
  fall: 'Fall — opposite its exaltation; traditionally weakened or humbled.',
};

// --- Glossary: every data-tip="g:key" in the UI resolves here ---------------

export const GLOSSARY = {
  ecliptic: ['Ecliptic', 'The Sun\'s apparent yearly path around the sky — the plane of Earth\'s orbit projected onto the sky. Planets stay close to it. Zodiac signs are 30° slices of this circle.'],
  eclipticLon: ['Ecliptic longitude (λ)', 'Angle measured eastward along the ecliptic from the vernal equinox (tropical) or a fixed-star reference point (sidereal). This single number is what astrology turns into "12° Leo".'],
  eclipticLat: ['Ecliptic latitude (β)', 'Angle north or south of the ecliptic. Astrology mostly ignores it — which is why a planet and a star can be "conjunct" in longitude while far apart in the sky.'],
  ra: ['Right ascension / declination', 'Equatorial coordinates: the celestial equivalent of longitude/latitude, measured from the celestial equator. Catalogues like Hipparcos use this frame (J2000).'],
  altaz: ['Altitude / azimuth', 'Where something actually appeared from the birthplace: altitude is height above the horizon (negative = below), azimuth is compass direction (0° N, 90° E, 180° S, 270° W). Includes atmospheric refraction for planets.'],
  tropical: ['Tropical zodiac', 'Signs anchored to the seasons: 0° Aries is defined as the March equinox point. Because of precession, tropical signs have drifted ~24° from the constellations of the same names since antiquity.'],
  sidereal: ['Sidereal zodiac', 'Signs anchored to the stars. The offset from tropical is the ayanamsa. Used in Indian (Jyotiṣa) astrology and Western sidereal astrology.'],
  ayanamsa: ['Ayanamsa', 'The angle between the tropical and sidereal zero points. It grows ~50.3″ per year due to precession. Lahiri fixes Spica at 0° Libra; Fagan/Bradley uses a different anchor.'],
  precession: ['Precession', 'Earth\'s axis wobbles like a top over ~25,772 years, so the equinox point slides westward through the stars by ~1° every 72 years. This is why fixed-star longitudes increase over time.'],
  properMotion: ['Proper motion', 'The real sideways motion of a star across the sky, measured by Hipparcos in milliarcseconds per year. Applied here to move each star from its 2000.0 position to your birth date.'],
  j2000: ['J2000 / ICRS', 'Standard astronomical reference frame fixed to the Earth\'s equator and equinox at noon, 1 Jan 2000. Star catalogue coordinates are given in this frame and must be rotated to the "of date" frame for a birth chart.'],
  ofDate: ['True ecliptic of date', 'The ecliptic and equinox as they were at the birth moment, including precession and nutation. Planets and stars are both expressed in this frame so their longitudes are directly comparable.'],
  nutation: ['Nutation', 'A small nodding of Earth\'s axis (up to ~17″) caused mainly by the Moon. Included via the IAU 2000B model.'],
  obliquity: ['Obliquity (ε)', 'Tilt between Earth\'s equator and the ecliptic, about 23.44°. It sets how equatorial (RA) and ecliptic coordinates relate, and so shapes the Ascendant and house cusps.'],
  deltaT: ['ΔT (Delta T)', 'Difference between uniform Terrestrial Time (used for ephemerides) and Universal Time (tied to Earth\'s irregular rotation). About 69 s today, but several minutes in the 1800s.'],
  gast: ['Sidereal time', 'Time measured by the stars rather than the Sun. Greenwich Apparent Sidereal Time plus your longitude gives local sidereal time, which tells which part of the zodiac is overhead.'],
  ramc: ['RAMC', 'Right Ascension of the Midheaven = local sidereal time in degrees. The starting point for computing the MC, Ascendant and quadrant house cusps.'],
  geocentric: ['Geocentric', 'Positions as seen from Earth\'s centre — the standard for natal charts. For the Moon this differs from the birthplace view by up to ~1°.'],
  topocentric: ['Topocentric', 'Positions as seen from the birthplace on Earth\'s surface. Used for the Birth Sky view.'],
  magnitude: ['Apparent magnitude', 'Brightness as seen from Earth. Smaller is brighter: Sirius −1.44, Polaris 1.98, the faintest naked-eye stars ~6.5. Each step is 2.512× fainter.'],
  orb: ['Orb', 'How far from exact an aspect may be and still count. Here: the allowed difference between the measured angular separation and the aspect\'s ideal angle.'],
  applying: ['Applying / separating', 'Applying: the faster body is moving toward the exact angle — traditionally stronger and still "building". Separating: past exact, waning. Determined from each body\'s daily motion.'],
  retrograde: ['Retrograde (℞)', 'Apparent backward motion along the ecliptic as Earth overtakes (or is overtaken by) another planet. The planet does not really reverse; it\'s a line-of-sight effect. Traditionally read as internalised or revisiting.'],
  aspect: ['Aspect', 'A meaningful angle between two chart points, measured in ecliptic longitude: 0°, 60°, 90°, 120°, 180°. Derived from dividing the 360° circle by 1, 6, 4, 3 and 2.'],
  house: ['Houses', 'Twelve divisions of the sky based on the birthplace\'s horizon and meridian, read as areas of life. Unlike signs, they depend on birth time and place.'],
  houseSystem: ['House system', 'Different mathematical methods for dividing the local sky into 12 houses. They all agree on the Ascendant (house 1) in most systems but disagree on intermediate cusps.'],
  wholeSign: ['Whole Sign houses', 'The oldest system (Hellenistic): the entire rising sign is house 1, the next sign house 2, and so on. Each house is exactly one sign.'],
  placidus: ['Placidus houses', 'Divides each point\'s time above (or below) the horizon — its semi-arc — into thirds. The most popular modern system; mathematically undefined above ~66° latitude.'],
  equal: ['Equal houses', 'Twelve 30° houses measured from the exact Ascendant degree.'],
  porphyry: ['Porphyry houses', 'Divides each of the four quadrants between ASC, IC, DSC and MC into three equal parts of ecliptic longitude.'],
  sign: ['Zodiac sign', 'A 30° slice of the ecliptic — not the same thing as the constellation of the same name, whose real boundaries are irregular and unequal.'],
  constellation: ['IAU constellation', 'One of 88 officially bounded regions of sky (1930). Constellations are patterns as seen from Earth; their stars are usually at very different distances.'],
  fixedStar: ['Fixed star', 'A real star used in astrology. "Fixed" because they move only ~1° per 72 years in longitude (precession) compared with the planets.'],
  fixedStarRule: ['Fixed-star conjunction rule', 'Traditional method: compare ecliptic longitudes only (projecting the star straight down onto the ecliptic). Sky method: require the real angular distance on the sky to be within the orb. Both distances are always shown.'],
  skySeparation: ['True sky separation', 'The real angular distance between two objects as you would measure it on the sky, computed from their 3D direction vectors. Compare with the longitude-only difference used in tradition.'],
  nature: ['Ptolemaic nature', 'Ptolemy (2nd c. CE) described each bright star as having the "nature" of one or two planets, e.g. Regulus = Mars/Jupiter. This is the traditional basis for interpreting fixed-star contacts.'],
  royalStars: ['Royal Stars of Persia', 'Aldebaran, Regulus, Antares and Fomalhaut — four bright stars roughly 90° apart that once marked the solstices and equinoxes.'],
  dignity: ['Essential dignity', 'Traditional scoring of how "at home" a planet is in a sign: domicile and exaltation are strong; detriment and fall are weak.'],
  chartRuler: ['Chart ruler', 'The planet that rules the Ascendant\'s sign. Traditionally the most personal planet in the chart.'],
  sect: ['Sect', 'Whether the Sun was above (day chart) or below (night chart) the horizon. Hellenistic astrology treats Jupiter/Sun/Saturn as the "day team" and Moon/Venus/Mars as the "night team".'],
  stellium: ['Stellium', 'Three or more planets gathered in one sign or house — a concentration of emphasis.'],
  grandTrine: ['Grand Trine', 'Three planets each 120° apart, forming an equilateral triangle — traditionally a closed circuit of ease and talent.'],
  tSquare: ['T-Square', 'Two planets in opposition, both square a third (the apex) — a dynamic, tension-driven configuration.'],
  element: ['Elements', 'Fire, Earth, Air and Water cycle through the signs in order. Counting your planets per element is a quick summary of temperament in tradition.'],
  modality: ['Modalities', 'Cardinal (initiating), Fixed (sustaining) and Mutable (adapting) — the three phases of each season.'],
  node: ['Lunar nodes', 'Where the Moon\'s orbit crosses the ecliptic. Eclipses occur only when the Sun and Moon are near a node. These are calculated points, not physical objects.'],
  lmt: ['Local Mean Time', 'Before standard time zones (late 1800s), clocks were set to the local mean Sun. The browser\'s tz database records this for many cities, offset to the second.'],
  dst: ['Daylight saving & history', 'Clock rules have changed many times by law. The app uses the IANA time-zone database built into your browser, so a 1975 birth uses 1975\'s rules, not today\'s.'],
  hyg: ['HYG Database', 'A merger of the Hipparcos, Yale Bright Star and Gliese catalogues (v4.1). Each star here carries its real measured position, proper motion, magnitude and colour.'],
  vsop: ['Ephemeris', 'Planet positions come from Astronomy Engine, which implements VSOP87 (planets), a lunar theory derived from Brown/ELP, and IAU precession/nutation. Accuracy ≈ 1 arcminute — far finer than any orb.'],
  network: ['Connection network', 'A graph of every rule-defined relationship in the chart. Lines are information, not physical beams or forces. Layout distance means nothing physically.'],
  wheel: ['Natal Wheel', 'A schematic chart: the ecliptic drawn as a circle with the Ascendant on the left. Real stars are rotated into the same frame behind it, so the zodiac ring lines up with the actual star field.'],
  birthSky: ['Birth Sky', 'The real sky from the birthplace at the birth moment. Directions are physically accurate; distances are not shown (everything sits on a sphere).'],
  luminaryBonus: ['Luminary orb bonus', 'Many astrologers allow wider orbs for aspects involving the Sun or Moon, because they are the dominant lights of the chart.'],
  modernRulers: ['Modern vs traditional rulers', 'Traditional (pre-1781) rulers use the seven visible planets only. Modern rulers assign Uranus to Aquarius, Neptune to Pisces and Pluto to Scorpio.'],
  timeUnknown: ['Unknown birth time', 'Without a time the chart is cast for local noon. Planet signs are usually still right (except possibly the Moon), but the Ascendant, Midheaven and houses can\'t be known.'],
  angularity: ['Angular planet', 'A planet within a few degrees of the ASC, MC, DSC or IC. Traditionally strongly emphasised — it was rising, culminating, setting or anti-culminating at birth.'],
};

export function glossaryHtml(key) {
  const g = GLOSSARY[key];
  if (!g) return null;
  return `<div class="tip-title">${g[0]}</div><div class="tip-body">${g[1]}</div>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lore = (txt) => `<div class="tip-lore"><span class="tag tag-lore">Tradition</span> ${txt}</div>`;
const fact = (txt) => `<div class="tip-fact"><span class="tag tag-fact">Astronomy</span> ${txt}</div>`;
const row = (k, v) => `<div class="tip-row"><span>${k}</span><b>${v}</b></div>`;

function zodiacLabel(model) { return ZODIACS[model.settings.zodiac].short; }

export function placementTip(model, p) {
  const s = signOf(p.lon);
  const sign = SIGNS[s.index];
  if (p.kind === 'angle') {
    const t = ANGLE_TEXT[p.id];
    return `<div class="tip-title">${p.glyph} ${t.name} — ${fmtLon(p.lon)}</div>
      ${row('Longitude', `${p.lon.toFixed(3)}° (${zodiacLabel(model)})`)}
      ${row('Computed from', `RAMC ${model.sky.lst.toFixed(3)}°, ε ${model.sky.obliquity.toFixed(4)}°, φ ${model.ctx.lat.toFixed(3)}°`)}
      ${fact(t.fact)}${lore(t.lore + ` In ${sign.name}: ${SIGN_TEXT[sign.id]}`)}`;
  }
  const t = PLANET_TEXT[p.id];
  const a = p.astro;
  return `<div class="tip-title">${p.glyph} ${p.name} in ${sign.name} ${p.retrograde && p.kind === 'body' ? '<span class="rx">℞</span>' : ''}</div>
    ${row('Position', `${fmtDeg(s.degree)} ${sign.glyph} ${sign.name}`)}
    ${row('Ecliptic λ / β', `${p.lon.toFixed(3)}° / ${(p.lat ?? 0).toFixed(3)}°`)}
    ${p.house ? row('House', `${p.house} (${HOUSE_SYSTEMS[model.chart.houseSystem]?.name ?? ''})`) : ''}
    ${p.speed !== undefined ? row('Daily motion', `${p.speed >= 0 ? '+' : ''}${p.speed.toFixed(3)}°/day${p.retrograde && p.kind === 'body' ? ' (retrograde)' : ''}`) : ''}
    ${a ? row('Sky at birth', `${a.alt >= 0 ? 'above' : 'below'} horizon, alt ${a.alt.toFixed(1)}°, az ${a.az.toFixed(1)}°`) : ''}
    ${p.dignity ? row('Dignity', p.dignity) : ''}
    ${fact(`${t.fact} Sign = floor(${p.lon.toFixed(2)}° ÷ 30) = ${s.index} → ${sign.name}; ${p.lon.toFixed(2)} − ${s.index * 30} = ${s.degree.toFixed(2)}° into the sign.`)}
    ${lore(`${t.lore} <i>${sign.name}:</i> ${SIGN_TEXT[sign.id]}`)}`;
}

export function signTip(model, i) {
  const sign = SIGNS[i];
  const occupants = model.chart.placements.filter((p) => (p.kind === 'body' || p.kind === 'point') && p.signIndex === i).map((p) => p.glyph + ' ' + p.name);
  const z = model.settings.zodiac;
  return `<div class="tip-title">${sign.glyph} ${sign.name}</div>
    ${row('Span', `${i * 30}° – ${i * 30 + 30}° of ecliptic longitude`)}
    ${row('Element · Modality', `${sign.element} · ${sign.modality}`)}
    ${row('Ruler', `${cap(sign.ruler)}${sign.modernRuler !== sign.ruler ? ` (modern: ${cap(sign.modernRuler)})` : ''}`)}
    ${row('Occupied by', occupants.length ? occupants.join(', ') : '—')}
    ${fact(z === 'tropical' ? 'Tropical signs start at the March-equinox point and are exactly 30° wide. The real constellation behind this slice is usually the previous one in the list, because of ~24° of precession since antiquity.' : `Sidereal: shifted by the ayanamsa (${model.chart.ayanamsa.toFixed(3)}°) so the signs roughly track the background constellations.`)}
    ${lore(SIGN_TEXT[sign.id])}`;
}

export function houseTip(model, h) {
  const cusps = model.chart.houses.cusps;
  const start = cusps[h - 1];
  const end = cusps[h % 12];
  const size = ((end - start) + 360) % 360;
  const occupants = model.chart.placements.filter((p) => p.house === h).map((p) => p.glyph + ' ' + p.name);
  return `<div class="tip-title">House ${h}</div>
    ${row('Cusp', fmtLon(start))}
    ${row('Size', `${size.toFixed(2)}° of longitude`)}
    ${row('Occupied by', occupants.length ? occupants.join(', ') : 'empty')}
    ${fact(`Cusp from the ${HOUSE_SYSTEMS[model.chart.houseSystem].name} system. ${model.chart.houseSystem === 'placidus' ? 'Unequal sizes are expected: Placidus trisects time-above-horizon, not degrees.' : ''}`)}
    ${lore(HOUSE_TEXT[h - 1])}`;
}

export function aspectTip(model, a) {
  const pa = model.byId(a.a);
  const pb = model.byId(a.b);
  const asp = a.aspect;
  const raw = Math.abs(((pa.lon - pb.lon) + 540) % 360 - 180);
  return `<div class="tip-title"><span style="color:${asp.color}">${asp.glyph}</span> ${pa.name} ${asp.name.toLowerCase()} ${pb.name}</div>
    ${row('Separation', `|${pa.lon.toFixed(2)}° − ${pb.lon.toFixed(2)}°| → ${raw.toFixed(2)}°`)}
    ${row('Ideal angle', `${asp.angle}°`)}
    ${row('Off exact by', `${a.deviation.toFixed(2)}° (orb allowed ${a.orb.toFixed(1)}°)`)}
    ${row('Phase', a.applying ? 'applying (tightening)' : 'separating (loosening)')}
    ${row('Strength', `${Math.round(a.strength * 100)}% — 100% = exact`)}
    ${fact('Measured purely in ecliptic longitude. The lines across the wheel are diagrams of this angle, not physical connections.')}
    ${lore(ASPECT_TEXT[asp.id])}`;
}

export function starTip(model, s) {
  const contacts = model.contacts.filter((c) => c.b === s.id);
  return `<div class="tip-title">✦ ${esc(s.name)} <span class="muted">${esc(s.desig)}</span></div>
    ${row('Ecliptic λ / β', `${fmtLon(s.lon)} / ${s.lat.toFixed(2)}°`)}
    ${row('Magnitude', s.mag.toFixed(2))}
    ${row('Constellation', model.catalog.consById.get(s.con)?.name ?? s.con)}
    ${row('Distance', s.dist ? `${s.dist.toFixed(1)} pc (${(s.dist * 3.2616).toFixed(0)} light-years)` : 'unknown')}
    ${row('Sky at birth', `${s.alt >= 0 ? 'above' : 'below'} horizon, alt ${s.alt.toFixed(1)}°`)}
    ${row('Nature', s.nature)}
    ${contacts.length ? row('Contacts', contacts.map((c) => model.byId(c.a).name).join(', ')) : ''}
    ${fact(`HYG position (J2000) moved ${s.years.toFixed(1)} years by proper motion (${s.pmra}, ${s.pmdec} mas/yr), then precessed to the ecliptic of date.`)}
    ${lore(esc(s.lore))}`;
}

export function contactTip(model, c) {
  const p = model.byId(c.a);
  const s = model.byId(c.b);
  const ratio = c.skySeparation / Math.max(c.lonDiff, 0.01);
  return `<div class="tip-title">✦ ${p.name} conjunct ${esc(s.name)}</div>
    ${row('Longitude difference', `${c.lonDiff.toFixed(2)}°`)}
    ${row('True sky separation', `${c.skySeparation.toFixed(2)}°`)}
    ${row('Star latitude', `${c.starLat >= 0 ? '+' : ''}${c.starLat.toFixed(2)}° from ecliptic`)}
    ${row('Rule', c.rule === 'sky' ? `sky separation ≤ ${c.orb.toFixed(1)}°` : `longitude ≤ ${c.orb.toFixed(1)}°`)}
    ${fact(c.skySeparation > 5 && c.rule !== 'sky' ? `These match in longitude only. On the real sky they were ${c.skySeparation.toFixed(1)}° apart (${ratio > 50 ? 'not remotely' : 'not'} adjacent) because the star sits ${Math.abs(c.starLat).toFixed(1)}° ${c.starLat > 0 ? 'north' : 'south'} of the ecliptic.` : 'These were genuinely close on the sky as well as in longitude.')}
    ${lore(`${esc(s.name)} has the nature of ${s.nature}. ${esc(s.lore)}`)}`;
}

export function edgeTip(model, e) {
  if (e.type === 'aspect') return aspectTip(model, e.data);
  if (e.type === 'star') return contactTip(model, e.data);
  const src = model.graph.byId.get(e.source);
  const tgt = model.graph.byId.get(e.target);
  const titles = { sign: 'is in', house: 'is in', rules: 'rules', angle: 'is angular on', pattern: 'includes' };
  return `<div class="tip-title">${src?.label} ${titles[e.type] ?? '→'} ${tgt?.label}</div>
    ${row('Relationship', e.type)}
    ${row('Rule', esc(e.rule))}
    ${e.type === 'angle' ? fact(`Off exact by ${e.data.deviation.toFixed(2)}°. ${GLOSSARY.angularity[1]}`) : ''}
    ${e.type === 'rules' ? lore('A sign\'s ruler acts as its "landlord": planets in the sign report to it.') : ''}`;
}

export function patternTip(model, pat) {
  const key = pat.type === 'stellium' ? 'stellium' : pat.type === 'grand-trine' ? 'grandTrine' : 'tSquare';
  return `<div class="tip-title">◈ ${pat.label}</div>
    ${row('Members', pat.members.map((m) => model.byId(m).name).join(', '))}
    ${row('Rule', pat.rule)}
    ${lore(GLOSSARY[key][1])}`;
}

export function nodeTip(model, n) {
  if (!n) return '';
  if (n.kind === 'body' || n.kind === 'point' || n.kind === 'angle') return placementTip(model, n.ref);
  if (n.kind === 'star') return starTip(model, n.ref);
  if (n.kind === 'sign') return signTip(model, n.ref.index);
  if (n.kind === 'house') return houseTip(model, n.ref.house);
  if (n.kind === 'pattern') return patternTip(model, n.ref);
  return esc(n.label);
}

export function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
export { esc, row, fact, lore };
