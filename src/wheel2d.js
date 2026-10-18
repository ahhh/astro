// Conventional 2D natal wheel (SVG). Same computed chart as the 3D views;
// every drawn element carries a data-tip so the chart explains itself.

import { SIGNS } from './astrology.js';
import { BODY_COLORS } from './scene.js';

const NS = 'http://www.w3.org/2000/svg';
const ELEMENT_FILL = { Fire: '#ff7a59', Earth: '#9ccf6a', Air: '#7fc4ff', Water: '#8f86ff' };

function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

export function renderWheel2D(svg, model, onSelect) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '-222 -222 444 444');
  const anchor = model.chart.angles ? model.chart.angles.asc : 0;
  const th = (lon) => (180 + lon - anchor) * Math.PI / 180;
  const P = (lon, r) => [r * Math.cos(th(lon)), -r * Math.sin(th(lon))];
  const arc = (r0, r1, a0, a1) => {
    const [x0, y0] = P(a0, r1); const [x1, y1] = P(a1, r1);
    const [x2, y2] = P(a1, r0); const [x3, y3] = P(a0, r0);
    const large = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0;
    return `M${x0},${y0} A${r1},${r1} 0 ${large} 0 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 1 ${x3},${y3} Z`;
  };
  const RO = 200, RS = 172, RH = 150, RA = 70;

  // zodiac band
  SIGNS.forEach((s, i) => {
    const g = el('g', { 'data-tip': `sign:${i}`, class: 'w-sign', tabindex: 0 }, svg);
    el('path', { d: arc(RS, RO, i * 30, i * 30 + 30), fill: ELEMENT_FILL[s.element], 'fill-opacity': 0.14, stroke: '#c8d2f2', 'stroke-opacity': 0.35 }, g);
    const [x, y] = P(i * 30 + 15, (RS + RO) / 2);
    el('text', { x, y, class: 'w-glyph', fill: ELEMENT_FILL[s.element] }, g).textContent = s.glyph;
  });
  for (let d = 0; d < 360; d += 5) {
    const [x0, y0] = P(d, RS); const [x1, y1] = P(d, RS - (d % 10 ? 3 : 6));
    el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: '#b9c3e6', 'stroke-opacity': 0.5 }, svg);
  }

  // houses
  if (model.chart.houses) {
    const cusps = model.chart.houses.cusps;
    for (let h = 0; h < 12; h++) {
      const span = (cusps[(h + 1) % 12] - cusps[h] + 360) % 360;
      const g = el('g', { 'data-tip': `house:${h + 1}`, class: 'w-house' }, svg);
      el('path', { d: arc(RA, RS, cusps[h], cusps[h] + span), fill: h % 2 ? '#ffffff' : '#ffffff', 'fill-opacity': h % 2 ? 0.012 : 0.035 }, g);
      const [x, y] = P(cusps[h] + span / 2, RA + 11);
      el('text', { x, y, class: 'w-house-num' }, g).textContent = h + 1;
      const angular = h % 3 === 0;
      const [a, b] = P(cusps[h], RA); const [c, d] = P(cusps[h], angular ? RO + 6 : RS);
      el('line', { x1: a, y1: b, x2: c, y2: d, stroke: angular ? '#fff' : '#9aa6cc', 'stroke-width': angular ? 1.6 : 0.8, 'stroke-dasharray': angular ? null : '2 2', 'pointer-events': 'none' }, svg);
    }
    for (const id of ['asc', 'mc', 'dsc', 'ic']) {
      const [x, y] = P(model.chart.angles[id], RO + 4);
      const t = el('text', { x, y, class: 'w-angle', 'data-tip': `obj:${id}`, 'data-id': id }, svg);
      t.textContent = id.toUpperCase();
      t.setAttribute('transform', `translate(${x * 0.04},${y * 0.04})`);
    }
  }
  el('circle', { r: RA, fill: 'none', stroke: '#9aa6cc', 'stroke-opacity': 0.5 }, svg);

  // aspect lines
  for (const a of model.chart.aspects) {
    const pa = model.byId(a.a); const pb = model.byId(a.b);
    if (a.aspect.id === 'conjunction') continue;
    const [x1, y1] = P(pa.lon, RA - 2); const [x2, y2] = P(pb.lon, RA - 2);
    const g = el('g', { 'data-tip': `edge:${a.id}`, class: 'w-aspect', 'data-edge': a.id }, svg);
    el('line', { x1, y1, x2, y2, stroke: 'transparent', 'stroke-width': 8 }, g);
    el('line', { x1, y1, x2, y2, stroke: a.aspect.color, 'stroke-width': 0.6 + 1.6 * a.strength, 'stroke-opacity': 0.4 + 0.55 * a.strength, 'stroke-dasharray': a.aspect.dash ? a.aspect.dash.join(' ') : null }, g);
  }

  // planets, staggered
  const bodies = model.chart.placements.filter((p) => p.kind === 'body' || p.id === 'node');
  const sorted = [...bodies].sort((a, b) => a.lon - b.lon);
  let last = -99; let lane = 0;
  for (const p of sorted) {
    lane = p.lon - last < 6 ? lane + 1 : 0;
    last = p.lon;
    const r = RH - (lane % 3) * 19;
    const [x, y] = P(p.lon, r);
    const color = '#' + (BODY_COLORS[p.id] ?? 0xffffff).toString(16).padStart(6, '0');
    const g = el('g', { 'data-tip': `obj:${p.id}`, class: 'w-planet', 'data-id': p.id, tabindex: 0 }, svg);
    const [tx0, ty0] = P(p.lon, RS); const [tx1, ty1] = P(p.lon, r + 9);
    el('line', { x1: tx0, y1: ty0, x2: tx1, y2: ty1, stroke: color, 'stroke-opacity': 0.6 }, g);
    el('circle', { cx: x, cy: y, r: 9, fill: '#0b1020', stroke: color, 'stroke-opacity': 0.5 }, g);
    el('text', { x, y, class: 'w-pglyph', fill: color }, g).textContent = p.glyph;
    const [dx, dy] = P(p.lon, r - 14);
    el('text', { x: dx, y: dy, class: 'w-pdeg' }, g).textContent = `${Math.floor(p.degree)}°${p.retrograde && p.kind === 'body' ? '℞' : ''}`;
  }

  svg.onclick = (e) => {
    const t = e.target.closest('[data-id]');
    if (t) onSelect(t.dataset.id);
  };
}

export function highlightWheel2D(svg, model, selectedId, related, relEdges) {
  svg.querySelectorAll('.w-planet').forEach((g) => {
    g.classList.toggle('dim', !!related && !related.has(g.dataset.id));
    g.classList.toggle('sel', g.dataset.id === selectedId);
  });
  svg.querySelectorAll('.w-aspect').forEach((g) => g.classList.toggle('dim', !!relEdges && !relEdges.has(g.dataset.edge)));
}
