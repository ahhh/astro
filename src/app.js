// Single-page controller: birth input → engines → views. Holds selection and
// settings so the three modes, the 2D wheel and the panels always agree.

import { buildBirthContext, loadCities, searchCities, formatOffset, isValidTimeZone } from './birth.js';
import { computeSky } from './astro.js';
import { buildChart, SIGNS, ASPECTS, ZODIACS, HOUSE_SYSTEMS, fmtLon, fmtDeg, signOf } from './astrology.js';
import { loadCatalog, starField, fixedStarPositions, fixedStarContacts, getCatalog } from './stars.js';
import { buildGraph, edgesFor, neighbours, EDGE_TYPES } from './correlations.js';
import { Universe } from './scene.js';
import { initTooltips, registerTip, show as showTip, hide as hideTip } from './tooltip.js';
import { renderWheel2D, highlightWheel2D } from './wheel2d.js';
import * as T from './interpret.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = T.esc;

// --- state ------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  zodiac: 'tropical', houseSystem: 'placidus', modernRulers: true, includeNodes: false,
  orbs: Object.fromEntries(ASPECTS.map((a) => [a.id, a.orb])),
  enabledAspects: Object.fromEntries(ASPECTS.map((a) => [a.id, true])),
  luminaryBonus: 2, angleOrb: 5, starOrb: 1, starOrbByMag: true, starRule: 'longitude', magLimit: 6.5,
};
const LAYERS = [
  ['stars', 'Star field', 'g:hyg', true], ['constellations', 'Constellation figures', 'g:constellation', true],
  ['conLabels', 'Constellation names', 'g:constellation', false], ['zodiac', 'Zodiac ring / ecliptic', 'g:sign', true],
  ['houses', 'Houses', 'g:house', true], ['aspects', 'Aspect lines', 'g:aspect', true],
  ['fixedStars', 'Fixed-star contacts', 'g:fixedStarRule', true], ['allFixedStars', 'All 68 fixed stars', 'g:fixedStar', true],
  ['nodes', 'Lunar nodes', 'g:node', true], ['guides', 'Equator & horizon guides', 'g:obliquity', true],
  ['ground', 'Ground (Birth Sky)', 'In Birth Sky mode, a translucent ground hides nothing but darkens everything below the horizon.', true],
  ['skyAspects', 'Aspect arcs on the sky', 'Draw aspect lines between planets\' real sky positions. Still measured in longitude — the arcs only connect where the planets appeared.', false],
  ['labels', 'Labels', 'Show or hide all text labels in the 3D view.', true],
];

let settings = loadJSON('cba.settings', null) ?? structuredClone(DEFAULT_SETTINGS);
settings = { ...structuredClone(DEFAULT_SETTINGS), ...settings };
let layers = { ...Object.fromEntries(LAYERS.map(([k, , , on]) => [k, on])), ...loadJSON('cba.layers', {}) };
// Sign and rulership edges start hidden: they would swamp the highlighted network.
const defaultEdgeFilters = () => Object.fromEntries(Object.keys(EDGE_TYPES).map((k) => [k, !['sign', 'rules'].includes(k)]));
let edgeFilters = defaultEdgeFilters();
let mode = 'wheel';
let model = null;
let selected = null;
let place = null;
let universe = null;

function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }

// --- boot -----------------------------------------------------------------------

async function boot() {
  initTooltips();
  registerTips();
  fillTimeZones();
  buildSettingsUI();
  bindUI();
  try {
    await loadCatalog();
  } catch (err) {
    $('#loading-msg').textContent = 'Could not load star data. Serve this folder over HTTP (e.g. python3 -m http.server).';
    console.error(err);
    return;
  }
  universe = new Universe($('#stage'), { onHover, onSelect: select });
  universe.setLayers(layers);
  universe.setEdgeFilters(edgeFilters);
  loadCities();

  // default: the sky right now over Greenwich
  setPlace({ label: 'Greenwich, England, United Kingdom', lat: 51.4779, lon: -0.0015, tz: 'Europe/London' });
  setNow();
  cast();
  $('#loading').classList.add('done');
}

// --- calculation pipeline -------------------------------------------------------

function readForm() {
  const date = $('#f-date').value;
  const time = $('#f-time').value || '12:00';
  const timeKnown = !$('#f-time-unknown').checked;
  const lat = parseFloat($('#f-lat').value);
  const lon = parseFloat($('#f-lon').value);
  const tz = $('#f-tz').value;
  const offsetText = $('#f-offset').value.trim().replace('−', '-');
  let offsetOverride = null;
  if (offsetText) {
    const m = offsetText.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
    if (!m) throw new Error('Manual offset must look like +05:30 or -04:00.');
    offsetOverride = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0) + Number(m[4] || 0) / 60);
  }
  if (!date) throw new Error('Enter a birth date.');
  const year = Number(date.slice(0, 4));
  if (year < 1700 || year > 2200) throw new Error('Dates between 1700 and 2200 are supported.');
  if (!Number.isFinite(lat) || Math.abs(lat) >= 90) throw new Error('Choose a birthplace or enter a valid latitude.');
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) throw new Error('Enter a valid longitude.');
  if (!offsetOverride && offsetOverride !== 0 && !isValidTimeZone(tz)) throw new Error('Choose a time zone.');
  return {
    name: $('#f-name').value.trim(), date, time, timeKnown, lat, lon, tz,
    placeLabel: place?.label, offsetOverride, ambiguityChoice: $('#f-ambig').value,
  };
}

function cast() {
  let input;
  try { input = readForm(); } catch (err) { showResolutionError(err.message); return; }
  const ctx = buildBirthContext(input);
  const sky = computeSky(ctx);
  const chart = buildChart(ctx, sky, settings);
  const stars = fixedStarPositions(sky, chart.ayanamsa);
  const contacts = fixedStarContacts(chart, sky, stars, settings);
  const field = starField(sky);
  const graph = buildGraph(chart, stars, contacts, settings);
  const lookup = new Map([...chart.placements.map((p) => [p.id, p]), ...stars.map((s) => [s.id, s])]);
  model = {
    input, ctx, sky, chart, stars, contacts, field, graph, settings, catalog: getCatalog(),
    byId: (id) => lookup.get(id),
  };
  if (selected && !graph.byId.has(selected)) selected = null;
  universe.setModel(model);
  renderAll();
  window.atlas = { model, universe }; // handy for debugging from the console
}

