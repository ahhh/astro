# Celestial Birth Atlas

A 3D birth chart built on real astronomy, implemented from the plan in
`FULL_PROJECT_PLAN.md` (the original planning README is now `PLAN_README.md`).

## Run it

```bash
python3 -m http.server 8000      # any static server works
open http://localhost:8000
node tests/run.mjs               # reference-case validation (41 checks)
```

It has no build step and no backend. Birth data never leaves the browser.

## Where the numbers come from

| What | Source | Treatment |
|---|---|---|
| Sun, Moon, planets | Astronomy Engine 2.1.19 (VSOP87, IAU 2006 precession, IAU 2000B nutation) | Apparent geocentric positions in the true ecliptic of date. Topocentric alt/az for Birth Sky |
| 8,920 background stars | HYG v4.1 from `../starexplorer` (Hipparcos / Yale BSC / Gliese), V ≤ 6.5 | J2000 position, moved by proper motion to the birth epoch, then rotated into the same frame as the planets |
| 68 fixed stars | The same HYG entries, matched by IAU proper name | Ptolemaic natures (Tetrabiblos I.9). Lore paraphrased from Robson (1923) |
| Constellations | IAU figures and boundaries from `../starexplorer` (d3-celestial) | Drawn through the real catalogue stars |
| Places / time zones | GeoNames cities15000 (CC BY 4.0) + the browser's IANA tz database | Historical DST and Local Mean Time handled. Gaps and overlaps are reported, not guessed |

Rebuild the datasets with `python3 scripts/build-data.py <geonames_dir>`.

## Validation (`tests/run.mjs`)

- Equinox/solstice Sun positions, a new moon, and Mercury retrograde dates.
- The Ascendant lies on the eastern horizon and the MC on the meridian (checked geometrically at 4 latitudes).
- Placidus cusps meet their semi-arc definition, and Placidus is refused above the polar circle.
- Einstein's AA-rated chart (Sun, Moon, ASC, MC, Mercury, Saturn) agrees with astro.com to within 0.02°.
- Regulus, Spica, Aldebaran, Antares and Sirius 2000.0 longitudes match published values within 0.01°.
- The Lahiri ayanamsa puts Spica at 0° Libra.
- Time zones: DST gaps and overlaps, British Standard Time in 1970, and Berlin LMT in 1879.

## Layout

```
src/birth.js         Engine 1  local time + place → UTC (Intl tz), gazetteer search
src/astro.js         Engine 2  ephemeris wrapper, frames, rotations
src/astrology.js     Engine 3  signs, ayanamsa, angles, houses, aspects, dignities, patterns
src/stars.js         Engine 4  catalogue, proper motion, fixed-star contacts (longitude vs true sky)
src/scene.js         Engine 5  Three.js: Natal Wheel / Birth Sky / Connection Network
src/correlations.js  Engine 6  rule-tagged relationship graph
src/interpret.js     Engine 7  fact vs tradition text, glossary, all tooltip content
src/tooltip.js       data-tip system (hover, focus, tap)
src/wheel2d.js       conventional SVG wheel
src/app.js           UI controller, selection sync, Math trace
```

## Known limits

- The fixed-star positions ignore annual aberration (≤ 20″), which is negligible against a 1° orb.
- The ayanamsas are mean values. Expect them to differ from Swiss Ephemeris by under 1′.
- Pre-1970 time-zone history in browsers is incomplete for some regions. Use the manual offset override when needed.
- Data licences (HYG: CC BY-SA 4.0; GeoNames: CC BY 4.0) need review before any commercial release.
