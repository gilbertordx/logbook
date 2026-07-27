/**
 * LOGBOOK — Dropdown HTML Generators
 * Single responsibility: produce <option> HTML strings for selects.
 * Pure functions — no state mutations, no DOM queries, no side effects.
 */

import { ANATOMICAL_DISCOMFORT_MAP, DEFAULT_DISCOMFORT_OPTIONS } from '../config/constants.js';

/* ── KG select ─────────────────────────────────────────────────────── */

/**
 * Generates <option> HTML for a weight (kg) select.
 * Shows a focused window ±2 steps around the current value; expands on demand.
 *
 * @param {string} category       CABLE | DUMBBELL | ASSISTED | other
 * @param {number} selectedVal    currently selected kg
 * @param {number} exIdx          exercise index (for unique key)
 * @param {number} setIdx         set index (for unique key)
 * @param {object} expandedKgSet  state.expandedKgSet
 * @returns {string}
 */
export function generateKgOptions(category, selectedVal, exIdx, setIdx, expandedKgSet) {
  const key        = `${exIdx}_${setIdx}`;
  const isExpanded = expandedKgSet[key];

  let fullList = [];
  let step     = 2.5;

  if (category === 'CABLE') {
    step = 5;
    for (let w = 5;   w <= 120; w += 5)   fullList.push(w);
  } else if (category === 'DUMBBELL') {
    step = 2;
    for (let w = 2;   w <= 60;  w += 2)   fullList.push(w);
  } else if (category === 'ASSISTED') {
    step = 5;
    for (let w = 0;   w <= 50;  w += 5)   fullList.push(w);
  } else {
    step = 2.5;
    for (let w = 2.5; w <= 150; w += 2.5) fullList.push(w);
  }

  const opt = (w) => `<option value="${w}" ${w === selectedVal ? 'selected' : ''}>${w} KG</option>`;

  if (isExpanded) {
    return fullList.map(opt).join('') + `<option value="__LESS__">[COLLAPSE]</option>`;
  }

  const center  = selectedVal || 30;
  const minVal  = category === 'ASSISTED' ? 0 : step;
  let focused   = [
    center - step * 2,
    center - step,
    center,
    center + step,
    center + step * 2,
  ].filter(w => w >= minVal);

  if (!focused.includes(selectedVal) && selectedVal > 0) {
    focused.push(selectedVal);
    focused.sort((a, b) => a - b);
  }

  return focused.map(opt).join('') + `<option value="__MORE__">[+ MORE]</option>`;
}

/* ── REPS select ───────────────────────────────────────────────────── */

/**
 * Generates <option> HTML for a reps select.
 * @param {number} selectedVal
 * @param {number} exIdx
 * @param {number} setIdx
 * @param {object} expandedRepsSet  state.expandedRepsSet
 * @returns {string}
 */
export function generateRepsOptions(selectedVal, exIdx, setIdx, expandedRepsSet) {
  const key        = `${exIdx}_${setIdx}`;
  const isExpanded = expandedRepsSet[key];
  const opt        = (r) => `<option value="${r}" ${r === selectedVal ? 'selected' : ''}>${r} REPS</option>`;

  if (isExpanded) {
    let html = '';
    for (let r = 1; r <= 20; r++) html += opt(r);
    return html + `<option value="__LESS__">[COLLAPSE]</option>`;
  }

  const center = selectedVal || 5;
  let focused  = center <= 5
    ? [3, 4, 5, 6, 7]
    : [center - 2, center - 1, center, center + 1, center + 2].filter(r => r >= 1);

  if (!focused.includes(selectedVal) && selectedVal > 0) {
    focused.push(selectedVal);
    focused.sort((a, b) => a - b);
  }

  return focused.map(opt).join('') + `<option value="__MORE__">[+ MORE]</option>`;
}

/* ── SHRUG REPS select ─────────────────────────────────────────────── */

/**
 * Generates <option> HTML for the shrug-reps select (+0 to +3 default).
 * @param {number} selectedVal
 * @param {number} exIdx
 * @param {number} setIdx
 * @param {object} expandedShrugSet  state.expandedShrugSet
 * @returns {string}
 */
export function generateShrugRepsOptions(selectedVal, exIdx, setIdx, expandedShrugSet) {
  const key        = `${exIdx}_${setIdx}`;
  const isExpanded = expandedShrugSet[key];
  const label      = (r) => r === 0 ? '+0 SHRUGS' : `+${r} SHRUGS`;
  const opt        = (r) => `<option value="${r}" ${r === selectedVal ? 'selected' : ''}>${label(r)}</option>`;

  if (isExpanded) {
    let html = '';
    for (let r = 0; r <= 10; r++) html += opt(r);
    return html + `<option value="__LESS__">[COLLAPSE]</option>`;
  }

  let focused = [0, 1, 2, 3];
  if (!focused.includes(selectedVal) && selectedVal > 0) {
    focused.push(selectedVal);
    focused.sort((a, b) => a - b);
  }

  return focused.map(opt).join('') + `<option value="__MORE__">[+ MORE]</option>`;
}

/* ── DISCOMFORT select ─────────────────────────────────────────────── */

/**
 * Generates <option> HTML for the anatomical discomfort select.
 * @param {string} exName       exercise name (used to look up the correct map)
 * @param {string} selectedVal
 * @returns {string}
 */
export function generateDiscomfortOptions(exName, selectedVal) {
  const map = ANATOMICAL_DISCOMFORT_MAP[exName.toUpperCase()] || DEFAULT_DISCOMFORT_OPTIONS;
  return map
    .map(d => {
      const label = d === 'NO DISCOMFORT' ? '[0 DISCOMFORT]' : `[!] ${d}`;
      return `<option value="${d}" ${d === selectedVal ? 'selected' : ''}>${label}</option>`;
    })
    .join('');
}