function recalc() {
  saveJSON('cba.settings', settings);
  if (model) cast();
}

// --- tooltips ---------------------------------------------------------------------

function registerTips() {
  registerTip('obj', (id) => model && T.nodeTip(model, model.graph.byId.get(id)));
  registerTip('edge', (id) => model && model.graph.edgeById.get(id) && T.edgeTip(model, model.graph.edgeById.get(id)));
  registerTip('sign', (i) => model && T.signTip(model, Number(i)));
  registerTip('house', (h) => model && model.chart.houses && T.houseTip(model, Number(h)));
  registerTip('con', (id) => {
    const c = getCatalog().consById.get(id);
    if (!c) return null;
    const fs = model?.stars.filter((s) => s.con === id).map((s) => s.name) ?? [];
    const zodiacal = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc', 'Oph'].includes(id);
    return `<div class="tip-title">${esc(c.name)} <span class="muted">(${esc(id)})</span></div>
      ${T.row('Genitive', esc(c.genitive ?? '—'))}
      ${fs.length ? T.row('Fixed stars here', esc(fs.join(', '))) : ''}
      ${T.fact(`An IAU constellation: a bounded region of sky. The stick figure joins real HYG stars.${zodiacal ? ' The ecliptic passes through it — but the zodiac <i>sign</i> of the same name is a separate 30° slice.' : ''}${id === 'Oph' ? ' Ophiuchus is the "13th" constellation the Sun crosses (late Nov–mid Dec); it is not a sign in either zodiac.' : ''}`)}`;
  });
  registerTip('mode', (m) => ({
    wheel: `<div class="tip-title">◎ Natal Wheel</div><div class="tip-body">The classic chart as a ring around a celestial globe. The ring <b>is</b> the ecliptic: real stars are rotated into the same frame, so each sign segment sits in front of the stars actually at those longitudes.</div>${T.fact('Schematic: houses and aspect lines are diagrams, not physical structures.')}`,
    sky: `<div class="tip-title">◠ Birth Sky</div><div class="tip-body">Stand at the birthplace at the birth moment and look around. Planets, stars and the ecliptic are in their true directions (topocentric, with refraction for planets).</div>${T.fact('Physically accurate directions. The ASC label sits where the ecliptic crossed the eastern horizon.')}`,
    network: `<div class="tip-title">⋰ Connections</div><div class="tip-body">Every rule-defined relationship as a graph: aspects, fixed-star contacts, signs, houses, rulerships and configurations. Signs are pinned to the outer ring, houses to the inner ring.</div>${T.fact('Layout distance means nothing physically. Edges are information.')}`,
  }[m]));
  registerTip('calc', (key) => calcTip(key));
}

function calcTip(key) {
  if (!model) return null;
  const { ctx, sky, chart } = model;
  const tips = {
    utc: () => `<div class="tip-title">Universal Time</div>${T.row('Local', esc(ctx.local.text))}${T.row('Offset', formatOffset(ctx.offsetMinutes))}${T.row('UTC', ctx.utc.toISOString().replace('T', ' ').slice(0, 19))}${T.fact(`UTC = local − offset. Source: ${esc(ctx.tzSource)}.`)}`,
    jd: () => `<div class="tip-title">Julian Day</div>${T.row('JD (UT)', sky.jdUT.toFixed(5))}${T.row('JD (TT)', sky.jdTT.toFixed(5))}${T.fact('A continuous day count since 4713 BCE used by astronomers to avoid calendar arithmetic. TT = UT + ΔT.')}`,
    deltaT: () => T.glossaryHtml('deltaT') + T.row('ΔT here', `${sky.deltaT.toFixed(1)} s`),
    lst: () => T.glossaryHtml('ramc') + T.row('GAST', `${sky.gast.toFixed(5)} h`) + T.row('× 15 + longitude', `${(sky.gast * 15).toFixed(3)}° + ${ctx.lon.toFixed(3)}° = ${sky.lst.toFixed(3)}°`),
    obliquity: () => T.glossaryHtml('obliquity') + T.row('True ε', `${sky.obliquity.toFixed(5)}°`) + T.row('Nutation in longitude', `${sky.nutationLon.toFixed(2)}″`),
    ayanamsa: () => T.glossaryHtml('ayanamsa') + T.row('Value', `${chart.ayanamsa.toFixed(4)}°`),
    frame: () => T.glossaryHtml('ofDate') + T.row('Centre', 'geocentric (chart) · topocentric (Birth Sky)'),
    sect: () => T.glossaryHtml('sect') + (chart.sect ? T.row('This chart', `${chart.sect} chart (Sun altitude ${sky.bodies[0].alt.toFixed(1)}°)`) : ''),
    ruler: () => T.glossaryHtml('chartRuler') + (chart.chartRuler ? T.row('This chart', `${T.cap(chart.chartRuler)}, ruler of ${SIGNS[signOf(chart.angles.asc).index].name} rising`) : ''),
  };
  return tips[key]?.();
}

function onHover(hit, x, y) {
  if (!hit || !model) { hideTip(); return; }
  let html = null;
  if (hit.tipKey) {
    const [prefix, ...rest] = hit.tipKey.split(':');
    const arg = rest.join(':');
    if (prefix === 'g') html = T.glossaryHtml(arg);
    else if (prefix === 'obj') html = T.nodeTip(model, model.graph.byId.get(arg));
    else if (prefix === 'edge') { const e = model.graph.edgeById.get(arg); html = e && T.edgeTip(model, e); }
    else if (prefix === 'sign') html = T.signTip(model, Number(arg));
    else if (prefix === 'house') html = T.houseTip(model, Number(arg));
  }
  if (html) showTip(html, x, y); else hideTip();
}

// --- selection --------------------------------------------------------------------

function select(id, { focus = false } = {}) {
  selected = id && model?.graph.byId.has(id) ? id : null;
  universe.select(selected);
  if (selected && focus) universe.focus(selected);
  syncHighlight();
  renderDetails();
  if (selected) switchTab('details', false);
}

