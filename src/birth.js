// Engine 1 — Birth Data.
// Turns a local wall-clock birth time + place into an unambiguous UTC instant,
// using the browser's built-in IANA time-zone database (Intl), which carries
// historical daylight-saving rules and, for many zones, Local Mean Time
// before standard time was adopted. Nothing here leaves the device.

const fmtCache = new Map();

function formatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', era: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz) {
  try { formatter(tz); return true; } catch { return false; }
}

// UTC offset in minutes (may be fractional, e.g. LMT +53:28) at a UTC instant.
export function offsetAt(utcMs, tz) {
  const parts = {};
  for (const p of formatter(tz).formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  let year = Number(parts.year);
  if (parts.era === 'BC' || parts.era === 'B') year = 1 - year;
  const asUtc = Date.UTC(year, Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second));
  // Date.UTC maps years 0..99 to 1900s; correct that.
  const d = new Date(asUtc);
  if (year >= 0 && year < 100) d.setUTCFullYear(year);
  const wholeSecondsUtc = Math.floor(utcMs / 1000) * 1000;
  return (d.getTime() - wholeSecondsUtc) / 60000;
}

export function zoneName(utcMs, tz, style = 'long') {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style })
      .formatToParts(new Date(utcMs));
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch { return tz; }
}

function localAsUtcMs(y, mo, d, h, mi, s) {
  const dt = new Date(Date.UTC(2000, mo - 1, d, h, mi, s));
  dt.setUTCFullYear(y);
  return dt.getTime();
}

/**
 * Resolve local civil time in an IANA zone to UTC.
 * Returns every valid interpretation so DST overlaps (two instants) and
 * DST gaps (no instant) are reported instead of silently guessed.
 */
export function resolveLocalTime({ year, month, day, hour, minute, second = 0 }, tz) {
  const local = localAsUtcMs(year, month, day, hour, minute, second);
  const offsets = new Set();
  for (const probe of [-36, -12, 0, 12, 36]) {
    offsets.add(offsetAt(local + probe * 3600e3, tz));
  }
  const candidates = [];
  for (const off of offsets) {
    const utc = local - off * 60000;
    if (Math.abs(offsetAt(utc, tz) - off) < 1e-6) candidates.push({ utcMs: utc, offsetMinutes: off });
  }
  candidates.sort((a, b) => a.utcMs - b.utcMs);
  if (candidates.length === 0) {
    // Clock skipped forward (spring DST gap). Report the instant using the
    // offset in force just before the gap, flagged as nonexistent.
    const before = offsetAt(local - 36 * 3600e3, tz);
    return { status: 'nonexistent', utcMs: local - before * 60000, offsetMinutes: before, alternatives: [] };
  }
  return {
    status: candidates.length > 1 ? 'ambiguous' : 'ok',
    utcMs: candidates[0].utcMs,
    offsetMinutes: candidates[0].offsetMinutes,
    alternatives: candidates,
  };
}

export function resolveFixedOffset({ year, month, day, hour, minute, second = 0 }, offsetMinutes) {
  const local = localAsUtcMs(year, month, day, hour, minute, second);
  return { status: 'ok', utcMs: local - offsetMinutes * 60000, offsetMinutes, alternatives: [] };
}

