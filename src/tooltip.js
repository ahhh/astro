// Tooltip system. Any element with data-tip gets an explanatory tooltip on
// hover, keyboard focus, or tap. Values:
//   data-tip="g:key"        → glossary entry
//   data-tip="prefix:arg"   → a registered resolver (obj:, edge:, sign:, house:, con:, …)
//   anything else           → shown as plain text
// The 3D scene calls show()/hide() directly with computed HTML.

import { glossaryHtml } from './interpret.js';

const resolvers = new Map();
let tipEl;
let anchor = null;
let timer = null;
let pinned = false;
let lastPointer = { x: 0, y: 0 };

export function registerTip(prefix, fn) { resolvers.set(prefix, fn); }

export function resolveTip(spec) {
  if (!spec) return null;
  const i = spec.indexOf(':');
  if (i > 0) {
    const prefix = spec.slice(0, i);
    const arg = spec.slice(i + 1);
    if (prefix === 'g') return glossaryHtml(arg);
    const fn = resolvers.get(prefix);
    if (fn) { try { return fn(arg); } catch (err) { console.warn('tip', spec, err); return null; } }
  }
  const div = document.createElement('div');
  div.textContent = spec;
  return `<div class="tip-body">${div.innerHTML}</div>`;
}

export function initTooltips() {
  tipEl = document.createElement('div');
  tipEl.id = 'tooltip';
  tipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(tipEl);

  const hasHover = window.matchMedia('(hover: hover)').matches;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.('[data-tip]');
    if (!el || el === anchor) return;
    anchor = el;
    clearTimeout(timer);
    timer = setTimeout(() => showFor(el, e.clientX, e.clientY), el.closest('.scene-label') ? 120 : 280);
  });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) return;
    if (el.contains(e.relatedTarget)) return;
    if (anchor === el) { anchor = null; clearTimeout(timer); if (!pinned) hide(); }
  });
  document.addEventListener('pointermove', (e) => {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (anchor && tipEl.classList.contains('show') && anchor.closest('.scene-label, svg')) place(e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el || e.target.matches?.('input[type=text], input[type=search], input[type=date], input[type=time], input[type=number]')) return;
    const r = el.getBoundingClientRect();
    anchor = el;
    showFor(el, r.left + r.width / 2, r.bottom);
  });
  document.addEventListener('focusout', () => { if (!pinned) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { pinned = false; hide(); } });

  // Touch: tapping an "info" target pins its tooltip; tapping elsewhere closes it.
  document.addEventListener('click', (e) => {
    const info = e.target.closest?.('.info');
    if (info || (!hasHover && e.target.closest?.('[data-tip]') && !e.target.closest('button, input, select, a, .scene-label, .list-row'))) {
      const el = info || e.target.closest('[data-tip]');
      e.preventDefault();
      pinned = true;
      anchor = el;
      const r = el.getBoundingClientRect();
      showFor(el, r.left + r.width / 2, r.bottom);
      return;
    }
    if (pinned && !e.target.closest('#tooltip')) { pinned = false; hide(); }
  });
}

function showFor(el, x, y) {
  const html = resolveTip(el.dataset.tip);
  if (!html) return;
  show(html, x, y);
}

export function show(html, x, y) {
  tipEl.innerHTML = html;
  tipEl.classList.add('show');
  place(x ?? lastPointer.x, y ?? lastPointer.y);
}

export function hide() {
  tipEl?.classList.remove('show');
}

function place(x, y) {
  const pad = 14;
  const w = tipEl.offsetWidth;
  const h = tipEl.offsetHeight;
  let left = x + pad;
  let top = y + pad;
  if (left + w > window.innerWidth - 8) left = Math.max(8, x - w - pad);
  if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - pad);
  tipEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}