function syncHighlight() {
  const related = selected ? neighbours(model.graph, selected, edgeFilters) : null;
  const relEdges = selected ? new Set(edgesFor(model.graph, selected, edgeFilters).map((e) => e.id)) : null;
  highlightWheel2D($('#wheel2d'), model, selected, related, relEdges);
  $$('.list-row[data-id]').forEach((r) => r.classList.toggle('is-selected', r.dataset.id === selected));
}

// --- rendering panels -----------------------------------------------------------

function renderAll() {
  renderChips();
  renderResolution();
  renderBanner();
  renderLegend();
  renderStatus();
  renderPlacements();
  renderAspects();
  renderStars();
  renderWheel2D($('#wheel2d'), model, (id) => select(id, { focus: true }));
  renderMath();
  renderDetails();
  syncHighlight();
}

function renderChips() {
  const z = ZODIACS[settings.zodiac];
  const h = model.chart.houseSystem ? HOUSE_SYSTEMS[model.chart.houseSystem].name : 'No houses';
  $('#convention-chips').innerHTML = `
    <span class="chip" data-tip="g:${settings.zodiac === 'tropical' ? 'tropical' : 'sidereal'}">${esc(z.short)}</span>
    <span class="chip" data-tip="${model.chart.houseSystem ? `g:${{ 'whole-sign': 'wholeSign', placidus: 'placidus', equal: 'equal', porphyry: 'porphyry' }[model.chart.houseSystem]}` : 'g:timeUnknown'}">${esc(h)}${model.chart.houses?.requested ? ' ⚠' : ''}</span>
    <span class="chip" data-tip="calc:frame">Geocentric · true equinox of date</span>`;
}

function showResolutionError(msg) {
  $('#resolution').innerHTML = `<div class="error">⚠ ${esc(msg)}</div>`;
}

function renderResolution() {
  const { ctx, sky } = model;
  const caution = [...ctx.cautions, ...model.chart.cautions];
  $('#resolution').innerHTML = `
    <div class="res-grid">
      <span data-tip="calc:utc">Local</span><b>${esc(ctx.local.text)}</b>
      <span data-tip="g:dst">Zone</span><b>${esc(ctx.zoneLabel)} <span class="muted">${formatOffset(ctx.offsetMinutes)}</span></b>
      <span data-tip="calc:utc">UTC</span><b>${ctx.utc.toISOString().replace('T', ' ').slice(0, 16)}</b>
      <span data-tip="Geographic coordinates of the birthplace (WGS84).">Place</span><b>${esc(ctx.placeLabel)}<br><span class="muted">${Math.abs(ctx.lat).toFixed(4)}°${ctx.lat >= 0 ? 'N' : 'S'} ${Math.abs(ctx.lon).toFixed(4)}°${ctx.lon >= 0 ? 'E' : 'W'}</span></b>
      <span data-tip="calc:jd">JD (TT)</span><b>${sky.jdTT.toFixed(4)}</b>
      <span data-tip="calc:deltaT">ΔT</span><b>${sky.deltaT.toFixed(1)} s</b>
    </div>
    ${caution.map((c) => `<div class="caution">⚠ ${esc(c)}</div>`).join('')}`;
}

function renderBanner() {
  const text = {
    wheel: ['Natal Wheel', 'schematic chart on a real-star globe', 'mode:wheel'],
    sky: ['Birth Sky', `true directions from ${model.ctx.placeLabel.split(',')[0]} at the birth moment${skyLightNote()}`, 'mode:sky'],
    network: ['Connection Network', 'rule-defined relationships — information, not forces', 'mode:network'],
  }[mode];
  $('#mode-banner').innerHTML = `<b data-tip="${text[2]}">${text[0]}</b> <span>${esc(text[1])}</span> <span class="info" data-tip="${text[2]}">ⓘ</span>`;
}

function skyLightNote() {
  const alt = model.sky.bodies[0].alt;
  if (alt > 0) return ` · daytime (Sun ${alt.toFixed(0)}° up): stars shown were not visible to the eye`;
  if (alt > -18) return ` · twilight (Sun ${Math.abs(alt).toFixed(0)}° below horizon)`;
  return ' · night';
}

function dashSvg(color, dash) {
  return `<svg width="34" height="8" aria-hidden="true"><line x1="1" y1="4" x2="33" y2="4" stroke="${color}" stroke-width="2.4" ${dash ? `stroke-dasharray="${dash.map((d) => d * 1.4).join(' ')}"` : ''}/></svg>`;
}

function renderLegend() {
  const items = ASPECTS.map((a) => `<div class="legend-row" data-tip="g:aspect"><span class="legend-swatch">${dashSvg(a.color, a.dash)}</span>${a.glyph} ${a.name} <span class="muted">${a.angle}°</span></div>`);
  items.push(`<div class="legend-row" data-tip="g:fixedStarRule"><span class="legend-swatch">${dashSvg('#7fe7ff', [1, 1.2])}</span>✦ Fixed-star contact</div>`);
  if (mode === 'network') {
    items.push(`<div class="legend-row" data-tip="g:angularity"><span class="legend-swatch">${dashSvg('#ffffff', [6, 3])}</span>Angular</div>`);
    items.push(`<div class="legend-row" data-tip="Ruler of a sign"><span class="legend-swatch">${dashSvg('#d7a75f', [4, 2])}</span>Rules</div>`);
  }
  if (mode === 'sky') items.push(`<div class="legend-row" data-tip="g:ecliptic"><span class="legend-swatch">${dashSvg('#f2c14e')}</span>Ecliptic</div><div class="legend-row" data-tip="g:ra"><span class="legend-swatch">${dashSvg('#6fa8ff', [3, 3])}</span>Celestial equator</div><div class="legend-row" data-tip="g:altaz"><span class="legend-swatch">${dashSvg('#8fd18f')}</span>Horizon</div>`);
  $('#legend').innerHTML = `<details ${window.innerWidth > 900 ? 'open' : ''}><summary data-tip="Line styles differ by pattern as well as colour, so the legend works without colour vision.">Legend</summary>${items.join('')}</details>`;
}

