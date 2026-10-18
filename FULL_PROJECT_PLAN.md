# Celestial Birth Atlas
## Complete Product Plan — 3D Astrological Birth Chart & Celestial Star Mapping

**Deliverable type:** Product, design, engine, and feature planning package  
**Target platform:** Single-page HTML and JavaScript web application  
**Scope of this package:** Planning and technical handoff only. It does **not** contain a functional application implementation.  
**Working title:** Celestial Birth Atlas  
**Version:** Plan 1.0 — October 2026

---

## 1. Core Concept

Create an immersive, interactive **3D astrological universe personalized to an individual's exact birth date, time, and location**. Instead of only a flat natal chart, the application creates an explorable celestial environment that shows how planets, zodiac placements, astrological houses, constellations, and notable fixed stars relate to the person's birth chart.

The central experience integrates three distinct but synchronized layers:

1. **Astronomical reality:** The apparent positions of the Sun, Moon, planets, and stars at the specified birth time and location.
2. **Astrological relationships:** Zodiac signs, houses, planetary aspects, angles, and traditional fixed-star associations.
3. **Personal interpretation:** Tradition-specific interpretations of highlighted placements and relationships.

**Guiding principle:** Astronomical coordinates, traditional astrological conventions, and symbolic interpretations must be individually identifiable. An astrological association is not automatically a physically close grouping in the sky or a scientifically established causal relationship.

**Signature interaction:** Select a planet in the natal chart and illuminate its network of astrological connections throughout the 3D celestial sphere, with a concise explanation for each link.

## 2. Visual Direction

Design the product as a **personal celestial observatory** with a refined, dark, accessible aesthetic—not a generic horoscope website.

- Deep-blue or near-black space background with restrained star glow.
- Distinct zodiac, ecliptic, horizon, celestial equator, and house overlays.
- Selectable planetary markers, prominent stars, and constellation outlines.
- Illuminated aspect lines and optional 3D relationship arcs.
- Smooth orbiting, zooming, focusing, and layered exploration.
- A visible explanation of the currently active astronomical/astrological view and reference frame.

The default view is an **Earth-centered natal celestial visualization** framed by a zodiac ring and informative planetary markers. When house boundaries or astrological aspect geometry are shown schematically, they must be labeled as chart overlays rather than literal physical structures.

## 3. Required Application Engines

| # | Engine | Main responsibility | Recommended approach |
|---|---|---|---|
| 1 | Birth Data Engine | Birth date/time/location, geocoding, historical time zones, uncertainty handling | JavaScript, date/time and location datasets |
| 2 | Astronomical Engine | Ephemerides, planetary positions, coordinate systems and transformation | Astronomy Engine or licensed Swiss Ephemeris integration |
| 3 | Astrology Engine | Zodiac signs, houses, angles, planetary aspects, rulerships and configurations | Dedicated calculation layer with selectable conventions |
| 4 | Fixed-Star Engine | Real-star catalog, coordinate propagation and traditional fixed-star associations | Curated stellar catalog plus coordinate calculations |
| 5 | 3D Universe Engine | Celestial sphere, star field, planets, labels, camera, graphic overlays | Three.js |
| 6 | Correlation Engine | Graph of natal planets, significant stars, aspects and chart angles | Custom configurable relationship analysis |
| 7 | Interpretation Engine | Contextual explanations of chart placements and relationships | Structured interpretive content, optional language assistant later |

### Engine 1 — Birth Data

**Inputs:** date, exact local time, birthplace or coordinates, time zone history, daylight-saving status, and optional birth-time confidence.

**Outputs:** unambiguous timestamp, location coordinates, user-selected chart conventions, and a provenance/uncertainty record.

**Feature requirements:**
- Birth date, birth time and location input with place lookup.
- Correct handling of historical time zones and daylight-saving rule changes.
- User override for special or disputed time zone records.
- Missing birth time workflow that explicitly marks angle and house results as uncertain or unavailable.
- Optional ability to save multiple profiles locally without an account.

### Engine 2 — Astronomical Calculations

**Responsibilities:** calculate apparent planetary positions and transformations required for natal and sky views.

**Outputs:** time-indexed positions, right ascension/declination, ecliptic longitude/latitude, appropriate reference frames and metadata.

**Requirements:**
- Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.
- Earth-based geocentric positions for the natal chart.
- Observer-based topocentric or horizontal coordinates for the localized sky view where appropriate.
- Explicit handling of precession, equinox/reference epoch, and coordinate convention.
- Planetary apparent retrograde status for the selected astrology convention.
- Validation against trusted ephemeris reference cases.

