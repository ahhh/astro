// Engine 5 — 3D universe renderer (Three.js).
// Consumes computed data only; it never calculates astronomy itself.
// Three modes share one renderer and one selection:
//   wheel   — the ecliptic as a ring on a celestial globe (schematic chart)
//   sky     — the real sky from the birthplace (physical directions)
//   network — a graph of rule-defined relationships (information only)

import * as THREE from 'three';
import { OrbitControls } from './../vendor/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from './../vendor/addons/CSS2DRenderer.js';
import { Line2 } from './../vendor/addons/lines/Line2.js';
import { LineGeometry } from './../vendor/addons/lines/LineGeometry.js';
import { LineMaterial } from './../vendor/addons/lines/LineMaterial.js';
import { SIGNS } from './astrology.js';
import { DEG, rotate } from './astro.js';
import { bvToRgb, getCatalog, propagate } from './stars.js';
import { EDGE_TYPES, neighbours, edgesFor } from './correlations.js';

const R = 100;
const RIN = 58; // inner chart disc: aspect lines live inside it
const ELEMENT_COLORS = { Fire: 0xff7a59, Earth: 0x9ccf6a, Air: 0x7fc4ff, Water: 0x8f86ff };
export const BODY_COLORS = {
  sun: 0xffd56b, moon: 0xe8ecf5, mercury: 0xbfc7d5, venus: 0xffc9e3, mars: 0xff6b5b, jupiter: 0xffb070,
  saturn: 0xe2c98f, uranus: 0x8ff0ea, neptune: 0x7f9dff, pluto: 0xc79bff, node: 0xa0a8c8, snode: 0xa0a8c8,
  asc: 0xffffff, mc: 0xffffff, dsc: 0xdddddd, ic: 0xdddddd,
};

// --- small helpers ----------------------------------------------------------

function fatLine(points, color, { width = 2, dash = null, opacity = 1 } = {}) {
  const geo = new LineGeometry();
  geo.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  const mat = new LineMaterial({
    color, linewidth: width, transparent: true, opacity, depthWrite: false,
    dashed: !!dash, dashSize: dash ? dash[0] : 1, gapSize: dash ? dash[1] : 0, dashScale: 1,
  });
  if (dash) mat.defines.USE_DASH = '';
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  line.userData.baseOpacity = opacity;
  return line;
}

function thinLines(positions, color, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const l = new THREE.LineSegments(geo, mat);
  l.userData.baseOpacity = opacity;
  return l;
}

function label(html, className, tip) {
  const el = document.createElement('div');
  el.className = 'scene-label ' + (className || '');
  el.innerHTML = html;
  if (tip) el.dataset.tip = tip;
  const obj = new CSS2DObject(el);
  obj.center.set(0.5, 0.5);
  return obj;
}

function circlePoints(fn, steps = 360) {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(fn((i / steps) * 360));
  return pts;
}

function starMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { scale: { value: 1 }, dim: { value: 1 } },
    vertexShader: `
      attribute float size; attribute vec3 color; attribute float alpha;
      varying vec3 vColor; varying float vAlpha;
      uniform float scale; uniform float dim;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * scale;
        vColor = color; vAlpha = alpha * dim;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float core = exp(-d * d * 30.0);
        float halo = smoothstep(0.5, 0.0, d) * 0.35;
        float a = min(1.0, core + halo) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.45), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function buildStarPoints(vectors, mags, cis, mapVec, magLimit) {
  const n = mags.length;
  const pos = [];
  const col = [];
  const size = [];
  const alpha = [];
  for (let i = 0; i < n; i++) {
    const m = mags[i];
    if (m > magLimit) continue;
    const v = mapVec(vectors[i * 3], vectors[i * 3 + 1], vectors[i * 3 + 2]);
    pos.push(v.x * R * 1.01, v.y * R * 1.01, v.z * R * 1.01);
    const [r, g, b] = bvToRgb(cis[i]);
    col.push(r, g, b);
    size.push(Math.max(2.2, Math.pow(Math.max(0, 7.2 - m), 1.4) * 0.75));
    alpha.push(Math.min(1, 0.4 + Math.max(0, 6.5 - m) / 4.5));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.Float32BufferAttribute(alpha, 1));
  const pts = new THREE.Points(geo, starMaterial());
  return pts;
}

// --- Universe ---------------------------------------------------------------

export class Universe {
  constructor(container, { onHover, onSelect }) {
    this.container = container;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.mode = 'wheel';
    this.layers = {};
    this.edgeFilters = {};
    this.selected = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x04060f, 1);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '3D celestial view. Use the object list for keyboard access.');
    this.renderer.domElement.tabIndex = 0;

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    this.controls = new OrbitControls(this.camera, this.labelRenderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.groups = { wheel: new THREE.Group(), sky: new THREE.Group(), network: new THREE.Group() };
    for (const g of Object.values(this.groups)) this.scene.add(g);

    this.registry = { wheel: this.emptyRegistry(), sky: this.emptyRegistry(), network: this.emptyRegistry() };
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line2 = { threshold: 6 };
    this.pointer = new THREE.Vector2();
    this.hoverPending = null;
    this.flight = null;

    this.bindEvents();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  emptyRegistry() { return { nodes: new Map(), edges: new Map(), labels: new Map(), positions: new Map(), pickables: [] }; }

  // --- events --------------------------------------------------------------

  bindEvents() {
    const el = this.labelRenderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5) return;
      const labelEl = e.target.closest?.('.scene-label');
      if (labelEl?.dataset.id) { this.onSelect(labelEl.dataset.id); return; }
      const hit = this.pick(e.clientX, e.clientY);
      if (hit?.id) this.onSelect(hit.id);
      else if (!hit) this.onSelect(null);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.target.closest?.('.scene-label')) { this.onHover(null); return; }
      this.hoverPending = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerleave', () => { this.hoverPending = null; this.onHover(null); });
    el.addEventListener('wheel', (e) => {
      if (this.mode !== 'sky') return;
      e.preventDefault();
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov * (1 + Math.sign(e.deltaY) * 0.08), 15, 110);
      this.camera.updateProjectionMatrix();
      this.updateStarScale();
    }, { passive: false });
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const reg = this.registry[this.mode];
    const dist = this.mode === 'sky' ? 1 : this.camera.position.length() / 260;
    this.raycaster.params.Points.threshold = (this.mode === 'sky' ? this.camera.fov / 45 : 1) * 1.2 * dist;
    const visible = reg.pickables.filter((o) => o.visible && o.parent?.visible !== false && this.isShown(o));
    const hits = this.raycaster.intersectObjects(visible, false);
    if (!hits.length) return null;
    // Prefer specific objects over regions.
    const rank = (h) => ({ node: 0, edge: 1, region: 2 }[h.object.userData.pick] ?? 3);
    hits.sort((a, b) => rank(a) - rank(b) || a.distance - b.distance);
    const h = hits[0];
    const u = h.object.userData;
    return { kind: u.pick, id: u.id, tipKey: u.tipKey };
  }

  isShown(o) {
    let p = o;
    if (o.material && o.material.visible === false) return false;
    while (p) { if (p.visible === false) return false; p = p.parent; }
    return true;
  }

  // --- model --------------------------------------------------------------

  setModel(model) {
    this.model = model;
    for (const [mode, g] of Object.entries(this.groups)) {
      g.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); o.geometry?.dispose?.(); o.material?.dispose?.(); });
      g.clear();
      this.registry[mode] = this.emptyRegistry();
    }
    this.buildWheel(model);
    this.buildSky(model);
    this.buildNetwork(model);
    this.applyLayers();
    this.setMode(this.mode, true);
    this.applySelection();
  }

  register(mode, kind, id, obj, { pick = null, tipKey = null } = {}) {
    const reg = this.registry[mode];
    const map = kind === 'edge' ? reg.edges : reg.nodes;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(obj);
    if (pick) {
      obj.userData.pick = pick;
      obj.userData.id = id;
      obj.userData.tipKey = tipKey ?? (kind === 'edge' ? `edge:${id}` : `obj:${id}`);
      reg.pickables.push(obj);
    }
  }

  addLabel(mode, id, obj, layer) {
    const reg = this.registry[mode];
    if (!reg.labels.has(id)) reg.labels.set(id, []);
    reg.labels.get(id).push(obj);
    if (id) obj.element.dataset.id = id;
    if (layer) obj.userData.layer = layer;
  }

  // --- Mode 1: Natal Wheel --------------------------------------------------

  buildWheel(m) {
    const g = this.groups.wheel;
    g.rotation.x = -Math.PI / 2;
    const reg = 'wheel';
    const anchor = m.chart.angles ? m.chart.angles.asc : 0;
    const ayan = m.chart.ayanamsa;
    // zodiac longitude → angle on the wheel (ASC at 9 o'clock, counter-clockwise)
    const theta = (lon) => (lon - anchor + 180) * DEG;
    const onRing = (lon, r, z = 0) => new THREE.Vector3(r * Math.cos(theta(lon)), r * Math.sin(theta(lon)), z);
    // tropical ecliptic-of-date vector → wheel coordinates
    const rot = (-ayan - anchor + 180) * DEG;
    const c = Math.cos(rot), s = Math.sin(rot);
    const eclToWheel = (x, y, z) => new THREE.Vector3(x * c - y * s, x * s + y * c, z);
    this.wheelMap = { theta, onRing, eclToWheel };

    // real star field, in the ecliptic frame
    const field = m.field;
    const stars = buildStarPoints(field.ect, field.mag, field.ci, eclToWheel, m.settings.magLimit);
    stars.userData.layer = 'stars';
    g.add(stars);
    this.registry.wheel.starPoints = stars;

    // constellation figures on the globe
    const cat = getCatalog();
    const rotEct = m.sky.rotEQJ_ECT;
    const consPos = [];
    for (const con of cat.constellations) {
      for (const fig of con.figures) {
        for (let i = 0; i < fig.length - 1; i++) {
          for (const [ra, dec] of [fig[i], fig[i + 1]]) {
            const v = propagate(ra, dec, 0, 0, 0);
            const e = eclToWheel(...rotate(rotEct, ...v));
            consPos.push(e.x * R * 1.01, e.y * R * 1.01, e.z * R * 1.01);
          }
        }
      }
      const [lra, ldec] = con.label;
      const lv = eclToWheel(...rotate(rotEct, ...propagate(lra, ldec, 0, 0, 0)));
      const l = label(con.name, 'con-label', `con:${con.id}`);
      l.position.copy(lv.multiplyScalar(R * 1.04));
      l.userData.layer = 'conLabels';
      g.add(l);
    }
    const cons = thinLines(consPos, 0x4a6aa8, 0.45);
    cons.userData.layer = 'constellations';
    g.add(cons);

    // ecliptic band: 12 sign segments
    for (let i = 0; i < 12; i++) {
      const sign = SIGNS[i];
      const geo = new THREE.RingGeometry(R, R + 13, 32, 1, theta(i * 30), 30 * DEG);
      const mat = new THREE.MeshBasicMaterial({ color: ELEMENT_COLORS[sign.element], transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.baseOpacity = 0.16;
      mesh.userData.layer = 'zodiac';
      g.add(mesh);
      this.register(reg, 'node', `sign-${sign.id}`, mesh, { pick: 'region', tipKey: `sign:${i}` });
      const lab = label(`<span class="glyph">${sign.glyph}</span>`, 'sign-label el-' + sign.element.toLowerCase(), `sign:${i}`);
      lab.position.copy(onRing(i * 30 + 15, R + 6.5));
      lab.userData.layer = 'zodiac';
      g.add(lab);
      this.addLabel(reg, `sign-${sign.id}`, lab);
    }
    // degree ticks + ring outlines
    const ticks = [];
    for (let d = 0; d < 360; d++) {
      const len = d % 30 === 0 ? 13 : d % 10 === 0 ? 3.2 : d % 5 === 0 ? 2.2 : 1.1;
      const a = onRing(d, R); const b = onRing(d, R + len);
      ticks.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const tickLines = thinLines(ticks, 0xb9c3e6, 0.55);
    tickLines.userData.layer = 'zodiac';
    g.add(tickLines);
    for (const r of [R, R + 13]) {
      const ring = fatLine(circlePoints((d) => onRing(d, r)), 0xc8d2f2, { width: 1.2, opacity: 0.7 });
      ring.userData.layer = 'zodiac';
      g.add(ring);
    }

    // celestial equator on the globe (tilted by the obliquity)
    const eqPts = circlePoints((d) => {
      const v = propagate(d, 0, 0, 0, 0);
      return eclToWheel(...rotate(rotEct, ...v)).multiplyScalar(R);
    }, 180);
    const eq = fatLine(eqPts, 0x6fa8ff, { width: 1, dash: [3, 3], opacity: 0.5 });
    eq.userData.layer = 'guides';
    g.add(eq);

    // houses
    if (m.chart.houses) {
      const cusps = m.chart.houses.cusps;
      for (let h = 0; h < 12; h++) {
        const isAngle = h % 3 === 0;
        const line = fatLine([onRing(cusps[h], RIN), onRing(cusps[h], R)], isAngle ? 0xffffff : 0x9aa6cc, { width: isAngle ? 2 : 1, opacity: isAngle ? 0.85 : 0.45, dash: isAngle ? null : [2, 2] });
        line.userData.layer = 'houses';
        g.add(line);
        // invisible sector for hovering
        const span = ((cusps[(h + 1) % 12] - cusps[h]) + 360) % 360;
        const sector = new THREE.Mesh(
          new THREE.RingGeometry(RIN, R - 1, 24, 1, theta(cusps[h]), span * DEG),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: h % 2 ? 0.0 : 0.025, side: THREE.DoubleSide, depthWrite: false }),
        );
        sector.userData.baseOpacity = sector.material.opacity;
        sector.userData.layer = 'houses';
        g.add(sector);
        this.register(reg, 'node', `house-${h + 1}`, sector, { pick: 'region', tipKey: `house:${h + 1}` });
        const lab = label(String(h + 1), 'house-label', `house:${h + 1}`);
        lab.position.copy(onRing(cusps[h] + span / 2, RIN + 5));
        lab.userData.layer = 'houses';
        g.add(lab);
        this.addLabel(reg, `house-${h + 1}`, lab);
      }
      const inner = fatLine(circlePoints((d) => onRing(d, RIN)), 0x9aa6cc, { width: 1, opacity: 0.5 });
      inner.userData.layer = 'houses';
      g.add(inner);
      // angle axes with labels
      for (const id of ['asc', 'mc', 'dsc', 'ic']) {
        const lon = m.chart.angles[id];
        const axis = fatLine([onRing(lon, R + 13), onRing(lon, R + 22)], 0xffffff, { width: 2.5, opacity: 0.95 });
        g.add(axis);
        this.register(reg, 'node', id, axis);
        const lab = label(id.toUpperCase(), 'angle-label', `obj:${id}`);
        lab.position.copy(onRing(lon, R + 26));
        g.add(lab);
        this.addLabel(reg, id, lab);
        this.registry.wheel.positions.set(id, onRing(lon, R + 18));
      }
    }

    // planets: stagger radii so close bodies don't overlap
    const bodies = m.chart.placements.filter((p) => p.kind === 'body' || p.kind === 'point');
    const sorted = [...bodies].sort((a, b) => a.lon - b.lon);
    const radius = new Map();
    let lastLon = -999; let lane = 0;
    for (const p of sorted) {
      lane = (p.lon - lastLon < 7) ? lane + 1 : 0;
      radius.set(p.id, 90 - (lane % 3) * 8.5);
      lastLon = p.lon;
    }
    for (const p of bodies) {
      const r = radius.get(p.id);
      const pos = onRing(p.lon, r);
      const color = BODY_COLORS[p.id] ?? 0xffffff;
      const isPoint = p.kind === 'point';
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(isPoint ? 1.1 : (p.id === 'sun' || p.id === 'moon' ? 2.4 : 1.8), 20, 14), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      mesh.userData.baseOpacity = 1;
      mesh.position.copy(pos);
      if (isPoint) mesh.userData.layer = 'nodes';
      g.add(mesh);
      this.register(reg, 'node', p.id, mesh, { pick: 'node' });
      // exact-degree pointer to the ring
      const tick = fatLine([onRing(p.lon, r + 3), onRing(p.lon, R)], color, { width: 1, opacity: 0.6 });
      if (isPoint) tick.userData.layer = 'nodes';
      g.add(tick);
      this.register(reg, 'node', p.id, tick);
      const lab = label(`<span class="glyph" style="color:#${color.toString(16).padStart(6, '0')}">${p.glyph}</span><span class="deg">${Math.floor(p.degree)}°${p.retrograde && p.kind === 'body' ? '℞' : ''}</span>`, 'planet-label', `obj:${p.id}`);
      lab.position.copy(onRing(p.lon, r - 4.5));
      if (isPoint) lab.userData.layer = 'nodes';
      g.add(lab);
      this.addLabel(reg, p.id, lab);
      this.registry.wheel.positions.set(p.id, pos);
    }

    // aspect lines across the inner disc
    for (const a of m.chart.aspects) {
      const pa = m.byId(a.a); const pb = m.byId(a.b);
      const pts = [onRing(pa.lon, RIN - 0.5), onRing(pb.lon, RIN - 0.5)];
      if (a.aspect.id === 'conjunction') { pts[0] = onRing(pa.lon, radius.get(a.a) ?? R + 18); pts[1] = onRing(pb.lon, radius.get(a.b) ?? R + 18); }
      const line = fatLine(pts, a.aspect.color, { width: 1.2 + 2.2 * a.strength, dash: a.aspect.dash, opacity: 0.35 + 0.6 * a.strength });
      line.userData.layer = 'aspects';
      line.userData.edgeType = 'aspect';
      g.add(line);
      this.register(reg, 'edge', a.id, line, { pick: 'edge' });
    }

    // fixed stars at their TRUE positions on the globe, with a drop-line to their longitude
    for (const st of m.stars) {
      const v = eclToWheel(...rotate(rotEct, ...st.vecEQJ));
      const pos = v.clone().multiplyScalar(R);
      const contacted = m.contacts.some((cc) => cc.b === st.id);
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(contacted ? 1.6 : 1.0), new THREE.MeshBasicMaterial({ color: contacted ? 0x9ff3ff : 0x7fa6c9, transparent: true, opacity: contacted ? 1 : 0.7 }));
      mesh.userData.baseOpacity = mesh.material.opacity;
      mesh.position.copy(pos);
      mesh.userData.layer = contacted ? 'fixedStars' : 'allFixedStars';
      g.add(mesh);
      this.register(reg, 'node', st.id, mesh, { pick: 'node' });
      this.registry.wheel.positions.set(st.id, pos);
      if (contacted || st.mag < 1.2) {
        const lab = label(st.name, 'star-label' + (contacted ? ' contacted' : ''), `obj:${st.id}`);
        lab.position.copy(pos.clone().multiplyScalar(1.035));
        lab.userData.layer = contacted ? 'fixedStars' : 'allFixedStars';
        g.add(lab);
        this.addLabel(reg, st.id, lab);
      }
      if (contacted) {
        // meridian of longitude from the star down to the ecliptic: shows the projection the rule uses
        const pts = [];
        for (let k = 0; k <= 24; k++) {
          const lat = st.lat * (1 - k / 24);
          const t = theta(st.lon);
          pts.push(new THREE.Vector3(R * Math.cos(lat * DEG) * Math.cos(t), R * Math.cos(lat * DEG) * Math.sin(t), R * Math.sin(lat * DEG)));
        }
        const drop = fatLine(pts, 0x7fe7ff, { width: 1, dash: [1.5, 1.5], opacity: 0.8 });
        drop.userData.layer = 'fixedStars';
        g.add(drop);
        this.register(reg, 'node', st.id, drop);
      }
    }
    for (const cc of m.contacts) {
      const p = m.byId(cc.a);
      const from = this.registry.wheel.positions.get(cc.a) ?? onRing(p.lon, R);
      const to = onRing(m.byId(cc.b).lon, R);
      const line = fatLine([from, to], 0x7fe7ff, { width: 1.6, dash: [1, 1.2], opacity: 0.85 });
      line.userData.layer = 'fixedStars';
      line.userData.edgeType = 'star';
      g.add(line);
      this.register(reg, 'edge', cc.id, line, { pick: 'edge' });
    }
  }

  // --- Mode 2: Birth Sky ---------------------------------------------------

  buildSky(m) {
    const g = this.groups.sky;
    const reg = 'sky';
    // HOR frame (x=N, y=W, z=up) → three (x=E, y=up, z=S)
    const horToThree = (x, y, z) => new THREE.Vector3(-y, z, -x);
    const altAz = (alt, az, r = R) => {
      const a = alt * DEG; const z = az * DEG;
      return new THREE.Vector3(r * Math.cos(a) * Math.sin(z), r * Math.sin(a), -r * Math.cos(a) * Math.cos(z));
    };
    const eqjToThree = (v) => horToThree(...rotate(m.sky.rotEQJ_HOR, ...v));
    const eclToThree = (lonTrop, lat) => {
      const v = [Math.cos(lat * DEG) * Math.cos(lonTrop * DEG), Math.cos(lat * DEG) * Math.sin(lonTrop * DEG), Math.sin(lat * DEG)];
      return eqjToThree(rotate(m.sky.rotECT_EQJ, ...v));
    };
    this.skyMap = { altAz, eqjToThree };

    const field = m.field;
    const stars = buildStarPoints(field.hor, field.mag, field.ci, horToThree, m.settings.magLimit);
    stars.userData.layer = 'stars';
    g.add(stars);
    this.registry.sky.starPoints = stars;

    const cat = getCatalog();
    const consPos = [];
    for (const con of cat.constellations) {
      for (const fig of con.figures) {
        for (let i = 0; i < fig.length - 1; i++) {
          for (const [ra, dec] of [fig[i], fig[i + 1]]) {
            const p = eqjToThree(propagate(ra, dec, 0, 0, 0)).multiplyScalar(R * 1.01);
            consPos.push(p.x, p.y, p.z);
          }
        }
      }
      const l = label(con.name, 'con-label', `con:${con.id}`);
      l.position.copy(eqjToThree(propagate(con.label[0], con.label[1], 0, 0, 0)).multiplyScalar(R * 0.98));
      l.userData.layer = 'conLabels';
      g.add(l);
    }
    const cons = thinLines(consPos, 0x4a6aa8, 0.55);
    cons.userData.layer = 'constellations';
    g.add(cons);

    // daylight / twilight tint from the Sun's real altitude
    const sunAlt = m.sky.bodies[0].alt;
    const dayOpacity = sunAlt > 0 ? 0.42 : sunAlt > -18 ? 0.42 * (1 + sunAlt / 18) ** 2 : 0;
    if (dayOpacity > 0) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: sunAlt > 0 ? 0x2a4f8f : 0x23305c, transparent: true, opacity: dayOpacity, side: THREE.BackSide, depthWrite: false }),
      );
      dome.renderOrder = -1;
      dome.userData.layer = 'ground';
      g.add(dome);
    }

    // ground: dark translucent lower hemisphere so below-horizon objects stay visible but obviously "under"
    const ground = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.97, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0b0f1c, transparent: true, opacity: 0.72, side: THREE.BackSide, depthWrite: false }),
    );
    ground.renderOrder = 5;
    ground.userData.layer = 'ground';
    g.add(ground);
    const horizon = fatLine(circlePoints((d) => altAz(0, d, R * 0.97)), 0x8fd18f, { width: 2, opacity: 0.9 });
    horizon.userData.layer = 'guides';
    g.add(horizon);
    for (const [txt, az] of [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]) {
      const l = label(txt, 'cardinal' + (txt.length === 1 ? ' major' : ''), `g:altaz`);
      l.position.copy(altAz(-2.5, az, R * 0.95));
      l.userData.layer = 'guides';
      g.add(l);
    }
    for (const alt of [30, 60]) {
      const ring = fatLine(circlePoints((d) => altAz(alt, d, R * 0.99), 120), 0x3c5070, { width: 1, dash: [1, 2], opacity: 0.5 });
      ring.userData.layer = 'guides';
      g.add(ring);
    }
    // ecliptic + equator
    const ecl = fatLine(circlePoints((d) => eclToThree(d, 0).multiplyScalar(R * 0.99), 240), 0xf2c14e, { width: 1.6, opacity: 0.75 });
    ecl.userData.layer = 'zodiac';
    g.add(ecl);
    this.register(reg, 'node', 'ecliptic', ecl, { pick: 'region', tipKey: 'g:ecliptic' });
    const eq = fatLine(circlePoints((d) => eqjToThree(propagate(d, 0, 0, 0, 0)).multiplyScalar(R * 0.99), 240), 0x6fa8ff, { width: 1, dash: [3, 3], opacity: 0.55 });
    eq.userData.layer = 'guides';
    g.add(eq);
    // sign boundaries along the ecliptic (zodiac signs, not constellations)
    const ayan = m.chart.ayanamsa;
    for (let i = 0; i < 12; i++) {
      const lonT = i * 30 + ayan;
      const a = eclToThree(lonT, -3).multiplyScalar(R * 0.99);
      const b = eclToThree(lonT, 3).multiplyScalar(R * 0.99);
      const t = fatLine([a, b], 0xf2c14e, { width: 1.4, opacity: 0.8 });
      t.userData.layer = 'zodiac';
      g.add(t);
      const lab = label(`<span class="glyph">${SIGNS[i].glyph}</span>`, 'sign-label small el-' + SIGNS[i].element.toLowerCase(), `sign:${i}`);
      lab.position.copy(eclToThree(lonT + 15, -4.5).multiplyScalar(R * 0.98));
      lab.userData.layer = 'zodiac';
      g.add(lab);
      this.addLabel(reg, `sign-${SIGNS[i].id}`, lab);
    }
    // chart angles on the real sky
    if (m.chart.angles) {
      for (const id of ['asc', 'mc', 'dsc', 'ic']) {
        const p = eclToThree(m.chart.angles.tropical[id], 0).multiplyScalar(R * 0.99);
        const lab = label(id.toUpperCase(), 'angle-label', `obj:${id}`);
        lab.position.copy(p);
        g.add(lab);
        this.addLabel(reg, id, lab);
        this.registry.sky.positions.set(id, p);
      }
    }
    // planets at their topocentric alt/az
    for (const b of m.sky.bodies) {
      const pos = altAz(b.alt, b.az, R * 0.95);
      const color = BODY_COLORS[b.id];
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.id === 'sun' || b.id === 'moon' ? 1.6 : 0.9, 20, 14), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      mesh.userData.baseOpacity = 1;
      mesh.position.copy(pos);
      mesh.renderOrder = 6;
      g.add(mesh);
      this.register(reg, 'node', b.id, mesh, { pick: 'node' });
      const p = m.byId(b.id);
      const lab = label(`<span class="glyph" style="color:#${color.toString(16).padStart(6, '0')}">${b.glyph}</span><span class="deg">${b.name}${b.alt < 0 ? ' · below' : ''}</span>`, 'planet-label' + (b.alt < 0 ? ' below' : ''), `obj:${b.id}`);
      lab.position.copy(pos.clone().multiplyScalar(0.97));
      g.add(lab);
      this.addLabel(reg, b.id, lab);
      this.registry.sky.positions.set(b.id, pos);
      void p;
    }
    // fixed stars (real positions)
    for (const st of m.stars) {
      const pos = altAz(st.alt, st.az, R * 0.985);
      const contacted = m.contacts.some((cc) => cc.b === st.id);
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(contacted ? 0.8 : 0.5), new THREE.MeshBasicMaterial({ color: contacted ? 0x9ff3ff : 0x7fa6c9, transparent: true, opacity: contacted ? 1 : 0.6 }));
      mesh.userData.baseOpacity = mesh.material.opacity;
      mesh.position.copy(pos);
      mesh.userData.layer = contacted ? 'fixedStars' : 'allFixedStars';
      g.add(mesh);
      this.register(reg, 'node', st.id, mesh, { pick: 'node' });
      this.registry.sky.positions.set(st.id, pos);
      if (contacted || st.mag < 1.2) {
        const lab = label(st.name, 'star-label' + (contacted ? ' contacted' : '') + (st.alt < 0 ? ' below' : ''), `obj:${st.id}`);
        lab.position.copy(pos.clone().multiplyScalar(0.965));
        lab.userData.layer = contacted ? 'fixedStars' : 'allFixedStars';
        g.add(lab);
        this.addLabel(reg, st.id, lab);
      }
    }
    // true-sky lines for fixed-star contacts: these show the REAL separation
    for (const cc of m.contacts) {
      const a = this.registry.sky.positions.get(cc.a); const b = this.registry.sky.positions.get(cc.b);
      if (!a || !b) continue;
      const pts = [];
      for (let k = 0; k <= 32; k++) pts.push(a.clone().lerp(b, k / 32).normalize().multiplyScalar(R * 0.96));
      const line = fatLine(pts, 0x7fe7ff, { width: 1.4, dash: [1, 1.2], opacity: 0.8 });
      line.userData.layer = 'fixedStars';
      g.add(line);
      this.register(reg, 'edge', cc.id, line, { pick: 'edge' });
    }
    // aspect lines as great-circle arcs on the sky (still symbolic: measured in longitude)
    for (const a of m.chart.aspects) {
      const pa = this.registry.sky.positions.get(a.a); const pb = this.registry.sky.positions.get(a.b);
      if (!pa || !pb) continue;
      const pts = [];
      const steps = 48;
      const omega = pa.angleTo(pb);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        if (omega > 3.1) pts.push(pa.clone().lerp(pb, t).add(new THREE.Vector3(0, R * Math.sin(Math.PI * t) * 0.5, 0)).normalize().multiplyScalar(R * 0.94));
        else pts.push(pa.clone().lerp(pb, t).normalize().multiplyScalar(R * 0.94));
      }
      const line = fatLine(pts, a.aspect.color, { width: 1 + 1.6 * a.strength, dash: a.aspect.dash, opacity: 0.3 + 0.4 * a.strength });
      line.userData.layer = 'skyAspects';
      line.userData.edgeType = 'aspect';
      g.add(line);
      this.register(reg, 'edge', a.id, line, { pick: 'edge' });
    }
  }

  // --- Mode 3: Connection Network -------------------------------------------

  buildNetwork(m) {
    const g = this.groups.network;
    const reg = 'network';
    const graph = m.graph;
    const keep = graph.nodes.filter((n) => n.kind !== 'star' || n.contacted);
    const ids = new Set(keep.map((n) => n.id));
    const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const pos = new Map();
    const pinned = new Set();
    // pin signs on an outer ring and houses on an inner tilted ring, in zodiac order
    keep.forEach((n) => {
      if (n.kind === 'sign') { const a = (n.ref.index * 30 + 15) * DEG; pos.set(n.id, new THREE.Vector3(95 * Math.cos(a), -30, -95 * Math.sin(a))); pinned.add(n.id); }
      else if (n.kind === 'house') { const a = ((m.chart.houses.cusps[n.ref.house - 1] + 10) - (m.chart.angles?.asc ?? 0) + 180) * DEG; pos.set(n.id, new THREE.Vector3(70 * Math.cos(a), 40, -70 * Math.sin(a))); pinned.add(n.id); }
      else {
        // seed near the sign the object sits in
        const lon = n.ref?.lon ?? Math.random() * 360;
        const a = lon * DEG;
        pos.set(n.id, new THREE.Vector3(40 * Math.cos(a) + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 30, -40 * Math.sin(a) + (Math.random() - 0.5) * 10));
      }
    });
    // deterministic-ish force layout (a few hundred iterations is instant at this size)
    const springLen = { aspect: 38, star: 18, sign: 55, house: 55, rules: 60, angle: 22, pattern: 20 };
    const strength = { aspect: 0.04, star: 0.08, sign: 0.012, house: 0.012, rules: 0.006, angle: 0.06, pattern: 0.06 };
    const vel = new Map(keep.map((n) => [n.id, new THREE.Vector3()]));
    const free = keep.filter((n) => !pinned.has(n.id));
    for (let it = 0; it < 400; it++) {
      for (let i = 0; i < free.length; i++) {
        const pi = pos.get(free[i].id);
        for (let j = 0; j < keep.length; j++) {
          if (free[i].id === keep[j].id) continue;
          const d = pi.clone().sub(pos.get(keep[j].id));
          const len = Math.max(d.length(), 1);
          vel.get(free[i].id).add(d.multiplyScalar(260 / (len * len * len)));
        }
      }
      for (const e of edges) {
        const a = pos.get(e.source); const b = pos.get(e.target);
        const d = b.clone().sub(a);
        const len = Math.max(d.length(), 0.01);
        const f = d.multiplyScalar(((len - springLen[e.type]) / len) * strength[e.type]);
        if (!pinned.has(e.source)) vel.get(e.source).add(f);
        if (!pinned.has(e.target)) vel.get(e.target).sub(f);
      }
      for (const n of free) {
        const v = vel.get(n.id);
        v.add(pos.get(n.id).clone().multiplyScalar(-0.002));
        pos.get(n.id).add(v.multiplyScalar(0.55));
        v.multiplyScalar(0.6);
      }
    }
    const kindStyle = {
      body: { r: 3, color: null }, point: { r: 2, color: 0xa0a8c8 }, angle: { r: 2.4, color: 0xffffff },
      star: { r: 2, color: 0x9ff3ff }, sign: { r: 2.6, color: null }, house: { r: 2.2, color: 0x9aa6cc }, pattern: { r: 2.4, color: 0xff9fd2 },
    };
    for (const n of keep) {
      const st = kindStyle[n.kind];
      const color = n.kind === 'body' ? BODY_COLORS[n.id] : n.kind === 'sign' ? ELEMENT_COLORS[n.ref.element] : st.color;
      const geo = n.kind === 'star' ? new THREE.OctahedronGeometry(st.r) : n.kind === 'sign' || n.kind === 'house' ? new THREE.BoxGeometry(st.r * 1.4, st.r * 1.4, st.r * 1.4) : new THREE.SphereGeometry(st.r, 20, 14);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      mesh.userData.baseOpacity = 1;
      mesh.position.copy(pos.get(n.id));
      g.add(mesh);
      this.register(reg, 'node', n.id, mesh, { pick: 'node' });
      const tip = n.kind === 'sign' ? `sign:${n.ref.index}` : n.kind === 'house' ? `house:${n.ref.house}` : `obj:${n.id}`;
      const lab = label(`<span class="glyph">${n.glyph}</span><span class="deg">${n.kind === 'sign' || n.kind === 'house' ? '' : n.label}</span>`, `net-label kind-${n.kind}`, tip);
      lab.position.copy(pos.get(n.id)).add(new THREE.Vector3(0, st.r + 3, 0));
      g.add(lab);
      this.addLabel(reg, n.id, lab);
      this.registry.network.positions.set(n.id, pos.get(n.id));
    }
    for (const e of edges) {
      const a = pos.get(e.source); const b = pos.get(e.target);
      const strong = e.type === 'aspect' ? e.data.strength : e.type === 'star' ? e.data.strength : 0.4;
      const width = e.type === 'aspect' || e.type === 'star' ? 1.2 + 2.4 * strong : e.type === 'angle' || e.type === 'pattern' ? 1.6 : 1;
      const opacity = e.type === 'sign' || e.type === 'house' || e.type === 'rules' ? 0.3 : 0.45 + 0.5 * strong;
      const line = fatLine([a, b], new THREE.Color(e.color), { width, dash: e.dash, opacity });
      line.userData.edgeType = e.type;
      g.add(line);
      this.register(reg, 'edge', e.id, line, { pick: 'edge' });
    }
  }

  // --- view state -----------------------------------------------------------

  setMode(mode, keepCamera = false) {
    const prev = this.mode;
    this.mode = mode;
    for (const [k, g] of Object.entries(this.groups)) g.visible = k === mode;
    if (!keepCamera || prev !== mode || !this.cameraInit) this.resetView();
    this.applySelection();
  }

  resetView() {
    this.cameraInit = true;
    this.flight = null;
    const c = this.controls;
    if (this.mode === 'sky') {
      this.camera.fov = 75;
      this.camera.near = 0.01;
      this.camera.position.set(0, 0, 0);
      // look toward the equator-facing horizon, 25° up
      const south = (this.model?.ctx.lat ?? 0) >= 0;
      const dir = new THREE.Vector3(0, Math.sin(25 * DEG), (south ? 1 : -1) * Math.cos(25 * DEG));
      // Camera sits a hair behind the origin and orbits it: effectively looking around from Earth's centre.
      c.target.set(0, 0, 0);
      this.camera.position.copy(dir.multiplyScalar(-0.01));
      c.enableZoom = false;
      c.enablePan = false;
      c.rotateSpeed = -0.35;
      c.minDistance = 0.01; c.maxDistance = 0.01;
    } else {
      this.camera.fov = 45;
      this.camera.near = 0.5;
      c.target.set(0, 0, 0);
      if (this.mode === 'wheel') this.camera.position.set(0, 300, 120);
      else this.camera.position.set(0, 120, 230);
      c.enableZoom = true;
      c.enablePan = true;
      c.rotateSpeed = 0.7;
      c.minDistance = 20; c.maxDistance = 900;
    }
    this.camera.updateProjectionMatrix();
    c.update();
    this.updateStarScale();
  }

  setLayers(layers) { this.layers = { ...layers }; this.applyLayers(); }
  setEdgeFilters(filters) { this.edgeFilters = { ...filters }; this.applySelection(); }

  applyLayers() {
    const L = this.layers;
    for (const g of Object.values(this.groups)) {
      g.traverse((o) => {
        const layer = o.userData.layer;
        if (!layer) return;
        if (layer === 'allFixedStars') o.visible = L.allFixedStars !== false && L.fixedStars !== false;
        else if (layer === 'skyAspects') o.visible = L.skyAspects === true && L.aspects !== false;
        else if (layer === 'ground') o.visible = L.ground !== false;
        else o.visible = L[layer] !== false;
      });
    }
    this.container.classList.toggle('hide-labels', L.labels === false);
  }

  select(id) {
    this.selected = id;
    this.applySelection();
  }

  applySelection() {
    if (!this.model) return;
    const reg = this.registry[this.mode];
    const id = this.selected;
    const filters = this.edgeFilters;
    const related = id ? neighbours(this.model.graph, id, filters) : null;
    const relEdges = id ? new Set(edgesFor(this.model.graph, id, filters).map((e) => e.id)) : null;
    for (const [nid, objs] of reg.nodes) {
      const on = !related || related.has(nid);
      for (const o of objs) if (o.material) o.material.opacity = (o.userData.baseOpacity ?? 1) * (on ? 1 : 0.12);
    }
    for (const [eid, objs] of reg.edges) {
      const e = this.model.graph.edgeById.get(eid);
      const typeOn = !e || filters[e.type] !== false;
      const on = typeOn && (!relEdges || relEdges.has(eid));
      for (const o of objs) {
        o.material.opacity = (o.userData.baseOpacity ?? 1) * (on ? (relEdges ? 1.3 : 1) : (typeOn ? 0.05 : 0));
        o.userData.filteredOut = !typeOn;
        o.material.visible = typeOn;
      }
    }
    for (const [lid, labs] of reg.labels) {
      const on = !related || related.has(lid);
      for (const l of labs) {
        l.element.classList.toggle('dim', !on);
        l.element.classList.toggle('selected', lid === id);
      }
    }
    const sp = reg.starPoints;
    if (sp) sp.material.uniforms.dim.value = id ? 0.45 : 1;
  }

  focus(id) {
    const p = this.registry[this.mode].positions.get(id);
    if (!p) return false;
    const world = p.clone().applyMatrix4(this.groups[this.mode].matrixWorld);
    if (this.mode === 'sky') {
      const to = world.clone().normalize().multiplyScalar(-0.01);
      this.flight = { kind: 'sky', from: this.camera.position.clone(), to, t: 0 };
    } else {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      const dist = Math.min(this.camera.position.distanceTo(this.controls.target), 170);
      this.flight = { kind: 'orbit', fromT: this.controls.target.clone(), toT: world, fromP: this.camera.position.clone(), toP: world.clone().add(dir.multiplyScalar(dist)), t: 0 };
    }
    if (this.reducedMotion && this.flight) this.flight.t = 0.999;
    return true;
  }

  zoom(factor) {
    if (this.mode === 'sky') {
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov * factor, 15, 110);
      this.camera.updateProjectionMatrix();
      this.updateStarScale();
    } else {
      const off = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
      this.camera.position.copy(this.controls.target).add(off);
    }
  }

  updateStarScale() {
    const h = this.renderer.domElement.clientHeight || 800;
    for (const mode of ['wheel', 'sky']) {
      const sp = this.registry[mode].starPoints;
      if (!sp) continue;
      const k = mode === 'sky' ? (75 / this.camera.fov) * 1.4 : 0.8;
      sp.material.uniforms.scale.value = k * (h / 900) * this.renderer.getPixelRatio();
    }
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const g of Object.values(this.groups)) g.traverse((o) => { if (o.material?.isLineMaterial) o.material.resolution.set(w, h); });
    this.updateStarScale();
  }

  frame() {
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + 0.035);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      if (f.kind === 'sky') this.camera.position.lerpVectors(f.from, f.to, e).normalize().multiplyScalar(0.01);
      else { this.controls.target.lerpVectors(f.fromT, f.toT, e); this.camera.position.lerpVectors(f.fromP, f.toP, e); }
      if (f.t >= 1) this.flight = null;
    }
    this.controls.update();
    if (this.hoverPending) {
      const { x, y } = this.hoverPending;
      this.hoverPending = null;
      const hit = this.pick(x, y);
      this.onHover(hit, x, y);
      this.renderer.domElement.style.cursor = hit?.id ? 'pointer' : '';
    }
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

export { EDGE_TYPES };