function renderStatus() {
  const { sky, chart } = model;
  $('#statusbar').innerHTML = `
    <span data-tip="calc:lst">RAMC <b>${sky.lst.toFixed(2)}°</b></span>
    <span data-tip="calc:obliquity">ε <b>${sky.obliquity.toFixed(4)}°</b></span>
    ${chart.ayanamsa ? `<span data-tip="calc:ayanamsa">Ayanamsa <b>${chart.ayanamsa.toFixed(3)}°</b></span>` : ''}
    <span data-tip="calc:deltaT">ΔT <b>${sky.deltaT.toFixed(1)} s</b></span>
    <span data-tip="g:hyg">Stars <b>${model.field.n.toLocaleString()}</b> HYG · epoch ${(2000 + model.field.years).toFixed(1)}</span>
    <span data-tip="g:vsop">Ephemeris <b>Astronomy Engine</b></span>
    <span class="grow"></span>
    <span data-tip="Interpretations are traditional and symbolic; they make no scientific claim of causation or prediction." class="muted">Astronomy is measured · astrology is symbolic</span>`;
}

function placementRow(p) {
  const s = signOf(p.lon);
  const dig = p.dignity ? `<span class="badge dig-${p.dignity}" data-tip="${esc(T.DIGNITY_TEXT[p.dignity])}">${p.dignity.slice(0, 3)}</span>` : '';
  const rx = p.retrograde && p.kind === 'body' ? '<span class="rx" data-tip="g:retrograde">℞</span>' : '';
  return `<button type="button" class="list-row" data-id="${p.id}" data-tip="obj:${p.id}">
    <span class="glyph">${p.glyph}</span><span class="name">${esc(p.name)}</span>
    <span class="pos">${fmtDeg(s.degree)} <span data-tip="sign:${s.index}">${SIGNS[s.index].glyph}</span> ${rx}</span>
    <span class="house" ${p.house ? `data-tip="house:${p.house}"` : ''}>${p.house ?? '—'}</span>${dig}</button>`;
}

function renderPlacements() {
  const { chart } = model;
  const bodies = chart.placements.filter((p) => p.kind !== 'angle');
  const angles = chart.placements.filter((p) => p.kind === 'angle');
  const bal = chart.balances;
  const bar = (obj, key) => Object.entries(obj).map(([k, ids]) => `<div class="bal" data-tip="${esc(`${k}: ${ids.map(T.cap).join(', ') || 'none'}`)}"><span>${k}</span><div class="bal-bar"><i style="width:${ids.length * 10}%"></i></div><b>${ids.length}</b></div>`).join('');
  $('#tab-planets').innerHTML = `
    <div class="list-head"><span></span><span>Body</span><span data-tip="g:eclipticLon">Position</span><span data-tip="g:house">House</span><span data-tip="g:dignity">Dig.</span></div>
    ${bodies.map(placementRow).join('')}
    ${angles.length ? `<h3>Angles <span class="info" data-tip="g:house">ⓘ</span></h3>${angles.map(placementRow).join('')}` : `<p class="caution" data-tip="g:timeUnknown">Angles and houses need a birth time.</p>`}
    <div class="facts">
      ${chart.chartRuler ? `<div data-tip="calc:ruler"><span>Chart ruler</span><b>${T.cap(chart.chartRuler)}</b></div>` : ''}
      ${chart.sect ? `<div data-tip="calc:sect"><span>Sect</span><b>${chart.sect} chart</b></div>` : ''}
    </div>
    <h3>Balance <span class="info" data-tip="g:element">ⓘ</span></h3>
    <div class="balances">${bar(bal.elements)}</div>
    <div class="balances" data-tip="g:modality">${bar(bal.modalities)}</div>
    ${chart.patterns.length ? `<h3>Configurations</h3>${chart.patterns.map((p) => `<button type="button" class="list-row pattern" data-id="${p.id}" data-tip="obj:${p.id}"><span class="glyph">◈</span><span class="name">${esc(p.label)}</span><span class="pos">${p.members.map((m) => model.byId(m).glyph).join(' ')}</span></button>`).join('')}` : ''}`;
}

function renderAspects() {
  const { chart } = model;
  const bodies = chart.placements.filter((p) => p.kind === 'body' || (p.kind === 'angle' && ['asc', 'mc'].includes(p.id)) || (settings.includeNodes && p.id === 'node'));
  const find = (a, b) => chart.aspects.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  let grid = '<table class="aspect-grid" aria-label="Aspect grid"><tbody>';
  for (let i = 1; i < bodies.length; i++) {
    grid += `<tr><th data-tip="obj:${bodies[i].id}">${bodies[i].glyph}</th>`;
    for (let j = 0; j < i; j++) {
      const a = find(bodies[i].id, bodies[j].id);
      grid += a ? `<td data-tip="edge:${a.id}" data-edge="${a.id}" style="color:${a.aspect.color}" class="${a.applying ? 'app' : 'sep'}">${a.aspect.glyph}<small>${Math.round(a.deviation)}</small></td>` : '<td></td>';
    }
    grid += '</tr>';
  }
  grid += `<tr><th></th>${bodies.slice(0, -1).map((b) => `<th data-tip="obj:${b.id}">${b.glyph}</th>`).join('')}</tr></tbody></table>`;
  const rows = chart.aspects.map((a) => {
    const pa = model.byId(a.a); const pb = model.byId(a.b);
    return `<button type="button" class="list-row aspect-row" data-edge="${a.id}" data-id="${a.a}" data-tip="edge:${a.id}">
      <span class="glyph" style="color:${a.aspect.color}">${a.aspect.glyph}</span>
      <span class="name">${pa.glyph} ${esc(pa.name)} ${a.aspect.name.toLowerCase()} ${pb.glyph} ${esc(pb.name)}</span>
      <span class="pos">${a.deviation.toFixed(2)}°</span><span class="house" data-tip="g:applying">${a.applying ? 'A' : 'S'}</span></button>`;
  }).join('');
  $('#tab-aspects').innerHTML = `<p class="hint">Grid numbers are degrees from exact. <span data-tip="g:applying" class="u">A/S</span> = applying/separating. <span data-tip="g:orb" class="u">Orbs</span> are set in the left panel.</p>${grid}<h3>${chart.aspects.length} aspects, tightest first</h3>${rows}`;
  $('#tab-aspects').querySelectorAll('td[data-edge]').forEach((td) => td.addEventListener('click', () => {
    const e = model.graph.edgeById.get(td.dataset.edge); select(e.source, { focus: true });
  }));
}

