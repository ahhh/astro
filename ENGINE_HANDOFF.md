# Implementation-System Handoff — Engines and Contracts

This file defines *what must be built*, not implementation code.

## Logical Processing Pipeline

```text
Birth date/time/place + chart conventions
                     │
                     ▼
           1. Birth Data Engine
                     │ UTC/time zone/location provenance
                     ▼
         2. Astronomical Engine
                     │ celestial positions + coordinate frames
             ┌───────┴───────────┐
             ▼                   ▼
       3. Astrology Engine   4. Fixed-Star Engine
             │                   │
             └────────┬──────────┘
                      ▼
          6. Correlation Engine
                      │ graph nodes/edges + explanation keys
             ┌────────┴─────────┐
             ▼                  ▼
       5. 3D Renderer    7. Interpretation Engine
             └────────┬─────────┘
                      ▼
       Single-page user interface
```

## Contract Definitions

| Contract | Required fields, conceptually | Consumers |
|---|---|---|
| Birth context | Local input, resolved instant, latitude/longitude, time-zone source, birth-time certainty | Astronomy, astrology |
| Planetary position | Stable body ID, timestamp, geocentric ecliptic position, RA/Dec, optional observer-relative alt/az, retrograde metadata | Astrology, correlations, renderer |
| Star record | Stable star ID, proper name, astronomical coordinate source/epoch, apparent brightness, constellation, optional symbolic associations | Fixed-star engine, renderer |
| Natal chart | Zodiac convention, house convention, positions/signs/degrees, houses, angles, calculated cautions | Correlations, renderer, interpretation |
| Relationship edge | Source node ID, target node ID, relationship type, calculation rule, angle/difference, permitted orb, active settings, explanatory ID | Renderer, detail panels |
| Selection/view state | Selected object ID, active visualization mode, visible layers, filters, camera state | User interface, renderer |

## Required Consistency Rules

- The display must never silently substitute a planet's visual approximation for its computed position.
- Preserve coordinate/frame metadata and transform before rendering; do not mix RA/Dec, ecliptic and altitude/azimuth coordinates indiscriminately.
- Ensure chart house computations use the selected convention and correct birth data.
- Do not collapse a fixed-star longitude conjunction into claims of actual 3D proximity.
- When birth time is unknown, restrict or label time-sensitive angles and houses.
- Every interpretation must link to a computed placement or association, never an invented object link.
- Handle daylight saving and historical time-zone changes explicitly.

## Primary Decisions for the Implementer

1. **Astronomy data provider** — evaluate browser-compatible Astronomy Engine against Swiss Ephemeris plus any relevant license/integration constraints.
2. **Astrology rules** — tropical default, sidereal optionally; Whole Sign first and Placidus second; write reference tests for all.
3. **Star data license** — select catalog/subset allowed for redistribution and intended commercial usage.
4. **Reference frames** — decide on a canonical intermediate celestial frame and separate mapping to 3D positions for each view.
5. **Star depth** — render on celestial dome as directions in the sky by default; optional physical 3D distance view must be explicit.
6. **Local storage** — consider JSON serialization and local-only saving, with user deletion/export controls.
7. **Accessibility** — selectable objects must also be reachable from an accessible textual object list.
8. **Performance profiles** — adaptive star counts, reduced effects, frame throttling where appropriate.

## Three Modes, One Underlying Data Model

- **Natal Wheel:** schematic chart layout highlighting symbolic signs/houses/aspects.
- **Birth Sky:** observer-centered or geocentric sky direction rendering, with truthful coordinate overlays.
- **Connection Network:** graph-layout connections; edges indicate category-specific analytical relationships, not physical force.

Selections, filters and relationship IDs remain stable across modes. Camera pose may vary between modes.

## Relationship Policy

The term “correlation” is product shorthand for a rule-defined chart relationship. It must **not** be presented as a measured statistical correlation without actual data analysis. Major aspects use angular longitude separations according to the selected astrological tradition; fixed-star interpretations must disclose whether matching is based on longitude, latitude restrictions, actual angular sky distance, or another documented rule.

## Privacy and Product Boundary

Default to no login and no data upload. User-provided birth details are sensitive personal data and should remain on-device unless a future feature explicitly asks permission to transmit them.