export function formatOffset(minutes) {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.floor(abs % 60);
  const s = Math.round((abs * 60) % 60);
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${s ? ':' + String(s).padStart(2, '0') : ''}`;
}

/**
 * Builds the Birth Context contract consumed by every other engine.
 */
export function buildBirthContext(input) {
  const { name, date, time, timeKnown, lat, lon, tz, placeLabel, offsetOverride, ambiguityChoice } = input;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (timeKnown ? time : '12:00').split(':').map(Number);
  const parts = { year, month, day, hour, minute, second: 0 };
  const cautions = [];

  let res;
  let tzSource;
  if (offsetOverride !== null && offsetOverride !== undefined && offsetOverride !== '') {
    res = resolveFixedOffset(parts, Number(offsetOverride));
    tzSource = 'manual UTC offset override';
  } else {
    res = resolveLocalTime(parts, tz);
    tzSource = `IANA tz database (${tz}) via the browser's Intl API`;
    if (res.status === 'ambiguous') {
      const pick = ambiguityChoice === 'later' ? res.alternatives[res.alternatives.length - 1] : res.alternatives[0];
      res = { ...res, utcMs: pick.utcMs, offsetMinutes: pick.offsetMinutes };
      cautions.push(`This local time occurred twice (clocks fell back). Using the ${ambiguityChoice === 'later' ? 'second (standard time)' : 'first (daylight time)'} occurrence.`);
    } else if (res.status === 'nonexistent') {
      cautions.push('This local time did not exist (clocks sprang forward). Interpreted with the pre-change offset; please verify the recorded time.');
    }
    if (year < 1970) cautions.push('Pre-1970 time-zone history in the browser database is less complete for some regions; verify the offset or use the manual override.');
    const zn = zoneName(res.utcMs, tz, 'short');
    if (/LMT/.test(zn) || (res.offsetMinutes % 15 !== 0)) {
      cautions.push('Local Mean Time (sun time for the zone\'s reference city) was in use at this date, not a standard time zone.');
    }
  }
  if (!timeKnown) {
    cautions.push('Birth time unknown: computed for local noon. Ascendant, Midheaven and houses are unavailable; the Moon may be off by up to ±7°.');
  }

  return {
    name: name || '',
    local: { ...parts, text: `${date} ${timeKnown ? time : '12:00 (assumed)'}` },
    timeKnown: !!timeKnown,
    utc: new Date(res.utcMs),
    offsetMinutes: res.offsetMinutes,
    resolution: res.status,
    alternatives: res.alternatives,
    tz,
    tzSource,
    zoneLabel: tzSource.startsWith('manual') ? formatOffset(Number(offsetOverride))
      // in a DST gap, name the zone that was in force just before the change
      : zoneName(res.status === 'nonexistent' ? res.utcMs - 3 * 3600e3 : res.utcMs, tz, 'long'),
    lat, lon,
    placeLabel: placeLabel || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    cautions,
  };
}

// --- Gazetteer (GeoNames cities15000, loaded lazily) -----------------------

let cityData = null;
let cityLoad = null;

export function loadCities() {
  if (!cityLoad) {
    cityLoad = fetch('data/cities.json').then((r) => r.json()).then((json) => {
      cityData = json;
      json.norm = json.cities.map((c) => fold(c[0]) + '|' + fold(c[1]));
      return json;
    });
  }
  return cityLoad;
}

function fold(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function searchCities(query, limit = 8) {
  if (!cityData) return [];
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const [cityPart, ...rest] = q.split(',').map((s) => s.trim());
  const qualifier = rest.join(' ');
  const out = [];
  for (let i = 0; i < cityData.cities.length && out.length < 200; i++) {
    const n = cityData.norm[i];
    const idx = n.indexOf(cityPart);
    if (idx === -1) continue;
    const c = cityData.cities[i];
    if (qualifier) {
      const country = fold(cityData.countries[c[3]] || '');
      const hay = fold(c[2]) + ' ' + country + ' ' + c[3].toLowerCase();
      if (!hay.includes(qualifier)) continue;
    }
    const prefix = idx === 0 || n[idx - 1] === ' ' || n[idx - 1] === '|';
    out.push({ c, score: (prefix ? 2 : 0) + (n.startsWith(cityPart + '|') ? 3 : 0) + Math.log10(c[7] + 10) / 10 });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map(({ c }) => ({
    name: c[0], region: c[2], country: cityData.countries[c[3]] || c[3], cc: c[3],
    lat: c[4], lon: c[5], tz: c[6], population: c[7],
    label: [c[0], c[2], cityData.countries[c[3]] || c[3]].filter(Boolean).join(', '),
  }));
}