function renderStars() {
  const { contacts, stars } = model;
  const contactRows = contacts.map((c) => {
    const p = model.byId(c.a); const s = model.byId(c.b);
    const far = c.skySeparation > 5;
    return `<button type="button" class="list-row star-row" data-id="${s.id}" data-tip="edge:${c.id}">
      <span class="glyph">${p.glyph}</span><span class="name">${esc(p.name)} ☌ ${esc(s.name)} <span class="muted">${esc(s.nature)}</span></span>
      <span class="pos" data-tip="g:eclipticLon">Δλ ${c.lonDiff.toFixed(2)}°</span>
      <span class="pos ${far ? 'warn' : ''}" data-tip="g:skySeparation">sky ${c.skySeparation.toFixed(1)}°</span></button>`;
  }).join('') || '<p class="hint">No planet or angle falls within the fixed-star orb. Try widening it in Orbs.</p>';
  const all = [...stars].sort((a, b) => a.lon - b.lon).map((s) => `<button type="button" class="list-row star-row" data-id="${s.id}" data-tip="obj:${s.id}">
      <span class="glyph">✦</span><span class="name">${esc(s.name)} <span class="muted">${esc(s.desig)}</span></span>
      <span class="pos">${fmtLon(s.lon)}</span><span class="house" data-tip="g:magnitude">${s.mag.toFixed(1)}</span></button>`).join('');
  $('#tab-stars').innerHTML = `
    <p class="hint">Rule: <b data-tip="g:fixedStarRule" class="u">${settings.starRule === 'sky' ? 'true sky separation' : 'ecliptic longitude only'}</b>. Both distances are shown — <span class="warn">orange</span> means the pair was far apart on the real sky.</p>
    <h3>Contacts (${contacts.length})</h3>${contactRows}
    <h3>All fixed stars by longitude <span class="info" data-tip="g:nature">ⓘ</span></h3>${all}
    <p class="hint">${esc(getCatalog().fixedMeta.source)}</p>`;
}

function renderDetails() {
  const box = $('#tab-details');
  if (!model) return;
  if (!selected) {
    const sun = model.byId('sun'); const moon = model.byId('moon');
    const asc = model.chart.angles ? fmtLon(model.chart.angles.asc) : null;
    box.innerHTML = `
      <div class="hero">
        <div class="hero-title">${esc(model.ctx.name || 'Birth chart')}</div>
        <div class="big3">
          <button type="button" class="list-row" data-id="sun" data-tip="obj:sun"><span class="glyph">☉</span><span class="name">Sun</span><span class="pos">${fmtLon(sun.lon)}</span></button>
          <button type="button" class="list-row" data-id="moon" data-tip="obj:moon"><span class="glyph">☽</span><span class="name">Moon</span><span class="pos">${fmtLon(moon.lon)}</span></button>
          ${asc ? `<button type="button" class="list-row" data-id="asc" data-tip="obj:asc"><span class="glyph">AC</span><span class="name">Rising</span><span class="pos">${asc}</span></button>` : ''}
        </div>
      </div>
      <p class="hint">Select any planet — here, in the 3D view, or in Placements — to light up its network of relationships. Every line has a reason you can inspect.</p>
      <div class="facts">
        <div data-tip="g:aspect"><span>Aspects</span><b>${model.chart.aspects.length}</b></div>
        <div data-tip="g:fixedStarRule"><span>Fixed-star contacts</span><b>${model.contacts.length}</b></div>
        <div data-tip="g:stellium"><span>Configurations</span><b>${model.chart.patterns.length}</b></div>
        <div data-tip="g:retrograde"><span>Retrograde</span><b>${model.chart.placements.filter((p) => p.kind === 'body' && p.retrograde).map((p) => p.glyph).join(' ') || 'none'}</b></div>
      </div>`;
    return;
  }
  const node = model.graph.byId.get(selected);
  const edges = edgesFor(model.graph, selected, edgeFilters);
  const groups = {};
  for (const e of edges) (groups[e.type] ||= []).push(e);
  const other = (e) => model.graph.byId.get(e.source === selected ? e.target : e.source);
  const connections = Object.entries(groups).map(([type, list]) => `
    <h3>${EDGE_TYPES[type].label}s <span class="muted">(${list.length})</span></h3>
    ${list.sort((a, b) => (a.data?.deviation ?? 0) - (b.data?.deviation ?? 0)).map((e) => {
      const o = other(e);
      const detail = e.type === 'aspect' ? `${e.aspect.glyph} ${e.aspect.name} · ${e.data.deviation.toFixed(2)}° ${e.data.applying ? 'applying' : 'separating'}`
        : e.type === 'star' ? `Δλ ${e.data.lonDiff.toFixed(2)}° · sky ${e.data.skySeparation.toFixed(1)}°`
          : esc(e.rule);
      return `<button type="button" class="list-row conn" data-id="${o?.id}" data-tip="edge:${e.id}">
        <span class="glyph" style="color:${e.color}">${o?.glyph ?? ''}</span><span class="name">${esc(o?.label ?? '')}<br><small>${detail}</small></span></button>`;
    }).join('')}`).join('');
  box.innerHTML = `
    <div class="detail-head"><span class="glyph big">${esc(node.glyph)}</span><div><div class="hero-title">${esc(node.label)}</div><div class="muted">${node.kind}</div></div>
      <button type="button" class="ghost small" id="clear-sel" data-tip="Clear selection (Esc)">✕</button></div>
    <div class="detail-tip">${T.nodeTip(model, node)}</div>
    ${connections || '<p class="hint">No relationships pass the current filters.</p>'}
    <p class="hint">Relationship filters (left panel) control which kinds appear here and in the 3D view.</p>`;
  $('#clear-sel')?.addEventListener('click', () => select(null));
}

