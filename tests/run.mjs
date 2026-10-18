// Reference-case validation (Gate 1 / F15). Run: node tests/run.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
globalThis.fetch = async (url) => ({ json: async () => JSON.parse(await readFile(path.join(root, url), 'utf8')) });

const { buildBirthContext, resolveLocalTime, offsetAt } = await import('../src/birth.js');
const { computeSky, eclipticToHorizontal, angDiff, norm360, A } = await import('../src/astro.js');
const { buildChart, chartAngles, placidusCusps, ayanamsa, signOf } = await import('../src/astrology.js');
const { loadCatalog, fixedStarPositions, fixedStarContacts } = await import('../src/stars.js');

let pass = 0, fail = 0;
function check(label, actual, expected, tol) {
  const ok = typeof expected === 'number' ? Math.abs(actual - expected) <= (tol ?? 0) : actual === expected;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${typeof actual === 'number' ? actual.toFixed(4) : actual}, expected ${expected}${tol !== undefined ? ' ±' + tol : ''}`);
}
const lonErr = (a, b) => angDiff(a, b);

const settings = { zodiac: 'tropical', houseSystem: 'placidus', luminaryBonus: 0, angleOrb: 5, includeNodes: false, starOrb: 1, starOrbByMag: false, starRule: 'longitude', modernRulers: true };
function chartFor(utcIso, lat, lon, s = settings) {
  const ctx = { utc: new Date(utcIso), lat, lon, timeKnown: true };
  const sky = computeSky(ctx);
  return { ctx, sky, chart: buildChart(ctx, sky, s) };
}

console.log('\n— Time zones (IANA via Intl) —');
{
  const r = resolveLocalTime({ year: 1990, month: 7, day: 4, hour: 12, minute: 0 }, 'America/New_York');
  check('New York 1990-07-04 12:00 EDT → UTC hour', new Date(r.utcMs).getUTCHours(), 16);
  check('DST gap 2021-03-14 02:30 New York', resolveLocalTime({ year: 2021, month: 3, day: 14, hour: 2, minute: 30 }, 'America/New_York').status, 'nonexistent');
  check('DST overlap 2021-11-07 01:30 New York', resolveLocalTime({ year: 2021, month: 11, day: 7, hour: 1, minute: 30 }, 'America/New_York').status, 'ambiguous');
  check('London Jan 1970 (British Standard Time, UTC+1 all year)', offsetAt(Date.UTC(1970, 0, 15), 'Europe/London'), 60, 0);
  check('India 2000 offset +5:30', offsetAt(Date.UTC(2000, 0, 1), 'Asia/Kolkata'), 330, 0);
  const ctx = buildBirthContext({ date: '1879-03-14', time: '11:30', timeKnown: true, lat: 48.4, lon: 9.99, tz: 'Europe/Berlin' });
  check('Berlin 1879 uses LMT offset (+53:28 = 53.4667 min)', ctx.offsetMinutes, 53.4667, 0.01);
}

console.log('\n— Solar / lunar positions (true ecliptic of date) —');
{
  // 2024 March equinox 03:06 UTC (USNO): Sun at 0°.
  check('Sun at 2024-03-20 03:06Z (equinox)', lonErr(chartFor('2024-03-20T03:06:00Z', 0, 0).sky.bodies[0].lon, 0), 0, 0.01);
  // 2024 June solstice 20:51 UTC: Sun at 90°.
  check('Sun at 2024-06-20 20:51Z (solstice)', lonErr(chartFor('2024-06-20T20:51:00Z', 0, 0).sky.bodies[0].lon, 90), 0, 0.01);
  // New moon 2024-01-11 11:57 UTC: Moon − Sun = 0.
  const nm = chartFor('2024-01-11T11:57:00Z', 0, 0).sky;
  check('New moon 2024-01-11 11:57Z, Moon−Sun', lonErr(nm.bodies[1].lon, nm.bodies[0].lon), 0, 0.05);
  // Mercury retrograde 2024-04-01 → 2024-04-25.
  check('Mercury retrograde on 2024-04-10', chartFor('2024-04-10T00:00:00Z', 0, 0).sky.bodies[2].retrograde, true);
  check('Mercury direct on 2024-05-10', chartFor('2024-05-10T00:00:00Z', 0, 0).sky.bodies[2].retrograde, false);
}

console.log('\n— Chart angles: geometric self-checks —');
for (const [lat, lon, iso] of [[40.7128, -74.006, '1990-07-04T16:00:00Z'], [-33.87, 151.21, '1985-12-01T02:00:00Z'], [51.5, -0.12, '2001-09-09T22:15:00Z'], [64.1, -21.9, '1975-01-20T08:00:00Z']]) {
  const { sky, chart } = chartFor(iso, lat, lon);
  const ascH = eclipticToHorizontal(sky, chart.angles.tropical.asc);
  const mcH = eclipticToHorizontal(sky, chart.angles.tropical.mc);
  check(`ASC on horizon (alt) lat ${lat}`, ascH.alt, 0, 0.02);
  check(`ASC in the east (az in 0..180) lat ${lat}`, ascH.az > 0 && ascH.az < 180, true);
  check(`MC on meridian (az 180 or 0) lat ${lat}`, Math.min(angDiff(mcH.az, 180), angDiff(mcH.az, 0)), 0, 0.02);
}

console.log('\n— Placidus definition check —');
{
  const { sky, chart } = chartFor('1990-07-04T16:00:00Z', 40.7128, -74.006);
  const e = sky.obliquity * Math.PI / 180, phi = 40.7128 * Math.PI / 180;
  for (const [idx, frac] of [[10, 1 / 3], [11, 2 / 3]]) {
    const lonC = chart.houses.cusps[idx] * Math.PI / 180;
    const dec = Math.asin(Math.sin(e) * Math.sin(lonC));
    const ra = norm360(Math.atan2(Math.sin(lonC) * Math.cos(e), Math.cos(lonC)) * 180 / Math.PI);
    const dsa = 90 + Math.asin(Math.tan(phi) * Math.tan(dec)) * 180 / Math.PI;
    check(`cusp ${idx + 1}: RA − RAMC = ${frac.toFixed(3)} × semi-arc`, norm360(ra - sky.lst), frac * dsa, 0.001);
  }
  check('Placidus refuses at 70°N', placidusCusps(10, 23.44, 70, chartAngles(10, 23.44, 70)), null);
}

console.log('\n— Published natal chart (Einstein, AstroDatabank AA: 1879-03-14 11:30 LMT Ulm) —');
{
  const ctx = buildBirthContext({ date: '1879-03-14', time: '11:30', timeKnown: true, lat: 48.4, lon: 9.9833, tz: 'Europe/Berlin', offsetOverride: 39.93 });
  const sky = computeSky(ctx);
  const chart = buildChart(ctx, sky, settings);
  const get = (id) => chart.placements.find((p) => p.id === id).lon;
  // Reference values from astro.com: Sun 23°30' Pisces, Moon 14°32' Sag, ASC 11°38' Cancer, MC 12°50' Pisces.
  check('Sun 23°30′ Pisces', lonErr(get('sun'), 353.5), 0, 0.05);
  check('Moon 14°32′ Sagittarius', lonErr(get('moon'), 254.53), 0, 0.1);
  check('Ascendant 11°38′ Cancer', lonErr(chart.angles.asc, 101.63), 0, 0.25);
  check('Midheaven 12°50′ Pisces', lonErr(chart.angles.mc, 342.83), 0, 0.25);
  check('Mercury 3°09′ Aries', lonErr(get('mercury'), 3.15), 0, 0.1);
  check('Saturn 4°11′ Aries', lonErr(get('saturn'), 4.18), 0, 0.1);
}

console.log('\n— Fixed stars (HYG + proper motion + precession) —');
{
  await loadCatalog();
  const { sky } = chartFor('2000-01-01T12:00:00Z', 0, 0);
  const stars = fixedStarPositions(sky, 0);
  const lonOf = (n) => stars.find((s) => s.name === n).tropicalLon;
  // Published tropical longitudes for 2000.0 (e.g. Brady, "Fixed Stars", 1998).
  check('Regulus 29°50′ Leo (2000)', lonErr(lonOf('Regulus'), 149.83), 0, 0.05);
  check('Spica 23°50′ Libra (2000)', lonErr(lonOf('Spica'), 203.83), 0, 0.05);
  check('Aldebaran 9°47′ Gemini (2000)', lonErr(lonOf('Aldebaran'), 69.78), 0, 0.05);
  check('Antares 9°46′ Sagittarius (2000)', lonErr(lonOf('Antares'), 249.76), 0, 0.05);
  check('Sirius 14°05′ Cancer (2000)', lonErr(lonOf('Sirius'), 104.08), 0, 0.05);
  const { sky: sky1900 } = chartFor('1900-01-01T12:00:00Z', 0, 0);
  const shift = angDiff(fixedStarPositions(sky1900, 0).find((s) => s.name === 'Regulus').tropicalLon, lonOf('Regulus'));
  check('Precession of Regulus 1900→2000 ≈ 1°23′', shift, 1.39, 0.03);
}

console.log('\n— Sidereal —');
check('Lahiri ayanamsa at J2000', ayanamsa('lahiri', 2451545.0), 23.857, 0.001);
check('Lahiri ayanamsa 2024-01-01 ≈ 24°11′', ayanamsa('lahiri', 2460311), 24.19, 0.02);
{
  // Lahiri is defined so that Spica sits at 0° Libra sidereal (180°).
  const { sky } = chartFor('1990-01-01T00:00:00Z', 0, 0);
  const ay = ayanamsa('lahiri', sky.jdTT);
  check('Spica ≈ 180° in Lahiri sidereal', lonErr(fixedStarPositions(sky, ay).find((s) => s.name === 'Spica').lon, 180), 0, 0.1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