**Potential libraries:** Astronomy Engine is convenient for browser-based astronomical calculations. Swiss Ephemeris is a specialized alternative whose integration method and licensing must be resolved before a commercial release. The plan does not mandate either vendor.

### Engine 3 — Astrology Rules

**Responsibilities:** convert astronomical positions into chart placements and symbolic angular relationships.

**Requirements:**
- Tropical zodiac as initial default; optional sidereal mode with a documented ayanamsa.
- House system options: Whole Sign initially, Placidus as an additional choice, with limitations disclosed for locations where certain systems cannot be calculated reliably.
- Ascendant, Midheaven, IC, Descendant, and other relevant angles.
- Sign degrees, house placements, chart ruler, traditional/modern rulership mappings.
- Major planetary aspects and configurable orbs.
- Stelliums, aspect configurations and angularity detections.
- Consistent and testable handling of cusp and near-boundary cases.

### Engine 4 — Fixed Stars and Constellations

**Responsibilities:** plot real stars correctly and separately classify traditional fixed-star astrological relationships.

**Requirements:**
- First release: curated catalog of ~50–100 notable stars, including Sirius, Regulus, Spica, Aldebaran, and Antares.
- Real sky coordinates and apparent brightness; star names and constellation references.
- Coordinate transformations and epoch/precession treatment appropriate to the natal date.
- Optional catalog expansion for much denser star rendering.
- Traditional fixed-star association rules with configurable longitude-based orbs.
- Display of **true angular separation in the sky** alongside any purely astrological longitude separation.
- Constellation line drawings, labels, and optional mythology/information.

**Data/legal note:** Review source-specific attribution, redistribution, and commercial-use rights for stellar catalogs before bundling them in a public product.

### Engine 5 — 3D Universe Renderer

**Responsibilities:** one responsive WebGL scene containing the selected sky, chart overlays, and highlighted relationship network.

**Requirements:**
- Full 360-degree camera rotation and touch navigation.
- Zoom-to-focus for stars, planets, signs and connection clusters.
- Layer controls for star field, constellations, labels, celestial guides, zodiac, houses, aspects and relation network.
- Selected-object emphasis and dimming of unrelated elements.
- GPU-efficient points/instancing for stars, level-of-detail, adaptive rendering for mobile.
- Readable object labels and hover/click/tap targets.
- Optional cinematic camera tours after core interactions work reliably.

**Recommended visualization framework:** Three.js, with a stable browser fallback and progressive rendering quality levels.

### Engine 6 — Correlation / Relationship Graph

**Responsibilities:** identify and rank qualifying relationships for user exploration. Here, “correlation” means **symbolic/geometry-based chart relationship**, not a statistical Pearson correlation or evidence of causality.

**Node types:** planets, Sun/Moon, fixed stars, zodiac signs, houses, chart angles, recognized aspect patterns.

**Edge types:**
- Planet–planet aspect.
- Planet–star traditional conjunction.
- Planet–sign placement and sign rulership.
- Planet–house placement.
- Planet/star-to-chart-angle proximity.
- Higher-order structures such as stelliums or aspect formations.

**Edge metadata:** category, reference system, angular measure, chosen orb, deviation from exactness, relevant calculation date, interpretive tradition, confidence/completeness, and presentation style.

**Interaction behavior:** Selecting Jupiter, for example, dims unconnected objects and highlights only Jupiter-related edges, optionally sorted by aspect category or closeness. Every displayed connection should be explorable and explainable.

### Engine 7 — Interpretation Content

**Responsibilities:** present contextual, clearly attributed and non-deterministic interpretations for natal placements and relationships.

**Requirements:**
- Short summary card for every major object and connection.
- Long-form explanation upon expansion.
- Consistent terminology depending on chosen astrology tradition.
- Separate factual astronomy from traditional symbolic interpretations.
- Source/provenance fields for editorial content; avoid unsupported precision.
- Optional AI narration later, grounded in already computed chart data and trusted interpretation records.

## 4. Feature Systems

### A. Personalized Celestial Generation

- Custom birth date, time and place entry.
- Natal positions of the 10 principal bodies used by modern western astrology.
- Zodiac and house overlays.
- Ascendant, Midheaven, IC, Descendant.
- Planet degrees and retrograde indicator.
- Tropical/sidereal convention selection; initial house system options.
- Missing-time mode with clearly signaled limitations.