function renderMath() {
  const { ctx, sky, chart } = model;
  const d = (x, n = 4) => x.toFixed(n);
  const sel = selected && model.byId(selected);
  const body = sel && (sel.kind === 'body' || sel.kind === 'point') ? sel : model.byId('sun');
  const star = sel && sel.kind === 'star' ? sel : model.stars.find((s) => s.name === 'Regulus');
  const zs = signOf(body.lon);
  const steps = [];
  steps.push(['1 · Local time → UTC', 'g:dst', `${esc(ctx.local.text)} at ${esc(ctx.zoneLabel)}<br>offset ${formatOffset(ctx.offsetMinutes)} → <b>${ctx.utc.toISOString().slice(0, 19).replace('T', ' ')} UTC</b>`]);
  steps.push(['2 · Time scales', 'g:deltaT', `JD(UT) = ${d(sky.jdUT, 5)}<br>ΔT = ${d(sky.deltaT, 1)} s → JD(TT) = <b>${d(sky.jdTT, 5)}</b>`]);
  steps.push(['3 · Earth orientation', 'g:obliquity', `true obliquity ε = <b>${d(sky.obliquity, 5)}°</b> (mean ${d(sky.meanObliquity, 5)}° + nutation)<br>GAST = ${d(sky.gast, 5)} h`]);
  steps.push(['4 · Local sidereal time (RAMC)', 'g:ramc', `RAMC = GAST × 15 + λ<sub>geo</sub> = ${d(sky.gast * 15, 3)}° + ${d(ctx.lon, 3)}° = <b>${d(sky.lst, 3)}°</b>`]);
  if (chart.angles) {
    const t = chart.angles.tropical;
    steps.push(['5 · Midheaven', 'obj:mc', `MC = atan2(sin RAMC, cos RAMC · cos ε) = <b>${d(t.mc, 3)}°</b> → ${fmtLon(chart.angles.mc)}`]);
    steps.push(['6 · Ascendant', 'obj:asc', `ASC = atan2(cos RAMC, −(sin RAMC · cos ε + tan φ · sin ε))<br>φ = ${d(ctx.lat, 4)}° → <b>${d(t.asc, 3)}°</b> → ${fmtLon(chart.angles.asc)}`]);
    steps.push([`7 · Houses (${HOUSE_SYSTEMS[chart.houseSystem].name})`, `g:${{ 'whole-sign': 'wholeSign', placidus: 'placidus', equal: 'equal', porphyry: 'porphyry' }[chart.houseSystem]}`,
      chart.houses.cusps.map((c, i) => `${i + 1}: ${fmtLon(c)}`).join(' · ')]);
  } else {
    steps.push(['5–7 · Angles & houses', 'g:timeUnknown', 'Skipped: birth time unknown.']);
  }
  if (chart.ayanamsa) steps.push(['8 · Ayanamsa', 'g:ayanamsa', `${ZODIACS[settings.zodiac].j2000}° at J2000 + precession (5028.796″·T + 1.105″·T²) = <b>${d(chart.ayanamsa, 4)}°</b><br>sidereal λ = tropical λ − ayanamsa`]);
  const a = body.astro;
  steps.push([`9 · ${body.name}`, `obj:${body.id}`, a
    ? `Geocentric apparent vector (light-time + aberration) in J2000 → precess + nutate → true ecliptic of date<br>RA/Dec (J2000) ${d(a.raJ2000, 3)}° / ${d(a.decJ2000, 3)}°<br>λ = <b>${d(body.tropicalLon, 4)}°</b>${chart.ayanamsa ? ` − ${d(chart.ayanamsa, 4)}° = ${d(body.lon, 4)}°` : ''}, β = ${d(body.lat, 4)}°<br>
       Sign = ⌊${d(body.lon, 2)} ÷ 30⌋ = ${zs.index} → ${SIGNS[zs.index].name}, ${d(zs.degree, 2)}° in<br>
       Motion: λ(t+12h) − λ(t−12h) = ${body.speed >= 0 ? '+' : ''}${d(body.speed, 4)}°/day ${body.retrograde ? '→ <b>retrograde</b>' : ''}<br>
       Distance ${d(a.distAU, 5)} AU · topocentric alt ${d(a.alt, 2)}°, az ${d(a.az, 2)}°`
    : `Mean lunar node (Meeus 47.7): <b>${d(body.tropicalLon, 4)}°</b>`]);
  if (star) {
    steps.push([`10 · Fixed star ${star.name}`, `obj:${star.id}`, `HYG (J2000, epoch 2000.0): RA ${d(star.ra, 4)}°, Dec ${d(star.dec, 4)}°<br>
      Proper motion ${star.pmra} / ${star.pmdec} mas/yr × ${d(star.years, 2)} yr → RA ${d(star.raEpoch, 4)}°, Dec ${d(star.decEpoch, 4)}°<br>
      Rotate by precession + nutation (J2000 → ecliptic of date): λ = <b>${d(star.tropicalLon, 4)}°</b>, β = ${d(star.lat, 3)}°<br>
      → ${fmtLon(star.lon)}`]);
  }
  const asp = chart.aspects.find((x) => x.a === body.id || x.b === body.id) || chart.aspects[0];
  if (asp) {
    const pa = model.byId(asp.a); const pb = model.byId(asp.b);
    steps.push([`11 · Aspect ${pa.name}–${pb.name}`, `edge:${asp.id}`, `|${d(pa.lon, 3)}° − ${d(pb.lon, 3)}°| folded to ≤180° = ${d(asp.separation, 3)}°<br>
      nearest aspect: ${asp.aspect.name} (${asp.aspect.angle}°), off by ${d(asp.deviation, 3)}° ≤ orb ${asp.orb}° ✓`]);
  }
  $('#tab-math').innerHTML = `<p class="hint">The actual numbers behind this chart. ${sel ? 'Steps 9–11 follow your selection.' : 'Select a planet or fixed star to trace it in steps 9–11.'}</p>
    ${steps.map(([t, tip, html]) => `<div class="math-step"><div class="math-title" data-tip="${tip}">${t}</div><div class="math-body">${html}</div></div>`).join('')}
    <p class="hint">Validated against published values: run <code>node tests/run.mjs</code>.</p>`;
}

// --- tabs, modes, UI binding --------------------------------------------------

