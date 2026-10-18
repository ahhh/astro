# Product Features, Priorities and Acceptance Criteria

## Primary Personas and Tasks

**Curious learner:** wants to understand their own natal planets and relationships without understanding astrophysics or astrological jargon.

**Astrology enthusiast:** wants transparent zodiac/house/aspect settings, fixed-star orbs and reproducible results.

**Astronomy-curious visitor:** wants to differentiate actual birth sky positions from conceptual astrological chart diagrams.

## V1 Feature / Acceptance Matrix

| ID | Must-have feature | Acceptance requirement |
|---|---|---|
| F01 | Birth data form | Supports date, time, place and displays resolved time zone, coordinates and errors |
| F02 | Natal positions | Calculates all 10 primary bodies and indicates retrograde status when relevant |
| F03 | Astrological chart | Displays chosen zodiac, signs, house assignments and angles where birth time permits |
| F04 | 3D exploration | Orbit, zoom, focus, reset and touch operate without losing selected object |
| F05 | Sky catalog | Renders a curated sample of 50–100 meaningful real stars with stable IDs and names |
| F06 | Constellations | Visibility toggle shows/hides lines and labels without recalculating natal positions |
| F07 | Planetary aspects | Lists each qualifying aspect with type, effective angle, deviation and orb rule |
| F08 | Fixed-star conjunctions | Lists traditional longitude-based candidates and separately reports true sky separation when possible |
| F09 | Connection filtering | Selecting any planet shows corresponding graph edges, with dimming and reversible filters |
| F10 | Three view modes | Natal Wheel, Birth Sky, and Connection Network share the same computed dataset and current selection |
| F11 | Object details | Clicking an object reveals a factual position panel and clearly marked interpretation text |
| F12 | Responsive layout | Usable desktop and mobile controls; adaptive visuals for lower-powered hardware |
| F13 | Settings clarity | UI visibly shows active zodiac and house conventions plus relevant calculation limitations |
| F14 | Local privacy | No external submission of birth details required for baseline operation |
| F15 | Validation | Reference date/time/location test set; regressions reveal differences in celestial placements |

## Phase Gates

### Gate 1: Valid Data
- At least five diverse reference birth cases, including DST transition and missing-time scenarios, are verified.
- Coordinates, epochs, and time zones are auditable.

### Gate 2: Functional 3D Interaction
- 3D canvas runs in modern mobile and desktop browsers.
- Mouse, touch and keyboard-accessible alternatives allow selection and navigation.

### Gate 3: Relationship Coherence
- The aspects shown in the right-side information panel exactly match highlighted scene edges.
- Visual colors are paired with noncolor cues; details reveal the rule and orb.

### Gate 4: Mode Coherence
- No contradictory planet positions or differing relationship sets appear when switching views.
- The Birth Sky describes physical direction while chart/network views are labeled as schematic.

### Gate 5: V1 Release Readiness
- User can complete input → generate → explore → select → understand a connection on mobile and desktop.
- License review completed for bundled data and calculation engine.
- No mandatory login, remote AI, or proprietary service required for core experience.

## Post-V1 Backlog

**V1.1:** 2D comparison natal wheel, local profile saving, download/capture, timeline controls.

**V1.2:** current transits and natal-vs-transit comparison with appropriate date/time handling.

**V2:** synastry, optional heliocentric astronomical rendering, narrative tours and an optional interpretation assistant.

## UI Behavior Standards

- Selected object always has a visible label and a detailed information path.
- Every visible connector can be filtered by type; a readable legend is always available.
- Settings changes trigger coherent recalculation rather than overlays disagreeing.
- User can reset filters and scene navigation with one action.
- Text explanations name the underlying astrological method and do not claim scientific causation.