### B. 3D Fixed-Star and Constellation Mapping

- Apparent stellar directions for the natal epoch.
- Bright-star visualization, constellation outlines and labels.
- Fixed stars with traditional astrological importance.
- Highlighted links to selected natal bodies where qualification rules are met.
- Search, object details, brightness and coordinates.
- Optional cultural/mythological descriptions.

### C. Planetary and Stellar Connection Network

- Major aspects: conjunction, sextile, square, trine, opposition.
- Adjustable orb thresholds and per-relationship filters.
- Fixed-star longitude conjunction detection (separate from true sky separation).
- Rulerships, angularity, sign/house associations and notable configurations.
- Highlight and isolate the network of the selected object.
- Inspect why each link qualifies; no unexplained “mystery score.”

### D. Interactive 3D Exploration

- Orbit, pan, zoom, touch controls, reset view and focus.
- Search/select celestial objects.
- Show/hide constellation lines, labels, zodiac rings, houses and aspects.
- Object details panel and optional camera fly-to.
- Designed for mouse, touch, keyboard and screen readers where possible.

## 5. Three Synchronized Visualization Modes

### Mode 1 — Natal Constellation Wheel
A three-dimensional interpretation of the classic natal chart, emphasizing houses, zodiac sections, bodies and aspect geometry. It is a **schematic astrological chart**, not a physically scaled planetary model.

### Mode 2 — Birth Sky Observatory
A reconstruction of the local sky at the birth moment, with accurate sight directions for planets and stars. Include horizon, celestial equator, ecliptic and constellation outlines as appropriate. Make above- vs below-horizon states obvious.

### Mode 3 — Cosmic Connection Network
A graph-oriented visualization of relationships between planets, fixed stars, zodiac and houses. Lines are **information edges**, not claims of physical beams or forces.

All modes use the same natal dataset and preserve the current object selection when switching.

## 6. Correlation Engine and Visual Legend

| Relationship | Approximate nominal angle | Proposed visual style |
|---|---:|---|
| Conjunction | 0° | Gold luminous line |
| Sextile | 60° | Blue line |
| Square | 90° | Red line |
| Trine | 120° | Green line |
| Opposition | 180° | Purple line |
| Planet–fixed-star traditional conjunction | Configurable ecliptic longitude criterion | White/cyan beam |
| Connection to chart angle | Configurable | Dashed bright line |

Visual styles must be user-customizable and should not rely on color alone. Add patterns or line styles for accessibility.

**Key distinction:** An ecliptic-longitude match used in fixed-star astrology can occur even when the objects are not visibly adjacent in the sky. The detail panel should show both measurements when available, and each relationship should state the rule it uses.

## 7. Single-Page Interface Plan

### Desktop composition

- **Header:** product title, profile, selected date/time, settings, optional save/export.
- **Left panel:** birth inputs, active mode, constellation and calculation settings, layer visibility.
- **Center canvas:** persistent Three.js celestial scene and minimal contextual controls.
- **Right panel:** selected object, coordinates/placement, associations, aspect list and interpretations.
- **Bottom mini-timeline (later):** birth moment versus transits or other time steps.

### Mobile composition

- Large central scene with floating mode switcher.
- Collapsible bottom sheet for object details.
- Drawer for birth information, layer toggles and settings.
- Touch-first picking and large enough interactive markers.

### Primary user journey

1. Enter birth date/time/location; choose default conventions.
2. Generate natal data and open the 3D chart.
3. Rotate, zoom, and inspect planetary markers.
4. Select a planet to light up qualifying connections.
5. Inspect an aspect or fixed-star connection for method, precision and interpretation.
6. Switch between Natal Wheel, Birth Sky and Connection Network without losing selection.
7. Optionally save/export the chart.

## 8. Feature Roadmap

| Priority | Capability | Release intent |
|---|---|---|
| High | Natal chart generation | V1 |
| High | 3D celestial sphere | V1 |
| High | Zodiac/house overlays | V1 |
| High | Major planetary aspects | V1 |
| High | Curated fixed-star mapping | V1 |
| High | Object inspection | V1 |
| High | Three synchronized views | V1 |
| Medium | Conventional 2D natal reference overlay | V1.1 |
| Medium | Time machine | V1.1 |
| Medium | Natal-vs-current transits | V1.2 |
| Medium | Image and chart export | V1.1 |
| Medium | Local saved birth profiles | V1.1 |
| Low | Synastry comparison | V2 |
| Low | Alternative heliocentric astronomical exploration | V2 |
| Low | Cinematic camera journeys | V2 |
| Low | Natural-language interpretation assistant | V2 |