function switchTab(name, user = true) {
  $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
  $$('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.tab === name));
  if (name === 'math') renderMath();
  if (user && window.innerWidth < 900) $('#panel-right').classList.add('open');
}

function setMode(m) {
  mode = m;
  $$('.mode-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === m));
  universe.setMode(m);
  if (selected) universe.focus(selected);
  renderBanner();
  renderLegend();
}

function fillTimeZones() {
  const sel = $('#f-tz');
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { zones = ['UTC', 'Europe/London', 'America/New_York']; }
  if (!zones.includes('UTC')) zones.unshift('UTC');
  sel.innerHTML = zones.map((z) => `<option>${z}</option>`).join('');
}

function setPlace(p) {
  place = p;
  $('#f-place').value = p.label;
  $('#f-lat').value = p.lat;
  $('#f-lon').value = p.lon;
  if ([...$('#f-tz').options].some((o) => o.value === p.tz)) $('#f-tz').value = p.tz;
}

function setNow() {
  const tz = $('#f-tz').value || 'UTC';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  $('#f-date').value = `${parts.year}-${parts.month}-${parts.day}`;
  $('#f-time').value = `${parts.hour}:${parts.minute}`;
  $('#f-time-unknown').checked = false;
  $('#f-offset').value = '';
  $('#f-name').value = 'The sky right now';
}

function buildSettingsUI() {
  $('#orb-sliders').innerHTML = ASPECTS.map((a) => `
    <label class="slider"><span data-tip="${esc(`${a.name} (${a.angle}°): ${T.ASPECT_TEXT[a.id]}`)}"><input type="checkbox" data-aspect="${a.id}"> <i style="color:${a.color}">${a.glyph}</i> ${a.name}</span>
      <input type="range" min="0" max="12" step="0.5" data-orb="${a.id}"><output></output></label>`).join('');
  $('#layer-toggles').innerHTML = LAYERS.map(([k, name, tip]) => `<label class="check" data-tip="${esc(tip)}"><input type="checkbox" data-layer="${k}"><span>${name}</span></label>`).join('');
  $('#edge-filters').innerHTML = Object.entries(EDGE_TYPES).map(([k, v]) => `<label class="check" data-tip="${esc(`${v.label}: shown as ${v.style}. Unticking hides these edges and removes them from the selection network.`)}"><input type="checkbox" data-edge-filter="${k}"><span>${v.label}</span></label>`).join('');
  syncSettingsUI();
}

function syncSettingsUI() {
  $$('[data-setting]').forEach((el) => {
    const v = settings[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = String(v);
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = el.dataset.setting === 'magLimit' ? v : `${v}°`;
  });
  $$('[data-orb]').forEach((el) => { el.value = settings.orbs[el.dataset.orb]; el.parentElement.querySelector('output').textContent = `${settings.orbs[el.dataset.orb]}°`; });
  $$('[data-aspect]').forEach((el) => { el.checked = settings.enabledAspects[el.dataset.aspect] !== false; });
  $$('[data-layer]').forEach((el) => { el.checked = layers[el.dataset.layer] !== false; });
  $$('[data-edge-filter]').forEach((el) => { el.checked = edgeFilters[el.dataset.edgeFilter] !== false; });
}

function bindUI() {
  $('#birth-form').addEventListener('submit', (e) => { e.preventDefault(); select(null); cast(); closeDrawers(); });
  $('#btn-now').addEventListener('click', () => { setNow(); cast(); });
  $('#btn-example').addEventListener('click', () => {
    $('#f-name').value = 'Albert Einstein (reference chart)';
    $('#f-date').value = '1879-03-14';
    $('#f-time').value = '11:30';
    $('#f-time-unknown').checked = false;
    setPlace({ label: 'Ulm, Baden-Württemberg, Germany', lat: 48.4, lon: 9.9833, tz: 'Europe/Berlin' });
    $('#f-offset').value = '+00:39:56';
    select(null);
    cast();
  });
  $('#f-time-unknown').addEventListener('change', (e) => { $('#f-time').disabled = e.target.checked; });

  // place search
  const placeInput = $('#f-place');
  const results = $('#place-results');
  let active = -1;
  let found = [];
  const renderResults = () => {
    results.innerHTML = found.map((c, i) => `<div class="opt ${i === active ? 'active' : ''}" role="option" data-i="${i}"><b>${esc(c.name)}</b> <span class="muted">${esc([c.region, c.country].filter(Boolean).join(', '))}</span><small>${c.lat.toFixed(2)}, ${c.lon.toFixed(2)} · ${esc(c.tz)}</small></div>`).join('');
    results.classList.toggle('show', found.length > 0);
  };
  placeInput.addEventListener('input', async () => {
    await loadCities();
    found = searchCities(placeInput.value);
    active = found.length ? 0 : -1;
    renderResults();
  });
  placeInput.addEventListener('keydown', (e) => {
    if (!found.length) return;
    if (e.key === 'ArrowDown') { active = (active + 1) % found.length; renderResults(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = (active - 1 + found.length) % found.length; renderResults(); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { found = []; renderResults(); }
  });
  const choose = (i) => { const c = found[i]; setPlace({ label: c.label, lat: c.lat, lon: c.lon, tz: c.tz }); $('#f-offset').value = ''; found = []; renderResults(); };
  results.addEventListener('pointerdown', (e) => { const o = e.target.closest('.opt'); if (o) { e.preventDefault(); choose(Number(o.dataset.i)); } });
  placeInput.addEventListener('blur', () => setTimeout(() => { found = []; renderResults(); }, 150));
  for (const id of ['#f-lat', '#f-lon']) $(id).addEventListener('input', () => { place = null; });

  // settings
  $$('[data-setting]').forEach((el) => el.addEventListener('input', () => {
    const k = el.dataset.setting;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'range') v = Number(v);
    if (k === 'modernRulers') v = v === 'true';
    settings[k] = v;
    syncSettingsUI();
    if (el.type === 'range') debounceRecalc(); else recalc();
  }));
  $('#orb-sliders').addEventListener('input', (e) => {
    if (e.target.dataset.orb) settings.orbs[e.target.dataset.orb] = Number(e.target.value);
    if (e.target.dataset.aspect) settings.enabledAspects[e.target.dataset.aspect] = e.target.checked;
    syncSettingsUI();
    debounceRecalc();
  });
  $('#layer-toggles').addEventListener('change', (e) => {
    layers[e.target.dataset.layer] = e.target.checked;
    saveJSON('cba.layers', layers);
    universe.setLayers(layers);
  });
  $('#edge-filters').addEventListener('change', (e) => {
    edgeFilters[e.target.dataset.edgeFilter] = e.target.checked;
    universe.setEdgeFilters(edgeFilters);
    syncHighlight();
    renderDetails();
  });

  // modes, tabs, tools
  $$('.mode-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $('#zoom-in').addEventListener('click', () => universe.zoom(0.8));
  $('#zoom-out').addEventListener('click', () => universe.zoom(1.25));
  $('#focus-btn').addEventListener('click', () => selected && universe.focus(selected));
  $('#reset-btn').addEventListener('click', resetAll);
  $('#help-btn').addEventListener('click', () => $('#help').showModal());
  $('#open-left').addEventListener('click', () => { $('#panel-left').classList.toggle('open'); $('#panel-right').classList.remove('open'); });
  $('#open-right').addEventListener('click', () => { $('#panel-right').classList.toggle('open'); $('#panel-left').classList.remove('open'); });

  // list rows anywhere select their object
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.list-row[data-id]');
    if (row && row.dataset.id !== 'undefined') { select(row.dataset.id, { focus: true }); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === '1') setMode('wheel');
    if (e.key === '2') setMode('sky');
    if (e.key === '3') setMode('network');
    if (e.key === 'Escape') select(null);
  });

  // object search
  const os = $('#object-search');
  const or = $('#object-results');
  os.addEventListener('input', () => {
    const q = os.value.trim().toLowerCase();
    if (!q || !model) { or.classList.remove('show'); return; }
    const hits = model.graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 10);
    const cons = getCatalog().constellations.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4);
    or.innerHTML = hits.map((n) => `<div class="opt" data-id="${n.id}" data-tip="obj:${n.id}"><b>${esc(n.glyph)} ${esc(n.label)}</b> <span class="muted">${n.kind}</span></div>`).join('')
      + cons.map((c) => `<div class="opt" data-tip="con:${c.id}"><b>${esc(c.name)}</b> <span class="muted">constellation</span></div>`).join('');
    or.classList.toggle('show', hits.length + cons.length > 0);
  });
  or.addEventListener('pointerdown', (e) => {
    const o = e.target.closest('.opt[data-id]');
    if (o) { e.preventDefault(); select(o.dataset.id, { focus: true }); os.value = ''; or.classList.remove('show'); }
  });
  os.addEventListener('blur', () => setTimeout(() => or.classList.remove('show'), 150));

  // profiles
  $('#btn-save').addEventListener('click', () => {
    if (!model) return;
    const list = loadJSON('cba.profiles', []);
    const p = { ...model.input, placeLabel: $('#f-place').value, savedAt: new Date().toISOString() };
    list.unshift(p);
    saveJSON('cba.profiles', list.slice(0, 30));
    renderProfiles();
  });
  $('#btn-export').addEventListener('click', exportJSON);
  $('#btn-png').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = universe.snapshot();
    a.download = `celestial-atlas-${mode}.png`;
    a.click();
  });
  $('#profiles').addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    if (!li) return;
    const list = loadJSON('cba.profiles', []);
    const p = list[Number(li.dataset.i)];
    if (e.target.closest('.del')) { list.splice(Number(li.dataset.i), 1); saveJSON('cba.profiles', list); renderProfiles(); return; }
    $('#f-name').value = p.name; $('#f-date').value = p.date; $('#f-time').value = p.time;
    $('#f-time-unknown').checked = !p.timeKnown;
    setPlace({ label: p.placeLabel, lat: p.lat, lon: p.lon, tz: p.tz });
    $('#f-offset').value = p.offsetOverride != null ? formatOffset(p.offsetOverride).replace('UTC', '').replace('−', '-') : '';
    select(null); cast();
  });
  renderProfiles();
}

