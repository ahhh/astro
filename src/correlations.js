// Engine 6 — Correlation (relationship) graph.
// "Correlation" here means a rule-defined chart relationship, never a
// statistical correlation or a physical force. Every edge carries the rule
// that produced it, the measured angle and the orb that allowed it.

import { SIGNS } from './astrology.js';

export const EDGE_TYPES = {
  aspect: { label: 'Planetary aspect', style: 'by aspect type' },
  star: { label: 'Fixed-star contact', style: 'cyan beam', color: '#7fe7ff', dash: [1, 2] },
  sign: { label: 'Sign placement', style: 'faint line', color: '#8a93b8' },
  house: { label: 'House placement', style: 'faint dotted line', color: '#6f7aa0', dash: [1, 3] },
  rules: { label: 'Rulership', style: 'thin amber line', color: '#d7a75f', dash: [4, 2] },
  angle: { label: 'Angular planet', style: 'dashed bright line', color: '#ffffff', dash: [6, 3] },
  pattern: { label: 'Configuration', style: 'pattern hub', color: '#ff9fd2' },
};

export function buildGraph(chart, stars, contacts, settings) {
  const nodes = [];
  const edges = [];
  const byId = new Map();
  const addNode = (n) => { if (!byId.has(n.id)) { byId.set(n.id, n); nodes.push(n); } return byId.get(n.id); };

  for (const p of chart.placements) {
    if (p.kind === 'angle' && !['asc', 'mc', 'dsc', 'ic'].includes(p.id)) continue;
    addNode({ id: p.id, kind: p.kind, label: p.name, glyph: p.glyph, ref: p });
  }
  const contactedStars = new Set(contacts.map((c) => c.b));
  for (const s of stars) addNode({ id: s.id, kind: 'star', label: s.name, glyph: '✦', ref: s, contacted: contactedStars.has(s.id) });
  SIGNS.forEach((s, i) => addNode({ id: `sign-${s.id}`, kind: 'sign', label: s.name, glyph: s.glyph, ref: { ...s, index: i } }));
  if (chart.houses) for (let h = 1; h <= 12; h++) addNode({ id: `house-${h}`, kind: 'house', label: `House ${h}`, glyph: String(h), ref: { house: h, cusp: chart.houses.cusps[h - 1] } });

  for (const a of chart.aspects) {
    edges.push({ id: a.id, type: 'aspect', source: a.a, target: a.b, aspect: a.aspect, data: a,
      rule: `|Δλ| within ${a.orb.toFixed(1)}° of ${a.aspect.angle}°`, color: a.aspect.color, dash: a.aspect.dash });
  }
  for (const c of contacts) {
    edges.push({ id: c.id, type: 'star', source: c.a, target: c.b, data: c,
      rule: c.rule === 'sky' ? `true sky separation ≤ ${c.orb.toFixed(1)}°` : `ecliptic longitude difference ≤ ${c.orb.toFixed(1)}° (latitude ignored)`,
      color: EDGE_TYPES.star.color, dash: EDGE_TYPES.star.dash });
  }
  const rulerKey = settings.modernRulers ? 'modernRuler' : 'ruler';
  for (const p of chart.placements) {
    if (p.kind !== 'body' && p.kind !== 'point') continue;
    const sign = SIGNS[p.signIndex];
    edges.push({ id: `sign:${p.id}`, type: 'sign', source: p.id, target: `sign-${sign.id}`, data: { degree: p.degree },
      rule: `ecliptic longitude ${p.lon.toFixed(2)}° falls in ${sign.name} (${p.signIndex * 30}°–${p.signIndex * 30 + 30}°)`, color: EDGE_TYPES.sign.color });
    if (p.house) edges.push({ id: `house:${p.id}`, type: 'house', source: p.id, target: `house-${p.house}`, data: { house: p.house },
      rule: `between the cusps of house ${p.house} and ${p.house % 12 + 1} (${chart.houseSystem})`, color: EDGE_TYPES.house.color, dash: EDGE_TYPES.house.dash });
  }
  SIGNS.forEach((s) => {
    const ruler = s[rulerKey];
    edges.push({ id: `rules:${ruler}:${s.id}`, type: 'rules', source: ruler, target: `sign-${s.id}`, data: {},
      rule: `${settings.modernRulers ? 'modern' : 'traditional'} rulership table`, color: EDGE_TYPES.rules.color, dash: EDGE_TYPES.rules.dash });
  });
  if (chart.angles) {
    for (const p of chart.placements.filter((x) => x.kind === 'body')) {
      for (const ang of ['asc', 'mc', 'dsc', 'ic']) {
        const d = Math.abs(((p.lon - chart.angles[ang] + 540) % 360) - 180);
        if (d <= settings.angleOrb) {
          edges.push({ id: `angle:${p.id}:${ang}`, type: 'angle', source: p.id, target: ang, data: { deviation: d, orb: settings.angleOrb },
            rule: `within ${settings.angleOrb}° of the ${ang.toUpperCase()} in longitude`, color: EDGE_TYPES.angle.color, dash: EDGE_TYPES.angle.dash });
        }
      }
    }
  }
  for (const pat of chart.patterns) {
    addNode({ id: pat.id, kind: 'pattern', label: pat.label, glyph: '◈', ref: pat });
    for (const m of pat.members) edges.push({ id: `${pat.id}:${m}`, type: 'pattern', source: pat.id, target: m, data: pat, rule: pat.rule, color: EDGE_TYPES.pattern.color });
  }

  const adjacency = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const e of edges) {
    if (!adjacency.has(e.source) || !adjacency.has(e.target)) continue;
    adjacency.get(e.source).add(e.id);
    adjacency.get(e.target).add(e.id);
  }
  return { nodes, edges, byId, adjacency, edgeById: new Map(edges.map((e) => [e.id, e])) };
}

export function edgesFor(graph, id, filters) {
  const ids = graph.adjacency.get(id) || new Set();
  return [...ids].map((eid) => graph.edgeById.get(eid)).filter((e) => !filters || filters[e.type] !== false);
}

export function neighbours(graph, id, filters) {
  const set = new Set([id]);
  for (const e of edgesFor(graph, id, filters)) { set.add(e.source); set.add(e.target); }
  return set;
}