## 9. Five Delivery Phases

### Phase 1 — Natal/Astronomical Foundation

Establish birth inputs, historical time handling, ephemerides, coordinate transformations, sign/house logic and reference-case validation.

**Exit condition:** multiple test charts reproduce agreed reference positions and correctly flag incomplete birth times.

### Phase 2 — Interactive 3D Universe

Create the navigable star field, planetary markers, chart overlays, camera controls and object picker.

**Exit condition:** user can navigate a valid natal scene smoothly on desktop and representative mobile hardware.

### Phase 3 — Stellar Correlations

Introduce curated fixed stars, connection classification and graph filtering, with transparent edge calculation rules.

**Exit condition:** selecting a planet reliably lists and highlights exactly the same relationships across visual and detail views.

### Phase 4 — Interpretation and Three-Mode Experience

Create explanatory object cards, traditions/setting labels, Natal Wheel, Birth Sky and Connection Network mode synchronization.

**Exit condition:** users can understand the distinction between symbolic aspects and actual sky proximity.

### Phase 5 — Advanced Experience

Extend to saved charts, exports, time travel, current transits, accessibility polish, and optional comparison modes.

**Exit condition:** the app can save/share useful outcomes without compromising birth-data privacy.

## 10. Essential Design and Scientific Integrity Requirements

1. **Coordinate integrity:** Clearly declare time scale, reference epoch, zodiac convention and geocentric/topocentric context for every position and overlay.
2. **Scale clarity:** Symbolic zodiac/houses/aspect lines are never misrepresented as physically sized 3D distances.
3. **Time accuracy:** Account for historical local clock rules; unknown birth times must not produce unjustified precise Ascendants/houses.
4. **Framework clarity:** Tropical signs, sidereal signs and astronomical constellations are distinct systems.
5. **Performance:** Begin with curated stars; add large catalogs only when frame-time budget allows.
6. **Privacy:** Default to client-side birth processing and local storage; no backend is necessary for the first release.
7. **Interpretation integrity:** Present astrological meaning as traditional/symbolic, not scientifically proven causation or prediction.
8. **Licensing:** Verify licenses for ephemeris software, place data, fonts, imagery and star catalogs before redistribution or commercial use.
9. **Accessibility:** Preserve meaningful interaction without reliance on specific colors, tiny visual targets or animation.

## 11. Recommended First Release — V1.0

**Personal Celestial Atlas:** A complete browser-based experience generating one person's birth-chart sky and its highlighted traditional relationships.

Minimum feature set:
- Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto natal positions.
- Zodiac and twelve-house structure, with time-uncertainty handling.
- Fully rotatable/zoomable 3D celestial interface.
- Catalog of approximately 50–100 notable stars.
- Major planet-to-planet aspect calculations.
- Traditional planet-to-fixed-star conjunction detection.
- Inspectable connection lines and object explanations.
- Three synchronized view modes.
- Mobile-responsive single-page shell.

**Primary success criterion:** Selecting any natal planet reveals a consistent, explainable and visually legible network of its significant natal relationships.

## 12. Handoff Notes for the Implementing System

- Deliver a **single-page HTML/JavaScript experience**; a bundler and split source files are permissible during development, but the shipped experience should behave as one page.
- Keep the seven engines independently testable and connected by stable data contracts.
- Start from precise calculations; visualizations consume data rather than generating astronomical values themselves.
- Represent each relationship with a rule ID, explicit angle/orb fields and the active reference convention.
- Preserve object IDs and selected state when moving between the three views.
- Define a clear lower-performance rendering path for mobile/older browsers.
- Keep natal data private by default.
- Avoid introducing accounts, AI APIs or a server as mandatory dependencies for V1.
- Treat all sample visuals as art direction, not scientific figures.

## 13. Suggested Reference Sources (for Technical Evaluation)

- Three.js: https://threejs.org/
- Astronomy Engine: https://github.com/cosinekitty/astronomy
- Swiss Ephemeris and licensing information: https://www.astro.com/swisseph/
- ESA Gaia mission: https://www.cosmos.esa.int/web/gaia
- ESA Hipparcos catalogue: https://www.cosmos.esa.int/web/hipparcos

These are starting points for evaluation, not endorsements or guarantees of license compatibility. Confirm current project documentation and terms during implementation.