let recalcTimer = null;
function debounceRecalc() { clearTimeout(recalcTimer); recalcTimer = setTimeout(recalc, 180); }

function closeDrawers() { $('#panel-left').classList.remove('open'); }

function resetAll() {
  edgeFilters = defaultEdgeFilters();
  syncSettingsUI();
  universe.setEdgeFilters(edgeFilters);
  select(null);
  universe.resetView();
}

function renderProfiles() {
  const list = loadJSON('cba.profiles', []);
  $('#profiles').innerHTML = list.length ? list.map((p, i) => `<li data-i="${i}"><button type="button" class="link">${esc(p.name || 'Untitled')} <span class="muted">${esc(p.date)} ${p.timeKnown ? esc(p.time) : '(no time)'}</span></button><button type="button" class="del" aria-label="Delete" data-tip="Delete this saved chart from this browser">✕</button></li>`).join('') : '<li class="muted">No saved charts.</li>';
}

function exportJSON() {
  const { ctx, sky, chart, contacts } = model;
  const out = {
    generator: 'Celestial Birth Atlas',
    conventions: { zodiac: settings.zodiac, ayanamsa: chart.ayanamsa, houseSystem: chart.houseSystem, frame: 'geocentric apparent, true ecliptic and equinox of date', ephemeris: 'Astronomy Engine 2.1.19', stars: 'HYG v4.1 + proper motion' },
    birth: { name: ctx.name, local: ctx.local.text, utc: ctx.utc.toISOString(), offsetMinutes: ctx.offsetMinutes, tz: ctx.tz, lat: ctx.lat, lon: ctx.lon, timeKnown: ctx.timeKnown, cautions: ctx.cautions },
    time: { jdUT: sky.jdUT, jdTT: sky.jdTT, deltaT: sky.deltaT, ramc: sky.lst, obliquity: sky.obliquity },
    angles: chart.angles && { asc: chart.angles.asc, mc: chart.angles.mc },
    houses: chart.houses?.cusps,
    placements: chart.placements.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, sign: SIGNS[p.signIndex].name, degree: p.degree, house: p.house, retrograde: p.retrograde, speed: p.speed })),
    aspects: chart.aspects.map((a) => ({ a: a.a, b: a.b, type: a.aspect.id, separation: a.separation, deviation: a.deviation, orb: a.orb, applying: a.applying })),
    fixedStarContacts: contacts.map((c) => ({ body: c.a, star: model.byId(c.b).name, lonDiff: c.lonDiff, skySeparation: c.skySeparation, rule: c.rule, orb: c.orb })),
    settings,
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(ctx.name || 'chart').replace(/[^\w-]+/g, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

boot();
